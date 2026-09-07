/*******************************************************************************
 * LoomVTT
 * client/core/packs-collection.ts
 * 
 * 
 * Collection manager for Compendium packs.
 ******************************************************************************/

import { api } from './api.js';

interface PackSummary {
  id: string;
  worldId: string;
  name: string;
  type: string;
  entryCount: number;
  [key: string]: any;
}

/** Actual WorldCollection of Packs, pre-loaded when joining the world. Same pattern as `items-collection.ts`. */
class PacksCollection {
  private byId = new Map<string, PackSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const packs = await api.get<PackSummary[]>(`/compendium?worldId=${worldId}`);
      this.byId.clear();
      for (const pack of packs) this.byId.set(pack.id, pack);
    } catch {
      // World without packs or network error — collection remains empty, doesn't break boot.
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): PackSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): PackSummary | undefined {
    return Array.from(this.byId.values()).find((p) => p.name === name);
  }

  filter(predicate: (pack: PackSummary) => boolean): PackSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (pack: PackSummary) => boolean): PackSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (pack: PackSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (pack: PackSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): PackSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const packsCollection = new PacksCollection();