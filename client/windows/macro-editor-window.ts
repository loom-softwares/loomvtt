/*******************************************************************************
 * LoomVTT
 * client/windows/macro-editor-window.ts
 * 
 * 
 * Window for editing macro scripts.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { t } from '../lib/i18n.js';
import { FilePickerWindow } from './file-picker-window.js';

interface Macro {
  id: string;
  worldId: string;
  name: string;
  type: string;
  command: string;
  imgUrl: string;
  slot: number;
  ownership: any;
  folderId: string;
}

export class MacroEditorWindow extends BaseWindow {
  private loading = true;

  constructor(private props: {
    worldId: string;
    slot: number;
    macro?: Macro;
    onSaved?: () => void;
    userRole?: number;
    folderId?: string;
  }) {
    super({
      id: `macro-editor-${props.macro ? props.macro.id : props.slot}`,
      title: props.macro ? t('common.macroEditTitle') : t('common.macroCreateTitle'),
      icon: '<i class="fa-solid fa-bolt"></i>',
      width: 500,
      height: 'auto',
      bannerImage: '/images/general-banners/macro-banner.png'
    });
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-fixed-header');
    }

    const pickBtn = this.element?.querySelector('#pick-macro-icon-btn');
    pickBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          const input = this.element?.querySelector<HTMLInputElement>('#macro-img');
          if (input) input.value = path;
        },
      });
    });
  }

  async mount(): Promise<void> {
    super.mount();
    this.loading = false;
    this.rerenderBody();
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }

    return `
      <div class="banner-spacer"></div>
      <div class="scroll-content">
        <form class="macro-editor-form" data-action="save">
          <div class="form-group">
            <label for="macro-name">${t('common.macroName')}</label>
            <input type="text" id="macro-name" name="name" value="${this.props.macro ? this.esc(this.props.macro.name) : ''}" required />
          </div>

          <div class="form-group">
            <label for="macro-type">${t('common.macroType')}</label>
            <select id="macro-type" name="type" required>
              <option value="chat" ${this.props.macro?.type === 'chat' ? 'selected' : ''}>${t('common.macroTypeChat')}</option>
              <option value="open-actor" ${this.props.macro?.type === 'open-actor' ? 'selected' : ''}>${t('common.macroTypeOpenActor')}</option>
              ${(this.props.userRole ?? 1) >= 3 ? `<option value="script" ${this.props.macro?.type === 'script' ? 'selected' : ''}>${t('common.macroTypeScript')}</option>` : ''}
            </select>
          </div>

          <div class="form-group">
            <label for="macro-command">${t('common.macroCommand')}</label>
            <textarea id="macro-command" name="command" rows="4" required placeholder="${this.esc(this.getCommandPlaceholder())}">${this.props.macro ? this.esc(this.props.macro.command) : ''}</textarea>
          </div>

          <div class="form-group">
            <label for="macro-img">${t('common.macroIcon')}</label>
            <div class="form-fields">
              <input type="text" id="macro-img" name="imgUrl" value="${this.props.macro ? this.esc(this.props.macro.imgUrl) : ''}" placeholder="${t('common.macroIconPlaceholder')}" />
              <button type="button" class="icon-button" id="pick-macro-icon-btn" title="${t('stageConfig.pickExistingFile')}"><i class="fa-solid fa-folder-open"></i></button>
            </div>
          </div>

          <div class="form-hint">
            ${this.getCommandHint()}
          </div>

        </form>
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.saveMacro();
    } else if (action === 'cancel') {
      windowManager.close(`macro-editor-${this.props.macro ? this.props.macro.id : this.props.slot}`);
    }
  }

  private async saveMacro(): Promise<void> {
    const form = this.element.querySelector('form');
    if (!form) return;

    const fd = new LoomFormData(form);
    const data = fd.object;
    const missing = fd.missing;

    if (missing.length > 0) {
      showToast(`Campos obrigatórios não preenchidos: ${missing.join(', ')}`, 'error');
      return;
    }

    try {
      if (this.props.macro) {
        // Editar macro existente
        await api.put(`/macros/${this.props.macro.id}`, data);
        showToast('Macro atualizado com sucesso', 'success');
      } else {
        // Criar nova macro
        await api.post('/macros', {
          worldId: this.props.worldId,
          slot: this.props.slot,
          folderId: this.props.folderId || '',
          ...data
        });
        showToast('Macro criado com sucesso', 'success');
      }

      this.props.onSaved?.();
      windowManager.close(`macro-editor-${this.props.macro ? this.props.macro.id : this.props.slot}`);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar macro', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  private getCommandPlaceholder(): string {
    if (this.props.macro?.type === 'open-actor') {
      return t('common.macroActorIdPlaceholder');
    } else if (this.props.macro?.type === 'script') {
      return t('common.macroScriptPlaceholder');
    }
    return t('common.macroCommandPlaceholder');
  }

  private getCommandHint(): string {
    if (this.props.macro?.type === 'open-actor') {
      return t('common.macroActorIdHint');
    } else if (this.props.macro?.type === 'script') {
      return t('common.macroScriptHint');
    }
    return t('common.macroCommandHint');
  }
}