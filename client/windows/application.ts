/*******************************************************************************
 * LoomVTT
 * client/windows/application.ts
 *
 *
 * Base mixin for Handlebars-based applications.
 ******************************************************************************/

import { LoomDocumentSheet } from './document-sheet.js';
import { clog } from '../lib/client-logger.js';
import { BaseWindow, mergeOptionsChain } from './base-window.js';
import type { BaseWindowOptions } from './base-window.js';
import { renderTemplate } from '../core/render-template.js';
import { LoomDragDrop } from '../lib/loom-drag-drop.js';
import { api } from '../core/api.js';
import { LoomFormData } from '../core/form-data.js';
import { windowManager } from '../core/window-manager.js';
import { wsClient } from '../core/ws-client.js';
import { FilePickerWindow } from './file-picker-window.js';
import { copyTextToClipboard } from '../lib/clipboard.js';
import { showToast } from '../components/toast.js';
export type SheetActionHandler = (event: PointerEvent, target: HTMLElement) => void | Promise<void>;

export interface SheetPart {
  template: string;
  id?: string;
  classes?: string[];
  forms?: Record<string, any>;
}

export interface ApplicationOptions {
  classes?: string[];
  window?: { icon?: string; title?: string; resizable?: boolean };
  position?: { width?: number; height?: number };
  actions?: Record<string, SheetActionHandler>;
  form?: {
    submitOnChange?: boolean;
    closeOnSubmit?: boolean;
    handler?: (this: any, event: Event, form: HTMLElement, formData: LoomFormData) => void | Promise<void>;
  };
  dragDrop?: Array<{
    dragSelector?: string | null;
    dropSelector?: string | null;
    permissions?: Record<string, (selector: HTMLElement) => boolean>;
    callbacks?: Record<string, (event: DragEvent) => void>;
  }>;
}

type Constructor<T = {}> = new (...args: any[]) => T;
type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

/** Marca, em `Base` (propriedade estática, herdada normalmente por qualquer subclasse),
 * que o pipeline de render de verdade (mount/rerenderBody/compile/...) já existe em algum
 * ponto acima na cadeia de protótipos. Sistemas convertidos aplicam `LoomHandlebarsMixin`
 * em mais de um nível (`WoDActorBase extends LoomHandlebarsMixin(LoomActorSheet)`, depois
 * `VampireActorSheet extends LoomHandlebarsMixin(WoDActorBase)`) — sem essa marca, CADA
 * aplicação reimplementava o pipeline inteiro, e só um contador de profundidade
 * (`_mountDepth`/`_rerenderDepth`, removido nesta versão) impedia rodar tudo em duplicata.
 * Com a marca, a 2ª aplicação (e qualquer nível além dela) nem redefine `mount()`/etc — a
 * chamada resolve, por busca de protótipo normal, na ÚNICA implementação que existe na
 * cadeia inteira. Ver `LoomHandlebarsMixin` abaixo. */
const LOOM_ENGINE = Symbol('loomRenderEngine');

/**
 * Equivalente a `HandlebarsApplicationMixin`: uma função que recebe QUALQUER
 * base (`(Base) => class extends Base {...}`), não uma classe fixa — adiciona `static PARTS`
 * (render por template), `DEFAULT_OPTIONS` options-driven, `actions` por nome, dragDrop e form
 * pipeline a cima da base recebida.
 */
export function LoomHandlebarsMixin<
  DocType extends Record<string, any> = any,
  TBase extends AbstractConstructor<BaseWindow> = AbstractConstructor<BaseWindow>
>(Base: TBase) {
  const engineAlreadyApplied = !!(Base as any)[LOOM_ENGINE];

  /** Hooks/opções que sistemas convertidos sobrescrevem via `super.<hook>()` normal — isto
   * roda em CADA nível da cadeia (é assim que uma subclasse intermediária estende
   * comportamento), independente de onde o motor de render físico mora. */
  abstract class Hooks extends Base {
    /** Nome `static DEFAULT_OPTIONS` por convenção — sistemas convertidos declaram exatamente assim. Tipado como superset de `BaseWindowOptions` só pra satisfazer a herança estática do TS; o merge real (herdado de `BaseWindow`) usa só os campos de `ApplicationOptions`. */
    static DEFAULT_OPTIONS: Partial<BaseWindowOptions> & ApplicationOptions = {};
    static PARTS: Record<string, SheetPart> = {};
    static TABS: Record<string, any> = {};

    /** `this.options` carrega dragDrop/actions/form/window/... — sistemas convertidos leem `this.options.dragDrop` etc. direto. Redeclarado aqui pra widen o tipo herdado de `BaseWindow`. */
    declare protected options: BaseWindowOptions & ApplicationOptions;

    /** Sem inicializador de campo de propósito — sistemas convertidos aplicam este mixin
     * em mais de um nível da cadeia (`WoDActorBase extends LoomHandlebarsMixin(LoomActorSheet)`,
     * depois `VampireActorSheet extends LoomHandlebarsMixin(WoDActorBase)`). Um campo de classe
     * roda de novo em cada aplicação e zerava o `tabGroups` que a subclasse intermediária já
     * tinha setado — nenhuma aba nunca ficava `active`, ficha inteira renderizava em branco.
     * `declare` não emite atribuição em runtime; o valor real é resolvido no construtor abaixo. */
    declare public tabGroups: Record<string, string>;

    protected _prepareTabs(group: string): void { }

    constructor(...args: any[]) {
      // Alguns sistemas convertidos (ex.: SkillApplication do wod5e) chamam `super()` sem
      // nenhum argumento, contando só com `static DEFAULT_OPTIONS` — `args[0]` pode ser
      // genuinamente `undefined`, não é erro de quem chama.
      const windowOptions = (args[0] ?? {}) as { id: string; documentId?: string };
      // new.target já está disponível aqui (antes do super()), diferente de `this`. Só usado
      // aqui pra TRADUZIR o shape aninhado (window.title/position.width) pro shape
      // achatado que o construtor de `BaseWindow` espera — o merge de verdade (incluindo esses
      // mesmos campos aninhados em `this.options`) já roda dentro do `super()`, herdado de
      // `BaseWindow`, não precisa ser refeito aqui.
      const merged = mergeOptionsChain(new.target as any) as ApplicationOptions;
      // Repassa o que veio ANTES de sobrepor o que este mixin resolve. Antes daqui montava-se
      // um objeto novo com oito campos fixos, o que descartava tudo o que o chamador tivesse
      // mandado — inclusive a chave que identifica o documento. O `windowManager.open()` passa
      // `{ actorId }` (o `id` dele é só chave do Map, não chega no construtor), então
      // `documentId` chegava undefined, `loadDocument()` saía na primeira linha e a ficha
      // montava sem documento. Com o spread, a base especializada resolve a chave que conhece.
      super({
        ...(windowOptions as Record<string, any>),
        title: (windowOptions as any).title ?? merged.window?.title ?? '',
        icon: (windowOptions as any).icon ?? merged.window?.icon,
        width: merged.position?.width,
        height: merged.position?.height ?? 'auto',
        submitOnChange: merged.form?.submitOnChange ?? false,
        // `_onChangeForm` (mais abaixo nesta classe) lê `this.options.form?.submitOnChange` —
        // o campo achatado acima alimenta `wireSubmitOnChange()` (base-window.ts), um mecanismo
        // DIFERENTE. Sem repassar `form` aqui, `this.options.form` nunca existia, o `if` de
        // `_onChangeForm` nunca era verdadeiro, e nenhuma tecla digitada disparava salvamento
        // algum — zero requisição de rede, em qualquer sheet convertida que declare
        // `DEFAULT_OPTIONS.form = { handler, submitOnChange: true }` (padrão do wod5e).
        form: merged.form,
        showFooter: false,
      } as any);

      // BaseWindow descarta campos não nativos (como dragDrop e actions) ao aplicar defaults.
      // Re-injetamos a chain completa resolvida pra que a subclasse consiga acessar this.options.dragDrop etc.
      this.options = { ...this.options, ...merged };

      // Só define o default aqui (sem inicializador de campo — ver comentário na declaração
      // de `tabGroups` acima). Nesse ponto `super()` já rodou os campos de uma classe
      // intermediária que possa ter setado o valor real; só cai pra `{}` se nada setou.
      this.tabGroups = this.tabGroups ?? {};
    }

    /** Default lê de `options.title`; sistemas convertidos costumam sobrescrever com um getter dinâmico
     * (ex: `get title() { return this.actor.name }`, padrão usado em `GroupActorSheet`). Nem toda ficha
     * convertida faz isso (SPC/Vampire/Hunter/Werewolf/Mortal do wod5e não têm getter próprio) — sem
     * este fallback pro nome do documento já carregado, a barra de título mostrava o windowId cru
     * (`ACTOR-SHEET-<uuid>`) pra sempre, em vez do nome do ator. */
    get title(): string {
      if (this.options.title) return this.options.title;
      const docName = (this as any).document?.name;
      if (docName && docName !== 'undefined' && docName !== 'null') return docName;
      // @ts-ignore: O mixin pode estar envolvendo uma classe que define title, e precisamos respeitá-la
      return super.title;
    }

    protected async _prepareContext(): Promise<Record<string, any>> {
      const base = (super._prepareContext as Function) ? await (super._prepareContext as Function).call(this) : {};
      return {
        ...base,
        rootId: `${this.options.id}-root`,
        fields: undefined,
      };
    }

    /**
     * Nota sobre fields/model:
     * - `fields`: LoomVTT não tem schema de campos client-side equivalente ao
     *   DataModel.schema.fields para documentos de sistemas convertidos.
     *   O schema existe apenas no servidor (data/fields.ts). Omitido (undefined).
     * - `model`: Não há instância de DataModel client-side. this.document é o
     *   dado cru da API, sem métodos de modelo (ex: testUserPermission).
     *   Apontado para this.document como fallback mínimo.
     * - `source`: Cópia rasa de this.document para evitar mutação acidental
     *   pelos templates, já que o Loom não separa source/prepared data.
     */

    /** Chamado apenas no primeiro render (mount). Subclasses do sistema convertido usam pra setup único. */
    protected _onFirstRender?(): void | Promise<void>;

    /** Chamado após todo render (primeiro ou não). Subclasses do sistema convertido sobrescrevem pra religar listeners. */
    protected _onRender?(): void | Promise<void>;

    /** Hook protected - chamado ANTES de montar o HTML novo (antes do compile()), default no-op */
    protected _preRender(context?: Record<string, any>, options?: any): void {
      // Default implementation - call base without parameters for compatibility
      super._preRender();
    }

    /** Hook protected - prepara contexto específico para cada part, default retorna contexto base */
    protected _preparePartContext(partId: string, context: Record<string, any>, options?: any): Record<string, any> {
      return context;
    }

    /** Hook protected - chamado depois de _onRender, layout já assentado, default no-op */
    protected _postRender(context?: Record<string, any>, options?: any): void {
      // Default implementation - call base without parameters for compatibility
      super._postRender();
    }

    /** Stub compatível — sistemas convertidos fazem `super._getHeaderControls()` esperando um array de volta.
     *  Como o mixin substitui o do BaseWindow, delega pro BaseWindow pra que sheets customizadas
     *  mantenham os controles nativos de janela (copiar-UID, menu ⋮, etc.). Sem minimizar/popout
     *  por padrão — janelas de ficha custom não precisam. */
    protected _getHeaderControls(): any[] {
      return super._getHeaderControls().filter((c: any) => c.action !== 'minimize' && c.action !== 'popout');
    }

    /** Repassa pro nível abaixo na cadeia, igual `_preRender`/`_postRender` logo abaixo —
     * sem isto, aplicar `LoomHandlebarsMixin` duas vezes na mesma cadeia (padrão normal:
     * `SplatActorSheet extends LoomHandlebarsMixin(WoDActorBase)`, sendo que
     * `WoDActorBase` já é `LoomHandlebarsMixin(LoomActorSheet)`) gerava um SEGUNDO stub
     * vazio mais próximo na cadeia de protótipos, que sempre vencia a resolução de método
     * e apagava silenciosamente a implementação real que uma classe intermediária (ex:
     * `WoDActorBase`) tivesse escrito — nenhum override de `_configureRenderOptions` de
     * sistema convertido rodava de verdade, mesmo chamando `super()` corretamente. */
    protected _configureRenderOptions(_options: any): void {
      // Repassa pro `super` mais próximo que definir isto — só existe em classes
      // intermediárias de sistema convertido (compat Foundry, nunca em BaseWindow
      // nativa; não declarar isso lá, é dívida técnica só desse caminho de compat).
      // @ts-expect-error — `_configureRenderOptions` não é membro de BaseWindow.
      super._configureRenderOptions?.(_options);
    }

    protected onAction(action: string, id: string | null, target: HTMLElement): void {
      const handler = this.options.actions?.[action];
      if (handler) {
        const syntheticEvent = new PointerEvent('click');
        Object.defineProperty(syntheticEvent, 'target', { value: target, configurable: true });
        void handler.call(this, syntheticEvent, target);
      } else if (action === 'copyUuid') {
        const documentId = this.options.documentId || ((this as any).document as any)?.id;
        if (documentId) {
          copyTextToClipboard(documentId);
          showToast('ID copiado com sucesso!', 'success');
        }
      } else if (action === 'editImage') {
        const fieldName = target.dataset.edit;
        if (!fieldName) return;
        windowManager.open('file-picker', FilePickerWindow, {
          onSelect: (path: string) => {
            const input = this.element.querySelector(`[name="${fieldName}"]`) as HTMLInputElement | null;
            if (input) {
              input.value = path;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      } else if (action === 'configureSheet') {
        // TODO: sem equivalente Loom ainda, ver HANDOFF-documentsheet-default-actions.md
      } else if (action === 'configureOwnership') {
        // TODO: sem equivalente Loom ainda, ver HANDOFF-documentsheet-default-actions.md
      } else if (action === 'importDocument') {
        // TODO: sem equivalente Loom ainda, ver HANDOFF-documentsheet-default-actions.md
      } else if (typeof super.onAction === 'function') {
        // LoomDocumentSheet (base do mixin) trata 'save'/'auto-save' de verdade.
        super.onAction(action, id, target);
      } else {
        clog.warn(`[APPLICATION] Ação "${action}" não reconhecida — botão não faz nada.`);
      }
    }

    // Debounce local, sem depender de `Loom.utils.debounce` estar pronto no instante em
    // que esta classe é construída — o `||` de fallback antigo, se `Loom.utils.debounce`
    // não existisse ainda nesse momento, virava uma chamada SEM debounce nenhum: cada
    // tecla digitada disparava um submit completo (PUT + reload + re-render) na hora,
    // brigando com a própria digitação do usuário.
    private _appSubmitTimer: number | undefined;
    private _debouncedAppSubmit = (): void => {
      this.setSaveStatus('saving');
      window.clearTimeout(this._appSubmitTimer);
      this._appSubmitTimer = window.setTimeout(() => void this.submit({ close: false }), 500);
    };

    protected _onChangeForm(event: Event): void {
      if (this.options.form?.submitOnChange) {
        // ApplicationV2 chama requestSubmit, o que dispara o pipeline do handler.
        if (this.options.form?.handler) {
          this._debouncedAppSubmit();
        } else {
          // Sistema declarou `form: { submitOnChange: true }` mas sem
          // `form.handler` (caso comum — rpg-generic é assim). Antes disso
          // caía em `super._onChangeForm(event)`, que é um stub VAZIO em
          // LoomDocumentSheet — `submitOnChange: true` não fazia nada,
          // silenciosamente, exatamente igual o bug do wireSubmitOnChange em
          // base-window.ts (mecanismo irmão, mesmo problema).
          this._debouncedAppSubmit();
        }
      }
    }

    protected async _onSubmit(options: { close?: boolean } = {}): Promise<void> {
      const handler = this.options.form?.handler;
      if (handler) {
        const body = this.element.querySelector<HTMLFormElement>('.loom-window-body form') || this.element.querySelector<HTMLElement>('.loom-window-body');
        if (!body) return;

        const fd = new LoomFormData(body);
        const event = new Event('submit', { cancelable: true }); // Dummy event

        try {
          // form.handler signature: handler(event, formElement, formDataExtended)
          await handler.call(this, event, body, fd);
          if (options.close) {
            windowManager.close(this.options.id);
          } else {
            this.setSaveStatus('saved');
          }
        } catch (e: any) {
          // Ignora erros normais da aplicação ou toast pra debug
          console.error('Submit handler error:', e);
          if (!options.close) {
            this.setSaveStatus('error');
          }
        }
      } else {
        // Fallback pra V1 / schema-driven
        await super._onSubmit(options);
      }
    }

    // ════════════════════════════════════════════════
    // STUBS DE COMPATIBILIDADE (APPLICATION V2 / MIXIN)
    // ════════════════════════════════════════════════

    get parts(): any { return (this.constructor as any).PARTS; }
    _getTabsConfig(): any[] { return []; }
    _onClickTab(): void { }
    _initializeApplicationOptions(): void { }
    _configureRenderParts(): void { }
    callHooks(): void { }
    async submit(options?: { close?: boolean }): Promise<void> {
      return this._onSubmit(options);
    }
  }

  if (engineAlreadyApplied) {
    // Motor de render já existe em algum nível acima (a 1ª aplicação de LoomHandlebarsMixin
    // nesta cadeia) — não redefine mount()/rerenderBody()/compile()/etc aqui. A chamada
    // resolve, por busca de protótipo normal, na única implementação que existe na cadeia.
    return Hooks as unknown as typeof WithEngine;
  }

  /** Motor de render de verdade — existe em EXATAMENTE UM lugar da cadeia de protótipos
   * (a primeira vez que `LoomHandlebarsMixin` é aplicado). Sem contador de profundidade:
   * se este código está rodando, é porque `engineAlreadyApplied` era `false`, ou seja, não
   * existe outra cópia acima nem vai existir uma redefinição abaixo (aplicações
   * subsequentes de `LoomHandlebarsMixin` na mesma cadeia devolvem só `Hooks`, sem motor). */
  abstract class WithEngine extends Hooks {
    private compiledHtml = '<div class="empty-state"><p>Carregando...</p></div>';
    private _firstRenderDone = false;
    private _rerenderInFlight: Promise<void> | null = null;
    private _rerenderPending = false;
    private partsDragDrop: LoomDragDrop[] = [];

    async mount(): Promise<void> {
      // O documento PRECISA estar carregado antes de _prepareContext()/compile(): quem chama
      // loadDocument() é LoomDocumentSheet.mount(), que só roda no super.mount() lá embaixo.
      // Sem isto, contexto e template são montados com this.document === null e a ficha abre
      // vazia (ou estoura em overrides de sistema que leem this.actor.*). loadDocument() tem
      // guarda `if (this.document) return`, então a chamada no super.mount() vira no-op.
      // O `?.()` cobre o caso do mixin aplicado sobre uma base sem LoomDocumentSheet.
      await (this as any).loadDocument?.();

      // Call _preRender before HTML generation
      const context = await this._prepareContext();
      await this._preRender(context, this.options);

      await this.compile();

      // Handle DOM replacement with state preservation
      const newBody = document.createElement('div');
      newBody.innerHTML = this.compiledHtml;
      const newParts = newBody.querySelectorAll('.sheet-part');
      const oldParts = this.element?.querySelectorAll('.sheet-part');

      // Preserve state for each part (only on re-render, not first mount)
      if (oldParts && oldParts.length > 0) {
        newParts.forEach((newPart, index) => {
          const partId = newPart.getAttribute('data-application-part');
          const oldPart = oldParts[index];
          if (partId && oldPart) {
            this._preSyncPartState(partId, newPart as HTMLElement, oldPart as HTMLElement);
          }
        });
      }

      await super.mount();

      // Restore state and attach listeners
      newParts.forEach((newPart, index) => {
        const partId = newPart.getAttribute('data-application-part');
        const oldPart = oldParts[index];
        if (partId && oldPart) {
          this._syncPartState(partId, newPart as HTMLElement, oldPart as HTMLElement);
          this._attachPartListeners(partId, newPart as HTMLElement, this.options);
        }
      });

      this.element.classList.add(...(this.options.classes ?? []));
      this.updateTitle();
      this.wireDragDrop();

      // Tab navigation delegation
      this.element.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabEl = target.closest<HTMLElement>('[data-tab][data-group]');
        if (tabEl) {
          e.preventDefault();
          const tab = tabEl.getAttribute('data-tab');
          const group = tabEl.getAttribute('data-group');
          if (tab && group) {
            this.changeTab(tab, group, { event: e });
          }
        }
      });

      // Sync active tabs on initial mount
      for (const [group, tab] of Object.entries(this.tabGroups)) {
        this.changeTab(tab, group, { force: true });
      }

      if (!this._firstRenderDone) {
        this._firstRenderDone = true;
        void this._onFirstRender?.();
        // Sistemas convertidos (wod5e) recomputam dados derivados assíncronos (`prepareAttributes`/
        // `prepareSkills`) em pontos fora desta cadeia de `await` (ex.: cache de import dinâmico,
        // dado que só fica pronto um instante depois do primeiro compile). O primeiro render pode
        // sair com listas vazias mesmo com tudo aguardado aqui — um segundo `rerenderBody()`
        // automático (mesma coisa que qualquer clique já dispara hoje) garante que a ficha se
        // autocorrija sem depender do usuário interagir primeiro.
        queueMicrotask(() => this.rerenderBody());
      }
      void this._onRender?.();
      void this._postRender(context, this.options);
    }

    protected rerenderBody(): void {
      if (this._rerenderInFlight) {
        // Já tem um render rolando — não empilha outro, só marca que precisa
        // rodar mais uma vez (uma só, não importa quantas chamadas cheguem
        // nesse meio-tempo) assim que o atual terminar.
        this._rerenderPending = true;
        return;
      }
      this._rerenderInFlight = this._doRerenderBody().finally(() => {
        this._rerenderInFlight = null;
        if (this._rerenderPending) {
          this._rerenderPending = false;
          this.rerenderBody();
        }
      });
    }

    private _doRerenderBody(): Promise<void> {
      return this.compile().then(async () => {
        // Call _preRender before HTML generation
        const context = await this._prepareContext();
        await this._preRender(context, this.options);

        // Handle DOM replacement with state preservation
        const newBody = document.createElement('div');
        newBody.innerHTML = this.compiledHtml;
        const newParts = newBody.querySelectorAll('.sheet-part');
        const oldParts = this.element.querySelectorAll('.sheet-part');

        // Preserve state for each part
        newParts.forEach((newPart, index) => {
          const partId = newPart.getAttribute('data-application-part');
          const oldPart = oldParts[index];
          if (partId && oldPart) {
            this._preSyncPartState(partId, newPart as HTMLElement, oldPart as HTMLElement);
          }
        });

        super.rerenderBody();

        // Restore state and attach listeners
        newParts.forEach((newPart, index) => {
          const partId = newPart.getAttribute('data-application-part');
          const oldPart = oldParts[index];
          if (partId && oldPart) {
            this._syncPartState(partId, newPart as HTMLElement, oldPart as HTMLElement);
            this._attachPartListeners(partId, newPart as HTMLElement, this.options);
          }
        });

        this.updateTitle();
        this.wireDragDrop();

        // Sync active tabs after re-render
        for (const [group, tab] of Object.entries(this.tabGroups)) {
          this.changeTab(tab, group, { force: true });
        }

        void this._onRender?.();
        void this._postRender(context, this.options);
      });
    }

    protected async compile(): Promise<void> {
      try {
        const PARTS = (this.constructor as unknown as { PARTS: Record<string, SheetPart> }).PARTS;
        // Foundry real pré-popula `options.parts` com todas as chaves antes de chamar
        // `_configureRenderOptions` — overrides de sistema convertido (ex: visão "limited")
        // só FILTRAM esse array, nunca o constroem do zero. Sem semear aqui, a primeira
        // chamada sempre via `options.parts` undefined e o filtro (`Array.isArray` guard)
        // nunca disparava.
        (this.options as any).parts = Object.keys(PARTS);
        this._configureRenderOptions(this.options);
        // `_configureRenderOptions` (chamada acima) é onde sistemas convertidos restringem
        // quais PARTS renderizar (ex: visão "limited" — só o resumo público, sem o resto da
        // ficha). Sem este filtro o array virava um no-op puro: nada aqui nunca consultava
        // `this.options.parts`, então TODA parte declarada em `static PARTS` sempre renderizava,
        // mesmo as que o sistema queria excluir.
        const requestedParts = (this.options as any)?.parts;
        const entries = Array.isArray(requestedParts) && requestedParts.length > 0
          ? Object.entries(PARTS).filter(([partId]) => requestedParts.includes(partId))
          : Object.entries(PARTS);
        const context = await this._prepareContext();
        const parts = await Promise.all(
          entries.map(async ([partId, part]) => {
            const partContext = await this._preparePartContext(partId, { ...context }, this.options);
            const html = await renderTemplate(part.template, partContext);
            const element = this.parsePartHTML(partId, part, html);
            return element.outerHTML;
          }),
        );
        this.compiledHtml = parts.join('\n');
      } catch (e: any) {
        // Isso cobria QUALQUER erro de _preparePartContext/renderTemplate (bug
        // no contexto do sistema, template com typo, campo undefined, etc.)
        // botando só uma div genérica no corpo da ficha — sem nenhuma linha
        // no console. Resultado: ficha inteira em branco, zero pista de qual
        // das N partes falhou nem por quê. Provável causa raiz de "ficha não
        // funciona, nem erro nem nada" pra qualquer sistema no padrão
        // ApplicationV2 (rpg-generic, wod5e, sw-saga-edition, etc.).
        const detail = e instanceof Error ? (e.stack || e.message) : String(e);
        clog.error(`[APPLICATION] Falha ao renderizar sheet "${this.options.id}": ${detail}`);
        this.compiledHtml = `<div class="empty-state"><p>Erro ao renderizar sheet: ${this.esc(e?.message || String(e))}</p></div>`;
      }
    }

    bodyTemplate(): string {
      return this.compiledHtml;
    }

    /** Parse HTML para um part específico, aplicando atributos corretos */
    private parsePartHTML(partId: string, part: SheetPart, html: string): HTMLElement {
      const element = document.createElement('div');
      element.innerHTML = html.trim();

      // Use the single root element if present (skipping comment/whitespace nodes),
      // otherwise wrap all child nodes in the container element.
      const targetElement = (element.childElementCount === 1 && element.firstElementChild instanceof HTMLElement)
        ? element.firstElementChild
        : element;

      targetElement.dataset.applicationPart = partId;
      if (part.id) targetElement.id = `${this.options.id}-${part.id}`;
      if (part.classes) targetElement.classList.add(...part.classes);
      return targetElement;
    }

    /**
     * Estado preservado entre renders, por part. Guardado na INSTÂNCIA, não no elemento:
     * o `newEl` passado pro ciclo de sync vem de um `<div>` desanexado usado só pra medir,
     * enquanto o DOM real recebe uma segunda análise da mesma string — anotar nele significa
     * anotar num nó que é descartado, e a restauração não chega na tela.
     */
    private partStates = new Map<string, {
      focus?: string;
      focusValue?: string;
      scroll: Array<[string, number, number]>;
      details: Record<string, boolean>;
    }>();

    /** Elemento vivo desta part na janela, ou `null` se ainda não foi montado. */
    private livePart(partId: string): HTMLElement | null {
      return this.element?.querySelector<HTMLElement>(`[data-application-part="${partId}"]`) ?? null;
    }

    /** Lê o estado visível da part ANTES da troca de DOM. */
    private _preSyncPartState(partId: string, _newEl: HTMLElement, oldEl: HTMLElement): void {
      const state: { focus?: string; focusValue?: string; scroll: Array<[string, number, number]>; details: Record<string, boolean> } =
        { scroll: [], details: {} };

      // Foco guardado como SELETOR, não como referência: o elemento focado é destruído na
      // troca de DOM, então guardar o nó não serve pra nada — precisa ser reencontrado no
      // HTML novo. Casa com a regra anti-blur (salvar por `name`).
      const focused = oldEl.querySelector<HTMLElement>(':focus');
      if (focused?.id) {
        state.focus = `#${CSS.escape(focused.id)}`;
      } else {
        const named = focused?.closest<HTMLElement>('[name]');
        const name = named?.getAttribute('name');
        if (named && name) state.focus = `${named.tagName}[name="${CSS.escape(name)}"]`;
      }

      // O valor digitado, não só o foco: um re-render disparado NO MEIO da digitação (eco de
      // WS de qualquer outra mudança, própria ou de outro usuário — não precisa ser deste
      // mesmo campo) reconstrói o input com o valor antigo do SERVIDOR, perdendo o que o
      // usuário já tinha digitado e ainda não foi salvo (o auto-save é debounced 500ms;
      // qualquer re-render antes disso apagava o rascunho sem erro nenhum). Sem isto era
      // exatamente o sintoma "digita e o campo volta vazio".
      if (state.focus && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)) {
        state.focusValue = focused.value;
      }

      // Só a raiz da part. Antes daqui havia uma lista de seletores de um sistema específico
      // chumbada no core (`.skills-list`, `.merits-list`, ...) — core não conhece CSS de
      // sistema. Genérico e sem campo novo: quem rola de verdade é o container da part.
      state.scroll.push(['', oldEl.scrollTop, oldEl.scrollLeft]);

      // `<details>` opta por participar via `data-sync`, com `id` como alternativa. Antes a
      // chave era o texto do <summary> — mudava o texto (nome de item, contador), perdia o
      // estado e reabria fechado.
      for (const el of oldEl.querySelectorAll<HTMLDetailsElement>('details[data-sync], details[id]')) {
        const key = el.dataset.sync || el.id;
        if (key) state.details[key] = el.open;
      }

      this.partStates.set(partId, state);
    }

    /** Reaplica o estado no DOM vivo DEPOIS da troca. */
    private _syncPartState(partId: string, _newEl: HTMLElement, _oldEl: HTMLElement): void {
      const state = this.partStates.get(partId);
      if (!state) return;
      const live = this.livePart(partId);
      if (!live) return;

      for (const [selector, scrollTop, scrollLeft] of state.scroll) {
        const el = selector === '' ? live : live.querySelector<HTMLElement>(selector);
        if (el) { el.scrollTop = scrollTop; el.scrollLeft = scrollLeft; }
      }

      for (const [key, open] of Object.entries(state.details)) {
        const el = live.querySelector<HTMLDetailsElement>(`details[data-sync="${key}"], details#${CSS.escape(key)}`);
        if (el) el.open = open;
      }

      // Foco por último: restaurar antes das trocas acima faria o navegador rolar o
      // container pro elemento focado e desfazer o scroll que acabamos de reaplicar.
      if (state.focus) {
        const el = live.querySelector<HTMLElement>(state.focus);
        if (el) {
          // Restaura o rascunho ANTES de focar — se restaurasse depois, o `setSelectionRange`
          // abaixo posicionaria o cursor com base no valor do SERVIDOR, não no que acabou de
          // ser reescrito.
          if (state.focusValue !== undefined && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
            el.value = state.focusValue;
          }
          el.focus();
          const input = el as HTMLInputElement;
          // Cursor no fim, senão digitar num campo que re-renderiza joga o caret pro começo.
          if (typeof input.setSelectionRange === 'function' && typeof input.value === 'string') {
            try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* type não suporta seleção */ }
          }
        }
      }

      this.partStates.delete(partId);
    }

    /** Anexa listeners para forms declarados em part.forms */
    private _attachPartListeners(partId: string, htmlElement: HTMLElement, options: any): void {
      const part = (this.constructor as unknown as { PARTS: Record<string, SheetPart> }).PARTS[partId];
      if (!part?.forms) return;

      Object.entries(part.forms).forEach(([formSelector, formConfig]) => {
        const form = htmlElement.querySelector(formSelector) as HTMLFormElement | null;
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const handler = this.options.form?.handler;
            if (handler) {
              const fd = new LoomFormData(form);
              const event = new Event('submit', { cancelable: true });
              void handler.call(this, event, form, fd);
            }
          });

          if (formConfig?.onChange) {
            form.addEventListener('change', (e) => {
              if (this.options.form?.submitOnChange) {
                void this.submit({ close: false });
              }
            });
          }
        }
      });
    }

    /** BaseWindow renderiza `options.title` uma vez no HTML; sistemas convertidos costumam sobrescrever `get title()` na instância — refletimos isso manualmente após cada render. Getter de sistema convertido pode assumir documento carregado (ex: `this.actor.name`) — se `loadDocument()` falhou, não deixa isso derrubar o resto do mount/render. */
    private updateTitle(): void {
      try {
        const titleEl = this.element?.querySelector('.loom-window-title-text');
        if (titleEl && this.title) titleEl.textContent = this.title;
      } catch {
        // título dinâmico do sistema convertido depende de documento não carregado — mantém o título default, não quebra o mount.
      }
    }

    private wireDragDrop(): void {
      for (const h of this.partsDragDrop) h.unbind();
      this.partsDragDrop = [];
      for (const cfg of this.options.dragDrop ?? []) {
        // Bind condicional — nem toda subclasse define os 5 métodos (ex: CompendiumBrowser
        // não tem `_onDrop`); `.bind()` de `undefined` estourava "Cannot read properties of
        // undefined (reading 'bind')" pra qualquer classe que não implementasse um deles.
        const bindIfDefined = (fn: any) => typeof fn === 'function' ? fn.bind(this) : undefined;
        const ddConfig = {
          ...cfg,
          permissions: {
            dragstart: cfg.permissions?.dragstart ?? bindIfDefined((this as any)._canDragStart),
            drop: cfg.permissions?.drop ?? bindIfDefined((this as any)._canDragDrop),
          },
          callbacks: {
            dragstart: cfg.callbacks?.dragstart ?? bindIfDefined((this as any)._onDragStart),
            dragover: cfg.callbacks?.dragover ?? bindIfDefined((this as any)._onDragOver),
            drop: cfg.callbacks?.drop ?? bindIfDefined((this as any)._onDrop),
          }
        };
        const dd = new LoomDragDrop(ddConfig).bind(this.element);
        this.partsDragDrop.push(dd);
      }
    }

    public changeTab(tab: string, group: string, options?: { event?: Event; force?: boolean }): void {
      if (!tab || !group) return;
      if (!options?.force && this.tabGroups[group] === tab) return;

      this.tabGroups[group] = tab;

      // Update Tab Navigation Items
      const navItems = this.element.querySelectorAll(`[data-group="${group}"][data-tab]`);
      navItems.forEach(el => {
        if (el.getAttribute('data-tab') === tab) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      // Update Tab Content Sections
      const contentItems = this.element.querySelectorAll(`.tab[data-group="${group}"]`);
      contentItems.forEach(el => {
        if (el.getAttribute('data-tab') === tab) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }

    protected onClose(): void {
      for (const h of this.partsDragDrop) h.unbind();
      this.partsDragDrop = [];
    }

    private esc(text: unknown): string {
      const div = document.createElement('div');
      div.textContent = String(text ?? '');
      return div.innerHTML;
    }
  }

  (WithEngine as any)[LOOM_ENGINE] = true;
  return WithEngine;
}
