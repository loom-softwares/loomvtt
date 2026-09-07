/*******************************************************************************
 * LoomVTT
 * client/windows/module-management-window.ts
 * 
 * 
 * Window for enabling and disabling modules.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { Tabs } from '../components/tabs.js';
import { LoadingProgress } from '../components/loading-progress.js';

interface ModuleEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

export class ModuleManagementWindow extends BaseWindow {
  private modules: ModuleEntry[] = [];
  private searchTerm = '';
  private tabs: Tabs;
  private loadingProgress = new LoadingProgress();

  constructor(private props: { worldId: string }) {
    super({
      id: `module-management-${props.worldId}`,
      title: t('moduleManagement.title'),
      icon: '<i class="fa-solid fa-cubes"></i>',
      width: 640,
      height: 'auto',
    });

    this.tabs = new Tabs([
      { id: 'all', label: t('moduleManagement.tabAll') },
      { id: 'active', label: t('moduleManagement.tabActive') },
      { id: 'inactive', label: t('moduleManagement.tabInactive') },
    ], 'all', {
      onChange: () => this.rerenderBody(),
    });
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadModules();
  }

  private async loadModules(): Promise<void> {
    try {
      this.modules = await api.get<ModuleEntry[]>(`/worlds/${this.props.worldId}/packages`);
    } catch {
      showToast(t('moduleManagement.loadError'), 'error');
      this.modules = [];
    }
    this.rerenderBody();
  }

  bodyTemplate(): string {
    const filtered = this.getFilteredModules();
    const total = this.modules.length;
    const activeCount = this.modules.filter(m => m.enabled).length;
    const inactiveCount = total - activeCount;

    const tabDefs = [
      { id: 'all', label: `${t('moduleManagement.tabAll')} <span class="count-badge">${total}</span>` },
      { id: 'active', label: `${t('moduleManagement.tabActive')} <span class="count-badge">${activeCount}</span>` },
      { id: 'inactive', label: `${t('moduleManagement.tabInactive')} <span class="count-badge">${inactiveCount}</span>` },
    ];

    const navHtml = `
      <div class="tabs" role="tablist">
        ${tabDefs.map(t => `
          <button class="tab-button${this.tabs.isActive(t.id) ? ' active' : ''}"
                  data-action="tab-${t.id}"
                  role="tab"
                  aria-selected="${this.tabs.isActive(t.id) ? 'true' : 'false'}">${t.label}</button>
        `).join('')}
      </div>
    `;

    return `
      <div class="module-manager-search">
        <input type="text" class="search-input" placeholder="${t('moduleManagement.searchPlaceholder')}"
               value="${this.searchTerm}" data-action="search-modules">
      </div>
      ${navHtml}
      <div class="module-manager-list">
        ${filtered.length === 0
        ? `<div class="empty-state"><p>${t('moduleManagement.empty')}</p></div>`
        : filtered.map(m => this.renderModuleRow(m)).join('')}
      </div>
      <div class="module-manager-footer-actions">
        <button class="btn btn-danger" data-action="disable-all">${t('moduleManagement.disableAll')}</button>
      </div>
    `;
  }

  private renderModuleRow(module: ModuleEntry): string {
    const versionClass = 'version-badge version-ok';
    return `
      <div class="module-row" data-module-id="${module.id}">
        <label class="module-row-label">
          <input type="checkbox" data-action="toggle-module" data-module-id="${module.id}"
                 ${module.enabled ? 'checked' : ''}>
          <span class="module-row-name">${this.esc(module.name)}</span>
          <span class="${versionClass}">${this.esc(module.version || '—')}</span>
        </label>
      </div>
    `;
  }

  private getFilteredModules(): ModuleEntry[] {
    let filtered = [...this.modules];

    const activeTab = this.tabs.active;
    if (activeTab === 'active') filtered = filtered.filter(m => m.enabled);
    else if (activeTab === 'inactive') filtered = filtered.filter(m => !m.enabled);

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(term) ||
        (m.description || '').toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    // 'save' = standard BaseWindow footer button (previously there was a duplicate in the body).
    if (action === 'save') {
      void this.saveModules();
    } else if (action === 'disable-all') {
      void this.disableAll();
    } else if (action === 'toggle-module') {
      const moduleId = target.getAttribute('data-module-id')!;
      const module = this.modules.find(m => m.id === moduleId);
      if (module) {
        module.enabled = (target as HTMLInputElement).checked;
        // Without this, the checkbox only ever updated in-memory state —
        // nothing was POSTed to /packages/gm, so world_packages never got
        // the enabled:false row, and the addon kept loading regardless of
        // what the UI showed (same save+reload path "Disable All" already uses).
        void this.saveModules();
      }
    } else if (this.tabs.handleAction(action)) {
      return;
    }
  }

  private async saveModules(): Promise<void> {
    const enabledModules = this.modules.filter(m => m.enabled).map(m => m.id);

    this.loadingProgress.show(t('moduleManagement.saving'), t('moduleManagement.applyingConfig'));

    try {
      await api.post(`/worlds/${this.props.worldId}/packages/gm`, { enabledModules });
      this.loadingProgress.update(t('moduleManagement.done'), 1, 1);
      setTimeout(() => {
        this.loadingProgress.hide();
        window.location.reload();
      }, 500);
    } catch (e: any) {
      this.loadingProgress.hide();
      showToast(e?.message || t('moduleManagement.saveError'), 'error');
    }
  }

  private async disableAll(): Promise<void> {
    for (const m of this.modules) m.enabled = false;
    this.rerenderBody();
    await this.saveModules();
  }

  private esc(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  protected _postRender(): void {
    super._postRender();
    const footer = this.element.querySelector('.loom-window-footer');
    if (footer) (footer as HTMLElement).style.display = 'none';
    const searchInput = this.element.querySelector<HTMLInputElement>('.search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.addEventListener('input', () => {
        this.searchTerm = searchInput.value;
        this.rerenderBody();
      });
    }
  }
}


