/*******************************************************************************
 * LoomVTT
 * client/core/actors-collection.ts
 *
 *
 *
 * Collection manager for Actor documents.
 ******************************************************************************/

import { api } from './api.js';
import { reclassifyDocument } from './client-document.js';

interface ActorRow {
  id: string;
  name: string;
  type: string;
  flags?: Record<string, Record<string, any>>;
  [key: string]: any;
}

/** Type alias kept for existing callers — real instances are now genuine
 * `documentClass` instances (`LoomActor` by default, or a system's own subclass),
 * not a separate wrapper class. */
export type LiveActor = ActorRow & {
  system: Record<string, any>;
  items: any;
  uuid: string;
  render(): void;
  testUserPermission(user: any, level: number, opts?: { exact?: boolean }): boolean;
  update(data: Record<string, any>): Promise<any>;
  getFlag(scope: string, key: string): any;
  [key: string]: any;
};

function resolveActorClass(): any {
  return (window as any).Loom?.config?.Actor?.documentClass;
}

/** Actual WorldCollection of Actors, pre-loaded when entering the world, with synchronous
 * `.get(id)` returning a real `documentClass` instance (native `LoomActor` or a converted
 * system's own subclass — `new documentClass(row)` runs the real constructor chain). */
class ActorsCollection {
  private byId = new Map<string, LiveActor>();

  async load(worldId: string): Promise<void> {
    try {
      const actors = await api.get<ActorRow[]>(`/actors?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = resolveActorClass();
      for (const actor of actors) {
        this.byId.set(actor.id, new documentClass(actor));
      }
    } catch (e) {
      // World with no actors yet or network error — collection stays empty without breaking boot
      // but we log it to prevent silent failures.
      console.error('LoomVTT | ActorsCollection.load falhou:', e);
    }
  }

  clear(): void {
    this.byId.clear();
  }

  /** Inserts/updates an actor without full reload — used when creating a new actor so immediately opened sheets find the document. */
  add(row: ActorRow): LiveActor {
    // If an instance for the same actor already exists and the incoming data is not newer, do not
    // reconstruct. The constructor runs `prepareData()`/`prepareDerivedData()` — if the converted
    // system calls `actor.update()` from within the derived data calculation (real pattern from wod5e),
    // reconstructing on EVERY echo of its own update triggers another `update()`, closing an infinite loop:
    // update -> WS broadcast -> `add()` reconstructs -> prepareData -> update again, forever.
    // Only reconstruct when the data is genuinely newer.
    const existing = this.byId.get(row.id);
    const documentClass = resolveActorClass();
    if (existing && (row as any).updatedAt && (existing as any).updatedAt &&
      (row as any).updatedAt <= (existing as any).updatedAt) {
      reclassifyDocument(existing, documentClass);
      return existing;
    }

    const actor = new documentClass(row);
    this.byId.set(row.id, actor);
    return actor;
  }

  /** The world loads actors BEFORE the active system's `main.js` runs its init hook, which
   * registers `CONFIG.Actor.documentClass = WoDActor` — the actor already exists as a `LoomActor`
   * (default) instance in this window. `reclassifyDocument` swaps the prototype to the real class
   * as soon as it appears, without changing the object identity (anyone holding this reference
   * keeps the same object, now reclassified). */
  get(id: string): LiveActor | undefined {
    const actor = this.byId.get(id);
    if (actor) reclassifyDocument(actor, resolveActorClass());
    return actor;
  }

  delete(id: string): boolean {
    return this.byId.delete(id);
  }

  getName(name: string): LiveActor | undefined {
    return Array.from(this.byId.values()).find((a) => a.name === name);
  }

  filter(predicate: (actor: LiveActor) => boolean): LiveActor[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (actor: LiveActor) => boolean): LiveActor | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (actor: LiveActor) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (actor: LiveActor) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): LiveActor[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }

  /** Set of IDs that failed validation on load. Loom doesn't validate schemas on client, so it's always empty. */
  get invalidDocumentIds(): Set<string> {
    return new Set();
  }

  /** Paired with `WorldCollection#getInvalid` — always undefined. */
  getInvalid(_id: string): LiveActor | undefined {
    return undefined;
  }

  [Symbol.iterator](): IterableIterator<LiveActor> {
    return this.byId.values();
  }
}

export const actorsCollection = new ActorsCollection();
