/*******************************************************************************
 * LoomVTT
 * client/core/macros-collection.ts
 * 
 * 
 * Collection manager for Macro documents.
 ******************************************************************************/

import { api } from './api.js';

interface MacroSummary {
  id: string;
  name: string;
  type: string;
  command: string;
  imgUrl: string;
  slot: number;
  [key: string]: any;
}

/** Actual WorldCollection of Macros, pre-loaded when joining the world. Same pattern as `items-collection.ts`. */
class MacrosCollection {
  private byId = new Map<string, MacroSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const macros = await api.get<MacroSummary[]>(`/macros?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.Macro?.documentClass;
      for (const macro of macros) {
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(macro);
        this.byId.set(macro.id, macro);
      }
    } catch {
      // World without macros or network error — collection remains empty, doesn't break boot.
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): MacroSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): MacroSummary | undefined {
    return Array.from(this.byId.values()).find((m) => m.name === name);
  }

  filter(predicate: (macro: MacroSummary) => boolean): MacroSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (macro: MacroSummary) => boolean): MacroSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (macro: MacroSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (macro: MacroSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): MacroSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const macrosCollection = new MacrosCollection();