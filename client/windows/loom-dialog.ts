/*******************************************************************************
 * LoomVTT
 * client/windows/loom-dialog.ts
 * 
 * 
 * Base class for rendering dialog prompts.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { LoomFormData } from '../core/form-data.js';
import { windowManager } from '../core/window-manager.js';
import { gameContext } from '../core/game-context.js';

export interface DialogButton {
  action: string;
  label: string;
  default?: boolean;
  /** Button visual style. `danger` also applies background color via CSS var. */
  variant?: 'primary' | 'ghost' | 'danger';
  callback?: (event: Event, button: HTMLButtonElement, dialog: LoomDialog) => any;
}

export interface DialogOptions {
  window?: { title?: string };
  content?: string | HTMLElement;
  buttons?: DialogButton[];
  submit?: (result: any) => void;
  rejectClose?: boolean;
  width?: number;
  classes?: string[];
  actions?: Record<string, (event: Event, target: HTMLElement, dialog: LoomDialog) => any>;
  render?: (event: Event | null, dialog: LoomDialog) => void | Promise<void>;
}

function applyButtonVariant(el: HTMLButtonElement, btn: DialogButton): void {
  const isPrimaryLike = btn.variant === 'primary' || btn.variant === 'danger' || (!btn.variant && btn.default);
  el.className = `btn ${isPrimaryLike ? '' : 'btn-secondary'}`.trim();
  if (btn.variant === 'danger') {
    el.style.background = 'var(--color-danger)';
    el.style.borderColor = 'var(--color-danger)';
  }
}

export class LoomDialog extends BaseWindow {
  private dialogOptions: DialogOptions;
  private resolveFn?: (value: any) => void;
  private rejectFn?: (reason: any) => void;

  constructor(options: DialogOptions = {}) {
    const id = `dialog-${Math.random().toString(36).substr(2, 9)}`;
    super({
      id,
      title: options.window?.title ?? 'Dialog',
      width: options.width ?? 400,
      height: 'auto',
      showFooter: false
    });
    this.dialogOptions = options;
  }

  protected _getHeaderControls(): any[] {
    return []; // Dialog typically has no extra header controls
  }

  /** Public access to the dialog body for button callbacks — the sanctioned way
   * to read form fields from a `callback: (event, button, dialog) => ...`. */
  getBody(): HTMLElement | null {
    return this.element.querySelector('.loom-window-body');
  }

  bodyTemplate(): string {
    return ''; // Overridden by custom mount logic
  }

  async mount(): Promise<void> {
    await super.mount();
    this.element.classList.add('loom-dialog');
    if (this.dialogOptions.classes?.length) {
      this.element.classList.add(...this.dialogOptions.classes);
    }

    const body = this.element.querySelector('.loom-window-body') as HTMLElement;
    if (body) {
      body.innerHTML = '';

      // Render content
      const content = this.dialogOptions.content;
      if (typeof content === 'string') {
        const div = document.createElement('div');
        div.className = 'dialog-content';
        div.innerHTML = content;
        body.appendChild(div);
      } else if (content instanceof HTMLElement) {
        body.appendChild(content);
      }

      if (this.dialogOptions.actions) {
        body.addEventListener('click', (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
          if (!target) return;
          const action = target.dataset.action!;
          const handler = this.dialogOptions.actions?.[action];
          if (!handler) return;
          e.preventDefault();
          void handler.call(this, e, target, this);
        });
      }

      // Render buttons
      const buttons = this.dialogOptions.buttons || [];
      if (buttons.length > 0) {
        const footer = document.createElement('div');
        footer.className = 'loom-window-footer';

        for (const btn of buttons) {
          const buttonEl = document.createElement('button');
          buttonEl.type = 'button';
          applyButtonVariant(buttonEl, btn);
          buttonEl.dataset.action = btn.action;
          buttonEl.innerHTML = btn.label;

          buttonEl.addEventListener('click', (e) => this._onClickButton(e, buttonEl, btn));
          footer.appendChild(buttonEl);
        }

        const resizeHandle = this.element.querySelector('.loom-window-resize-handle');
        if (resizeHandle) {
          this.element.insertBefore(footer, resizeHandle);
        } else {
          this.element.appendChild(footer);
        }
      }
    }

    if (this.dialogOptions.render) {
      try {
        await this.dialogOptions.render(null, this);
      } catch (e) {
        console.error('Dialog render callback error', e);
      }
    }
  }

  private async _onClickButton(event: Event, button: HTMLButtonElement, config: DialogButton) {
    if (event) event.stopPropagation();
    let result: any = config.action;

    if (config.callback) {
      try {
        result = await config.callback(event, button, this);
      } catch (e) {
        console.error('Dialog callback error', e);
        return; // Don't close or submit if callback crashed
      }
    }

    if (this.dialogOptions.submit) {
      this.dialogOptions.submit(result);
    }

    if (this.resolveFn) {
      this.resolveFn(result);
      // Clean up so _onBeforeClose doesn't resolve again
      this.resolveFn = undefined;
      this.rejectFn = undefined;
    }

    // Auto-close dialog after button click
    windowManager.close(this.options.id);
  }

  protected async _onBeforeClose(): Promise<boolean> {
    if (this.resolveFn && !this.dialogOptions.submit) {
      if (this.dialogOptions.rejectClose && this.rejectFn) {
        this.rejectFn(new Error('Dialog closed'));
      } else {
        this.resolveFn(null);
      }
    }
    return true;
  }

  // Stub compatível — sistemas convertidos chamam `super._onKeyDown(event)`
  protected _onKeyDown(event: KeyboardEvent): void {
    // Handle ESC key to close dialog
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.resolveFn && !this.dialogOptions.submit) {
        if (this.dialogOptions.rejectClose && this.rejectFn) {
          this.rejectFn(new Error('Dialog closed'));
        } else {
          this.resolveFn(null);
        }
      }
      windowManager.close(this.options.id);
    }
  }

  // Stub compatível — sistemas convertidos chamam `super._renderButtons()`
  protected _renderButtons(): void {
    // Already handled in mount() method
    // This stub exists for compatibility with systems that call super._renderButtons()
  }

  public render(options: any = {}): LoomDialog {
    windowManager.mountExisting(this.options.id, this as any);
    return this;
  }

  public wait(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
      windowManager.mountExisting(this.options.id, this as any);
    });
  }

  public resolve(value: any): void {
    if (this.resolveFn) {
      this.resolveFn(value);
      this.resolveFn = undefined;
      this.rejectFn = undefined;
    }
    windowManager.close(this.options.id);
  }

  // --- Static Helpers ---

  static async wait(config: DialogOptions = {}): Promise<any> {
    const dialog = new LoomDialog(config);
    return dialog.wait();
  }

  static async prompt(config: DialogOptions & { ok?: DialogButton } = {}): Promise<any> {
    // Merge, não substitui — mesmo motivo do `input()` abaixo: um `ok` parcial (só
    // `callback`, sem `label`) não pode apagar o `label: 'OK'` padrão, senão o botão
    // renderiza o texto literal "undefined".
    const okBtn: DialogButton = { action: 'ok', label: 'OK', default: true, ...config.ok };
    return this.wait({
      ...config,
      buttons: [okBtn, ...(config.buttons || [])]
    });
  }

  static async confirm(config: DialogOptions & { yes?: DialogButton; no?: DialogButton } = {}): Promise<any> {
    const yesBtn: DialogButton = { action: 'yes', label: 'Yes', default: true, callback: () => true, ...config.yes };
    const noBtn: DialogButton = { action: 'no', label: 'No', callback: () => false, ...config.no };

    return this.wait({
      ...config,
      buttons: [yesBtn, noBtn, ...(config.buttons || [])]
    });
  }

  static async input(config: DialogOptions & { ok?: DialogButton, cancel?: DialogButton } = {}): Promise<any> {
    // Merge (not replace) — um `ok`/`cancel` parcial (ex: só `icon`/`label`) não pode
    // descartar o `callback` padrão que serializa o formulário, senão o botão OK some
    // com o comportamento e devolve `undefined` pro chamador.
    const cancelBtn: DialogButton = {
      action: 'cancel',
      label: 'Cancelar',
      default: false,
      callback: () => null,
      ...config.cancel
    };

    const okBtn: DialogButton = {
      action: 'ok',
      label: 'Salvar',
      default: true,
      callback: (event, button, dialog) => {
        const body = dialog.element.querySelector('.dialog-content') || dialog.element;
        const fd = new LoomFormData(body as HTMLElement);
        return fd.object;
      },
      ...config.ok
    };

    return this.wait({
      ...config,
      buttons: [cancelBtn, okBtn, ...(config.buttons || [])]
    });
  }

  static async query(user: any, type: string, config: DialogOptions = {}): Promise<any> {
    // Determine if the user is the local user
    let isSelf = false;
    if (typeof user === 'string') {
      isSelf = user === gameContext.session?.userId;
    } else {
      isSelf = user.isSelf || user.id === gameContext.session?.userId;
    }

    if (isSelf) {
      // Prompt/confirm/input/wait local
      if (typeof (this as any)[type] === 'function') {
        return (this as any)[type](config);
      }
      return this.wait(config);
    }

    // Phase 2: Remote question via socket to another client
    console.warn(`LoomDialog.query para usuário remoto não implementado (Fase 2)`);
    return null;
  }
}
