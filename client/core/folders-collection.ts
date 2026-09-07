/*******************************************************************************
 * LoomVTT
 * client/core/folders-collection.ts
 * 
 * 
 * Collection manager for directory Folders.
 ******************************************************************************/

import { api } from './api.js';

interface FolderSummary {
  id: string;
  name: string;
  type: string;
  worldId: string;
  color?: string;
  sorting?: string;
  sort?: number;
  [key: string]: any;
}

class FoldersCollection {
  private byId = new Map<string, FolderSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const folders = await api.get<FolderSummary[]>(`/folders?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.Folder?.documentClass;
      for (const f of folders) {
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(f);
        this.byId.set(f.id, f);
      }
    } catch {
      // API may fail if no folders exist
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): FolderSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): FolderSummary | undefined {
    return Array.from(this.byId.values()).find((f) => f.name === name);
  }

  filter(predicate: (folder: FolderSummary) => boolean): FolderSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (folder: FolderSummary) => boolean): FolderSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (folder: FolderSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (folder: FolderSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): FolderSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const foldersCollection = new FoldersCollection();
