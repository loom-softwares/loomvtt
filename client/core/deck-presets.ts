/*******************************************************************************
 * LoomVTT
 * client/core/deck-presets.ts
 *
 * Loader and manager for card deck presets located in /cards/
 ******************************************************************************/

export interface DeckPresetCard {
  name: string;
  type?: string;
  suit?: string;
  value?: string | number;
  img?: string;
  face?: string;
  back?: string;
  description?: string;
}

export interface DeckPresetSummary {
  id: string;
  name: string;
  description?: string;
  file: string;
  count: number;
  back?: string;
  preview?: string;
}

export interface DeckPresetData {
  id: string;
  name: string;
  type: string;
  back?: string;
  width?: number;
  height?: number;
  description?: string;
  cards: DeckPresetCard[];
}

import { showToast } from '../components/toast.js';

let cachedPresets: DeckPresetSummary[] | null = null;

export async function fetchDeckPresets(): Promise<DeckPresetSummary[]> {
  if (cachedPresets) return cachedPresets;
  try {
    const res = await fetch('/cards/presets.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedPresets = Array.isArray(data) ? data : [];
    return cachedPresets;
  } catch (err: any) {
    console.warn('[DeckPresets] Failed to fetch /cards/presets.json:', err);
    showToast(`Erro de rede ao carregar presets de baralho: ${err?.message || 'Falha na conexão'}`, 'error');
    return [];
  }
}

export async function loadDeckPresetFile(fileUrl: string): Promise<DeckPresetData | null> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[DeckPresets] Failed to load deck preset at ${fileUrl}:`, err);
    return null;
  }
}

export function instantiateDeckCards(presetCards: DeckPresetCard[]): Array<DeckPresetCard & { id: string }> {
  return presetCards.map(c => ({
    ...c,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? `card-${crypto.randomUUID()}`
      : `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  }));
}
