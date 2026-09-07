/**
 * i18n.ts — Loom VTT internationalisation (EN / PT-BR)
 * Simple version without React context for now
 */
// Import the single locales file that contains both languages
import localesData from '../../locales.json' with { type: 'json' };

export type Locale = 'en' | 'pt-BR';

// Extract language bundles from the main locales file
const BUNDLES: Record<Locale, any> = {
  en: (localesData as any).en || {},
  'pt-BR': (localesData as any)['pt-BR'] || {}
};

export let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('loom_locale', locale);
}

export function detectLocale(): Locale {
  const saved = localStorage.getItem('loom_locale') as Locale | null;
  if (saved && BUNDLES[saved]) return saved;
  return navigator.language.startsWith('pt') ? 'pt-BR' : 'en';
}

export type I18nVars = Record<string, string | number>;

export function t(key: string, vars?: I18nVars): string {
  const keys = key.split('.');
  let value: unknown = BUNDLES[currentLocale];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}

// Initialize locale on load
currentLocale = detectLocale();