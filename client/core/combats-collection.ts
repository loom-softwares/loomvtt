/*******************************************************************************
 * LoomVTT
 * client/core/combats-collection.ts
 *
 *
 * Collection manager for Combat encounters.
 ******************************************************************************/

import { api } from './api.js';
import { wsClient } from './ws-client.js';
import { LoomHooks } from './hooks.js';

interface CombatSummary {
  id: string;
  worldId: string;
  round: number;
  currentTurn: number;
  isActive: boolean;
  combatants: any[];
  groups: any[];
  [key: string]: any;
}

class CombatsCollection {
  private byId = new Map<string, CombatSummary>();
  private wsBound = false;

  async load(worldId: string): Promise<void> {
    try {
      // The API currently returns a single combat object (the active one) or null
      const combat = await api.get<CombatSummary | null>(`/combat/${worldId}`);
      this.byId.clear();
      if (combat) {
        this.applyDerivedData(combat);
        this.byId.set(combat.id, combat);
      }
    } catch {
      // API may 404 or fail if no combats exist
    }
  }

  private applyDerivedData(combat: CombatSummary): void {
    const combatClass = (window as any).Loom?.config?.Combat?.documentClass;
    if (combatClass?.prototype?.prepareDerivedData) combatClass.prototype.prepareDerivedData.call(combat);
    const combatantClass = (window as any).Loom?.config?.Combatant?.documentClass;
    if (combatantClass?.prototype?.prepareDerivedData) {
      for (const combatant of combat.combatants ?? []) combatantClass.prototype.prepareDerivedData.call(combatant);
    }
  }

  /**
   * Listens to the same WS events the sidebar's own combat tracker UI already
   * reacts to (`combat.started`/`combat.next`/`combat.ended`, see sidebar.ts
   * `setupWebSocketListeners`) — before this, `Loom.combats`/`Loom.combat`
   * was a one-time snapshot loaded at boot (`game-hud.ts`) that never updated
   * again, so a ruleset reading it mid-session always saw stale (or no)
   * combat state. Idempotent: safe to call more than once (e.g. hot reload).
   *
   * Also fires `LoomHooks` events (`combatStart`/`combatTurn`/`combatRound`/
   * `combatEnd`) — before this there was NO hook a ruleset could listen to
   * for combat state changes at all (confirmed: `combat.*` never appeared in
   * any `LoomHooks.callAll` call in the client). `combatRound` only fires
   * when the round number actually increased (not on every single turn).
   */
  bindWebSocket(): void {
    if (this.wsBound) return;
    this.wsBound = true;

    wsClient.on('combat.started', (data: CombatSummary) => {
      this.applyDerivedData(data);
      this.byId.clear();
      this.byId.set(data.id, data);
      LoomHooks.callAll('combatStart', data);
    });

    wsClient.on('combat.next', (data: CombatSummary) => {
      const previous = this.byId.get(data.id);
      this.applyDerivedData(data);
      this.byId.set(data.id, data);
      LoomHooks.callAll('combatTurn', data);
      if (!previous || data.round > previous.round) LoomHooks.callAll('combatRound', data);
    });

    wsClient.on('combat.ended', (data?: { worldId?: string }) => {
      this.byId.clear();
      LoomHooks.callAll('combatEnd', data);
    });
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): CombatSummary | undefined {
    return this.byId.get(id);
  }

  filter(predicate: (combat: CombatSummary) => boolean): CombatSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (combat: CombatSummary) => boolean): CombatSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (combat: CombatSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (combat: CombatSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): CombatSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }

  get active(): CombatSummary | undefined {
    return this.contents.find(c => c.isActive);
  }

  // ── Actions — thin wrappers over the existing `/api/combat/*` REST routes
  // (server/applications/api/combat.ts), the same ones the sidebar's combat
  // tracker UI already calls directly. Before this, a ruleset had no
  // sanctioned way to act on combat at all — only read it via `load()`. The
  // resulting state update always arrives through the WS listeners above
  // (`combat.started`/`combat.next`/`combat.ended`), never from the response
  // of these calls directly — mirrors how the sidebar's own UI is built, and
  // keeps every client (this collection, the sidebar, any other tab open) in
  // sync from one source instead of two different update paths racing.

  /** Starts a new encounter. `combatants` entries without `initiative` get a
   * random 1-20 rolled server-side. Ends any other active combat in the world first. */
  async start(worldId: string, combatants: Array<{ id: string; name: string; initiative?: number;[key: string]: any }> = []): Promise<void> {
    await api.post(`/combat/${worldId}/start`, { combatants });
  }

  /** Starts a new encounter rolling DEX-based initiative for the given cast members
   * (or every cast member in the world if `castIds` is omitted). */
  async startDexInitiative(worldId: string, opts: { castIds?: string[]; initiativeFormula?: string } = {}): Promise<void> {
    await api.post(`/combat/${worldId}/dex-initiative`, opts);
  }

  /** Advances to the next combatant's turn, wrapping to a new round when it
   * reaches the end of the list. */
  async next(worldId: string): Promise<void> {
    await api.post(`/combat/${worldId}/next`, {});
  }

  /** Ends the active combat in this world. */
  async end(worldId: string): Promise<void> {
    await api.post(`/combat/${worldId}/end`, {});
  }

  /** Adds one cast member to the active combat (creates a combat if none is active). */
  async addCombatant(worldId: string, castId: string): Promise<void> {
    await api.post(`/combat/${worldId}/combatant`, { castId });
  }

  /** Removes one combatant from the active combat. */
  async removeCombatant(worldId: string, castId: string): Promise<void> {
    await api.delete(`/combat/${worldId}/combatant/${castId}`);
  }

  /** Partial update on one combatant entry (e.g. initiative, hp). */
  async updateCombatant(worldId: string, castId: string, data: Record<string, any>): Promise<void> {
    await api.put(`/combat/${worldId}/combatant/${castId}`, data);
  }

  /** Groups combatants under one shared initiative entry. */
  async addGroup(worldId: string, data: Record<string, any>): Promise<void> {
    await api.post(`/combat/${worldId}/group`, data);
  }

  /** Partial update on an existing combatant group. */
  async updateGroup(worldId: string, groupId: string, data: Record<string, any>): Promise<void> {
    await api.put(`/combat/${worldId}/group/${groupId}`, data);
  }

  /** Removes a combatant group (ungroups its members). */
  async removeGroup(worldId: string, groupId: string): Promise<void> {
    await api.delete(`/combat/${worldId}/group/${groupId}`);
  }
}

export const combatsCollection = new CombatsCollection();
