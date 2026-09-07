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
  compendiums?: string[];
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
  compendiums?: string[];
  languages?: Array<{ lang: string; name?: string; path: string }>;
}

export interface LoadedAddon {
  name: string;
  type: 'addon' | 'ruleset';
  manifest: AddonManifest | RulesetManifest;
  loaded: boolean;
  error?: string;
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

  for (const entry of allEntries) {
    const { dir, manifest, type } = entry;
    const name = manifest.name ?? path.basename(dir);

    // Skip if explicitly disabled
    if (manifest.active === false) {
      logger.info(`[AddonLoader] Skipping disabled ${type}: ${name}`);
      loaded.push({ name, type, manifest, loaded: false, error: 'disabled' });
      continue;
    }

    // Skip if a declared dependency isn't active
    const missingDep = (manifest.dependencies ?? []).find((dep: string) => !activeNames.has(dep));
    if (missingDep) {
      logger.warn(`[AddonLoader] Skipping ${type} "${name}": missing dependency "${missingDep}"`);
      loaded.push({ name, type, manifest, loaded: false, error: `missing dependency: ${missingDep}` });
      continue;
    }

    // Skip if a declared conflict is active
    const foundConflict = (manifest.conflicts ?? []).find((c: string) => activeNames.has(c));
    if (foundConflict) {
      logger.warn(`[AddonLoader] Skipping ${type} "${name}": conflicts with active "${foundConflict}"`);
      loaded.push({ name, type, manifest, loaded: false, error: `conflicts with: ${foundConflict}` });
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
      loaded.push({ name, type, manifest, loaded: true });
      continue;
    }

    const entryPath = path.resolve(dir, manifest.core);
    const entryUrl = pathToFileURL(entryPath).href;

    try {
      await import(entryUrl);
      logger.info(`[AddonLoader] Loaded ${type}: ${name}`, { entry: entryPath, url: entryUrl });
      loaded.push({ name, type, manifest, loaded: true });
    } catch (err: any) {
      logger.error(`[AddonLoader] Failed to load ${type}: ${name}`, {
        entry: entryPath,
        url: entryUrl,
        error: err.message,
      });
      loaded.push({ name, type, manifest, loaded: false, error: err.message });
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
