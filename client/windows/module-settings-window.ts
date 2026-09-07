/*******************************************************************************
 * LoomVTT
 * client/windows/module-settings-window.ts
 * 
 * 
 * Window for configuring module settings.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { t } from '../lib/i18n.js';
import { settingsRegistry } from '../core/settings-registry.js';

interface ModuleSetting {
  key: string;
  type: 'string' | 'number' | 'boolean';
  default: string | number | boolean;
  label: string;
  hint?: string;
  scope: 'world' | 'client';
}

interface ModuleManifest {
  name: string;
  title?: string;
  settings: ModuleSetting[];
}

interface ModuleSettingsData {
  [key: string]: any;
}

export class ModuleSettingsWindow extends BaseWindow {
  private loading = true;
  private currentSettings: ModuleSettingsData = {};
  private manifest: ModuleManifest;

  constructor(private props: { worldId: string; moduleId: string; manifest: ModuleManifest }) {
    super({
      id: `module-settings-${props.moduleId}`,
      title: props.manifest.title || props.manifest.name,
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 500,
      height: 'auto'
    });
    this.manifest = props.manifest;
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const response = await api.get<{ data: ModuleSettingsData; error: string | null }>(
        `/module-settings/${this.props.worldId}/${this.props.moduleId}`
      );

      if (response.error) {
        throw new Error(response.error);
      }

      this.currentSettings = response.data || {};
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar configurações do módulo', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }

    return `
      <form class="module-settings-form" data-action="save">
        <div class="settings-list">
          ${this.manifest.settings.map(setting => this.settingTemplate(setting)).join('')}
        </div>
      </form>
    `;
  }

  private settingTemplate(setting: ModuleSetting): string {
    const currentValue = this.currentSettings[setting.key] ?? setting.default;
    const inputId = `setting-${setting.key}`;

    let inputHtml = '';
    switch (setting.type) {
      case 'string':
        inputHtml = `<input type="text" id="${inputId}" name="${setting.key}" value="${this.esc(currentValue)}" />`;
        break;
      case 'number':
        inputHtml = `<input type="number" id="${inputId}" name="${setting.key}" value="${currentValue}" />`;
        break;
      case 'boolean':
        inputHtml = `<input type="checkbox" id="${inputId}" name="${setting.key}" ${currentValue ? 'checked' : ''} />`;
        break;
    }

    return `
      <div class="setting-item">
        <label for="${inputId}">${this.esc(setting.label)}</label>
        ${inputHtml}
        ${setting.hint ? `<div class="setting-hint">${this.esc(setting.hint)}</div>` : ''}
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.saveSettings();
    } else if (action === 'close') {
      windowManager.close(`module-settings-${this.props.moduleId}`);
    }
  }

  private async saveSettings(): Promise<void> {
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
      // Saves via settingsRegistry (not direct to API) to keep Loom.settings cache/onChange
      // in sync with what the user changed through this window.
      const savePromises = Object.entries(data).map(([key, value]) =>
        settingsRegistry.set(this.props.moduleId, key, value)
      );

      await Promise.all(savePromises);

      showToast('Configurações salvas com sucesso', 'success');
      windowManager.close(`module-settings-${this.props.moduleId}`);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar configurações', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}