/*******************************************************************************
 * LoomVTT
 * server/applications/addons/compendium-source.ts
 *
 *
 * Read-only access to compendium packs shipped by addons/rulesets as `.sqlite`
 * files. Never copied into a world's own database on activation — browsing
 * reads straight from the source file. Materializing a single entry into a
 * world (drag into world) is the only path that writes anything, and it
 * writes one row, not the whole pack. See memory:
 * project_compendio_arquitetura_2026_09_08 for the reasoning.
 ******************************************************************************/

import knex, { Knex } from 'knex';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { getLoadedAddons, getScrubbedEnvVar, type RemoteCompendiumSource } from './loader.js';

export interface SourcePackMeta {
  sourceId: string;
  name: string;
  type: string;
  ownerName: string;   // addon/ruleset name that ships this pack
  ownerType: 'addon' | 'ruleset';
  sourceKind: 'local' | 'remote';
  filePath?: string;   // só 'local'
  apiUrl?: string;      // só 'remote'
}

export interface SourceEntrySummary {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  imgUrl: string;
}

export interface SourceEntry extends SourceEntrySummary {
  data: any;
}

const connections = new Map<string, Knex>();

function getConnection(filePath: string): Knex {
  let conn = connections.get(filePath);
  if (conn) return conn;
  conn = knex({
    client: 'better-sqlite3',
    connection: { filename: filePath },
    useNullAsDefault: true,
  });
  connections.set(filePath, conn);
  return conn;
}

/** Fecha e descarta todas as conexões abertas (ex: ao recarregar addons). */
export async function closeAllSources(): Promise<void> {
  for (const conn of connections.values()) {
    try { await conn.destroy(); } catch { /* ignore */ }
  }
  connections.clear();
}

type ResolvedSource =
  | { kind: 'local'; ownerName: string; filePath: string }
  | { kind: 'remote'; ownerName: string; apiUrl: string; apiKey: string };

function buildSourceId(kind: 'local' | 'remote', ownerName: string, key: string): string {
  return `${kind}::${ownerName}::${key}`;
}

/** Headers do contrato PostgREST — Supabase aceita `apikey` + `Authorization`
 * com o mesmo token. */
function remoteHeaders(apiKey: string): Record<string, string> {
  return { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
}

/** A chave da editora só pode viajar em HTTPS — em texto claro, qualquer um na
 * rede entre nós e o backend deles intercepta a chave (e a partir daí, tudo
 * que ela dá acesso). Bloqueia a fonte inteira em vez de arriscar 1 request. */
function assertSecureApiUrl(apiUrl: string): void {
  if (!apiUrl.startsWith('https://')) {
    throw new Error(`apiUrl remoto precisa ser https:// (recebido: ${apiUrl})`);
  }
}

async function readRemoteMeta(apiUrl: string, apiKey: string): Promise<{ name: string; type: string } | null> {
  const res = await fetch(`${apiUrl}/pack_meta?select=name,type&limit=1`, { headers: remoteHeaders(apiKey) });
  if (!res.ok) throw new Error(`pack_meta HTTP ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

/** Lista todos os packs disponíveis nos addons/rulesets carregados atualmente ativos.
 * Fontes locais: cada uma é um arquivo `.sqlite` distinto — nunca lido inteiro
 * na listagem, só a tabela `pack_meta` (1 linha). Fontes remotas: 1 request
 * leve por pack no endpoint REST declarado no manifest. */
export async function listSourcePacks(): Promise<SourcePackMeta[]> {
  const results: SourcePackMeta[] = [];
  const loaded = getLoadedAddons();

  for (const entry of loaded) {
    if (!entry.loaded) continue;
    const compendiums = (entry.manifest as any).compendiums as Array<string | RemoteCompendiumSource> | undefined;
    if (!compendiums || compendiums.length === 0) continue;

    const baseDir = (entry as any).dir as string | undefined;

    for (let i = 0; i < compendiums.length; i++) {
      const decl = compendiums[i];

      if (typeof decl === 'string') {
        if (!baseDir) continue;
        const filePath = path.resolve(baseDir, decl);
        if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath)) {
          logger.warn(`[CompendiumSource] Pack não encontrado: ${decl}`, { owner: entry.name });
          continue;
        }
        try {
          const conn = getConnection(filePath);
          const meta = await conn('pack_meta').first();
          if (!meta) {
            logger.warn(`[CompendiumSource] pack_meta ausente/vazio em ${filePath}`);
            continue;
          }
          results.push({
            sourceId: buildSourceId('local', entry.name, decl),
            name: meta.name,
            type: meta.type,
            ownerName: entry.name,
            ownerType: entry.type,
            sourceKind: 'local',
            filePath,
          });
        } catch (err: any) {
          logger.error(`[CompendiumSource] Falha ao ler pack ${filePath}`, { error: err.message });
        }
        continue;
      }

      // decl.type === 'remote'
      const apiKey = getScrubbedEnvVar(decl.apiKeyEnvVar);
      if (!apiKey) {
        logger.warn(`[CompendiumSource] Env var ${decl.apiKeyEnvVar} ausente pra pack remoto`, { owner: entry.name });
        continue;
      }
      try {
        assertSecureApiUrl(decl.apiUrl);
        const meta = await readRemoteMeta(decl.apiUrl, apiKey);
        if (!meta) {
          logger.warn(`[CompendiumSource] pack_meta ausente/vazio em ${decl.apiUrl}`);
          continue;
        }
        results.push({
          sourceId: buildSourceId('remote', entry.name, String(i)),
          name: meta.name,
          type: meta.type,
          ownerName: entry.name,
          ownerType: entry.type,
          sourceKind: 'remote',
          apiUrl: decl.apiUrl,
        });
      } catch (err: any) {
        logger.error(`[CompendiumSource] Falha ao ler pack remoto ${decl.apiUrl}`, { error: err.message });
      }
    }
  }

  return results;
}

async function resolveSource(sourceId: string): Promise<ResolvedSource | null> {
  const parts = sourceId.split('::');
  if (parts.length !== 3) return null;
  const [kind, ownerName, key] = parts;

  const loaded = getLoadedAddons();
  const entry = loaded.find(e => e.name === ownerName);
  if (!entry) return null;

  if (kind === 'local') {
    const baseDir = (entry as any).dir as string | undefined;
    if (!baseDir) return null;
    const filePath = path.resolve(baseDir, key);
    if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath)) return null;
    return { kind: 'local', ownerName, filePath };
  }

  if (kind === 'remote') {
    const compendiums = (entry.manifest as any).compendiums as Array<string | RemoteCompendiumSource> | undefined;
    const decl = compendiums?.[Number(key)];
    if (!decl || typeof decl === 'string') return null;
    const apiKey = process.env[decl.apiKeyEnvVar];
    if (!apiKey) return null;
    assertSecureApiUrl(decl.apiUrl);
    return { kind: 'remote', ownerName, apiUrl: decl.apiUrl, apiKey };
  }

  return null;
}

export async function getSourcePackMeta(sourceId: string): Promise<SourcePackMeta | null> {
  const resolved = await resolveSource(sourceId);
  if (!resolved) return null;

  if (resolved.kind === 'local') {
    const conn = getConnection(resolved.filePath);
    const meta = await conn('pack_meta').first();
    if (!meta) return null;
    return {
      sourceId,
      name: meta.name,
      type: meta.type,
      ownerName: resolved.ownerName,
      ownerType: 'addon',
      sourceKind: 'local',
      filePath: resolved.filePath,
    };
  }

  const meta = await readRemoteMeta(resolved.apiUrl, resolved.apiKey);
  if (!meta) return null;
  return {
    sourceId,
    name: meta.name,
    type: meta.type,
    ownerName: resolved.ownerName,
    ownerType: 'addon',
    sourceKind: 'remote',
    apiUrl: resolved.apiUrl,
  };
}

/** Listagem leve — sem `data` — pra popular a lista de entries sem carregar o
 * payload mecânico de cada uma. */
export async function querySourceEntries(sourceId: string, opts?: { search?: string }): Promise<SourceEntrySummary[]> {
  const resolved = await resolveSource(sourceId);
  if (!resolved) return [];

  if (resolved.kind === 'local') {
    const conn = getConnection(resolved.filePath);
    const query = conn('entries').select('id', 'name', 'type', 'sortOrder', 'imgUrl').orderBy('sortOrder', 'asc');
    if (opts?.search) query.whereILike('name', `%${opts.search}%`);
    return query;
  }

  const params = new URLSearchParams({ select: 'id,name,type,sortOrder,imgUrl', order: 'sortOrder.asc' });
  if (opts?.search) params.set('name', `ilike.*${opts.search}*`);
  const res = await fetch(`${resolved.apiUrl}/entries?${params}`, { headers: remoteHeaders(resolved.apiKey) });
  if (!res.ok) throw new Error(`entries HTTP ${res.status}`);
  return res.json();
}

export async function getSourceEntry(sourceId: string, entryId: string): Promise<SourceEntry | null> {
  const resolved = await resolveSource(sourceId);
  if (!resolved) return null;

  if (resolved.kind === 'local') {
    const conn = getConnection(resolved.filePath);
    const row = await conn('entries').where({ id: entryId }).first();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      sortOrder: row.sortOrder,
      imgUrl: row.imgUrl,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {}),
    };
  }

  const params = new URLSearchParams({ select: '*', id: `eq.${entryId}`, limit: '1' });
  const res = await fetch(`${resolved.apiUrl}/entries?${params}`, { headers: remoteHeaders(resolved.apiKey) });
  if (!res.ok) throw new Error(`entries HTTP ${res.status}`);
  const rows = await res.json();
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sortOrder: row.sortOrder,
    imgUrl: row.imgUrl,
    data: row.data ?? {},
  };
}
