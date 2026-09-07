/*******************************************************************************
 * LoomVTT
 * client/core/font-loader.ts
 * 
 * 
 * Utility for loading and checking custom fonts.
 ******************************************************************************/

import { api } from './api.js';
import clog from '../lib/client-logger.js';

interface FontEntry {
  family: string;
  url: string;
  weight: string;
  style: string;
  source: 'core' | 'system';
}

export interface FontSlot {
  variable: string;
  label: string;
  currentFamily: string;
}

let _catalog: FontEntry[] | null = null;

export async function getFontCatalog(): Promise<FontEntry[]> {
  if (_catalog) return _catalog;
  try {
    // Without the `/api` prefix: the `api` helper automatically prepends BASE = '/api'.
    _catalog = await api.get<FontEntry[]>('/fonts');
    return _catalog;
  } catch (err) {
    // Do not swallow silently: without a catalog, CSS falls back silently and UI appears correct,
    // masking underlying failures (e.g., 401 on protected routes or 404 from duplicate API prefix).
    clog.warn('Font catalog unavailable — using CSS fallback', err);
    return [];
  }
}

export async function loadFontsFromCatalog(): Promise<void> {
  const catalog = await getFontCatalog();
  const loaded = new Set<string>();
  for (const entry of catalog) {
    if (loaded.has(entry.family)) continue;
    loaded.add(entry.family);
    try {
      const font = new FontFace(entry.family, `url(${entry.url})`, {
        weight: entry.weight,
        style: entry.style as FontFaceDescriptors['style'],
        display: 'swap',
      });
      await font.load();
      document.fonts.add(font);
    } catch (e) {
      console.warn('[FontLoader] Failed to load font:', entry.family, entry.url, e);
    }
  }
}

export function applyFontSlot(slotVar: string, familyName: string): void {
  const current = getComputedStyle(document.documentElement).getPropertyValue(slotVar).trim();
  const fallback = current.split(',')?.slice(1).join(',') || 'serif';
  document.documentElement.style.setProperty(slotVar, `'${familyName}', ${fallback}`);
}

export const FONT_SLOTS: FontSlot[] = [
  { variable: '--font-display', label: 'fontSettings.slotDisplay', currentFamily: 'Cinzel' },
  { variable: '--font-body', label: 'fontSettings.slotBody', currentFamily: 'Crimson Text' },
  { variable: '--font-ui', label: 'fontSettings.slotUi', currentFamily: 'Inter' },
  { variable: '--font-mono', label: 'fontSettings.slotMono', currentFamily: 'JetBrains Mono' },
];
