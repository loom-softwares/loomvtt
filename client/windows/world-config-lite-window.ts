/*******************************************************************************
 * LoomVTT
 * client/windows/world-config-lite-window.ts
 * 
 * 
 * Lean window for configuring world settings.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { windowManager } from '../core/window-manager.js';
import { FilePickerWindow } from './file-picker-window.js';
import { mountRichTextEditor, type RichTextEditorHandle } from '../lib/rich-text-registry.js';

interface WorldBasicInfo {
  id: string;
  name: string;
  backgroundUrl?: string;
  theme?: string;
  nextSession?: string;
  description?: string;
}

/**
 * Lean world config window, accessible in-game (GM) — only superficial
 * fields. The FULL window (system, dataPath, password) is in the
 * Setup Hub (`edit-world-window.ts`), intentionally out of scope here.
 */
export class WorldConfigLiteWindow extends BaseWindow {
  private world: WorldBasicInfo | null = null;
  private loading = true;
  private editorHandle: RichTextEditorHandle | null = null;

  constructor(private props: { worldId: string }) {
    super({
      id: `world-config-lite-${props.worldId}`,
      // The emoji stays only in `icon` — the base already renders it in a span before the
      // titulo, entao repeti-lo aqui desenhava dois globos.
      title: t('worldConfigLite.title'),
      icon: '<i class="fa-solid fa-earth-americas"></i>',
      width: 520,
      height: 'auto',
    });
  }

  protected _preFirstRender(): void {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.world = await api.get<WorldBasicInfo>(`/worlds/${this.props.worldId}`);
    } catch (e: any) {
      showToast(e?.message || t('worldConfigLite.loadError'), 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    if (!this.world) {
      return `<div class="empty-state"><p>${t('worldConfigLite.worldNotFound')}</p></div>`;
    }
    return `
      <form data-application-part="world-config-lite-form">
        <div class="form-group">
          <label>${t('worldConfigLite.worldTitle')}</label>
          <input type="text" name="name" value="${this.esc(this.world.name)}" required />
        </div>

        <div class="form-group file-picker-group">
          <label>Imagem de Fundo</label>
          <div class="input-with-button">
            <input type="text" name="backgroundUrl" value="${this.esc(this.world.backgroundUrl || '')}" placeholder="${t('worldConfigLite.noFileSelected')}" />
            <button type="button" class="btn btn-secondary btn-pick-file" data-action="pick-background">📂</button>
          </div>
        </div>

        <div class="form-group">
          <label>${t('worldConfigLite.homeTheme')}</label>
          <select name="theme">
            <option value="" ${!this.world.theme ? 'selected' : ''}>${t('worldConfigLite.defaultTheme')}</option>
          </select>
        </div>

        <div class="form-group">
          <label>${t('worldConfigLite.nextSession')}</label>
          <input type="datetime-local" name="nextSession" value="${this.esc(this.world.nextSession || '')}" />
        </div>

        <div class="form-group form-group-full">
          <label>${t('worldConfigLite.worldDescription')}</label>
          <div class="journal-editor world-config-lite-editor"></div>
        </div>
      </form>
    `;
  }

  protected onRender(): void {
    const container = this.element.querySelector<HTMLElement>('.world-config-lite-editor');
    if (container) {
      if (this.editorHandle) this.editorHandle.destroy();
      this.editorHandle = mountRichTextEditor(container, this.world?.description || '');
    }
  }

  // Returns the save Promise on purpose: the base `_onAction` only waits for the
  // handler to finish if the return has `.then`. With `void this.save()` it
  // closed the window before PUT responded — including when PUT failed,
  // and the user lost what was typed, seeing only the error toast.
  protected onAction(action: string): void | Promise<void> {
    if (action === 'pick-background') {
      this.pickBackground();
      return;
    }
    if (action === 'save') {
      return this.save();
    }
  }

  private pickBackground(): void {
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: (path: string) => {
        const input = this.element.querySelector<HTMLInputElement>('[name="backgroundUrl"]');
        if (input) input.value = path;
      },
    });
  }

  private async save(): Promise<void> {
    const name = this.element.querySelector<HTMLInputElement>('[name="name"]')?.value;
    const backgroundUrl = this.element.querySelector<HTMLInputElement>('[name="backgroundUrl"]')?.value;
    const theme = this.element.querySelector<HTMLSelectElement>('[name="theme"]')?.value;
    const nextSession = this.element.querySelector<HTMLInputElement>('[name="nextSession"]')?.value;
    const description = this.editorHandle ? this.editorHandle.getHTML() : '';

    if (!name) {
      showToast(t('worldConfigLite.titleRequired'), 'error');
      // `throw` and not `return`: a normal return the base would read as success and
      // close the window, discarding the edit because of an empty field.
      throw new Error('titleRequired');
    }

    try {
      const updated = await api.put<WorldBasicInfo>(`/worlds/${this.props.worldId}/basic-info`, {
        name, backgroundUrl: backgroundUrl || '', theme: theme || '', nextSession: nextSession || '', description,
      });
      document.title = `LoomVTT — ${updated.name}`;
      showToast(t('worldConfigLite.saveSuccess'), 'success');
      // Nao fecha aqui: quem fecha e o `_onAction` da base (`closeOnSave`).
      // Fechar nos dois lugares disparava windowManager.close duas vezes.
    } catch (e: any) {
      showToast(e?.message || t('worldConfigLite.saveError'), 'error');
      // Repropagates: it's the `reject` that makes the base keep the window open.
      throw e;
    }
  }

  async destroy(): Promise<void> {
    if (this.editorHandle) {
      this.editorHandle.destroy();
      this.editorHandle = null;
    }
    await super.destroy();
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
