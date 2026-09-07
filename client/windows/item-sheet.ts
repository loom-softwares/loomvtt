/*******************************************************************************
 * LoomVTT
 * client/windows/item-sheet.ts
 * 
 * 
 * Specialized Document Sheet for Items.
 ******************************************************************************/

import { LoomDocumentSheet } from './document-sheet.js';
import { itemsCollection } from '../core/items-collection.js';
import { actorsCollection } from '../core/actors-collection.js';
import { api } from '../core/api.js';

/**
 * Specialized Item document sheet: adds `item` and `actor` (the actor OWNER of the
 * item, same semantics as `ItemSheetV2#actor`) and loads the item from WorldCollection.
 *
 * Those who want to render via template apply the mixin on declaration:
 * `class MySheet extends Loom.LoomHandlebarsMixin(Loom.LoomItemSheet) {}`
 */
export abstract class LoomItemSheet<DocType extends Record<string, any> = any> extends LoomDocumentSheet<DocType> {
  protected get documentName(): string { return 'item'; }
  protected _apiRouteOverride: string | undefined;
  protected get apiRoute(): string { return this._apiRouteOverride ?? '/items'; }

  constructor(props: { itemId?: string; documentId?: string; worldId?: string; id?: string;[key: string]: any }) {
    // Same case as LoomActorSheet: the app instantiates with `itemId`, the mixin passes
    // `documentId` and the already resolved window options. See comment there.
    const documentId = props.documentId ?? props.itemId;
    super({ ...props, id: props.id || `item-sheet-${documentId}`, title: props.title ?? '', documentId });
  }

  protected async loadDocument(): Promise<void> {
    if (!this.options.documentId) return;
    // Sempre busca fresco — `itemsCollection` é populada uma vez no boot e só atualizada por
    // quem lembra de chamar `.add()`/`.delete()` depois (nem todo caminho de update/create
    // lembra). Reaproveitar QUALQUER entrada cacheada, mesmo desatualizada, abria a ficha
    // do item com campos (ex: discipline) que não batiam com o que estava salvo de verdade.
    const row = await api.get<any>(`${this.apiRoute}/${this.options.documentId}`);
    const item = itemsCollection.add(row);
    this.document = (item as unknown as DocType) ?? null;
  }

  get item(): DocType | null {
    return this.document;
  }

  /** Returns the Actor owning the item, if the item is embedded/linked to one.*/
  get actor(): any | null {
    const actorId = (this.document as any)?.actorId;
    return actorId ? actorsCollection.get(actorId) ?? null : null;
  }

  // Stub compatível — sistemas convertidos chamam `super._dragDrop()`
  protected _dragDrop(event: DragEvent): void {
    // Delegate to existing drag drop handlers
    if (this._canDragStart(event.target as HTMLElement)) {
      this._onDragStart(event);
    }
  }
}
