/*******************************************************************************
 * LoomVTT
 * client/core/items-collection.ts
 *
 *
 * Collection manager for Item documents.
 ******************************************************************************/

import { api } from './api.js';
import { reclassifyDocument } from './client-document.js';

interface ItemSummary {
  id: string;
  name: string;
  type: string;
  [key: string]: any;
}

/** Type alias kept for existing callers — real instances are now genuine
 * `documentClass` instances (`LoomItem` by default, or a system's own subclass). */
export type LiveItem = ItemSummary & {
  system: Record<string, any>;
  render(): void;
  update(data: Record<string, any>): Promise<any>;
  getFlag(scope: string, key: string): any;
  [key: string]: any;
};

function resolveItemClass(): any {
  return (window as any).Loom?.config?.Item?.documentClass;
}

/** Actual WorldCollection of Items (not embedded in actors), pre-loaded when entering the
 * world. Same pattern as `actors-collection.ts`. */
class ItemsCollection {
  private byId = new Map<string, LiveItem>();

  async load(worldId: string): Promise<void> {
    try {
      const items = await api.get<ItemSummary[]>(`/items?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = resolveItemClass();
      for (const item of items) {
        this.byId.set(item.id, new documentClass(item));
      }
    } catch {
      // World without items or network error — collection remains empty, doesn't break boot.
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): LiveItem | undefined {
    const item = this.byId.get(id);
    if (item) reclassifyDocument(item, resolveItemClass());
    return item;
  }

  delete(id: string): void {
    this.byId.delete(id);
  }

  add(row: ItemSummary): LiveItem {
    // Always replaces with the most recent instance — same pattern as
    // ActorsCollection.add(). Replaces rather than ignoring to ensure the collection
    // stays a live source of truth (the WS item.updated echo would otherwise return
    // stale data to a reopened sheet).
    const documentClass = resolveItemClass();
    const item = new documentClass(row);
    this.byId.set(row.id, item);
    return item;
  }

  getName(name: string): LiveItem | undefined {
    return Array.from(this.byId.values()).find((i) => i.name === name);
  }

  filter(predicate: (item: LiveItem) => boolean): LiveItem[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (item: LiveItem) => boolean): LiveItem | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (item: LiveItem) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (item: LiveItem) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): LiveItem[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }

  [Symbol.iterator](): IterableIterator<LiveItem> {
    return this.byId.values();
  }

  /** Paired with `WorldCollection#invalidDocumentIds`/`#getInvalid` — always empty/undefined. Loom doesn't validate schemas on client. */
  get invalidDocumentIds(): Set<string> {
    return new Set();
  }

  getInvalid(_id: string): LiveItem | undefined {
    return undefined;
  }
}

export const itemsCollection = new ItemsCollection();
