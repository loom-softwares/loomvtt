/*******************************************************************************
 * LoomVTT
 * client/windows/keybind-config-window.ts
 * 
 * 
 * Window for configuring keybindings.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { keybindManager, KeybindAction } from '../core/keybinds.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';

export class KeybindConfigWindow extends BaseWindow {
  private listening: string | null = null;

  constructor(_props: { worldId: string }) {
    super({
      id: 'keybind-config',
      title: t('keybindConfig.title'),
      icon: '<i class="fa-solid fa-keyboard"></i>',
      width: 540,
      height: 'auto',
    });
  }

  private getBindings(): KeybindAction[] {
    return keybindManager.getAllBindings();
  }

  bodyTemplate(): string {
    const bindings = this.getBindings();
    const groups = new Map<string, KeybindAction[]>();
    for (const b of bindings) {
      const cat = b.category || t('keybinds.core.category');
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(b);
    }

    return `
      <div class="keybind-list">
        <p class="keybind-hint">${t('keybindConfig.hint')}</p>
        ${Array.from(groups.entries()).map(([cat, actions]) => `
          <div class="keybind-category">
            <h3 class="keybind-category-title">${cat} <span class="keybind-category-count">[${actions.length}]</span></h3>
            ${actions.map(b => `
              <div class="keybind-row">
                <div class="keybind-info">
                  <div class="keybind-label">${b.label}</div>
                  <div class="keybind-desc">${b.description}</div>
                </div>
                <div class="keybind-actions">
                  <button class="btn keybind-key-btn ${this.listening === b.id ? 'listening' : ''}"
                          data-action="rebind" data-id="${b.id}">
                    ${this.listening === b.id ? t('keybindConfig.waiting') : b.defaultKey}
                  </button>
                  <button class="btn btn-icon keybind-reset-btn" data-action="reset-keybind" data-id="${b.id}"
                          title="${t('keybindConfig.restoreDefault')}">↩️</button>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div class="form-actions">
        <button class="btn btn-danger" data-action="reset-all-keybinds">${t('keybindConfig.restoreAllDefaults')}</button>
      </div>
    `;
  }

  protected _postRender(): void {
    super._postRender();
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'rebind' && id) {
      this.startListening(id);
    } else if (action === 'reset-keybind' && id) {
      keybindManager.resetBinding(id);
      this.rerenderBody();
      showToast('Atalho restaurado para o padrão', 'success');
    } else if (action === 'reset-all-keybinds') {
      keybindManager.resetAll();
      this.rerenderBody();
      showToast('Todos os atalhos foram restaurados', 'success');
    }
  }

  private startListening(actionId: string): void {
    this.listening = actionId;
    this.rerenderBody();

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      document.removeEventListener('keydown', handler, true);
      this.listening = null;

      const key = e.key === ' ' ? 'Space' : e.key;
      if (key === 'Escape') {
        this.rerenderBody();
        return;
      }

      const existing = keybindManager.getAction(key);
      if (existing && existing !== actionId) {
        showToast(t('keybindConfig.keyInUse', { key, label: this.getBindings().find(b => b.id === existing)?.label || '' }), 'error');
        this.rerenderBody();
        return;
      }

      keybindManager.setBinding(actionId, key);
      this.rerenderBody();
      showToast(t('keybindConfig.keyChanged', { key }), 'success');
    };

    document.addEventListener('keydown', handler, true);
  }
}
