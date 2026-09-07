/*******************************************************************************
 * LoomVTT
 * client/windows/document-sheet.ts
 * 
 * 
 * Base class for rendering document sheets.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { wsClient } from '../core/ws-client.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { windowManager } from '../core/window-manager.js';
import { DragDropHandler, DragDropConfig } from '../lib/drag-drop.js';
import { LoomDragDrop } from '../lib/loom-drag-drop.js';
import { FilePickerWindow } from './file-picker-window.js';
import { clog } from '../lib/client-logger.js';
import { isPreparingData, warnCompatDeprecated } from '../core/client-document.js';
import { setProperty, expandFoundryUpdate } from '../core/utils.js';
import { applyTypeDataModelDefaults } from '../core/data-model.js';
import { gameContext } from '../core/game-context.js';
import { systemRegistry } from '../core/system-registry.js';

export abstract class LoomDocumentSheet<DocType extends Record<string, any> = any> extends BaseWindow {
  protected document: DocType | null = null;
  protected unsubscribe: (() => void) | null = null;
  private dragDropHandlers: DragDropHandler[] = [];
  protected globalDragDrop: LoomDragDrop | null = null;

  protected abstract get documentName(): string; // e.g., 'actor', 'item'
  protected abstract get apiRoute(): string; // e.g., '/actors', '/items'

  protected get dataKey(): string {
    return this.documentName === 'actor' ? 'systemData' : 'data';
  }

  /**
   * Runs the system data preparation cycle on the raw row coming
   * from the API — equivalent to `prepareData()` of an ApplicationV2 Document.
   *
   * The methods are called with `.call(row)`, so `this` inside them
   * points to the document object itself: they write the derived data
   * INSIDE the row the sheet already uses. We purposefully don't wrap the row in
   * LiveActor/LiveItem — those classes change the object shape (`items`
   * becomes a collection with `size` instead of an array with `length`, and disappears in a
   * spread because it's a prototype getter), which would break systems reading
   * `document.items` as an array.
   *
   * If the system hasn't registered `documentClass` in CONFIG (situation for all
   * installed systems today), returns the untouched row — no-op.
   * 
   * @param row - The raw document object retrieved from the database.
   * @returns A promise that resolves to the document with derived data applied.
   */
  protected async _runPrepareData(row: DocType): Promise<DocType> {
    if (!row) return row;
    const configKey =
      this.documentName === 'actor' ? 'Actor' :
        this.documentName === 'item' ? 'Item' : null;
    if (!configKey) return row;

    const config = (window as any).Loom?.config?.[configKey];

    // Fills in the schema defaults (`dataModels[type]`) BEFORE anything else — without this,
    // an unedited field (e.g. `blood.potency` on a new vampire) arrives undefined in
    // systemData and the system's `prepareDerivedData()` crashes on it. Runs even if the
    // system didn't register `documentClass`/`prepareData`: the template reads `system.blood.*`
    // directly, without going through any prepareData.
    // O nome do campo vem de `dataKey` (`systemData` pra Actor, `data` pra Item): hardcoded
    // em `systemData`, um Item recebia os defaults num campo que ninguém lê, enquanto o `data`
    // real ficava sem eles.
    const dataKey = this.dataKey;
    (row as any)[dataKey] = applyTypeDataModelDefaults(config?.dataModels, (row as any).type, (row as any)[dataKey]);

    // Acessor `system` → campo real do documento. Precisa ser definido AQUI, antes de qualquer
    // caminho de preparo: o ramo declarativo abaixo sai por `return` e, quando o acessor era
    // criado só no ramo legado lá embaixo, a row voltava sem `.system` nenhum — a ficha lia
    // `document.system.<campo>` como `undefined` e caía nos defaults do schema a cada
    // re-render (o dado certo continuava salvo, só não era exibido).
    if (!Object.getOwnPropertyDescriptor(row, 'system')) {
      Object.defineProperty(row, 'system', {
        get() { return (row as any)[dataKey]; },
        enumerable: true,
        configurable: true,
      });
    }

    // Native declarative path — takes priority over the legacy `documentClass` prototype-borrow
    // below. A system that registers `prepareData(actor)` via `systemRegistry.register({...})`
    // (see `LoomSystem` in `system-registry.ts`) never touches the compat shim at all. Same hook
    // name used for both actor and item rows, matching how the legacy path below already handles
    // both `documentName` cases identically.
    const activeSystem = systemRegistry.getActive();
    if (typeof activeSystem?.prepareData === 'function') {
      try {
        await activeSystem.prepareData(row);
      } catch (e: any) {
        clog.error(`[DOCUMENT-SHEET] prepareData nativo do sistema falhou para "${this.documentName}": ${e?.message || String(e)}`);
      }
      return row;
    }

    // `ClientDocument.prototype.prepareData` exists natively (see client-document.ts) — every
    // document class inherits it, including the default `LoomActor`/`LoomItem` shells that
    // `Loom.config.<Type>.documentClass` resolves to even when NO system has registered anything.
    // `typeof proto?.prepareData === 'function'` alone is always true, so it can't tell a real
    // converted-system override apart from that inherited default — check `hasOwnProperty`
    // instead: a system's own class (e.g. `class WoDActor { async prepareData() {...} }`) defines
    // it directly on its own prototype, the default shells don't.
    const proto = config?.documentClass?.prototype;
    if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'prepareData')) return row;

    warnCompatDeprecated('_runPrepareData (document-sheet.ts) — empréstimo de protótipo de sistema convertido');

    // Borrows the system class prototype for the row during the call.
    //
    // Calling `proto.prepareData.call(row)` DOES NOT work: the `prepareData` of the
    // DataModel encadeia (`this.reset()` → `prepareBaseData()` →
    // `prepareEmbeddedDocuments()` → `prepareDerivedData()`), and the row is a
    // simple object coming from the API JSON — it doesn't have any of these methods.
    // The chain crashed with `this.reset is not a function` at the first step,
    // and `prepareDerivedData` was never reached.
    //
    // With the borrowed prototype, `this.*` resolves normally (including
    // `super` calls from a system extending the base class), the derived data
    // is written inside the row itself, and the `finally` block returns the
    // row to its simple object condition — nothing of its shape changes.
    //
    // `await`: converted system's `prepareData()`/`prepareDerivedData()` can be
    // `async` (e.g. wod5e uses `await prepareAttributes(...)` internally). An `async` function
    // NEVER throws errors synchronously — even a throw on the first line becomes a rejected Promise.
    // rejected. Without `await` here, the `try/catch` below never saw anything: the call returned
    // immediately, the catch finished without catching anything, and the rejection escaped later as
    // "Uncaught (in promise)", with no useful stack in the correct flow.
    const originalProto = Object.getPrototypeOf(row);
    try {
      // O acessor `system` já foi definido lá em cima, antes dos dois caminhos de preparo.
      Object.setPrototypeOf(row, proto);
      this._preparingDataDepth++;
      await (row as any).prepareData();
    } catch (e: any) {
      // System calculation error cannot crash the entire sheet — the
      // sheet opens with the base data, and the reason is logged in the console.
      clog.error(`[DOCUMENT-SHEET] prepareData do sistema falhou para "${this.documentName}": ${e?.message || String(e)}`);
    } finally {
      this._preparingDataDepth--;
      Object.setPrototypeOf(row, originalProto);
    }
    return row;
  }

  /** Mesmo motivo do contador em `LiveActor` (actors-collection.ts): sistemas convertidos
   * chamam `this.update()` de dentro de `prepareDerivedData()` sem checar se o valor mudou
   * (bug real do wod5e), o que fecha um ciclo infinito de save → eco WS → preparar → save. */
  private _preparingDataDepth = 0;

  /** Attaches a lightweight `.update()` (non-enumerable — does not appear in spread/JSON.stringify)
   * directly on the raw row, without wrapping in LiveActor/LiveItem (see comment in
   * `_runPrepareData` above about why the document shape cannot change). Without this,
   * converted system scripts calling `actor.update(data)`/`item.update(data)` from
   * the sheet document worked only up to the first WS round-trip — the handler
   * for `${documentName}.updated` reassigned `this.document` through this same path, without
   * `.update()`, and the 2nd click would break. */
  protected _withUpdateMethod(row: DocType): DocType {
    if (!row) return row;
    if (typeof (row as any).update !== 'function') {
      Object.defineProperty(row, 'update', {
        value: async (data: Record<string, any>): Promise<DocType> => {
          // Checa os dois: o contador da ficha (preparo síncrono) e a marca no próprio
          // documento, que fica armada até o estágio assíncrono do sistema liquidar.
          // `data` chega no formato Foundry (`"system.dicepool.abc": {...}`, `"system.x.-=y": null`)
          // — sistemas convertidos ainda pensam nesse padrão. Loom chama esse campo `systemData`
          // (Actor) ou `data` (Item) e a rota PUT só reconhece esses nomes exatos; sem expandir,
          // a chave `system.*` não bate com nada e o servidor devolve 400 "No valid fields provided".
          const expandedData = expandFoundryUpdate(row as any, data, this.dataKey);

          if (this._preparingDataDepth > 0 || isPreparingData(row)) {
            // Mesmo tratamento de `LiveActor.update` — atribui local, nunca persiste.
            for (const [path, value] of Object.entries(expandedData)) setProperty(row as any, path, value);
            clog.debug(`[DOCUMENT-SHEET] "${this.documentName}" chamou update() durante o preparo de dados — aplicado localmente, sem persistir:`, data);
            return row;
          }
          const updated = await api.put<DocType>(`${this.apiRoute}/${(row as any).id}`, expandedData);
          Object.assign(row as any, updated);
          return row;
        },
        enumerable: false,
        configurable: true,
      });
    }
    // Mesma checagem de `LiveActor.testUserPermission` (actors-collection.ts) — sistemas
    // convertidos chamam isso direto no documento da própria ficha (`this.actor`/`this.item`),
    // que passa por aqui, não pela coleção. Sem o bypass de GM, até o GM ficava barrado em
    // documentos novos (nascem com `ownership: {}`).
    if (typeof (row as any).testUserPermission !== 'function') {
      Object.defineProperty(row, 'testUserPermission', {
        value: (
          user: { id?: string } | string,
          permissionLevel: number,
          { exact = false }: { exact?: boolean } = {},
        ): boolean => {
          const userId = typeof user === 'string' ? user : user?.id;
          const isCurrentUser = !userId || userId === gameContext.session?.userId;
          if (isCurrentUser && gameContext.isGM) {
            return exact ? permissionLevel === 3 : true;
          }
          const ownership = (row as any).ownership || {};
          const level = (userId ? ownership[userId] : undefined) ?? ownership.default ?? 0;
          return exact ? level === permissionLevel : level >= permissionLevel;
        },
        enumerable: false,
        configurable: true,
      });
    }
    return row;
  }

  /**
   * Preserves embedded collections (ChildrenField, e.g. `items`) that the WebSocket payload does not
   * bring. The server broadcast sends the raw document row; if the key doesn't even exist in the
   * payload, overwriting directly would delete the children that the `?populate=true` of
   * `loadDocument()` had brought in.
   *
   * The rule is strictly `undefined`, on purpose: an empty array in the payload is a real value
   * (the last item was deleted) and should overwrite.
   */
  protected _mergeChildren(incoming: DocType): DocType {
    if (!this.document || !incoming) return incoming;
    const merged: Record<string, any> = { ...incoming };
    for (const [key, value] of Object.entries(this.document)) {
      if (Array.isArray(value) && merged[key] === undefined) {
        merged[key] = value;
      }
    }
    return merged as DocType;
  }

  /** Fetches the document from the API before the first render. Without this `this.document` stays `null` until a WebSocket event or a save happens by chance — this is the bug that causes the sheet to open "dead". */
  protected async loadDocument(): Promise<void> {
    if (this.document) return;
    if (!this.options.documentId) return;
    try {
      // `?populate=true` is mandatory: without it the server doesn't populate ChildrenField
      // (document.items becomes undefined) and systems reading items see an empty list.
      const row = await api.get<DocType>(`${this.apiRoute}/${this.options.documentId}?populate=true`);
      // `_withUpdateMethod` PRECISA rodar antes de `_runPrepareData`: sistemas convertidos (wod5e)
      // chamam `this.update()` de DENTRO do `prepareDerivedData()`. Se o update seguro só for
      // anexado depois, essa chamada cai no `ClientDocument.prototype.update` cru (via o
      // prototype emprestado em `_runPrepareData`), que tenta montar a URL com `this.documentName`
      // — nunca setado, porque o objeto nunca passou pelo construtor de `ClientDocument`. Anexar
      // antes garante que a versão que checa `isPreparingData`/`_preparingDataDepth` (e só atribui
      // local, sem rede) já está lá quando o preparo chegar nessa chamada.
      this.document = await this._runPrepareData(this._withUpdateMethod(row));
    } catch (e: any) {
      clog.error(`[DOCUMENT-SHEET] Falha ao carregar documento "${this.options.documentId}": ${e?.message || String(e)}`);
    }
  }

  /** Recarrega o documento do zero (`?populate=true`) e re-renderiza — o WS reativo
   * (`wsClient.on` acima) depende do relay do servidor e de round-trips que podem atrasar
   * ou nunca chegar pra QUEM disparou a própria mudança; chamar isto direto depois de criar/
   * excluir um item embutido é determinístico e não depende de nenhum desses dois. */
  async _reloadDocument(): Promise<void> {
    if (!this.options.documentId) return;
    const row = await api.get<DocType>(`${this.apiRoute}/${this.options.documentId}?populate=true`);
    this.document = await this._runPrepareData(this._withUpdateMethod(row));
    this.rerenderBody();
  }

  protected async _prepareContext(): Promise<Record<string, any>> {
    const base = await super._prepareContext();
    const session = wsClient.session;
    return {
      ...base,
      document: this.document,
      editable: this.isEditable,
      // `system`/`items` in LiveActor/LiveItem are prototype getters (not own
      // properties) — the spread above does not copy them, so they must be explicitly re-attached
      // so `source` doesn't diverge from `document` in these two fields.
      source: this.document
        ? { ...this.document, system: (this.document as any).system, items: (this.document as any).items }
        : null,
      user: session ? { id: session.userId, role: session.userRole } : null,
      model: this.document,
    };
  }

  /** `mount()` pode rodar mais de uma vez na mesma instância (ex.: reabrir a ficha do mesmo
   * documento sem fechar a anterior). Sem essa guarda, a inscrição WS e os listeners de
   * change/input/submit abaixo duplicavam a cada chamada — `this.unsubscribe` só guarda o
   * último, os anteriores ficavam pendurados pra sempre, cada um reagindo ao mesmo evento. */
  private _reactiveListenersWired = false;

  async mount(): Promise<void> {
    await this.loadDocument();
    super.mount();

    this.element.classList.add('sheet', this.documentName);
    if (this.document?.type) {
      this.element.classList.add(this.document.type);
    }

    if (this._reactiveListenersWired) return;
    this._reactiveListenersWired = true;

    // Automatic WebSocket subscription for reactive updates
    const eventName = `${this.documentName}.updated`;
    // Entregas repetidas do MESMO evento (mesmo `updatedAt`, chegando a poucos ms de
    // distância — por que isso ainda acontece não está provado, mas acontece) faziam a ficha
    // reconstruir o corpo duas vezes seguidas; a segunda vinha com o dado do SERVIDOR, sem o
    // que o usuário tinha acabado de digitar, apagando a edição em andamento antes do
    // auto-save (debounced) sequer rodar. Agrupa entregas próximas da MESMA versão numa só —
    // não afeta o caso legítimo de duas mudanças reais em sequência, porque essas têm
    // `updatedAt` diferentes entre si.
    let lastHandledUpdatedAt: string | undefined;
    let lastHandledItemsSignature: string | undefined;
    this.unsubscribe = wsClient.on(eventName, async (doc: DocType) => {
      if (doc.id !== this.options.documentId) return;
      const incomingUpdatedAt = (doc as any).updatedAt;
      const currentUpdatedAt = (this.document as any)?.updatedAt;
      // Só descarta o que é ESTRITAMENTE mais antigo. Com `<=`, um broadcast em cascata
      // (mudou um item embarcado → servidor reemite o ator dono, ver `cascadeItemToActor`
      // em `api/items.ts`) chegava com o `updatedAt` do ATOR inalterado — igual ao atual —
      // e era jogado fora como "velho": a ficha do ator só refletia a mudança do item
      // depois de fechar e reabrir.
      if (incomingUpdatedAt && currentUpdatedAt && incomingUpdatedAt < currentUpdatedAt) return;
      // `cascadeItemToActor` reemite o ator com o MESMO `updatedAt` dele (só o item mudou,
      // não o ator) — comparar só `updatedAt` fazia a 2ª, 3ª, ... cascata seguida (criar mais
      // um item, renomear outro) ser descartada como "duplicata" da 1ª, mesmo carregando itens
      // diferentes: a ficha congelava no primeiro conjunto de itens e não pegava as mudanças
      // seguintes sem fechar e reabrir. Some a assinatura dos itens (id+updatedAt) na dedup —
      // só é duplicata de verdade se ATÉ os itens embutidos forem idênticos aos já aplicados.
      const items = (doc as any).items;
      const itemsSignature = Array.isArray(items)
        ? items.map((i: any) => `${i?.id}:${i?.updatedAt}`).join(',')
        : '';
      if (incomingUpdatedAt && incomingUpdatedAt === lastHandledUpdatedAt && itemsSignature === lastHandledItemsSignature) return;
      lastHandledUpdatedAt = incomingUpdatedAt;
      lastHandledItemsSignature = itemsSignature;
      // Mesmo motivo do `loadDocument()`: `_withUpdateMethod` precisa estar anexado ANTES do
      // `prepareData()` rodar, não depois.
      this.document = await this._runPrepareData(this._withUpdateMethod(this._mergeChildren(doc)));
      this.rerenderBody();
    });

    // Event listeners for change and secret actions
    this.element.addEventListener('change', (e) => this._onChangeForm(e));
    this.element.addEventListener('input', (e) => this._onChangeForm(e));
    this.element.addEventListener('click', (e) => {
      const secret = (e.target as HTMLElement).closest('.journal-secret');
      if (secret) this._onRevealSecret(e);
    });

    // Intercepts the actual form submission (submit)
    this.element.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.isEditable) return;

      const form = (e.target as HTMLElement).closest('form') as HTMLFormElement;
      if (!form) return;

      const fd = new LoomFormData(form);
      const changes: Record<string, any> = { ...fd.object };

      await this._updateObject(e, changes);
    });

    // Wire global drag-and-drop for the sheet body
    this.globalDragDrop = new LoomDragDrop({
      dropSelector: '.loom-window-body',
      callbacks: {
        drop: (e: DragEvent) => this._onDrop(e)
      }
    });
    this.globalDragDrop.bind(this.element);
  }

  protected _onChangeForm(event: Event): void {
    // Subclasses can hook into this when any form input changes
  }

  protected _onRevealSecret(event: Event): void {
    // Subclasses can hook into this or use the default reveal logic
    const secret = (event.target as HTMLElement).closest('.journal-secret');
    if (secret) {
      secret.classList.toggle('revealed');
    }
  }

  protected registerDragDrop(config: DragDropConfig): void {
    const handler = new DragDropHandler(this.element, config);
    this.dragDropHandlers.push(handler);
  }

  protected clearDragDrop(): void {
    for (const h of this.dragDropHandlers) h.destroy();
    this.dragDropHandlers = [];
  }

  protected onClose(): void {
    this.unsubscribe?.();
    this._reactiveListenersWired = false;
    for (const h of this.dragDropHandlers) h.destroy();
    this.dragDropHandlers = [];
  }

  protected async _onBeforeSubmit(): Promise<boolean> {
    return this.isEditable;
  }

  /**
   * Standard entry point to save data from a FormApplication.
   * Subclasses de modulos vao fazer override disso, entao essa classe base precisa existir.
   */
  protected async _updateObject(event: Event, formData: Record<string, any>): Promise<void> {
    if (!this.document) return;

    const diff: Record<string, any> = {};
    for (const key in formData) {
      if (formData[key] !== (this.document as any)[key]) {
        diff[key] = formData[key];
      }
    }

    if (Object.keys(diff).length > 0) {
      await (this.document as any).update(diff);
    }
  }

  /**
   * Centralized form submission pipeline
   */
  protected async _onSubmit(options: { close?: boolean } = {}): Promise<void> {
    if (!this.document) return;
    const body = this.element.querySelector<HTMLElement>('.loom-window-body');
    if (!body) return;

    const fd = new LoomFormData(body);
    if (fd.missing.length > 0) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const processed = this._processFormData(fd.object);
    try {
      await this._processSubmitData(processed);
      if (options.close) {
        showToast('Documento salvo com sucesso', 'success');
        windowManager.close(this.options.id);
      } else {
        this.setSaveStatus('saved');
      }
    } catch (e: any) {
      if (options.close) {
        showToast(e?.message || 'Erro ao salvar', 'error');
      } else {
        this.setSaveStatus('error');
        showToast(e?.message || 'Erro ao salvar', 'error');
      }
    }
  }

  /**
   * Bridge para sistemas que chamam this._prepareSubmitData(event, form, formData).
   * Adapta os args crus para o pipeline existente do Loom (_processFormData).
   * Nota: não executa validação client-side (Loom não tem DataModel.validate()).
   */
  protected _prepareSubmitData(event: Event, form: HTMLFormElement, formData: LoomFormData, updateData?: Record<string, any>): Record<string, any> {
    const processed = this._processFormData(formData.object);
    if (updateData) Object.assign(processed, updateData);
    return processed;
  }

  /**
   * Process submitted form data, nesting dynamic properties
   */
  protected _processFormData(formData: Record<string, any>): Record<string, any> {
    const name = formData.name || (this.document ? this.document.name : '');
    const sd = formData.sd || {};

    // Sistemas convertidos (ex: wod5e) nomeiam campos no formato Foundry `system.*`, não no
    // `sd:*` nativo do Loom — sem isto, esses campos eram descartados calado aqui (só `sd`
    // era lido) e o form devolvia sempre os dados antigos inalterados, mesmo com valor novo
    // no input. Reaproveita a mesma expansão usada em `ClientDocument.update()`.
    const expanded = expandFoundryUpdate(this.document ?? undefined, formData, this.dataKey);

    return {
      name,
      [this.dataKey]: {
        ...(expanded[this.dataKey] ?? (this.document ? this.document[this.dataKey] || {} : {})),
        ...sd
      }
    };
  }

  /**
   * Execute API PUT request to persist changes
   */
  /** Disjuntor no ponto único por onde TODO save de documento passa (auto-save, submit manual,
   * ou qualquer chamada programática de sistema convertido) — protege mesmo quando o loop não
   * vem do caminho de `input`/`change` do BaseWindow. Sem isso, um bug de render/WS que
   * realimenta submit → broadcast → re-render → submit martela o servidor pra sempre e trava
   * o navegador do cliente. */
  private static readonly PUT_BREAKER_LIMIT = 3;
  private static readonly PUT_BREAKER_WINDOW_MS = 1000;
  private putTimestamps: number[] = [];
  private putBreakerTripped = false;

  protected async _processSubmitData(submitData: Record<string, any>): Promise<void> {
    if (!this.document) return;
    if (this.putBreakerTripped) return;

    const now = Date.now();
    this.putTimestamps.push(now);
    this.putTimestamps = this.putTimestamps.filter((ts) => now - ts <= LoomDocumentSheet.PUT_BREAKER_WINDOW_MS);
    if (this.putTimestamps.length > LoomDocumentSheet.PUT_BREAKER_LIMIT) {
      this.putBreakerTripped = true;
      clog.error(
        `[LoomDocumentSheet] Save cortado: "${this.options.id}" tentou PUT ${this.putTimestamps.length}x em ${LoomDocumentSheet.PUT_BREAKER_WINDOW_MS}ms — provável loop de render/WS. Feche e reabra a janela.`,
      );
      showToast('Salvamento desligado nesta janela (loop detectado) — feche e reabra.', 'error');
      return;
    }

    const updated = await api.put<DocType>(`${this.apiRoute}/${this.document.id}`, submitData);
    this.document = updated;
  }

  /**
   * Deleta o documento (via `apiRoute`, mesmo padrão usado por save/load) e fecha a janela.
   */
  async delete(): Promise<void> {
    if (!this.document) return;
    await api.delete(`${this.apiRoute}/${this.document.id}`);
    windowManager.close(this.options.id);
  }

  /**
   * Programmatic submit
   */
  async submit(options: { close?: boolean } = {}): Promise<void> {
    if (await this._onBeforeSubmit()) {
      await this._onSubmit(options);
    }
  }

  private _debouncedAutoSave = ((window as any).Loom?.utils?.debounce?.(
    () => void this.submit({ close: false }),
    500
  ) as any) || (() => void this.submit({ close: false }));

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      void this.submit({ close: true });
    } else if (action === 'auto-save') {
      this._debouncedAutoSave();
    } else if (action === 'pick-portrait' || action === 'editImage') {
      // Fallback genérico — cobre qualquer sheet (sistema convertido via
      // LoomHandlebarsMixin) que use `data-action="pick-portrait"`/`"editImage"` no
      // template mas não implemente o handler na própria classe. Sem isso,
      // clicar no portrait de uma ficha que não é ActorSheetWindow (que já
      // trata isso sozinha) não fazia NADA — nem erro, nem log.
      void this.pickDocumentImage(target);
    }
  }

  /** Campo convencional: `avatarUrl` (actor) / `imgUrl` (item) — ou `data-edit="campo"` explícito no elemento clicado. */
  private async pickDocumentImage(target: HTMLElement): Promise<void> {
    if (!this.document || !this.options.documentId) return;
    const field = target.dataset.edit || (this.documentName === 'actor' ? 'avatarUrl' : 'imgUrl');
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: async (path: string) => {
        (this.document as any)[field] = path;
        this.rerenderBody();
        try {
          await api.put(`${this.apiRoute}/${this.options.documentId}`, { [field]: path });
        } catch (e: any) {
          clog.error(`[DOCUMENT-SHEET] Falha ao salvar "${field}" de "${this.options.documentId}": ${e?.message || String(e)}`);
          showToast(e?.message || 'Erro ao salvar imagem', 'error');
        }
      },
    });
  }

  protected _canDragStart(selector: string | HTMLElement): boolean {
    return this.isEditable;
  }

  protected _canDragDrop(selector: string | HTMLElement): boolean {
    return this.isEditable;
  }

  protected _onDragStart(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (event.dataTransfer && target.dataset) {
      // Create a plain object out of DOMStringMap
      const dataObj: Record<string, string> = {};
      for (const key in target.dataset) {
        dataObj[key] = target.dataset[key]!;
      }
      event.dataTransfer.setData('text/plain', JSON.stringify(dataObj));
    }
  }

  protected _onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected _onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const dataText = event.dataTransfer.getData('text/plain');
    if (!dataText) return;
    try {
      const data = JSON.parse(dataText);
      if (data.type === 'Item') void this._onDropItem(event, data);
      else if (data.type === 'Actor') void this._onDropActor(event, data);
      else if (data.type === 'ActiveEffect') void this._onDropActiveEffect(event, data);
      else if (data.type === 'Folder') void this._onDropFolder(event, data);
    } catch (e) {
      console.warn('LoomVTT | Dropped invalid JSON data', e);
    }
  }

  protected async _onDropItem(event: DragEvent, data: any): Promise<any> { }
  protected async _onDropActor(event: DragEvent, data: any): Promise<any> { }
  protected async _onDropActiveEffect(event: DragEvent, data: any): Promise<any> { }
  protected async _onDropFolder(event: DragEvent, data: any): Promise<any> { }
  protected async _onDropDocument(event: DragEvent, data: any): Promise<any> { }
  protected async _onSortItem(event: DragEvent, itemData: any): Promise<any> { }

  // Stub compatível — sistemas convertidos chamam `super._migrateConstructorParams(params)`
  protected _migrateConstructorParams(_params: any): void { }

  // Stub compatível — sistemas convertidos chamam `super.canConfigureOwnership()`  
  protected canConfigureOwnership(): boolean {
    return this.isEditable;
  }

  // Stub compatível — sistemas convertidos chamam `super.canConfigureSheet()`
  protected canConfigureSheet(): boolean {
    return this.isEditable;
  }

  // Stub compatível — sistemas convertidos chamam `super.onConfigureOwnership()`
  protected onConfigureOwnership(): void {
    // TODO: implementar configuração de ownership real
  }

  // Stub compatível — sistemas convertidos chamam `super.onConfigureSheet()`
  protected onConfigureSheet(): void {
    // TODO: implementar configuração de sheet real
  }

  // Stub compatível — sistemas convertidos chamam `super.onCopyUuid()`
  protected onCopyUuid(): void {
    // Usar copyTextToClipboard existente do projeto
    if (this.document?.uuid) {
      (window as any).Loom?.utils?.copyTextToClipboard?.(this.document.uuid);
    }
  }

  // Stub compatível — sistemas convertidos chamam `super.onDragStartCopyUuid()`
  protected onDragStartCopyUuid(event: DragEvent): void {
    if (event.dataTransfer && this.document?.uuid) {
      event.dataTransfer.setData('text/plain', this.document.uuid);
    }
  }

  // Stub compatível — sistemas convertidos chamam `super.onImportDocument()`
  protected onImportDocument(): void {
    // TODO: implementar importação de documento real
  }

  // Stub compatível — sistemas convertidos chamam `super.onSubmitDocumentForm()`
  protected onSubmitDocumentForm(): void {
    void this.submit({ close: false });
  }

  /** Whether this sheet is currently visible (rendered and not closed). */
  get isVisible(): boolean {
    return this.rendered;
  }

  get isEditable(): boolean {
    if (!this.document) return false;
    const session = wsClient.session;
    if (!session) return true;
    if ((session.userRole ?? 1) >= 4) return true; // GM
    const ownership = this.document.ownership || {};
    const perm = ownership[session.userId ?? ''] ?? ownership.default ?? 0;
    return perm >= 3; // Owner
  }

  protected _toggleDisabled(disabled: boolean): void {
    const form = this.element?.querySelector('form');
    if (!form) return;
    form.querySelectorAll('input, select, textarea, button').forEach((el) => {
      (el as HTMLInputElement).disabled = disabled;
    });
  }
}
