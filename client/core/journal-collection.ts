/*******************************************************************************
 * LoomVTT
 * client/core/journal-collection.ts
 * 
 * 
 * Collection manager for Journal entries.
 ******************************************************************************/

import { api } from './api.js';

interface JournalSummary {
  id: string;
  name: string;
  worldId: string;
  ownership: any;
  pages: any[];
  [key: string]: any;
}

class JournalCollection {
  private byId = new Map<string, JournalSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const journals = await api.get<JournalSummary[]>(`/journals?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.Journal?.documentClass;
      const pageClass = (window as any).Loom?.config?.JournalPage?.documentClass;
      for (const j of journals) {
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(j);
        if (pageClass?.prototype?.prepareDerivedData) {
          for (const page of j.pages ?? []) pageClass.prototype.prepareDerivedData.call(page);
        }
        this.byId.set(j.id, j);
      }
    } catch {
      // API may fail if no journals exist or world isn't setup
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): JournalSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): JournalSummary | undefined {
    return Array.from(this.byId.values()).find((j) => j.name === name);
  }

  filter(predicate: (journal: JournalSummary) => boolean): JournalSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (journal: JournalSummary) => boolean): JournalSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (journal: JournalSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (journal: JournalSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): JournalSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const journalCollection = new JournalCollection();
