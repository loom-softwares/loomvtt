/*******************************************************************************
 * LoomVTT
 * client/core/render-template.ts
 * 
 * 
 * Core utility for rendering Handlebars templates.
 ******************************************************************************/

import Handlebars from 'handlebars';
import { clog } from '../lib/client-logger.js';

/**
 * Client-side .loom template engine (browser) — used by
 * addons/rulesets to render Actor/Item sheets. Mirrors the global
 * `renderTemplate()` + `Handlebars.registerHelper()` API used by
 * converted RPG systems to facilitate porting existing sheets.
 *
 * Typical usage within a ruleset/addon:
 *   const html = await renderTemplate('/marketplace/rulesets/dnd5e/templates/actor-sheet.loom', actorData);
 *   container.innerHTML = html;
 */

const compileCache = new Map<string, HandlebarsTemplateDelegate>();
const sourceCache = new Map<string, Promise<string>>();

/**
 * Translates the legacy convention (`systems/<id>/...`, relative to the server's data root)
 * to the actual path where Loom serves rulesets (`/marketplace/rulesets/<id>/...`).
 * Also ensures that relative fetch paths resolve correctly.
 *
 * Templates for installed rulesets now use the `.hbs` extension natively.
 */
function resolvePath(path: string): string {
  const rulesetsResolved = path.replace(/^systems\/([^/]+)\//, '/marketplace/rulesets/$1/');
  const finalPath = rulesetsResolved.replace(/^modules\/([^/]+)\//, '/marketplace/addons/$1/');
  return finalPath.startsWith('/') ? finalPath : `/${finalPath}`;
}

async function fetchSource(path: string): Promise<string> {
  const resolvedPath = resolvePath(path);

  let pending = sourceCache.get(resolvedPath);
  if (!pending) {
    pending = fetch(resolvedPath).then((res) => {
      if (!res.ok) {
        const msg = `Failed to load "${resolvedPath}" (${res.status})`;
        clog.error(`[TEMPLATE] ${msg}`);
        throw new Error(`[renderTemplate] ${msg}`);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        const msg = `"${resolvedPath}" returned HTML (likely dev-server fallback, not the real template)`;
        clog.error(`[TEMPLATE] ${msg}`);
        throw new Error(`[renderTemplate] ${msg}`);
      }
      return res.text();
    }).catch((err) => {
      // Fetch failed before reaching the response (network, CORS, etc.) — the two
      // above cases already logged and reject again here, so only log what hasn't passed through them.
      if (!(err instanceof Error) || !err.message.startsWith('[renderTemplate]')) {
        const detail = err instanceof Error ? (err.stack || err.message) : String(err);
        clog.error(`[TEMPLATE] Error fetching "${resolvedPath}": ${detail}`);
      }
      sourceCache.delete(resolvedPath); // do not cache failures — next attempt might succeed
      throw err;
    });
    sourceCache.set(resolvedPath, pending);
  }
  return pending;
}

/** Compiles (with cache) and renders a .loom/.hbs template from the given path with provided data. */
export async function renderTemplate(path: string, data: unknown = {}): Promise<string> {
  const resolvedPath = resolvePath(path);
  let compiled = compileCache.get(resolvedPath);
  if (!compiled) {
    const source = await fetchSource(path);
    try {
      compiled = Handlebars.compile(source);
    } catch (err) {
      clog.error(`[TEMPLATE] Failed to compile "${resolvedPath}": ${(err as Error).message}`, err as Error);
      throw err;
    }
    compileCache.set(resolvedPath, compiled);
    clog.success(`[TEMPLATE] "${resolvedPath}" loaded and compiled`);
  }
  return compiled(data);
}

/** Clears the cache of a specific template (or all, if omitted) — useful for addon dev/hot-reload. */
export function clearTemplateCache(path?: string): void {
  if (path) {
    const resolvedPath = resolvePath(path);
    compileCache.delete(resolvedPath);
    sourceCache.delete(resolvedPath);
  } else {
    compileCache.clear();
    sourceCache.clear();
  }
}

/** Registers a pre-loaded partial by .loom/.hbs path (compiles and registers via the same mechanism as renderTemplate). */
export async function loadTemplates(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      const resolvedPath = resolvePath(path);
      const source = await fetchSource(path);
      // Alguns sistemas referenciam partials pelo path original .hbs, 
      // but we expose it with both the short name and original/modified path to be safe
      const name = resolvedPath.split('/').pop()!.replace(/\.(loom|hbs)$/, '');
      Handlebars.registerPartial(name, source);
      // Also register by the exact path passed by the system (many systems use the full path as the partial key)
      Handlebars.registerPartial(path, source);
      if (path !== resolvedPath) Handlebars.registerPartial(resolvedPath, source);

      clog.success(`[TEMPLATE] Partial "${resolvedPath}" registered`);
    }),
  );
}

export { Handlebars };
