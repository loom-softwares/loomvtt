/*******************************************************************************
 * LoomVTT
 * client/windows/actor-sheet.ts
 * 
 * 
 * Specialized Document Sheet for Actors.
 ******************************************************************************/

import { LoomDocumentSheet } from './document-sheet.js';
import { actorsCollection } from '../core/actors-collection.js';
import { api } from '../core/api.js';

/**
 * Specialized Actor document sheet: adds `actor`/`token` and loads the actor
 * from WorldCollection. Equivalent to `ActorSheetV2` — which also extends the document sheet
 * and DOES NOT bring the built-in template mixin.
 *
 * Those who want to render via template apply the mixin on declaration:
 * `class MySheet extends Loom.LoomHandlebarsMixin(Loom.LoomActorSheet) {}`
 */
export abstract class LoomActorSheet<DocType extends Record<string, any> = any> extends LoomDocumentSheet<DocType> {
  protected get documentName(): string { return 'actor'; }
  protected _apiRouteOverride: string | undefined;
  protected get apiRoute(): string { return this._apiRouteOverride ?? '/actors'; }

  constructor(props: { actorId?: string; documentId?: string; worldId?: string; id?: string;[key: string]: any }) {
    // Two callers with different shapes: the app instantiates directly with `actorId`, and the mixin
    // (when this class is its base) passes `documentId` along with resolved title/icon/position.
    // Reading only `actorId` caused documentId to arrive undefined under the mixin —
    // `loadDocument()` would exit on the first line and the sheet would mount without a document.
    //
    // The spread preserves the rest of the options: previously, building a new object with three fields
    // discarded icon, width, height, and submitOnChange that the mixin had calculated.
    const documentId = props.documentId ?? props.actorId;
    super({ ...props, id: props.id || `actor-sheet-${documentId}`, title: props.title ?? '', documentId });
  }

  get actor(): DocType | null {
    return this.document;
  }

  get token(): any | null {
    // LoomVTT documents (like LiveActor) may have an optional token reference if they are synthetic.
    // If not, this safely returns undefined/null, preventing crashes in converted systems.
    return (this.document as any)?.token ?? null;
  }

  /** Uses the already loaded WorldCollection (`actor.system`/`.uuid`/`.items` only exist on LiveActor, not in the raw API JSON). Auto-heals: if the actor was created after the last collection load (e.g. just created this session), fetches directly and inserts into the collection. */
  protected async loadDocument(): Promise<void> {
    if (!this.options.documentId) return;
    let actor = actorsCollection.get(this.options.documentId);
    if (!actor) {
      const row = await api.get<any>(`${this.apiRoute}/${this.options.documentId}`);
      actor = actorsCollection.add(row);
    }
    // `LiveActor` dispara `prepareData()` no próprio construtor sem `await` (construtor não pode
    // ser async) — sem isto, a sheet lia `this.document` antes do preparo assíncrono do sistema
    // (ex.: wod5e aguardando `prepareAttributes`/`prepareSkills`) terminar, e `derivedData` chegava
    // vazio no primeiro render. Recomputa (idempotente — mesmos dados de entrada, mesmo resultado)
    // em vez de reaproveitar a chamada do construtor, mas garante que quem chama loadDocument()
    // só segue depois do preparo terminar.
    await (actor as any)?.prepareDerivedData?.();
    this.document = (actor as unknown as DocType) ?? null;
  }

  // Stub compatível — sistemas convertidos chamam `super.onConfigurePrototypeToken()`
  protected onConfigurePrototypeToken(): void {
    // TODO: implementar configuração de token protótipo real
  }

  // Stub compatível — sistemas convertidos chamam `super.onConfigureToken()`
  protected onConfigureToken(): void {
    // TODO: implementar configuração de token real
  }

  // Stub compatível — sistemas convertidos chamam `super.onShowPortraitArtwork()`
  protected onShowPortraitArtwork(): void {
    // TODO: implementar exibição de arte do retrato real
  }

  // Stub compatível — sistemas convertidos chamam `super.onShowTokenArtwork()`
  protected onShowTokenArtwork(): void {
    // TODO: implementar exibição de arte do token real
  }

  // Stub compatível — sistemas convertidos chamam `super._dragDrop()`
  protected _dragDrop(event: DragEvent): void {
    // Delegate to existing drag drop handlers
    if (this._canDragStart(event.target as HTMLElement)) {
      this._onDragStart(event);
    }
  }
}
