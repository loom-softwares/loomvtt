/*******************************************************************************
 * LoomVTT
 * client/core/client-document.ts
 * 
 * 
 * Base class for client-side documents.
 ******************************************************************************/

import { api } from './api.js';
import { LoomHooks } from './hooks.js';
import type { SchemaDefinition } from '../../shared/data/fields.js';
import { validateAgainstSchema } from '../../shared/data/fields.js';
import { DataModel } from '../../shared/data/data-model.js';
import { setProperty, expandFoundryUpdate } from './utils.js';

/** System data field name per document type — used to expand `system.*` updates
 * in Foundry format (see `expandFoundryUpdate`). Documents not in this list
 * (ChatMessage, Folder, ...) have no system field — updates pass through directly. */
const SYSTEM_FIELD_BY_DOCUMENT: Record<string, string> = {
  Actor: 'systemData',
  Item: 'data',
};
import { gameContext } from './game-context.js';

/** Marks that the document has entered a data preparation cycle. */
export function beginPrepareData(doc: any): void {
  if (!doc) return;
  doc._preparingDataDepth = (doc._preparingDataDepth ?? 0) + 1;
}

/** Ends the cycle opened by `beginPrepareData`. If the stage returned a promise
 * (converted system declared `prepareDerivedData()` as `async`), the flag is only
 * cleared when it settles — a synchronous `try/finally` would release the guard on the first
 * `await`, before the `update()` from within the preparation even happens. */
export function endPrepareData(doc: any, result?: unknown): void {
  if (!doc) return;
  const release = (): void => {
    doc._preparingDataDepth = Math.max(0, (doc._preparingDataDepth ?? 1) - 1);
  };
  if (isThenable(result)) result.then(release, release);
  else release();
}

/** `true` while any preparation stage (including asynchronous) is in progress. */
export function isPreparingData(doc: any): boolean {
  return (doc?._preparingDataDepth ?? 0) > 0;
}

export function isThenable(v: unknown): v is Promise<unknown> {
  return !!v && typeof (v as any).then === 'function';
}

/** Warns ONCE per mechanism (not on every call — which would spam the console and drown useful
 * debug logs) that a compatibility path for a converted system (prototype borrowing, DOM property
 * disguise, etc.) was actually exercised in this session. Used to confirm, in production/real tests,
 * which of these paths are still in use before removing them — without needing to grep manually.
 * Remove when the warned mechanism(s) is/are turned off for good. */
const warnedCompatKeys = new Set<string>();
export function warnCompatDeprecated(key: string): void {
  if (warnedCompatKeys.has(key)) return;
  warnedCompatKeys.add(key);
  console.warn(`[DEPRECATED] Converted-system compatibility path in use: "${key}" — this method will be deprecated in version 1.0.`);
}

export class ClientDocument extends DataModel {
  /** Name of the document type for the API route/hook names (`/actors`, `preUpdateActor`).
   * Subclasses extended by converted systems (`LoomActor`/`LoomItem`) declare this
   * as a static property — inherited normally by `class WoDActor extends Actor`,
   * so an instance of `WoDActor` still resolves to `"Actor"`, not the real name of the
   * system's JS class. Without this, `this.constructor.name` would vary by system and break
   * the route (`/woDActors`) and the hooks (`preUpdateWoDActor`). */
  static documentName?: string;

  public documentName: string;
  public id: string;
  public flags: Record<string, Record<string, any>> = {};

  constructor(data: any = {}, context: any = {}) {
    super();
    // `items` (when it exists in the actor JSON) collides with the read-only getter of `LoomActor`
    // — Object.assign over a getter-only throws a TypeError (class is strict mode).
    // Same handling as in `update()` below.
    const { items, ...safeData } = data || {};
    Object.assign(this, safeData);
    this.documentName = (this.constructor as typeof ClientDocument).documentName || this.constructor.name;
    this.id = data.id || data._id;
    this.flags = data.flags || {};
  }

  /** Document data preparation chain. Every document class must expose this:
   * a system subclass overrides `prepareData()` and calls `super.prepareData()` inside
   * (universal pattern). Without the four methods here, that `super` would throw a `TypeError` and
   * abort the system preparation halfway — derived data would never be calculated and the
   * sheet would open with empty derived fields until another path recalculated them.
   * The three stages are no-ops in the base class: subclasses fill them in. */
  async prepareData(): Promise<void> {
    beginPrepareData(this);
    try {
      await this.prepareBaseData();
      await this.prepareEmbeddedDocuments();
      await this.prepareDerivedData();
    } finally {
      endPrepareData(this);
    }
  }

  /** Stage 1 — base values, before embedded documents. No-op in base. */
  prepareBaseData(): void | Promise<void> { }

  /** Stage 2 — prepares embedded collections (items, effects). No-op in base. */
  prepareEmbeddedDocuments(): void | Promise<void> { }

  /** Stage 3 — derived/calculated values. No-op in base.
   * ⚠️ Never write to the database from here: only ASSIGN local values. An `update()` here closes
   * a loop with the WS echo (see `_preparingDataDepth` guard in `actors-collection.ts`). */
  prepareDerivedData(): void | Promise<void> { }

  /** Blocks `update()` triggered from WITHIN the data preparation cycle itself (a converted
   * system calling `this.update()` in `prepareDerivedData()` without checking if the value
   * changed) — assigns locally instead of persisting, otherwise it closes a loop with the WS echo that
   * never stops on its own (same bug documented in `actors-collection.ts`/loop from 2026-08-24). */
  async update(changes: any, context: any = {}): Promise<this> {
    const systemField = SYSTEM_FIELD_BY_DOCUMENT[this.documentName];
    const expandedChanges = systemField ? expandFoundryUpdate(this as any, changes, systemField) : changes;

    if (isPreparingData(this)) {
      for (const [path, value] of Object.entries(expandedChanges)) setProperty(this, path, value);
      return this;
    }

    LoomHooks.call(`preUpdate${this.documentName}`, this, changes, context);

    // Document routes on the server expose PUT, not PATCH (`actorsRouter.put('/:id', ...)`,
    // `itemsRouter.put('/:id', ...)`) — using PATCH here fails with 404 "API route not found".
    const endpoint = `/${this.documentName.toLowerCase()}s`;
    const res = await api.put<any>(`${endpoint}/${this.id}`, expandedChanges);
    // `items` (when it exists) is a read-only getter in `LoomActor` — assigning over it
    // via Object.assign throws a TypeError (class is strict mode). Exclude before applying.
    const { items, ...safeRes } = res || {};
    Object.assign(this, safeRes);

    LoomHooks.call(`update${this.documentName}`, this, changes, context);
    return this;
  }

  async delete(context: any = {}): Promise<this> {
    LoomHooks.call(`preDelete${this.documentName}`, this, context);

    const endpoint = `/${this.documentName.toLowerCase()}s`;
    await api.delete<any>(`${endpoint}/${this.id}`);

    LoomHooks.call(`delete${this.documentName}`, this, context);
    return this;
  }

  async setFlag(scope: string, key: string, value: any): Promise<this> {
    const flags = this.flags || {};
    if (!flags[scope]) flags[scope] = {};
    flags[scope][key] = value;
    return this.update({ flags });
  }

  getFlag(scope: string, key: string): any {
    return this.flags?.[scope]?.[key];
  }

  get uuid(): string {
    return `${this.documentName}.${this.id}`;
  }

  /** `ownership` arrives from the server as database TEXT (stringified JSON) — it is never
   * rehydrated before being read here, so indexing directly by userId always resulted in
   * undefined for any user who wasn't a GM (the GM short-circuit hid this). */
  private parsedOwnership(): Record<string, number> {
    const raw = (this as any).ownership;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  /** Compares the user's ownership level against the requested one — GM always passes fully,
   * otherwise converted systems block even the GM on new documents
   * that are created with `ownership: {}` (real bug found in wod5e, counters.js). */
  testUserPermission(user: { id?: string } | string, permissionLevel: number, { exact = false }: { exact?: boolean } = {}): boolean {
    const userId = typeof user === 'string' ? user : user?.id;
    const isCurrentUser = !userId || userId === gameContext.session?.userId;
    if (isCurrentUser && gameContext.isGM) {
      return exact ? permissionLevel === 3 : true;
    }
    const ownership = this.parsedOwnership();
    const level = (userId ? ownership[userId] : undefined) ?? ownership.default ?? 0;
    return exact ? level === permissionLevel : level >= permissionLevel;
  }

  /** Restricted view: current user ONLY has "Limited" (1) level on this document — not
   * observer nor owner. GM is never limited. Mirrors `document.limited` from real Foundry,
   * used by converted systems to decide whether to show the full sheet or just the
   * public summary. */
  get limited(): boolean {
    if (gameContext.isGM) return false;
    const userId = gameContext.session?.userId;
    const ownership = this.parsedOwnership();
    const level = (userId ? ownership[userId] : undefined) ?? ownership.default ?? 0;
    return level === 1;
  }
}

/** Swaps the prototype of an already built document for the real class of a system
 * (converted or native) registered AFTER construction — normal boot scenario: the world
 * loads documents before the active system's `main.js` runs its init hook and
 * registers `CONFIG.Actor.documentClass`. Makes the object actually become an instance of the
 * system class (`instanceof` starts working, method dispatch is normal JS prototype)
 * without changing identity — anyone already holding the reference keeps the
 * same object. Idempotent: does not repeat the swap or reprepare if it's already the right class. */
export function reclassifyDocument(doc: any, documentClass: any): void {
  if (!doc || !documentClass) return;
  if (Object.getPrototypeOf(doc) === documentClass.prototype) return;
  Object.setPrototypeOf(doc, documentClass.prototype);
  doc.prepareData();
}
