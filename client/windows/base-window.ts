/*******************************************************************************
 * LoomVTT
 * client/windows/base-window.ts
 * 
 * 
 * Base window class handling geometry, drag, and rendering lifecycle.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { windowManager } from '../core/window-manager.js';
import { showContextMenu, ContextMenuItem } from '../components/context-menu.js';
import { showToast } from '../components/toast.js';
import { LoomHooks } from '../core/hooks.js';
import { attachWindow as popoutAttach, detachWindow as popoutDetach, isPoppedOut } from '../lib/popout.js';
import { copyTextToClipboard } from '../lib/clipboard.js';
import { clog } from '../lib/client-logger.js';
import { preserveFocusAcrossRender, attachDataActionDispatch } from '../lib/dom-render.js';

function isPlainObject(v: any): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 
 * Arrays concat, objects merge recursively, everything else the most derived subclass overwrites — same rule as ApplicationV2 _initializeApplicationOptions. 
 * 
 * @param base - The base object to merge into.
 * @param incoming - The incoming options to merge over the base.
 * @returns A new object with the merged options.
 */
export function deepMergeOptions(base: any, incoming: any): any {
  if (incoming === undefined) return base;
  if (Array.isArray(base) && Array.isArray(incoming)) return [...base, ...incoming];
  if (isPlainObject(base) && isPlainObject(incoming)) {
    const out: Record<string, any> = { ...base };
    for (const key of Object.keys(incoming)) {
      out[key] = key in out ? deepMergeOptions(out[key], incoming[key]) : incoming[key];
    }
    return out;
  }
  return incoming;
}

/** 
 * Traverses the entire inheritance chain (from base to most-derived) collecting `static DEFAULT_OPTIONS`. Each level that declares its OWN `DEFAULT_OPTIONS` is merged, not just the most derived. 
 * 
 * @param ctor - The constructor function (class) to analyze.
 * @returns A flattened object containing all default options from the inheritance chain.
 */
export function mergeOptionsChain(ctor: any): Record<string, any> {
  const chain: Record<string, any>[] = [];
  let c = ctor;
  while (c && typeof c === 'function') {
    if (Object.prototype.hasOwnProperty.call(c, 'DEFAULT_OPTIONS')) chain.unshift(c.DEFAULT_OPTIONS);
    c = Object.getPrototypeOf(c);
  }
  return chain.reduce((acc, o) => deepMergeOptions(acc, o), {});
}

export interface BaseWindowOptions {
  id: string;
  title: string;
  icon?: string;
  width?: number | 'auto';
  classes?: string[] | string;
  /** `'auto'` lets the initial height be calculated by actual content (scrollHeight), respecting max-height: 90vh. */
  height?: number | 'auto';
  /** Optional: image URL (e.g., '/images/general-banners/map-banner.png') for header gradient */
  bannerImage?: string;
  documentId?: string;
  /** Regra 5: auto-dispatches a debounced "auto-save" action on any field input/change. */
  submitOnChange?: boolean;
  /** Whether to show the default cancel/save footer. Defaults to true. */
  showFooter?: boolean;
  /** Custom label for the cancel/close button in the footer. Defaults to 'Fechar' if submitOnChange is true, or 'Cancelar' otherwise. */
  cancelLabel?: string;
  /** Custom label for the save button in the footer. Defaults to 'Salvar'. */
  saveLabel?: string;
  /** If true, anchors the window near the top of the screen instead of centering vertically. Used by small utility dialogs. */
  anchorTop?: boolean;
  /** Whether the window can be resized by the user. Defaults to true. */
  resizable?: boolean;
  /** If true, the window won't clip content that spills outside its bounding box.
   * By default, it clips everything (`overflow: hidden`) to prevent unwanted visual spillage;
   * only enable this when the system/addon really needs it. */
  allowOverflow?: boolean;
  /** How much content spills outside the window rectangle (px) when `allowOverflow`
   * is true — e.g., a floating side tab sticking out 70px to the left. `constrainToViewport()`
   * uses this to prevent dragging the window so close to the screen edge that the spilled
   * content is pushed outside the viewport and becomes inaccessible. */
  overflowMargin?: number;
}

export abstract class BaseWindow {
  protected element!: HTMLElement;
  private isDragging = false;
  private dragStart = { x: 0, y: 0, windowX: 0, windowY: 0, maxLeft: 0, maxTop: 0 };
  private isResizing = false;
  private submitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveStatusTimeout: ReturnType<typeof setTimeout> | null = null;
  private previousFocusedElement: HTMLElement | null = null;
  private boundEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundFocusTrapHandler: ((e: KeyboardEvent) => void) | null = null;
  private childIds: Set<string> = new Set();
  /**
   * Set to true in a subclass to enable the popout button in the header.
   * Only enable on one window at a time for now.
   */
  protected popoutEnabled = false;

  /**
   * Whether the window closes itself after a successful save.
   *
   * Default is true — expected behavior for config dialogs, making save symmetrical with cancel.
   * Leave false in editors where saving is a checkpoint (e.g. macro editor, active character sheet).
   */
  protected closeOnSave = true;

  protected isMinimized = false;
  private originalHeight: string | null = null;

  /**
   * Default options for this window class, merged with constructor args.
   * Subclasses SHOULD override to set defaults (width, height, icon, etc.)
   * and MAY narrow the type to enforce required constructor props.
   */
  static DEFAULT_OPTIONS: Partial<BaseWindowOptions> = {};

  abstract bodyTemplate(): string;

  /** Hook called before the first mount render. */
  protected _preFirstRender(): void { }

  /** Hook called before the body content is rendered or updated. */
  protected _preRender(): void { }

  /** Hook called after the window is fully rendered. */
  protected _postRender(): void { }

  /** Called after the window is re-attached to the main workspace. */
  protected _postAttach(from: any, to: any): void { }
  /** Called after the window is detached from the main workspace. */
  protected _postDetach(from: any, to: any): void { }

  /** Async pre-close hook. Awaited in destroy() before onClose(). */
  protected async _preClose(options?: any): Promise<void> { }

  /**
   * Create a ContextMenu bound to a selector.
   */
  protected _createContextMenu(handler: any, selector: string, options?: any): void { }

  /** Interop bridge: delegates to Loom `onClose()`. Converted systems call `super._onClose()`. */
  protected _onClose(options?: any): void {
    this.onClose?.();
  }

  /**
   * Sets or clears the visual auto-save status indicator in the window header.
   *
   * @param status - The save state ('idle', 'saving', 'saved', or 'error').
   * @param message - Optional custom text to display next to the icon.
   */
  public setSaveStatus(status: 'idle' | 'saving' | 'saved' | 'error', message?: string): void {
    const el = this.element?.querySelector<HTMLElement>('.loom-window-save-status');
    if (!el) return;
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
      this.saveStatusTimeout = null;
    }
    el.className = 'loom-window-save-status';
    if (status === 'idle') {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'inline-flex';
    el.style.opacity = '1';
    if (status === 'saving') {
      el.classList.add('is-saving');
      el.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${message || 'Salvando...'}</span>`;
    } else if (status === 'saved') {
      el.classList.add('is-saved');
      el.innerHTML = `<i class="fa-solid fa-check"></i> <span>${message || 'Salvo'}</span>`;
      this.saveStatusTimeout = setTimeout(() => {
        el.style.opacity = '0';
        this.saveStatusTimeout = setTimeout(() => {
          el.style.display = 'none';
          el.className = 'loom-window-save-status';
        }, 300);
      }, 1500);
    } else if (status === 'error') {
      el.classList.add('is-error');
      el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message || 'Erro ao salvar'}</span>`;
      this.saveStatusTimeout = setTimeout(() => {
        el.style.opacity = '0';
        this.saveStatusTimeout = setTimeout(() => {
          el.style.display = 'none';
          el.className = 'loom-window-save-status';
        }, 300);
      }, 3000);
    }
  }

  /** Interop bridge: delegates to Loom `_getHeaderControls()`. */
  protected *_headerControlButtons(): Generator<any> {
    for (const c of this._getHeaderControls()) {
      yield c;
    }
  }

  /** Interop bridge: delegates to Loom `getOptionsMenuItems()`. */
  protected *_headerControlContextEntries(): Generator<any> {
    for (const item of this.getOptionsMenuItems()) {
      yield item;
    }
  }

  /**
   * Hook called when an action that isn't handled at the base level fires.
   * Subclasses override this instead of onAction (which is now _onAction).
   */
  protected onAction?(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void;

  /**
   * Internal action dispatcher. Handles built-in actions (save, close, cancel,
   * copy-id, window-menu) and falls through to onAction for custom actions.
   * Lifecycle guards (_onBeforeClose / _onBeforeSubmit) are checked before
   * the corresponding actions are executed.
   * 
   * @param action - The string identifier of the action triggered (e.g., 'save', 'close').
   * @param id - Optional data-id attached to the clicked element.
   * @param target - The DOM element that triggered the action.
   */
  protected async _onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): Promise<void> {
    if (action === 'close' || action === 'cancel') {
      if (await this._onBeforeClose()) {
        windowManager.close(this.options.id);
      }
      return;
    }
    if (action === 'save') {
      if (await this._onBeforeSubmit()) {
        const result: unknown = this.onSubmit
          ? this.onSubmit()
          : this.onAction?.(action, id, target);

        // Async handler: only decide to close after the save actually finished.
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          try {
            await result;
          } catch (_e) {
            // Failed (validation, network): DO NOT close. Closing here would make the user lose
            // their input without even seeing the error. The handler is responsible for notifying.
            return;
          }
        }

        // Closes by default. Previously, save executed and left the window open
        // while cancel closed it — clicking Save seemed to do nothing, and multiple
        // windows compensated by creating their own second button. Editors that should
        // continuar abertos definem `closeOnSave = false`.
        if (this.closeOnSave && this.element?.isConnected) {
          windowManager.close(this.options.id);
        }
      }
      return;
    }
    if (action === 'copy-id' && this.options.documentId) {
      copyTextToClipboard(this.options.documentId);
      showToast(t('baseWindow.idCopied'), 'success');
      return;
    }
    if (action === 'window-menu') {
      const items = this.getOptionsMenuItems();
      if (items.length > 0) {
        const rect = target.getBoundingClientRect();
        showContextMenu(
          new MouseEvent('contextmenu', {
            clientX: rect.left,
            clientY: rect.bottom,
            bubbles: true,
            cancelable: true,
          }),
          items,
        );
      }
      return;
    }
    if (action === 'minimize') {
      if (this.isMinimized) {
        this.maximize();
        this.dispatchEvent('maximize');
      } else {
        this.minimize();
        this.dispatchEvent('minimize');
      }
      const controls = this.element.querySelector('.loom-window-controls');
      if (controls) {
        controls.innerHTML = `
          <span class="loom-window-save-status" style="display: none;"></span>
          ${this._getHeaderControls()
            .map((c) => `<button class="loom-window-control-btn" data-action="${c.action}" title="${c.title || c.label}"><i class="${c.icon}"></i></button>`)
            .join('')}
          <button class="loom-window-close" data-action="close">✕</button>
        `;
      }
      return;
    }
    if (action === 'popout') {
      if (isPoppedOut(this.options.id)) {
        this.detachWindow();
        this.dispatchEvent('position', { poppedOut: false });
      } else {
        this.attachWindow();
        this.dispatchEvent('position', { poppedOut: true });
      }
      return;
    }
    if (!this.onAction) {
      // A click with data-action reached this point (it's not a native action like close/save/cancel)
      // and the subclass does NOT implement onAction. To prevent silent failures
      // where the button does nothing without a trace, we log a warning.
      clog.warn(`[WINDOW] Window "${this.options.id}" received a click with data-action="${action}" but doesn't define onAction() — button will do nothing.`);
      return;
    }
    this.onAction(action, id, target);
  }

  /**
   * Register a submit callback. When set, the 'save' action calls this
   * instead of falling through to onAction.
   */
  protected onSubmit?: () => void;

  protected registerSubmit(handler: () => void): void {
    this.onSubmit = handler;
  }

  /** Optional hook: builds data made available to bodyTemplate() via this.context. */
  protected prepareContext?(): Record<string, any>;
  protected context: Record<string, any> = {};

  /** Optional hook: runs after the body is (re)rendered. */
  protected onRender?(): void;

  /** Optional hook: async cleanup before the window element is removed. */
  protected onClose?(): void | Promise<void>;

  /**
   * Optional guard — return false to prevent mounting.
   * Checked at the start of mount(); window creation is skipped when false.
   */
  protected _canRender(): boolean {
    return true;
  }

  /**
   * Whether the current user can edit content in this window.
   * Subclasses override based on document ownership / user permissions.
   * Defaults to true (backward-compatible).
   */
  get isEditable(): boolean {
    return true;
  }

  /** Whether this Application is permitted to detach (popout). */
  protected _canDetach(): boolean {
    return true;
  }

  /** Whether this Application is permitted to re-attach from popout. */
  protected _canAttach(): boolean {
    return true;
  }

  /** Equivalent to the window accessor from real ApplicationV2 —
   * convenient references to frame elements. Converted systems read
   * this.window.title/this.window.content directly instead of letting Core auto-update. */
  get window(): { title: HTMLElement | null; content: HTMLElement | null; header: HTMLElement | null; close: HTMLElement | null; controls: HTMLElement[] } {
    return {
      title: this.element?.querySelector('.loom-window-title-text') ?? null,
      content: this.element?.querySelector('.window-content') ?? null,
      header: this.element?.querySelector('.loom-window-header') ?? null,
      close: this.element?.querySelector('.loom-window-close') ?? null,
      controls: Array.from(this.element?.querySelectorAll('.loom-window-controls button, .loom-window-controls a') ?? []),
    };
  }

  get classList(): DOMTokenList {
    return this.element.classList;
  }

  get id(): string {
    return this.options.id;
  }

  get minimized(): boolean {
    return this.isMinimized;
  }

  get form(): HTMLFormElement | null {
    return this.element?.querySelector('form') ?? null;
  }

  get hasFrame(): boolean {
    return true;
  }

  get rendered(): boolean {
    return !!this.element && document.body.contains(this.element);
  }

  /** The child Applications registered under this one via renderChild. */
  get children(): Map<string, BaseWindow> {
    const map = new Map<string, BaseWindow>();
    for (const childId of this.childIds) {
      const child = windowManager.get(childId);
      if (child instanceof BaseWindow) {
        map.set(childId, child);
      }
    }
    return map;
  }

  /** The parent Application of this Application, if registered via renderChild. */
  parent: BaseWindow | null = null;

  static RENDER_STATES: Record<string, number> = {
    NONE: 0,
    RENDERING: 1,
    RENDERED: 2,
    CLOSING: 3,
    CLOSED: 4,
  };

  private _renderState: number = BaseWindow.RENDER_STATES.NONE;

  get state(): number {
    return this._renderState;
  }

  /**
   * Lifecycle guard: called before the window is closed.
   * Return false to prevent close. Async-safe.
   */
  protected async _onBeforeClose(): Promise<boolean> {
    return true;
  }

  /**
   * Lifecycle guard: called before a submit/save action is dispatched.
   * Return false to prevent the submit. Async-safe.
   */
  protected async _onBeforeSubmit(): Promise<boolean> {
    return true;
  }

  /**
   * Open a child window that is automatically closed when this window closes.
   * 
   * @param ChildClass - The class of the child window to open.
   * @param id - The unique identifier for the child window.
   * @param props - Additional properties to pass to the child window.
   */
  renderChild<P>(ChildClass: new (props: P & { id: string }) => BaseWindow, id: string, props: P): void;
  renderChild(app: BaseWindow, options?: any): Promise<void>;
  renderChild(arg1: any, arg2?: any, arg3?: any): void | Promise<void> {
    if (typeof arg1 === 'function') {
      const ChildClass = arg1;
      const id = arg2;
      const props = arg3;
      // `childIds` also drives the parent's own cascade-close (see destroy()) so it's never
      // removed on child close — checking windowManager directly (not childIds.has) means a
      // reused id (e.g. every "pick-image" button sharing 'file-picker') still reopens after
      // the child closes itself, instead of silently no-oping forever.
      if (windowManager.get(id)) return;
      this.childIds.add(id);
      const app = new ChildClass({ ...props, id });
      app.parent = this;
      void windowManager.mountExisting(id, app);
      return;
    }
    const app = arg1;
    this.childIds.add(app.options.id);
    return app.mount() as Promise<void>;
  }

  /**
   * Promote this window to the top visual layer (simulated popout).
   */
  protected attachWindow(): void {
    if (this.element) popoutAttach(this.element, this.options.id);
  }

  /**
   * Return this window to its normal visual layer.
   */
  protected detachWindow(): void {
    if (this.element) popoutDetach(this.element, this.options.id);
  }

  /**
   * Bring the window to front.
   */
  bringToFront(): void {
    windowManager.focus(this.options.id);
  }

  /**
   * Lifecycle hook called before window position changes.
   */
  protected _prePosition(position: { left?: number; top?: number; width?: number; height?: number }): void { }

  /**
   * Lifecycle hook called after window position changes.
   */
  protected _onPosition(position: { left?: number; top?: number; width?: number; height?: number }): void { }

  get position(): { left: number; top: number; width: number; height: number } {
    const rect = this.element?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
    };
  }

  /**
   * Set window position/dimensions dynamically.
   * 
   * @param position - An object containing the new left, top, width, and/or height properties.
   */
  setPosition(position: { left?: number; top?: number; width?: number; height?: number } = {}): void {
    if (!this.element) return;
    this._prePosition(position);
    if (position.left !== undefined) this.element.style.left = `${position.left}px`;
    if (position.top !== undefined) this.element.style.top = `${position.top}px`;
    if (position.width !== undefined) this.element.style.width = `${position.width}px`;
    if (position.height !== undefined) this.element.style.height = `${position.height}px`;
    this.writeStoredRect();
    this.dispatchEvent('position', position);
    this._onPosition(position);
  }

  /** Repositions the window so the top and sides never leave the screen.
   * Used when reopening with stored position, during drag, and after resize. */
  private constrainToViewport(): void {
    if (!this.element) return;
    const margin = (this.options.allowOverflow ? this.options.overflowMargin || 0 : 0);
    const maxLeft = window.innerWidth - this.element.offsetWidth - margin;
    const maxTop = window.innerHeight - this.element.offsetHeight - margin;
    this.element.style.left = `${Math.max(margin, Math.min(this.element.offsetLeft, maxLeft))}px`;
    this.element.style.top = `${Math.max(margin, Math.min(this.element.offsetTop, maxTop))}px`;
  }

  minimize(): void {
    if (this.isMinimized) return;
    this.isMinimized = true;
    this.originalHeight = this.element.style.height;
    this.element.classList.add('minimized');
    this.element.style.height = '36px';
    this.writeStoredRect();
    this.dispatchEvent('minimize');
  }

  maximize(): void {
    if (!this.isMinimized) return;
    this.isMinimized = false;
    this.element.classList.remove('minimized');
    if (this.originalHeight) {
      this.element.style.height = this.originalHeight;
    } else {
      const stored = this.readStoredRect();
      const fallbackHeight = typeof this.options.height === 'number' ? this.options.height : 400;
      this.element.style.height = `${stored?.h ?? fallbackHeight}px`;
    }
    this.writeStoredRect();
    this.dispatchEvent('maximize');
  }

  /**
   * Returns the array of controls rendered in the window's header.
   * Subclasses can override this to customize window controls.
   */
  protected _headerButtons: {
    icon: string;
    label?: string;
    class?: string;
    tooltip?: string;
    onclick?: (e: Event) => void;
  }[] = [];

  /**
   * Extension point for subclasses to prepare template variables.
   */
  protected async _prepareContext(): Promise<Record<string, any>> {
    return {};
  }

  /**
   * Form submission pipeline.
   */
  protected async _onSubmit(options: { close?: boolean } = {}): Promise<void> {
    // Stub for subclasses
  }

  protected _getHeaderControls(): Array<{
    icon: string;
    label: string;
    action: string;
    title?: string;
  }> {
    const controls = [];
    if (this.options.documentId) {
      controls.push({
        icon: 'fa-regular fa-copy',
        label: t('baseWindow.copyId'),
        action: 'copy-id',
        title: t('baseWindow.copyId')
      });
    }
    controls.push({
      icon: 'fa-solid fa-ellipsis-vertical',
      label: t('baseWindow.options'),
      action: 'window-menu',
      title: t('baseWindow.options')
    });
    controls.push({
      icon: this.isMinimized ? 'fa-solid fa-window-maximize' : 'fa-solid fa-minus',
      label: this.isMinimized ? t('baseWindow.maximize') : t('baseWindow.minimize'),
      action: 'minimize',
      title: this.isMinimized ? t('baseWindow.maximize') : t('baseWindow.minimize')
    });
    if (this.popoutEnabled) {
      controls.push({
        icon: 'fa-solid fa-external-link-alt',
        label: t('baseWindow.popout'),
        action: 'popout',
        title: t('baseWindow.popout')
      });
    }
    return controls;
  }

  protected _emittedEvents: string[] = ['render', 'close', 'position', 'minimize', 'maximize'];

  /**
   * Emits a lifecycle or interaction event to LoomHooks.
   */
  dispatchEvent(name: string, data: any = {}): void {
    if (this._emittedEvents.includes(name)) {
      if ((window as any).LoomHooks) {
        (window as any).LoomHooks.callAll(`window.${name}`, this, data);
      }
    }
  }

  constructor(protected options: BaseWindowOptions) {
    // Traverses the ENTIRE inheritance chain collecting `static DEFAULT_OPTIONS` (not just
    // base and leaf). Ensures intermediate classes are not silently ignored when a more
    // derived subclass also declares its own DEFAULT_OPTIONS.
    const defaults = mergeOptionsChain(this.constructor);
    this.options = deepMergeOptions(defaults, options);
  }

  /** Returns a sanitized title. Sometimes undefined is cast to the literal
   * string "undefined" during document creation and saved to the DB.
   * This ensures the UI doesn't blindly display "undefined" as a valid title. */
  get title(): string {
    const title = this.options.title || this.id;
    if (title === 'undefined' || title.trim() === '') {
      if (typeof this.options.title === 'string' && this.options.title.trim() === 'undefined') {
        clog.warn(`[WINDOW] Window "${this.options.id}" has invalid title ("${title}") — likely saved as string literal in document. Showing generic fallback.`);
      }
      return 'Untitled';
    }
    return title;
  }

  mount(): void {
    if (!this._canRender()) return;

    this._renderState = BaseWindow.RENDER_STATES.RENDERING;
    this._preFirstRender();

    const container = document.getElementById('windows');
    if (!container) return;

    // Store currently focused element so we can restore it on close
    this.previousFocusedElement = document.activeElement as HTMLElement | null;

    // Create window element with ARIA attributes
    this.element = document.createElement('div');
    this.element.className = 'loom-window app window-app application';

    if (this.options.classes?.length) {
      if (Array.isArray(this.options.classes)) {
        this.element.classList.add(...this.options.classes);
      } else if (typeof this.options.classes === 'string') {
        this.element.className += ' ' + this.options.classes;
      }
    }
    if (this.options.allowOverflow) this.element.classList.add('loom-window--allow-overflow');
    this.element.id = this.options.id;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', this.title);

    if (this.options.bannerImage) {
      this.element.classList.add('window-has-banner');
      this.element.style.setProperty('--window-banner-url', `url('${this.options.bannerImage}')`);
    }

    const stored = this.readStoredRect();

    // Prioritize default width if set by the system, fallback to stored, then 600
    const width = this.options.width ?? stored?.w ?? 600;

    // Smart initialization of dimensions
    this.element.style.width = typeof width === 'number' ? `${width}px` : width;

    // Prioritize default height if set
    if (this.options.height !== undefined && this.options.height !== 'auto') {
      this.element.style.height = typeof this.options.height === 'number' ? `${this.options.height}px` : this.options.height;
    } else if (stored?.h) {
      this.element.style.height = `${stored.h}px`;
    } else {
      this.element.style.height = 'auto';
      if (typeof this.options.height === 'number') {
        this.element.style.maxHeight = `${Math.min(this.options.height, window.innerHeight - 20)}px`;
      } else {
        this.element.style.maxHeight = 'calc(100vh - 20px)';
      }
    }
    this.element.style.zIndex = '101';

    // If we have stored coordinates, apply directly. Otherwise, render off-screen temporarily to measure
    if (stored) {
      this.element.style.left = `${stored.x}px`;
      this.element.style.top = `${stored.y}px`;
    } else {
      this.element.style.left = '-9999px';
      this.element.style.top = '-9999px';
      // Temporarily disable animation to avoid visual flashes during transition
      this.element.style.animation = 'none';
    }

    if (this.prepareContext) this.context = this.prepareContext();
    this._preRender();

    // Build window HTML
    // `options.icon` aceita duas convenções: um glyph/emoji literal (ex.: '🎭', usado pelas fichas
    // nativas) OU uma classe de fonte de ícone (Font Awesome — 'fa-solid fa-dice' — ou a
    // rpg-awesome própria do Loom — 'rpg-d10' — convenção Foundry que sistemas convertidos
    // declaram em `window.icon`) — sem essa distinção, a classe aparecia como TEXTO cru
    const rawIcon = (this.options.icon || '').trim();
    let iconHtml = '';
    if (rawIcon) {
      if (rawIcon.startsWith('<')) {
        iconHtml = rawIcon;
      } else if (/(^|\s)(fa[srlbd]?-|rpg-|ra\s|ra-)/.test(rawIcon)) {
        iconHtml = `<i class="loom-window-title-icon ${rawIcon}"></i>`;
      } else {
        iconHtml = `<span class="loom-window-title-icon">${rawIcon}</span>`;
      }
    }
    const html = `
      <header class="loom-window-header window-header">
        <h1 class="loom-window-title window-title">
          ${iconHtml}
          <span class="loom-window-title-text">${this.title}</span>
        </h1>
        <div class="loom-window-controls">
          <span class="loom-window-save-status" style="display: none;"></span>
          ${this._getHeaderControls()
        .map((c) => `<button class="loom-window-control-btn header-control" data-action="${c.action}" title="${c.title || c.label}"><i class="${c.icon}"></i></button>`)
        .join('')}
          <button class="loom-window-close header-control" data-action="close">✕</button>
        </div>
      </header>
      <section class="loom-window-body window-content">
        ${this.bodyTemplate()}
      </section>
      ${this.options.showFooter !== false ? `
      <div class="loom-window-footer">
        <button class="btn btn-secondary" data-action="cancel">${this.options.cancelLabel || (this.options.submitOnChange ? t('common.close') : t('common.cancel'))}</button>
        <button class="btn" data-action="save">${this.options.saveLabel || t('common.save')}</button>
      </div>` : ''}
      ${this.options.resizable !== false ? '<div class="loom-window-resize-handle window-resize-handle"></div>' : ''}
    `;

    this.element.innerHTML = html;

    // Attach event handlers
    this.attachHandlers();

    // Focus window when clicked anywhere inside it
    this.element.addEventListener('pointerdown', () => {
      windowManager.focus(this.options.id);
    });

    // Wire drag functionality
    const header = this.element.querySelector('.loom-window-header')!;
    header.addEventListener('pointerdown', (e) => this.startDrag(e as PointerEvent));

    // Wire resize functionality — `resizable: false` skips the handle above,
    // so this only queries/wires when it actually exists (was unconditional
    // before, so `options.resizable` was accepted but silently never read).
    const resizeHandle = this.element.querySelector(
      '.loom-window-resize-handle',
    );
    resizeHandle?.addEventListener('pointerdown', (e) =>
      this.startResize(e as PointerEvent),
    );

    // Wire ESC key (stored reference so destroy() can clean it up)
    this.boundEscapeHandler = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (await this._onBeforeClose()) {
          windowManager.close(this.options.id);
        }
      }
    };
    document.addEventListener('keydown', this.boundEscapeHandler);

    // Focus trap: cycle Tab / Shift+Tab within the window
    this.boundFocusTrapHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', this.boundFocusTrapHandler);

    container.appendChild(this.element);

    if (stored) {
      this.constrainToViewport();
    } else {
      // Measure actual size after render and center it for the first time
      const actualWidth = this.element.offsetWidth;
      const actualHeight = this.element.offsetHeight;

      let left = (window.innerWidth - actualWidth) / 2;
      let top = this.options.anchorTop
        ? Math.max(10, window.innerHeight * 0.12)
        : (window.innerHeight - actualHeight) / 2;

      // Ensure the window doesn't overflow the screen
      left = Math.max(10, Math.min(left, window.innerWidth - actualWidth - 10));
      top = Math.max(10, Math.min(top, window.innerHeight - actualHeight - 10));

      this.element.style.left = `${left}px`;
      this.element.style.top = `${top}px`;

      // Restore CSS entry animation
      this.element.style.animation = '';

      // The clamp above only considers the window's own bounding box (`actualWidth`/`actualHeight`).
      // If `allowOverflow` exposes content outside (e.g., side tabs), it isn't accounted for
      // because `offsetWidth` ignores overflow. `constrainToViewport()` reserves
      // `overflowMargin` properly — reapply it here on the first render, not just
      // when reopening with a saved position.
      if (this.options.allowOverflow) this.constrainToViewport();
    }

    this.wireSubmitOnChange();

    // Focus the first focusable element inside the window
    setTimeout(() => {
      this.getFocusableElements()[0]?.focus();
    }, 50);

    this._renderState = BaseWindow.RENDER_STATES.RENDERED;
    (this as any).activateListeners?.((window as any).jQuery?.(this.element) ?? this.element);
    this.onRender?.();
    this._postRender();
    this.dispatchEvent('render');
    this._callRenderHooks();
  }

  /**
   * Compatibility stub for legacy (V1) systems.
   * Older converted systems override this method to use jQuery instead of the native
   * `[data-action]` attribute. It is called with fresh HTML in every render cycle —
   * never store the reference beyond this method's scope. Since the DOM is replaced
   * by the diffing process, a cached jQuery selection will point to obsolete nodes
   * outside the main tree.
   */
  protected activateListeners(html: any): void { }

  private getFocusableElements(): HTMLElement[] {
    if (!this.element) return [];
    return Array.from(
      this.element.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !(el as HTMLButtonElement | HTMLInputElement).disabled && el.offsetParent !== null);
  }

  /** Disjuntor do auto-save: nenhum sistema convertido (com bug de render/WS que realimenta
   * submit → broadcast → re-render → submit) pode martelar o servidor pra sempre e travar o
   * navegador do cliente. Core corta depois de N submits rápidos demais, não depende de achar
   * a causa em cada sistema individualmente. */
  private static readonly SUBMIT_BREAKER_LIMIT = 3;
  private static readonly SUBMIT_BREAKER_WINDOW_MS = 1000;
  private submitTimestamps: number[] = [];
  private submitBreakerTripped = false;

  private wireSubmitOnChange(): void {
    if (!this.options.submitOnChange) return;
    // Sistemas convertidos com `DEFAULT_OPTIONS.form = { handler, submitOnChange: true }`
    // (padrão wod5e) já têm seu PRÓPRIO gatilho de auto-save em `_onChangeForm`
    // (application.ts, mixin LoomHandlebarsMixin) — o mesmo `submitOnChange: true` também
    // liga ESTE mecanismo genérico, e os dois disparavam save em paralelo pro mesmo campo,
    // cada um com seu debounce e seu snapshot de dados, um sobrescrevendo o outro (o
    // sintoma era "3 requisições e o dado não fica salvo"). Quando existe `form.handler`,
    // deixa só o dele responder.
    if ((this.options as any).form?.handler) return;
    const trigger = () => {
      if (this.submitBreakerTripped) return;
      this.setSaveStatus('saving');
      if (this.submitDebounceTimer) clearTimeout(this.submitDebounceTimer);
      this.submitDebounceTimer = setTimeout(() => {
        const now = Date.now();
        this.submitTimestamps.push(now);
        this.submitTimestamps = this.submitTimestamps.filter(
          (ts) => now - ts <= BaseWindow.SUBMIT_BREAKER_WINDOW_MS,
        );
        if (this.submitTimestamps.length > BaseWindow.SUBMIT_BREAKER_LIMIT) {
          this.submitBreakerTripped = true;
          this.setSaveStatus('error');
          clog.error(
            `[BaseWindow] Auto-save cortado: "${this.options.id}" tentou salvar ${this.submitTimestamps.length}x em ${BaseWindow.SUBMIT_BREAKER_WINDOW_MS}ms — provável loop de render/WS. Feche e reabra a janela.`,
          );
          showToast('Auto-save desligado nesta janela (loop detectado) — feche e reabra.', 'error');
          return;
        }

        // Triggers the actual save pipeline `_onSubmit()` instead of the unsupported
        // 'auto-save' action. Ensures `submitOnChange: true` correctly saves the document.
        const onSubmit = (this as unknown as { _onSubmit?: (opts?: { close?: boolean }) => Promise<void> })._onSubmit;
        if (typeof onSubmit === 'function') {
          void onSubmit.call(this, { close: false });
        } else {
          // Not a LoomDocumentSheet — fallback to the legacy behavior for
          // third-party systems that manually implement the 'auto-save' action.
          this.onAction?.('auto-save', null, this.element);
          this.setSaveStatus('saved');
        }
      }, 300);
    };
    this.element.addEventListener('input', trigger);
    this.element.addEventListener('change', trigger);
  }

  setZ(z: number): void {
    this.element.style.zIndex = String(z);
  }

  private get storageKey(): string {
    return `loom-window-rect:${this.options.id}`;
  }

  private readStoredRect(): { x: number; y: number; w: number; h: number } | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeStoredRect(): void {
    try {
      const stored = this.readStoredRect();
      const isAutoHeight = this.element.style.height === 'auto' || !this.element.style.height;

      const rect: { x: number; y: number; w: number; h?: number } = {
        x: this.element.offsetLeft,
        y: this.element.offsetTop,
        w: this.element.offsetWidth,
      };

      // If dynamic height or window is minimized, and we didn't actively resize, preserve auto or old value
      if ((isAutoHeight || this.isMinimized) && !this.isResizing) {
        if (stored?.h) rect.h = stored.h;
      } else {
        rect.h = this.element.offsetHeight;
      }

      localStorage.setItem(this.storageKey, JSON.stringify(rect));
    } catch {
      // localStorage unavailable (private mode, quota) — position just won't persist
    }
  }

  protected rerenderBody(): void {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    preserveFocusAcrossRender(body, () => {
      if (this.prepareContext) this.context = this.prepareContext();
      this._preRender();
      body.innerHTML = this.bodyTemplate();
    });

    (this as any).activateListeners?.((window as any).jQuery?.(this.element) ?? this.element);
    this.onRender?.();
    this._postRender();
    this._callRenderHooks();
  }

  /** Triggers rendering hooks. The system fires two: a generic one (`renderApplication`
   * — the catch-all used by most modules injecting CSS/header buttons) and a class-specific one
   * (e.g., `renderCharacterSheet`), based on the constructor name. The second might not exist
   * for anonymous classes, so the generic one acts as a fallback.
   *
   * @private
   */
  private _callRenderHooks(): void {
    const cls = this.constructor?.name;
    LoomHooks.callAll('renderWindow', this, this.element);
    if (cls) LoomHooks.callAll(`render${cls}`, this, this.element);
  }

  private attachHandlers(): void {
    attachDataActionDispatch(this.element, (action, id, target) => {
      // `_onAction` is async (awaits `_onBeforeClose`/`_onBeforeSubmit`, guards that a
      // subclass could override to reject). Firing it with a bare `void` swallowed any
      // rejection silently — a guard that throws (instead of resolving false) left the
      // window permanently stuck open with zero trace in the console, indistinguishable
      // from "the click just didn't register". Logging here doesn't change behavior when
      // nothing throws; it just stops failures from vanishing.
      this._onAction(action, id, target).catch((err) => {
        clog.error(`[WINDOW] action "${action}" failed on window "${this.options.id}": ${err instanceof Error ? (err.stack || err.message) : String(err)}`);
      });
    });
  }

  protected getOptionsMenuItems(): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (this.options.documentId) {
      items.push({
        icon: '<i class="fa-solid fa-clipboard"></i>',
        label: t('baseWindow.copyDocId'),
        action: () => {
          copyTextToClipboard(this.options.documentId!);
          showToast(t('baseWindow.idCopied'), 'success');
        }
      });

      let entityType = '';
      if (this.options.id.startsWith('actor-sheet-')) entityType = 'Actor';
      else if (this.options.id.startsWith('item-sheet-')) entityType = 'Item';
      else if (this.options.id.startsWith('journal-')) entityType = 'JournalEntry';
      else if (this.options.id.startsWith('stage-config-')) entityType = 'Scene';
      else if (this.options.id.startsWith('deck-sheet-')) entityType = 'Cards';
      else if (this.options.id.startsWith('compendium-pack-')) entityType = 'Compendium';

      if (entityType) {
        items.push({
          icon: '<i class="fa-solid fa-link"></i>',
          label: t('baseWindow.copyDocUuid'),
          action: () => {
            copyTextToClipboard(`${entityType}.${this.options.documentId}`);
            showToast(t('baseWindow.uuidCopied'), 'success');
          }
        });
      }
    }

    if ((window as any).LoomHooks) {
      (window as any).LoomHooks.callAll('getWindowOptionsMenuItems', this, items);
    }

    return items;
  }

  private startDrag(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('.loom-window-controls')) {
      return;
    }

    this.isDragging = true;
    this.element.style.willChange = 'transform';
    const margin = (this.options.allowOverflow ? this.options.overflowMargin || 0 : 0);
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
      windowX: this.element.offsetLeft,
      windowY: this.element.offsetTop,
      maxLeft: window.innerWidth - this.element.offsetWidth - margin,
      maxTop: window.innerHeight - this.element.offsetHeight - margin,
    };

    const dragHandler = (ev: PointerEvent) => this.doDrag(ev);
    const stopDrag = () => {
      this.isDragging = false;
      this.element.style.willChange = 'auto';
      document.removeEventListener('pointermove', dragHandler);
      document.removeEventListener('pointerup', stopDrag);
      this.writeStoredRect();
    };

    document.addEventListener('pointermove', dragHandler);
    document.addEventListener('pointerup', stopDrag);
  }

  private doDrag(e: PointerEvent): void {
    if (!this.isDragging) return;

    const margin = (this.options.allowOverflow ? this.options.overflowMargin || 0 : 0);
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;

    const left = Math.max(margin, Math.min(this.dragStart.windowX + dx, this.dragStart.maxLeft));
    const top = Math.max(margin, Math.min(this.dragStart.windowY + dy, this.dragStart.maxTop));

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private startResize(e: PointerEvent): void {
    if (this.isMinimized) return;
    this.isResizing = true;
    const startWidth = this.element.offsetWidth;
    const startHeight = this.element.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;

    const resizeHandler = (e: PointerEvent) => {
      if (!this.isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.element.style.width = `${Math.max(320, startWidth + dx)}px`;
      this.element.style.height = `${Math.max(200, startHeight + dy)}px`;

      const rect = this.element.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.element.style.width = `${window.innerWidth - rect.left - 10}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.element.style.height = `${window.innerHeight - rect.top - 10}px`;
      }
    };

    const stopResize = () => {
      this.isResizing = false;
      document.removeEventListener('pointermove', resizeHandler);
      document.removeEventListener('pointerup', stopResize);
      this.writeStoredRect();
    };

    document.addEventListener('pointermove', resizeHandler);
    document.addEventListener('pointerup', stopResize);
  }

  async destroy(): Promise<void> {
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
      this.saveStatusTimeout = null;
    }
    if (this.submitDebounceTimer) {
      clearTimeout(this.submitDebounceTimer);
      this.submitDebounceTimer = null;
    }
    this._renderState = BaseWindow.RENDER_STATES.CLOSING;
    // Close children before parent
    for (const childId of this.childIds) {
      windowManager.close(childId);
    }
    this.childIds.clear();

    await this._preClose();
    await this.onClose?.();
    this.dispatchEvent('close');
    const closedCls = this.constructor?.name;
    LoomHooks.callAll('closeWindow', this);
    if (closedCls) LoomHooks.callAll(`close${closedCls}`, this);
    this._renderState = BaseWindow.RENDER_STATES.CLOSED;

    if (this.boundEscapeHandler) {
      document.removeEventListener('keydown', this.boundEscapeHandler);
      this.boundEscapeHandler = null;
    }
    if (this.boundFocusTrapHandler) {
      document.removeEventListener('keydown', this.boundFocusTrapHandler);
      this.boundFocusTrapHandler = null;
    }

    this.element?.remove();

    if (this.previousFocusedElement && document.contains(this.previousFocusedElement)) {
      this.previousFocusedElement.focus();
      this.previousFocusedElement = null;
    }
  }

  // ════════════════════════════════════════════════
  // COMPATIBILITY STUBS (APPLICATION V2)
  // ════════════════════════════════════════════════

  render(...args: any[]): any {
    if (windowManager.get(this.options.id)) {
      (this as any).rerenderBody?.();
      windowManager.focus(this.options.id);
    } else {
      windowManager.open(this.options.id, this.constructor as any, this.options);
    }
    return this;
  }

  get canDetach(): boolean { return this._canDetach(); }
  get instances(): Map<string, BaseWindow> {
    const map = new Map<string, BaseWindow>();
    if (!(windowManager as any).windows) return map;
    for (const [id, entry] of (windowManager as any).windows.entries()) {
      map.set(id, entry.instance as BaseWindow);
    }
    return map;
  }
  get inheritanceChain(): any[] { return []; }

  static parseCSSDimension(value: string | number, basis: number): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.endsWith('%')) return basis * (parseFloat(value) / 100);
      return parseFloat(value);
    }
    return 0;
  }

  applyPosition(position: any): any {
    this.setPosition(position);
    return position;
  }

  getVisibleBoundingBox(): DOMRect | null {
    return this.element?.getBoundingClientRect() ?? null;
  }

  static unionBoundingBoxes(...rects: DOMRect[]): DOMRect | null {
    if (!rects.length) return null;
    const minX = Math.min(...rects.map(r => r.left));
    const minY = Math.min(...rects.map(r => r.top));
    const maxX = Math.max(...rects.map(r => r.right));
    const maxY = Math.max(...rects.map(r => r.bottom));
    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    return window.requestAnimationFrame(callback);
  }

  static mergeApplicationOptions(base: any, incoming: any): any {
    return Object.assign({}, base, incoming);
  }

  applyDetachedConstraints(): void { }
  endPointerCapture(): void { }
  startPointerCapture(): void { }
  waitForImages(): Promise<void> { return Promise.resolve(); }
  _attachFrameListeners(): void { }
  _awaitTransition(): Promise<void> { return Promise.resolve(); }
  _getFrameButtons(): any[] { return []; }
  _renderFrameButtons(): void { }
  _renderHeaderControl(): void { }
  _tearDown(): void { }
  _updateFrame(): void { }
  _updatePosition(): void { }
  _doEvent(): void { }
  _insertElement(): void { }
  _removeElement(): void { }
  onClick(): void { }
  onPointerDown(): void { }
  onPointerMove(): void { }
  onWindowDoubleClick(): void { }
  onWindowResizeMove(): void { }
}
