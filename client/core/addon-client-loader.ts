/*******************************************************************************
 * LoomVTT
 * client/core/addon-client-loader.ts
 * 
 * 
 * Client-side loader for addon modules.
 ******************************************************************************/

import { api } from './api.js';
import { clog } from '../lib/client-logger.js';
import { settingsRegistry } from './settings-registry.js';
import { rulesetI18n } from './ruleset-i18n.js';
import { getLocale } from '../lib/i18n.js';

/** Extracts stack trace (if available) so the full error appears in the log line, avoiding the need to expand the object in the console. */
function formatLoadError(err: unknown): string {
  return err instanceof Error ? (err.stack || err.message) : String(err);
}

/**
 * Rewrites relative `url(...)` in CSS to absolute URLs resolved against the CSS source path (`href`).
 * Since CSS is injected as `<style>textContent` rather than `<link href>`, relative URLs inside
 * `<style>` would resolve against the page root instead of the original file, causing asset requests
 * to fail (e.g., returning the SPA HTML fallback instead of fonts/textures).
 */
function rewriteRelativeCssUrls(css: string, href: string): string {
  const base = new URL(href, window.location.origin);
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote: string, path: string) => {
    if (/^(https?:|data:|\/)/i.test(path)) return match; // Already absolute or remote
    const resolved = new URL(path, base).pathname;
    return `url(${quote}${resolved}${quote})`;
  });
}

/**
 * Injects package stylesheets into the DOM.
 * @param pkg Package information.
 * @param folder Package marketplace folder ('addons' or 'rulesets').
 */
async function injectPackageStyles(pkg: PackageInfo, folder: string): Promise<void> {
  if (!pkg.styles?.length) return;

  for (const stylePath of pkg.styles) {
    const href = `/marketplace/${folder}/${pkg.name}/${stylePath}`;

    // Prevents duplicates
    if (document.querySelector(`style[data-loom-href="${href}"]`)) {
      continue;
    }

    // Fetches intentionally instead of using `<link href>`: a `<link>` with incorrect MIME type
    // (e.g., dev server returning SPA index.html instead of 404) still fires `onload` in Chrome.
    // The browser silently refuses to apply the CSS with a raw warning.
    // Fetch allows inspecting the content-type before injection.
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        throw new Error(`Invalid MIME type (${contentType || 'unknown'}) — file likely doesn't exist at this path`);
      }
      const css = await res.text();
      const style = document.createElement('style');
      style.dataset.loomPackage = pkg.name;
      style.dataset.loomHref = href;
      style.textContent = rewriteRelativeCssUrls(css, href);
      document.head.appendChild(style);
      clog.success(`[CSS] "${pkg.name}" injected: ${href}`);
    } catch (err) {
      clog.error(`[CSS] "${pkg.name}" failed to load ${href}: ${formatLoadError(err)}`);
    }
  }
}

interface PackageInfo {
  type: 'addon' | 'ruleset';
  name: string;
  title?: string;
  client?: string;
  active?: boolean;
  styles?: string[];
  scripts?: string[];
  languages?: { lang: string; name?: string; path: string }[];
  settings?: Array<{
    key: string;
    name?: string;
    label?: string;
    hint?: string;
    scope?: 'world' | 'client';
    type?: string;
    default?: any;
    choices?: Record<string, string>;
  }>;
}

export const packageTitles = new Map<string, string>();

/**
 * Injects package `scripts` (manifest field, e.g. vendored jQuery plugins) as classic
 * `<script>` tags, in declared order, awaiting each `onload` before the next — a system
 * declaring `["lib/jquery.min.js", "lib/some-plugin.js"]` needs jQuery attached to
 * `window` before the plugin that extends `$.fn` runs. Sequential, not `Promise.all`.
 */
async function injectPackageScripts(pkg: PackageInfo, folder: string): Promise<void> {
  if (!pkg.scripts?.length) return;

  for (const scriptPath of pkg.scripts) {
    const src = `/marketplace/${folder}/${pkg.name}/${scriptPath}`;

    if (document.querySelector(`script[data-loom-src="${src}"]`)) continue;

    await new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.dataset.loomPackage = pkg.name;
      script.dataset.loomSrc = src;
      script.onload = () => {
        clog.success(`[SCRIPT] "${pkg.name}" injected: ${src}`);
        resolve();
      };
      script.onerror = () => {
        clog.error(`[SCRIPT] "${pkg.name}" failed to load ${src}`);
        resolve();
      };
      document.head.appendChild(script);
    });
  }
}

async function loadPackageLanguage(pkg: PackageInfo, folder: string): Promise<void> {
  if (!pkg.languages?.length) return;

  const activeLang = (settingsRegistry.get('core', 'language') as string) || 'en';

  let langDefs = pkg.languages.filter(l => l.lang === activeLang);
  if (!langDefs.length) {
    langDefs = pkg.languages.filter(l => l.lang === 'en');
  }

  if (!langDefs.length) {
    const available = pkg.languages.map(l => l.lang).join(', ');
    const wanted = activeLang === 'en' ? `"en"` : `"${activeLang}" nem "en"`;
    clog.info(`[I18N] "${pkg.name}" has no language ${wanted} — available: [${available}], no language file loaded`);
    return;
  }

  for (const langDef of langDefs) {
    const url = `/marketplace/${folder}/${pkg.name}/${langDef.path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      rulesetI18n.registerLang(langDef.lang, json);
      clog.success(`[I18N] Language "${langDef.lang}" from "${pkg.name}" loaded from ${url}`);
    } catch (err) {
      clog.warn(`[I18N] Failed to load language from ${url}: ${formatLoadError(err)}`);
    }
  }
}

/**
 * Load status of the world's active system (ruleset). Queried by actor/item sheet resolvers:
 * if the system failed to load, `sheetCatalog` remains unpopulated by it.
 * Opening the generic sheet in this case would mislead the user into thinking it's the real system sheet.
 */
export let systemLoadStatus: { attempted: boolean; loaded: string | null; failed: string | null } = {
  attempted: false,
  loaded: null,
  failed: null,
};

/**
 * @param activeSystemId - ID of the ruleset used by the world (world.system).
 * Only THIS ruleset is loaded. Loading all installed rulesets would cause
 * multiple systems to register in `window.Loom.systems` simultaneously.
 */
export async function loadClientAddons(activeSystemId?: string, worldId?: string): Promise<void> {
  // The core language is the source of truth for ruleset bundles: it syncs with the engine's
  // actual locale on boot to ensure ruleset bundles match the user's localized interface.
  settingsRegistry.set('core', 'language', getLocale());

  let packages: PackageInfo[] = [];
  try {
    // `worldId` lets the server merge this world's per-world addon toggle
    // (world_packages, set via "Gerenciamento de Módulos") into `active` —
    // without it, an addon disabled just for this world would still load,
    // since the manifest's own `active` flag never reflects per-world state.
    const query = worldId ? `?worldId=${encodeURIComponent(worldId)}` : '';
    const res = await api.get<{ packages: PackageInfo[] }>(`/marketplace/packages${query}`);
    packages = res.packages ?? [];
  } catch (err) {
    clog.warn('Marketplace unavailable or not configured yet', err as Error);
    return;
  }

  const addons = packages.filter(p => p.type === 'addon');
  const rulesets = packages.filter(p => p.type === 'ruleset');

  // ── ADDONS (Additive, all active ones load and affect any world) ──
  const addonsLoaded: string[] = [];
  const addonsSkipped: string[] = [];
  const addonsFailed: string[] = [];
  for (const pkg of addons) {
    if (pkg.active === false || !pkg.client) {
      addonsSkipped.push(`${pkg.name} (${!pkg.client ? 'sem client.js' : 'inativo'})`);
      continue;
    }

    if (pkg.title) packageTitles.set(pkg.name, pkg.title);

    // Register declarative settings from manifest into settingsRegistry
    if (pkg.settings?.length) {
      for (const s of pkg.settings) {
        if (!settingsRegistry.getDefinitionsForModule(pkg.name).some((d) => d.key === s.key)) {
          settingsRegistry.register(pkg.name, s.key, {
            name: s.name || s.label || s.key,
            hint: s.hint,
            scope: s.scope ?? 'world',
            type: s.type === 'boolean' ? Boolean : s.type === 'number' ? Number : String,
            default: s.default,
            choices: s.choices,
          });
        }
      }
    }

    // Inject package styles before loading JS
    await injectPackageStyles(pkg, 'addons');
    await injectPackageScripts(pkg, 'addons');
    await loadPackageLanguage(pkg, 'addons');

    // `?v=` forces the browser to refetch on every boot to bypass the ES module registry cache,
    // ensuring updated files are loaded instead of reusing the initial `import()` payload.
    const url = `/marketplace/addons/${pkg.name}/${pkg.client}?v=${Date.now()}`;
    try {
      await import(/* @vite-ignore */ url);
      addonsLoaded.push(pkg.name);
      clog.success(`[ADDON] "${pkg.name}" loaded from ${url}`);
    } catch (err) {
      addonsFailed.push(pkg.name);
      clog.error(`[ADDON] Failed to load "${pkg.name}" from ${url}: ${formatLoadError(err)}`);
    }
  }
  clog.info(`[ADDON] Loaded: [${addonsLoaded.join(', ') || 'none'}]`);
  if (addonsFailed.length) clog.error(`[ADDON] FAILED: [${addonsFailed.join(', ')}]`);
  if (addonsSkipped.length) clog.info(`[ADDON] Skipped: [${addonsSkipped.join(', ')}]`);

  // ── SYSTEM (Ruleset) — Only the world's active system (world.system) loads, never more than one ──
  const systemsSkipped: string[] = [];
  let systemLoaded: string | null = null;
  let systemFailed: string | null = null;
  for (const pkg of rulesets) {
    if (pkg.active === false || !pkg.client) {
      systemsSkipped.push(`${pkg.name} (${!pkg.client ? 'sem client.js' : 'inativo'})`);
      continue;
    }
    if (activeSystemId && pkg.name !== activeSystemId) {
      // Do not log: having other inactive systems installed for the current world is expected behavior.
      continue;
    }

    if (pkg.title) packageTitles.set(pkg.name, pkg.title);

    // Register declarative settings from manifest into settingsRegistry
    if (pkg.settings?.length) {
      for (const s of pkg.settings) {
        if (!settingsRegistry.getDefinitionsForModule(pkg.name).some((d) => d.key === s.key)) {
          settingsRegistry.register(pkg.name, s.key, {
            name: s.name || s.label || s.key,
            hint: s.hint,
            scope: s.scope ?? 'world',
            type: s.type === 'boolean' ? Boolean : s.type === 'number' ? Number : String,
            default: s.default,
            choices: s.choices,
          });
        }
      }
    }

    // Inject system styles before loading JS
    await injectPackageStyles(pkg, 'rulesets');
    await injectPackageScripts(pkg, 'rulesets');
    await loadPackageLanguage(pkg, 'rulesets');

    const url = `/marketplace/rulesets/${pkg.name}/${pkg.client}?v=${Date.now()}`;
    try {
      await import(/* @vite-ignore */ url);
      systemLoaded = pkg.name;
      clog.success(`[SYSTEM] "${pkg.name}" loaded from ${url}`);
    } catch (err) {
      systemFailed = pkg.name;
      clog.error(`[SYSTEM] Failed to load active system "${pkg.name}" from ${url}: ${formatLoadError(err)}`);
    }
  }
  if (systemLoaded) {
    clog.info(`[SYSTEM] World's active system: ${systemLoaded}`);
  } else if (systemFailed) {
    clog.info(`[SYSTEM] World's active system: FAILED (${systemFailed})`);
  } else if (activeSystemId) {
    // No installed package matches the requested world ID.
    // Nothing from this system loads (JS/CSS/i18n/.hbs).
    const installed = rulesets.map(r => r.name).join(', ') || 'nenhum';
    clog.error(`[SYSTEM] The world requires system "${activeSystemId}", but no installed package has that name. Nothing from this system (JS/CSS/language/.hbs) was loaded; sheets will open generic.`);
  } else {
    clog.info('[SYSTEM] World has no system defined');
  }
  if (systemsSkipped.length) clog.info(`[SYSTEM] Skipped: [${systemsSkipped.join(', ')}]`);
  systemLoadStatus = { attempted: !!activeSystemId, loaded: systemLoaded, failed: systemFailed };
}