/*******************************************************************************
 * LoomVTT
 * client/core/effects-api.ts
 * Component Version: 1.0.0
 *
 * Thin client wrapper around the existing `/api/buffs` REST route (embedded
 * Buff/effect documents — see `server/applications/api/buffs.ts`). Exposed as
 * `Loom.effects` so a ruleset can apply/remove buffs without hand-rolling its
 * own fetch calls against `/api/buffs/...` — before this there was no
 * `Loom.effects.*` surface at all, only the raw REST route and the
 * `Loom.config.Buff.documentClass` used for `prepareDerivedData()`.
 ******************************************************************************/

import { api } from './api.js';

export interface EffectData {
  id: string;
  worldId: string | null;
  actorId: string | null;
  itemId: string | null;
  name: string;
  icon: string;
  origin: string;
  duration: number;
  disabled: boolean;
  changes: unknown[];
}

export const effectsApi = {
  /** Lists effects (buffs) directly on an actor. */
  forActor: (actorId: string) => api.get<EffectData[]>(`/buffs/actor/${actorId}`),
  /** Lists effects (buffs) embedded on an item. */
  forItem: (itemId: string) => api.get<EffectData[]>(`/buffs/item/${itemId}`),
  /** Creates a new effect. Needs either `actorId` or `itemId`, plus `worldId` when unowned by an item. */
  create: (data: Partial<EffectData> & { name: string }) => api.post<EffectData>('/buffs', data),
  /** Partial update — only the fields present are changed. */
  update: (id: string, updates: Partial<EffectData>) => api.put<EffectData>(`/buffs/${id}`, updates),
  /** Permanently removes an effect. */
  delete: (id: string) => api.delete<{ success: boolean }>(`/buffs/${id}`),
};
