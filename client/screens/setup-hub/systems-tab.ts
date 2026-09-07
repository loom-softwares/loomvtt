import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api, API_PATHS } from '../../core/api.js';
import { CardGrid, CardGridItem } from '../../components/card-grid.js';
import { cardProgressTracker } from '../../components/card-progress.js';
import { createSearchFilter } from '../../components/search-filter.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';
import { showToast } from '../../components/toast.js';
import { renderSetupTabsNav } from './setup-tabs-nav.js';
import { renderGlobalProgressBar, updateGlobalProgressBarUI } from '../../components/global-progress-bar.js';
import { windowManager } from '../../core/window-manager.js';
import { PackageBrowserWindow } from '../../windows/package-browser-window.js';

interface SystemResponse {
  id: string;
  title: string;
  version: string;
  author?: string;
  repository?: string;
  backgroundUrl?: string;
}

interface System {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  repository?: string;
  backgroundUrl?: string;
}

export class SystemsTab extends BaseComponent {
  private systems: System[] = [];
  private filteredSystems: System[] = [];
  private cardGrid: CardGrid | null = null;
  private unsubProgress: (() => void) | null = null;

  constructor(container: HTMLElement) {
    super(container);
    this.unsubProgress = cardProgressTracker.onChange(() => updateGlobalProgressBarUI(this.element));
    this.load();
  }

  private async load(): Promise<void> {
    try {
      const data = await api.get<SystemResponse[]>(API_PATHS.SYSTEMS);
      this.systems = data.map(s => ({
        id: s.id,
        name: s.title || s.id,
        version: s.version,
        author: s.author,
        repository: s.repository,
        backgroundUrl: s.backgroundUrl,
      }));
      this.filteredSystems = this.systems;
      this.render();
    } catch (e) {
      showToast(t('setupHub.systems.errorLoading'), 'error');
      this.render();
    }
  }

  protected template(): string {
    const viewMode = localStorage.getItem('viewMode.systems') || 'cards';
    return `
      <header class="setup-hub-panel-header">${renderSetupTabsNav('systems')}</header>
      <div class="tab-content-box">
        <div class="setup-hub-toolbar">
          <div id="search-container"></div>
          <button class="btn" data-action="install"><i class="fa-solid fa-download"></i> ${t('setupHub.systems.installSystem')}</button>
          <button class="btn btn-secondary" data-action="update-all"><i class="fa-solid fa-arrows-rotate"></i> ${t('setupHub.systems.updateAll')}</button>
          <div class="view-mode-toggle">
            <button class="view-mode-btn" data-action="toggle-view" title="${t('setupHub.systems.toggleView')}">
              <i class="fa-solid ${viewMode === 'list' ? 'fa-list' : viewMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>
            </button>
          </div>
        </div>
        ${renderGlobalProgressBar()}
        <div id="systems-grid"></div>
      </div>
    `;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'install') {
      windowManager.open('package-browser-system', PackageBrowserWindow, {
        catalogType: 'system',
        onInstalled: () => this.load(),
      });
    } else if (action === 'update-all') {
      showToast(t('setupHub.systems.updateComingSoon'), 'info');
    } else if (action === 'toggle-view') {
      const newMode = this.cardGrid?.toggleViewMode() || 'cards';
      target.innerHTML = `<i class="fa-solid ${newMode === 'list' ? 'fa-list' : newMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>`;
    }
  }

  render(): void {
    super.render();

    const searchContainer = this.element.querySelector('#search-container');
    if (searchContainer) {
      const filter = createSearchFilter(
        t('setupHub.systems.filterSystems'),
        this.systems.length,
        (query) => this.filterSystems(query),
      );
      searchContainer.appendChild(filter);
    }

    const gridContainer = this.element.querySelector('#systems-grid');
    if (!gridContainer) return;

    if (this.systems.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">${t('setupHub.systems.emptyTitle')}</div>
          <p>${t('setupHub.systems.emptyDesc')}</p>
          <button class="btn" data-action="install">➕ ${t('setupHub.systems.installSystem')}</button>
        </div>
      `;
      return;
    }

    const items: CardGridItem[] = this.filteredSystems.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      meta: `v${s.version}`,
      coverUrl: s.backgroundUrl || '/bgs/05_ancient_library.png',
      progress: cardProgressTracker.get(s.id),
      author: s.author,
      repository: s.repository
    }));

    this.cardGrid = new CardGrid(gridContainer as HTMLElement, items, {
      storageKey: 'systems',
      onCardContextMenu: (item, event) =>
        this.showContextMenu(item.id, event as MouseEvent),
    });

    this.cardGrid.render();
  }

  private filterSystems(query: string): void {
    const lowerQuery = query.toLowerCase();
    this.filteredSystems = this.systems.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery),
    );

    const items: CardGridItem[] = this.filteredSystems.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      meta: `v${s.version}`,
      coverUrl: s.backgroundUrl || '/bgs/05_ancient_library.png',
      progress: cardProgressTracker.get(s.id),
      author: s.author,
      repository: s.repository
    }));

    this.cardGrid?.setItems(items);
  }

  private showContextMenu(systemId: string, event: MouseEvent): void {
    const system = this.systems.find((s) => s.id === systemId);
    if (!system) return;

    const items: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-gear"></i>',
        label: t('setupHub.systems.editSystem'),
        action: () => showToast(t('setupHub.systems.editionComingSoon'), 'info'),
      },
      {
        icon: '<i class="fa-solid fa-trash"></i>',
        label: t('setupHub.systems.uninstall'),
        danger: true,
        action: () => showToast(t('setupHub.systems.uninstallComingSoon'), 'info'),
      },
    ];

    showContextMenu(event, items);
  }

  destroy(): void {
    this.unsubProgress?.();
    super.destroy();
  }
}
