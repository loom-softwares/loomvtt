import en from '../locales/en.json';
import ptBR from '../locales/pt-BR.json';

export type Locale = 'en' | 'pt-BR';

export type I18nVars = Record<string, string | number>;

const BUNDLES = {
  en: en as unknown as Record<string, Record<string, string>>,
  'pt-BR': ptBR as unknown as Record<string, Record<string, string>>
};

let currentLocale: Locale = 'en';

function detectLocale(): Locale {
  const saved = localStorage.getItem('loom_locale') as Locale | null;
  if (saved && BUNDLES[saved]) return saved;
  return navigator.language.startsWith('pt') ? 'pt-BR' : 'en';
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('loom_locale', locale);
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

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

currentLocale = detectLocale();
document.documentElement.lang = currentLocale;
