/**
 * core/src/addons/loader.ts
 *
 * Scans marketplace/addons/ and marketplace/rulesets/ for manifests.
 * For each active entry that declares a "core" entry point, dynamically
 * imports and executes it. Errors in individual addons are caught and
 * logged — they never crash the core.
 */

import path from 'path';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import logger from '../utils/logger.js';

import { getDataRoot } from '../database/db.js';

// Root of the marketplace directory in DataRoot (or project root in standalone Node dev)
const MARKETPLACE_ROOT = path.join(getDataRoot(), 'marketplace');
logger.info(`[AddonLoader] Using marketplace root: ${MARKETPLACE_ROOT}`);

export interface AddonManifest {
  name: string;
  title?: string;
  version?: string;
  author?: string;
  repository?: string;
  backgroundUrl?: string;
  coverUrl?: string;
  active?: boolean;   // default: true if absent
  core?: string;      // relative path to core entry point
  client?: string;    // relative path to client entry (informational only)
  mount?: string;     // optional DOM mount id
  signals?: string[];
  dependencies?: string[]; // names of other addons/rulesets that must be active
  conflicts?: string[];    // names of other addons/rulesets that must NOT be active
  settings?: Array<{
    key: string;
    type: 'string' | 'number' | 'boolean';
    default: string | number | boolean;
    label: string;
    hint?: string;
    scope: 'world' | 'client'; // v1: only 'world' scope is implemented
  }>;
  styles?: string[];  // array de paths relativos para arquivos CSS
  /** Cada item é um pack lido direto da fonte via compendium-source.ts
   * (browse read-only). Nunca copiado pro banco do mundo na ativação — só
   * quando 1 entry é materializada. String = caminho relativo a um `.sqlite`
   * local. Objeto = pack remoto (ver RemoteCompendiumSource). */
  compendiums?: CompendiumSourceDecl[];
  languages?: Array<{ lang: string; name?: string; path: string }>;
}

export interface RulesetManifest {
  name: string;
  title?: string;
  version?: string;
  author?: string;
  repository?: string;
  backgroundUrl?: string;
  coverUrl?: string;
  active?: boolean;
  core?: string;
  client?: string;
  signals?: string[];
  dependencies?: string[];
  conflicts?: string[];
  styles?: string[];  // array de paths relativos para arquivos CSS
  compendiums?: CompendiumSourceDecl[];
  languages?: Array<{ lang: string; name?: string; path: string }>;
}

/** Pack hospedado por terceiro (ex: editora vendendo um módulo pago), sem
 * arquivo local nenhum. `apiUrl` deve responder ao contrato PostgREST
 * (tabelas/views `pack_meta` e `entries`) — o próprio REST automático do
 * Supabase serve isso sem código extra do lado da editora. A credencial
 * NUNCA fica no manifest: só o nome da env var lida no servidor de quem
 * instala o addon (ver memory: project_compendio_arquitetura_2026_09_08). */
export interface RemoteCompendiumSource {
  type: 'remote';
  apiUrl: string;
  apiKeyEnvVar: string;
}

export type CompendiumSourceDecl = string | RemoteCompendiumSource;

/** Chaves de API de fonte remota (Postgres/Supabase de terceiro), lidas do
 * `process.env` UMA vez aqui e depois apagadas de lá (ver scrubRemoteApiKeys)
 * — depois desse ponto, nenhum addon carregado (nem os que ainda vão ser
 * importados) consegue ler essas env vars, só compendium-source.ts via
 * getScrubbedEnvVar. Não é isolamento de processo de verdade (todo addon
 * ainda roda no mesmo processo do servidor), mas fecha o vazamento direto
 * de `process.env` entre addons pra esse caso específico. */
const scrubbedEnv = new Map<string, string>();

export function getScrubbedEnvVar(name: string): string | undefined {
  return scrubbedEnv.get(name);
}

/** Chamado ANTES de importar o `core` de qualquer addon (allEntries só tem
 * manifests lidos como JSON até esse ponto — nenhum addon rodou código
 * ainda). */
function scrubRemoteApiKeys(entries: Array<{ manifest: any }>): void {
  for (const entry of entries) {
    const compendiums = entry.manifest.compendiums as CompendiumSourceDecl[] | undefined;
    if (!compendiums) continue;
    for (const decl of compendiums) {
      if (typeof decl === 'string' || decl.type !== 'remote') continue;
      const value = process.env[decl.apiKeyEnvVar];
      if (value === undefined) continue;
      scrubbedEnv.set(decl.apiKeyEnvVar, value);
      delete process.env[decl.apiKeyEnvVar];
    }
  }
}

export interface LoadedAddon {
  name: string;
  type: 'addon' | 'ruleset';
  manifest: AddonManifest | RulesetManifest;
  loaded: boolean;
  error?: string;
  /** Diretório absoluto do addon/ruleset — usado por compendium-source.ts pra
   * resolver `manifest.compendiums` (caminhos relativos a arquivos `.sqlite`). */
  dir?: string;
}

/**
 * Reads all addon.json / ruleset.json files from the marketplace.
 * Returns their parsed manifests alongside directory path.
 */
async function scanManifests(
  subdir: 'addons' | 'rulesets',
  filename: 'addon.json' | 'ruleset.json'
): Promise<Array<{ dir: string; manifest: any }>> {
  const results: Array<{ dir: string; manifest: any }> = [];
  const marketDir = path.join(MARKETPLACE_ROOT, subdir);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(marketDir);
    logger.debug(`[AddonLoader] Found ${entries.length} entries in ${marketDir}`);
  } catch {
    logger.warn(`[AddonLoader] Marketplace ${subdir} directory not found`, { marketDir });
    return results;
  }

  for (const entry of entries) {
    const manifestPath = path.join(marketDir, entry, filename);
    logger.debug(`[AddonLoader] Checking manifest: ${manifestPath}`);
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      results.push({ dir: path.join(marketDir, entry), manifest });
      logger.info(`[AddonLoader] Loaded ${filename}: ${entry}`);
    } catch (error) {
      logger.warn(`[AddonLoader] Failed to load ${manifestPath}:`, error as object);
    }
  }

  return results;
}

let _lastLoaded: LoadedAddon[] = [];

/**
 * Load all active addons and rulesets.
 * Returns a list of LoadedAddon records for the /api/addons endpoint.
 */
export async function loadAllAddons(): Promise<LoadedAddon[]> {
  const loaded: LoadedAddon[] = [];

  // Ensure marketplace directory and subdirectories exist
  try {
    await fs.mkdir(path.join(MARKETPLACE_ROOT, 'addons'), { recursive: true });
    await fs.mkdir(path.join(MARKETPLACE_ROOT, 'rulesets'), { recursive: true });
  } catch (err: any) {
    logger.error('Failed to create marketplace directories', { error: err.message });
  }

  const addonEntries = await scanManifests('addons', 'addon.json');
  const rulesetEntries = await scanManifests('rulesets', 'ruleset.json');

  const allEntries: Array<{ dir: string; manifest: any; type: 'addon' | 'ruleset' }> = [
    ...addonEntries.map(e => ({ ...e, type: 'addon' as const })),
    ...rulesetEntries.map(e => ({ ...e, type: 'ruleset' as const })),
  ];

  const activeNames = new Set(
    allEntries.filter(e => e.manifest.active !== false).map(e => e.manifest.name ?? path.basename(e.dir)),
  );

  // Captura e apaga as env vars remotas ANTES de importar código de qualquer
  // addon — depois desse ponto elas não existem mais em process.env.
  scrubRemoteApiKeys(allEntries);

  for (const entry of allEntries) {
    const { dir, manifest, type } = entry;
    const name = manifest.name ?? path.basename(dir);

    // Skip if explicitly disabled
    if (manifest.active === false) {
      logger.info(`[AddonLoader] Skipping disabled ${type}: ${name}`);
      loaded.push({ name, type, manifest, loaded: false, error: 'disabled', dir });
      continue;
    }

    // Skip if a declared dependency isn't active
    const missingDep = (manifest.dependencies ?? []).find((dep: string) => !activeNames.has(dep));
    if (missingDep) {
      logger.warn(`[AddonLoader] Skipping ${type} "${name}": missing dependency "${missingDep}"`);
      loaded.push({ name, type, manifest, loaded: false, error: `missing dependency: ${missingDep}`, dir });
      continue;
    }

    // Skip if a declared conflict is active
    const foundConflict = (manifest.conflicts ?? []).find((c: string) => activeNames.has(c));
    if (foundConflict) {
      logger.warn(`[AddonLoader] Skipping ${type} "${name}": conflicts with active "${foundConflict}"`);
      loaded.push({ name, type, manifest, loaded: false, error: `conflicts with: ${foundConflict}`, dir });
      continue;
    }

    // Rulesets never run server-side code — de forma estrutural, não só por
    // convenção do scaffold. Um "core" em ruleset.json roda no MESMO processo
    // Node do servidor (process.env, db, filesystem) sem sandbox nenhum;
    // sistemas de terceiro não devem ter esse alcance. Lógica de sistema
    // (rolls, automação, sheet) roda 100% client-side via window.Loom/SDK,
    if (type === 'ruleset' && manifest.core) {
      logger.warn(`[AddonLoader] Ruleset "${name}" declara "core" — ignorado por segurança (rulesets rodam só client-side).`);
    }

    // No core entry point (ou ruleset com core ignorado acima) — client-only, ainda listado
    if (!manifest.core || type === 'ruleset') {
      logger.debug(`[AddonLoader] ${type} "${name}" has no core entry — skipping execution`);
      loaded.push({ name, type, manifest, loaded: true, dir });
      continue;
    }

    const entryPath = path.resolve(dir, manifest.core);
    const entryUrl = pathToFileURL(entryPath).href;

    try {
      await import(entryUrl);
      logger.info(`[AddonLoader] Loaded ${type}: ${name}`, { entry: entryPath, url: entryUrl });
      loaded.push({ name, type, manifest, loaded: true, dir });
    } catch (err: any) {
      logger.error(`[AddonLoader] Failed to load ${type}: ${name}`, {
        entry: entryPath,
        url: entryUrl,
        error: err.message,
      });
      loaded.push({ name, type, manifest, loaded: false, error: err.message, dir });
    }
  }

  _lastLoaded = loaded;
  return loaded;
}

/**
 * Return the last loaded addons list (no rescan).
 */
export function getLoadedAddons(): LoadedAddon[] {
  return _lastLoaded;
}
