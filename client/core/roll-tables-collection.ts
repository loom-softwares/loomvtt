/*******************************************************************************
 * LoomVTT
 * client/core/roll-tables-collection.ts
 * 
 * 
 * Collection manager for Roll Tables.
 ******************************************************************************/

import { api } from './api.js';

interface RollTableSummary {
  id: string;
  name: string;
  worldId: string;
  formula: string;
  results: any[];
  [key: string]: any;
}

class RollTablesCollection {
  private byId = new Map<string, RollTableSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const tables = await api.get<RollTableSummary[]>(`/roll-tables?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.RollTable?.documentClass;
      const resultClass = (window as any).Loom?.config?.TableResult?.documentClass;
      for (const t of tables) {
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(t);
        if (resultClass?.prototype?.prepareDerivedData) {
          for (const result of t.results ?? []) resultClass.prototype.prepareDerivedData.call(result);
        }
        this.byId.set(t.id, t);
      }
    } catch {
      // API may fail if no tables exist
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): RollTableSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): RollTableSummary | undefined {
    return Array.from(this.byId.values()).find((t) => t.name === name);
  }

  filter(predicate: (table: RollTableSummary) => boolean): RollTableSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (table: RollTableSummary) => boolean): RollTableSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (table: RollTableSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (table: RollTableSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): RollTableSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const rollTablesCollection = new RollTablesCollection();
