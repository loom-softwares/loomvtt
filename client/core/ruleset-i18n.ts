/*******************************************************************************
 * LoomVTT
 * client/core/ruleset-i18n.ts
 * 
 * 
 * Internationalization manager for rulesets.
 ******************************************************************************/

import { t as coreT } from '../lib/i18n.js';

type LangBundle = Record<string, any>;

/** Language strings registered by a ruleset at runtime. When the ruleset build is
 * generated, it calls `Loom.i18n.registerLang('en', {...})` with the contents of the original
 * `lang/en.json`. Without this, `localize()` would have nowhere to read from and would just return the key. */
function deepMerge(target: LangBundle, source: LangBundle): LangBundle {
  const out: LangBundle = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = out[key];
    if (tv && typeof tv === 'object' && typeof sv === 'object' && !Array.isArray(tv) && !Array.isArray(sv)) {
      out[key] = deepMerge(tv as LangBundle, sv as LangBundle);
    } else {
      out[key] = sv;
    }
  }
  return out;
}

class RulesetI18n {
  private bundles = new Map<string, LangBundle>();

  registerLang(locale: string, bundle: LangBundle): void {
    const existing = this.bundles.get(locale);
    this.bundles.set(locale, existing ? deepMerge(existing, bundle) : bundle);
  }

  private lookup(bundle: LangBundle | undefined, key: string): string | undefined {
    if (!bundle) return undefined;
    let value: unknown = bundle;
    for (const part of key.split('.')) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return typeof value === 'string' ? value : undefined;
  }

  localize(key: string): string {
    const locale = document.documentElement.lang || 'en';
    const found = this.lookup(this.bundles.get(locale), key) ?? this.lookup(this.bundles.get('en'), key);
    if (found !== undefined) return found;
    const core = coreT(key);
    // coreT returns the key itself when not found — maintaining the contract expected by converted systems
    // (localizing an unknown key returns the key, never throwing an error).
    return core;
  }

  format(key: string, data: Record<string, string | number> = {}): string {
    const raw = this.localize(key);
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in data ? String(data[name]) : `{${name}}`));
  }
}

export const rulesetI18n = new RulesetI18n();
