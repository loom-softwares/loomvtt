/*******************************************************************************
 * LoomVTT
 * server/applications/addons/compendium-source.ts
 *
 *
 * Compendium packs shipped by addons/rulesets as `.sqlite` files — the pack
 * itself is a real read/write database, mirroring how a Foundry system/module
 * LevelDB works: one shared file, never duplicated per world. `pack_meta.locked`
 * (default true) gates writes — a GM must unlock a pack before editing its
 * entries, and since the lock lives IN the file (not in any per-world table),
 * unlocking is a property of the pack, not of who unlocked it or from where.
 * An edit lands in the same file every world using that addon/ruleset reads,
 * so it's visible everywhere immediately — that's intentional, not a bug.
 *
 * Browsing/dragging a single entry onto a world's actor sheet still never
 * touches this file (that path copies the entry's data into the actor, see
 * `server/applications/api/compendium.ts`'s `/import` route) — the write path
 * added here is specifically for editing the SOURCE pack in place.
 ******************************************************************************/

import knex, { Knex } from 'knex';
import { randomUUID } from 'crypto';
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
  /** Só packs locais podem ser editados — remoto é a API de terceiro, sempre `true`. */
  locked: boolean;
}

export interface SourceEntrySummary {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  imgUrl: string;
  folderId: string;
}

export interface SourceEntry extends SourceEntrySummary {
  data: any;
}

export interface SourceFolder {
  id: string;
  name: string;
  parent: string;
  color: string;
  sorting: string;
}

const connections = new Map<string, Knex>();
/** Arquivos cuja coluna `locked` já foi conferida/criada nesta execução do
 * processo — evita repetir `hasColumn` a cada request pro mesmo pack. */
const lockColumnEnsured = new Set<string>();

/** Self-heal: os primeiros `.sqlite` gerados por `build-compendium-pack.mjs`
 * não tinham `locked` em `pack_meta` (a feature não existia ainda). Em vez de
 * exigir reconversão de todo pack já instalado, a própria leitura da conexão
 * garante a coluna, com default `true` (trava por padrão — nunca destrava um
 * pack existente sozinho). */
async function ensureLockColumn(conn: Knex, filePath: string): Promise<void> {
  if (lockColumnEnsured.has(filePath)) return;
  const has = await conn.schema.hasColumn('pack_meta', 'locked');
  if (!has) {
    await conn.schema.alterTable('pack_meta', (t) => {
      t.boolean('locked').notNullable().defaultTo(true);
    });
  }
  lockColumnEnsured.add(filePath);
}

/** Idem, mas para pastas: os packs anteriores não tinham nem a tabela `folders`
 * nem a coluna `entries.folderId` (a feature não existia). Estrutura mínima
 * pra organizar entries dentro do PRÓPRIO pack — não a tabela `folders` do
 * banco central (essa é por mundo; o pack não pertence a nenhum). Espelha
 * `folders.schema.ts` menos `worldId`/`type`: aqui o pack já é o escopo, e só
 * existe um tipo de conteúdo por pack. */
const folderSchemaEnsured = new Set<string>();

async function ensureFolderSchema(conn: Knex, filePath: string): Promise<void> {
  if (folderSchemaEnsured.has(filePath)) return;

  const hasFoldersTable = await conn.schema.hasTable('folders');
  if (!hasFoldersTable) {
    await conn.schema.createTable('folders', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('parent').notNullable().defaultTo('');
      t.string('color').notNullable().defaultTo('');
      t.string('sorting').notNullable().defaultTo('m');
    });
  }

  const hasFolderIdColumn = await conn.schema.hasColumn('entries', 'folderId');
  if (!hasFolderIdColumn) {
    await conn.schema.alterTable('entries', (t) => {
      t.string('folderId').notNullable().defaultTo('');
    });
  }

  folderSchemaEnsured.add(filePath);
}

async function getConnection(filePath: string): Promise<Knex> {
  let conn = connections.get(filePath);
  if (!conn) {
    conn = knex({
      client: 'better-sqlite3',
      connection: { filename: filePath },
      useNullAsDefault: true,
    });
    connections.set(filePath, conn);
  }
  await ensureLockColumn(conn, filePath);
  await ensureFolderSchema(conn, filePath);
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
          const conn = await getConnection(filePath);
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
            locked: !!meta.locked,
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
          locked: true,
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
    const conn = await getConnection(resolved.filePath);
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
      locked: !!meta.locked,
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
    locked: true,
  };
}

/** Listagem leve — sem `data` — pra popular a lista de entries sem carregar o
 * payload mecânico de cada uma. */
export async function querySourceEntries(sourceId: string, opts?: { search?: string }): Promise<SourceEntrySummary[]> {
  const resolved = await resolveSource(sourceId);
  if (!resolved) return [];

  if (resolved.kind === 'local') {
    const conn = await getConnection(resolved.filePath);
    const query = conn('entries').select('id', 'name', 'type', 'sortOrder', 'imgUrl', 'folderId').orderBy('sortOrder', 'asc');
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
    const conn = await getConnection(resolved.filePath);
    const row = await conn('entries').where({ id: entryId }).first();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      sortOrder: row.sortOrder,
      imgUrl: row.imgUrl,
      folderId: row.folderId ?? '',
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
    // Fontes remotas não têm o esquema de pastas local (não é o `.sqlite` que
    // o self-heal alcança) — sempre soltas, na raiz.
    folderId: '',
    data: row.data ?? {},
  };
}

/** Trava/destrava o pack IN PLACE (`pack_meta.locked`, direto no `.sqlite`
 * compartilhado) — nunca num registro por mundo. Só packs locais têm cadeado;
 * fonte remota nunca é gravável por aqui. Devolve `false` se a fonte não
 * existir ou não for local — `true` se a escrita aconteceu. */
export async function setSourceLock(sourceId: string, locked: boolean): Promise<boolean> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return false;
  const conn = await getConnection(resolved.filePath);
  await conn('pack_meta').update({ locked });
  return true;
}

/** Edita UMA entry direto no `.sqlite` compartilhado. Chamado só depois do
 * caller já ter checado `pack_meta.locked === false` (ver rota em
 * `server/applications/api/compendium.ts`) — esta função não repete a
 * checagem pra não duplicar a fonte de verdade do gate. `patch` é parcial: só
 * os campos presentes são regravados. */
export async function updateSourceEntry(
  sourceId: string,
  entryId: string,
  patch: Partial<{ name: string; type: string; imgUrl: string; data: any }>,
): Promise<boolean> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return false;
  const conn = await getConnection(resolved.filePath);

  const update: Record<string, any> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.imgUrl !== undefined) update.imgUrl = patch.imgUrl;
  if (patch.data !== undefined) update.data = JSON.stringify(patch.data);
  if (Object.keys(update).length === 0) return true;

  const affected = await conn('entries').where({ id: entryId }).update(update);
  return affected > 0;
}

/** Pastas vivem na PRÓPRIA `.sqlite` do pack (tabela `folders`, self-heal em
 * `ensureFolderSchema`) — mesma razão do cadeado: não é um registro por
 * mundo, é estrutura do pack compartilhado. As quatro funções abaixo
 * espelham `server/applications/api/folders.ts` (mundo) campo a campo, menos
 * `worldId`/`type` — aqui o pack já é o escopo e só tem um tipo de conteúdo.
 * Só fazem sentido pra fonte local; remota devolve `false`/`[]`/`null`. */

export async function listSourceFolders(sourceId: string): Promise<SourceFolder[]> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return [];
  const conn = await getConnection(resolved.filePath);
  return conn('folders').select('id', 'name', 'parent', 'color', 'sorting');
}

export async function createSourceFolder(
  sourceId: string,
  data: { name: string; parent?: string; color?: string },
): Promise<{ folder: SourceFolder | null; error?: string }> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return { folder: null, error: 'Compendium source not found or not editable.' };
  const conn = await getConnection(resolved.filePath);

  const name = data.name?.trim();
  if (!name) return { folder: null, error: 'Field "name" is required.' };

  const parent = data.parent || '';
  if (parent) {
    const parentFolder = await conn('folders').where({ id: parent }).first();
    if (!parentFolder) return { folder: null, error: 'Parent folder not found.' };
  }

  const folder: SourceFolder = { id: randomUUID(), name, parent, color: data.color || '', sorting: 'm' };
  await conn('folders').insert(folder);
  return { folder };
}

export async function updateSourceFolder(
  sourceId: string,
  folderId: string,
  patch: { name?: string; parent?: string; color?: string },
): Promise<{ folder: SourceFolder | null; error?: string }> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return { folder: null, error: 'Compendium source not found or not editable.' };
  const conn = await getConnection(resolved.filePath);

  const existing = await conn('folders').where({ id: folderId }).first();
  if (!existing) return { folder: null, error: 'Folder not found.' };

  const update: Record<string, any> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.color !== undefined) update.color = patch.color;
  // Mesma proteção de auto-referência de folders.ts:94 — direta (pra num
  // ciclo mais profundo, quem cria a pasta já não deveria poder escolher um
  // descendente como pai; fora de escopo aqui, igual está fora no original).
  if (patch.parent !== undefined && patch.parent !== folderId && patch.parent !== existing.parent) {
    if (patch.parent) {
      const parentFolder = await conn('folders').where({ id: patch.parent }).first();
      if (!parentFolder) return { folder: null, error: 'Parent folder not found.' };
    }
    update.parent = patch.parent;
  }

  if (Object.keys(update).length === 0) return { folder: existing as SourceFolder };
  await conn('folders').where({ id: folderId }).update(update);
  const updated = await conn('folders').where({ id: folderId }).first();
  return { folder: updated as SourceFolder };
}

export async function deleteSourceFolder(sourceId: string, folderId: string): Promise<boolean> {
  const resolved = await resolveSource(sourceId);
  if (!resolved || resolved.kind !== 'local') return false;
  const conn = await getConnection(resolved.filePath);

  const existing = await conn('folders').where({ id: folderId }).first();
  if (!existing) return false;

  // Mesmo padrão de folders.ts:117-146: reparenta filhos pro avô, solta as
  // entries que estavam nela (não apaga nada de conteúdo).
  await conn('folders').where({ parent: folderId }).update({ parent: existing.parent });
  await conn('entries').where({ folderId }).update({ folderId: '' });
  await conn('folders').where({ id: folderId }).delete();
  return true;
}
