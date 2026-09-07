/*******************************************************************************
 * LoomVTT
 * client/core/theme-manager.ts
 * 
 * 
 * Manager for UI themes and styling.
 ******************************************************************************/

export type ThemeMode = 'dark' | 'light';

export const BUILTIN_PALETTES = ['default', 'ember', 'frost', 'violet'] as const;
export type BuiltinPalette = (typeof BUILTIN_PALETTES)[number];

const THEME_KEY = 'loom.theme';
const PALETTE_KEY = 'loom.palette';
const CUSTOM_PALETTES_KEY = 'loom.customPalettes';
const CUSTOM_STYLE_ID = 'loom-custom-theme';

/** Allowed variables that a custom theme can overwrite — never accept
 * keys outside this list (input is a JSON imported by the user). */
const ALLOWED_VARS = new Set([
  '--color-accent',
  '--color-accent-rgb',
  '--color-accent-hover',
  '--color-bg-deep',
  '--color-bg-dark',
  '--color-bg-medium',
  '--color-bg-surface',
  '--color-bg-surface-hover',
  '--color-border',
  '--color-border-glass',
  '--window-bg',
  '--window-border',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-danger',
  '--color-success',
  '--color-warning',
  '--color-info',
  '--shadow-glow',
]);

export interface CustomPalette {
  name: string;
  vars: Record<string, string>;
}

function getCustomPalettes(): CustomPalette[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomPalettes(list: CustomPalette[]): void {
  localStorage.setItem(CUSTOM_PALETTES_KEY, JSON.stringify(list));
}

function applyCustomStyle(vars: Record<string, string> | null): void {
  let styleEl = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!vars) {
    styleEl?.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  const body = Object.entries(vars)
    .filter(([k]) => ALLOWED_VARS.has(k))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  styleEl.textContent = `:root {\n${body}\n}`;
}

export function getCurrentTheme(): ThemeMode {
  return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark';
}

export function getCurrentPalette(): string {
  return localStorage.getItem(PALETTE_KEY) || 'default';
}

export function listCustomPalettes(): CustomPalette[] {
  return getCustomPalettes();
}

/** Applies the saved theme/palette — call on boot (main.ts) and whenever the
 * user changes something. Ensures consistency after the synchronous pre-render application. */
export function applyTheme(): void {
  const theme = getCurrentTheme();
  const palette = getCurrentPalette();
  document.documentElement.setAttribute('data-theme', theme);

  if (BUILTIN_PALETTES.includes(palette as BuiltinPalette)) {
    if (palette === 'default') {
      document.documentElement.removeAttribute('data-palette');
    } else {
      document.documentElement.setAttribute('data-palette', palette);
    }
    applyCustomStyle(null);
  } else {
    const custom = getCustomPalettes().find((p) => p.name === palette);
    document.documentElement.removeAttribute('data-palette');
    applyCustomStyle(custom ? custom.vars : null);
  }
}

export function setTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

export function setPalette(name: string): void {
  localStorage.setItem(PALETTE_KEY, name);
  applyTheme();
}

/** Installs (or replaces) a custom palette from a JSON imported
 * by the user — only accepts known keys (ALLOWED_VARS), the rest is
 * silently discarded. */
export function installCustomPalette(name: string, vars: Record<string, string>): void {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (ALLOWED_VARS.has(k) && typeof v === 'string') cleaned[k] = v;
  }
  const list = getCustomPalettes().filter((p) => p.name !== name);
  list.push({ name, vars: cleaned });
  saveCustomPalettes(list);
}

export function deleteCustomPalette(name: string): void {
  saveCustomPalettes(getCustomPalettes().filter((p) => p.name !== name));
  if (getCurrentPalette() === name) setPalette('default');
}
