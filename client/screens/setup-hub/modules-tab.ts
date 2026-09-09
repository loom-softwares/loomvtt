import { BaseComponent } from '../../components/base-component.js';
import { createSearchFilter } from '../../components/search-filter.js';
import { showToast } from '../../components/toast.js';
import { renderSetupTabsNav } from './setup-tabs-nav.js';
import { renderGlobalProgressBar, updateGlobalProgressBarUI } from '../../components/global-progress-bar.js';
import { api } from '../../core/api.js';
import { t } from '../../lib/i18n.js';
import { windowManager } from '../../core/window-manager.js';
import { ModuleManifestWindow } from '../../windows/module-manifest-window.js';
import { PackageBrowserWindow } from '../../windows/package-browser-window.js';
import { showConfirm } from '../../components/dialog.js';
import { cardProgressTracker } from '../../components/card-progress.js';
import { CardGrid, CardGridItem } from '../../components/card-grid.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';

// Import CSS
import '../../styles/modules/modules.css';

interface PackageInfo {
  type: 'addon' | 'ruleset';
  name: string;
  title?: string;
  version?: string;
  author?: string;
  repository?: string;
  backgroundUrl?: string;
  coverUrl?: string;
  description?: string;
  active?: boolean;
  dependencies?: string[];
  conflicts?: string[];
  settings?: Array<{
    key: string;
    type: 'string' | 'number' | 'boolean';
    default: string | number | boolean;
    label: string;
    hint?: string;
    scope: 'world' | 'client';
  }>;
}

export class ModulesTab extends BaseComponent {
  private packages: PackageInfo[] = [];
  private packagesLoaded = false;
  private unsubProgress: (() => void) | null = null;
  private cardGrid: CardGrid | null = null;
  private filteredPackages: PackageInfo[] = [];

  constructor(container: HTMLElement) {
    super(container);
    this.unsubProgress = cardProgressTracker.onChange(() => updateGlobalProgressBarUI(this.element));
    this.loadPackages();
    this.render();
  }

  private async loadPackages(): Promise<void> {
    if (this.packagesLoaded) return;

    try {
      const data = await api.get<{ packages: PackageInfo[] }>('/marketplace/packages');
      // Rulesets appear in the Systems tab — here it is only addons.
      this.packages = (data.packages ?? []).filter((pkg) => pkg.type === 'addon');
      this.filteredPackages = this.packages;
    } catch (error) {
      this.packages = [];
      this.filteredPackages = [];
    }

    this.packagesLoaded = true;
    this.render();
  }

  render(): void {
    try {
      this.element.innerHTML = this.template();
      
      const searchContainer = this.element.querySelector('#search-container');
      if (searchContainer && this.packagesLoaded) {
        const filter = createSearchFilter(
          t('setupHub.modules.title'),
          this.packages.length,
          (query) => this.filterPackages(query),
        );
        searchContainer.appendChild(filter);
      }

      const gridContainer = this.element.querySelector('#modules-grid');
      if (gridContainer && this.packages.length > 0) {
        const items: CardGridItem[] = this.filteredPackages.map((pkg) => ({
          id: pkg.name,
          name: pkg.title || pkg.name,
          description: pkg.description,
          meta: pkg.version ? `v${pkg.version}` : 'Unknown',
          type: pkg.type,
          coverUrl: pkg.backgroundUrl || pkg.coverUrl || '/bgs/01_stone_corridor.png',
          author: pkg.author,
          repository: pkg.repository
        }));

        this.cardGrid = new CardGrid(gridContainer as HTMLElement, items, {
          storageKey: 'modules',
          onCardContextMenu: (item, event) => this.showContextMenu(item, event as MouseEvent),
        });
        this.cardGrid.render();
      }
    } catch {
      this.element.innerHTML = `
        <header class="setup-hub-panel-header">${renderSetupTabsNav('modules')}</header>
        <div class="empty-state">
          <div class="empty-state-title">${t('setupHub.modules.emptyTitle')}</div>
        </div>
      `;
    }
  }

  private filterPackages(query: string): void {
    const lowerQuery = query.toLowerCase();
    this.filteredPackages = this.packages.filter(
      (pkg) =>
        (pkg.title || pkg.name).toLowerCase().includes(lowerQuery) ||
        pkg.description?.toLowerCase().includes(lowerQuery),
    );
    
    if (this.cardGrid) {
      const items: CardGridItem[] = this.filteredPackages.map((pkg) => ({
        id: pkg.name,
        name: pkg.title || pkg.name,
        description: pkg.description,
        meta: pkg.version ? `v${pkg.version}` : 'Unknown',
        type: pkg.type,
        coverUrl: pkg.backgroundUrl || pkg.coverUrl || '/bgs/01_stone_corridor.png',
        author: pkg.author,
        repository: pkg.repository
      }));
      this.cardGrid.setItems(items);
    }
  }

  protected template(): string {
    if (!this.packagesLoaded) {
      return `
        <header class="setup-hub-panel-header">${renderSetupTabsNav('modules')}</header>
        <div class="setup-hub-toolbar">
          <div id="search-container"></div>
          <button class="btn" data-action="update-all">🔄 ${t('setupHub.modules.updateAll')}</button>
        </div>
        ${renderGlobalProgressBar()}
        <div class="loading-state">
          <div class="loading-icon">⏳</div>
          <div class="loading-text">${t('setupHub.modules.loading')}</div>
        </div>
      `;
    }

    const viewMode = localStorage.getItem('viewMode.setup-modules') || 'cards';
    const searchContainer = `<div id="search-container"></div>`;

    const installButton = `<button class="btn" data-action="browse-marketplace"><i class="fa-solid fa-cube"></i> ${t('setupHub.modules.installFromUrl')}</button>`;

    const toolbar = `
      <div class="setup-hub-toolbar">
        ${searchContainer}
        ${installButton}
        <button class="btn" data-action="update-all"><i class="fa-solid fa-arrows-rotate"></i> ${t('setupHub.modules.updateAll')}</button>
        <div class="view-mode-toggle">
          <button class="view-mode-btn" data-action="toggle-view" title="Toggle View">
            <i class="fa-solid ${viewMode === 'list' ? 'fa-list' : viewMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>
          </button>
        </div>
      </div>
      ${renderGlobalProgressBar()}
    `;

    if (this.packages.length === 0) {
      return `
        <header class="setup-hub-panel-header">${renderSetupTabsNav('modules')}</header>
        <div class="tab-content-box">
          ${toolbar}
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">${t('setupHub.modules.emptyTitle')}</div>
            <p>${t('setupHub.modules.emptyDescription')}</p>
            <button class="btn" data-action="browse-marketplace">
              <i class="fa-solid fa-cube"></i> ${t('setupHub.modules.installFromUrl')}
            </button>
          </div>
        </div>
      `;
    }

    return `
      <header class="setup-hub-panel-header">${renderSetupTabsNav('modules')}</header>
      <div class="tab-content-box">
        ${toolbar}
        <div id="modules-grid"></div>
      </div>
    `;
  }

  private showContextMenu(item: CardGridItem, event: MouseEvent): void {
    const pkg = this.packages.find((p) => p.name === item.id);
    if (!pkg) return;

    const menuItems: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-folder-tree"></i>',
        label: t('setupHub.modules.manifestEdit'),
        action: () => this.openModuleManifest(pkg),
      },
    ];
    menuItems.push({
      icon: '<i class="fa-solid fa-trash"></i>',
      label: t('setupHub.modules.uninstall'),
      danger: true,
      action: () => this.handleUninstallPackage(pkg.name, pkg.type, this.element)
    });

    showContextMenu(event, menuItems);
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'browse-marketplace') {
      windowManager.open('package-browser-module', PackageBrowserWindow, {
        catalogType: 'module',
        onInstalled: () => {
          this.packagesLoaded = false;
          this.loadPackages();
        },
      });
    } else if (action === 'update-all') {
      this.handleUpdateAll();
    } else if (action === 'toggle-view') {
      const newMode = this.cardGrid?.toggleViewMode() || 'cards';
      target.innerHTML = `<i class="fa-solid ${newMode === 'list' ? 'fa-list' : newMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** Edita metadado do pacote (versão, autor, dependências...) direto no
   * addon.json/ruleset.json em disco. Diferente de "configurações do módulo"
   * (settings de escopo mundo/client, que o próprio addon define) — essas
   * continuam configuradas de dentro do jogo (Game Settings), nunca aqui,
   * porque o Setup Hub roda antes de qualquer mundo estar ativo. */
  private openModuleManifest(pkg: PackageInfo): void {
    windowManager.open(`module-manifest-${pkg.name}`, ModuleManifestWindow, {
      pkg,
      onSaved: () => {
        this.packagesLoaded = false;
        this.loadPackages();
      },
    });
  }

  private async handleTogglePackage(name: string, type: 'addon' | 'ruleset', target: HTMLElement): Promise<void> {
    const packageIndex = this.packages.findIndex(p => p.name === name && p.type === type);
    if (packageIndex === -1) return;

    const pkg = this.packages[packageIndex];
    const action = pkg.active ? 'deactivate' : 'activate';
    const actionText = pkg.active ? t('setupHub.modules.toggleDeactivate') : t('setupHub.modules.toggleActivate');

    try {
      await api.post(`/marketplace/${type}/${name}/${action}`);
      
      pkg.active = !pkg.active;
      this.render();
      
      showToast(
        t('setupHub.modules.toggleSuccess', { action: actionText.toLowerCase() }), 
        'success'
      );
    } catch (error: any) {
      showToast(
        t('setupHub.modules.toggleError', { action: actionText.toLowerCase() }), 
        'error'
      );
    }
  }

  private async handleUninstallPackage(name: string, type: 'addon' | 'ruleset', target: HTMLElement): Promise<void> {
    const pkg = this.packages.find(p => p.name === name && p.type === type);
    if (!pkg) return;

    const confirmed = await showConfirm(
      'Uninstall Addon',
      t('setupHub.modules.uninstallConfirm', { name: pkg.title || name }),
    );

    if (!confirmed) return;

    try {
      await api.delete(`/marketplace/${type}/${name}`);
      
      this.packages = this.packages.filter(p => !(p.name === name && p.type === type));
      this.render();
      
      showToast(t('setupHub.modules.uninstallSuccess'), 'success');
    } catch (error: any) {
      showToast(t('setupHub.modules.uninstallError'), 'error');
    }
  }

  private async handleUpdateAll(): Promise<void> {
    let updateCount = 0;
    
    for (const pkg of this.packages) {
      try {
        const result = await api.get<{ hasUpdate?: boolean }>(`/marketplace/${pkg.type}/${pkg.name}/update-check`);
        if (result.hasUpdate) {
          updateCount++;
        }
      } catch (error) {
        // Ignore errors for individual update checks
      }
    }

    if (updateCount > 0) {
      showToast(t('setupHub.modules.updateSuccess', { count: updateCount }), 'info');
    } else {
      showToast(t('setupHub.modules.updateNone'), 'info');
    }
  }

  destroy(): void {
    this.unsubProgress?.();
    super.destroy();
  }
}
