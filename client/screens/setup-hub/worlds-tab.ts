import { BaseComponent } from '../../components/base-component.js';
import { api, API_PATHS } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { windowManager } from '../../core/window-manager.js';
import { CreateWorldScreen } from '../create-world/create-world-screen.js';
import { EditWorldWindow } from '../../windows/edit-world-window.js';
import { CardGrid, CardGridItem } from '../../components/card-grid.js';
import { cardProgressTracker } from '../../components/card-progress.js';
import { createSearchFilter } from '../../components/search-filter.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';
import { showToast } from '../../components/toast.js';
import { renderSetupTabsNav } from './setup-tabs-nav.js';
import { renderGlobalProgressBar, updateGlobalProgressBarUI } from '../../components/global-progress-bar.js';
import { showConfirm } from '../../components/dialog.js';
import { InviteLinksWindow } from '../../windows/invite-links-window.js';
import { t } from '../../lib/i18n.js';

/** Local server responds too fast for the progress bar — without this minimum
 * pause, several steps finish in the same frame and the bar "jumps" straight
 * to the end instead of running (see comment in activateWorld). */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface World {
  id: string;
  name: string;
  coverUrl?: string;
  backgroundUrl?: string;
  description?: string;
  system: string;
  createdAt?: string;
  /** Scheduled date/time of the next session. Empty string = not scheduled.
   * Already comes from `GET /api/worlds`; it was just missing in the local type. */
  nextSession?: string;
  isActive?: boolean;
}

export class WorldsTab extends BaseComponent {
  private worlds: World[] = [];
  private filteredWorlds: World[] = [];
  private cardGrid: CardGrid | null = null;
  private unsubProgress: (() => void) | null = null;

  constructor(container: HTMLElement) {
    super(container);
    this.unsubProgress = cardProgressTracker.onChange(() => updateGlobalProgressBarUI(this.element));
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.worlds = await api.get<World[]>(API_PATHS.WORLDS);
      this.filteredWorlds = this.worlds;
      this.render();
    } catch (e) {
      showToast('Error loading worlds', 'error');
      this.render();
    }
  }

  /** Featured world, in this order of preference:
   * 1. the last one the admin opened (saved in `launchWorld`);
   * 2. the one with the nearest scheduled session;
   * 3. the first in the list.
   * With no worlds, the banner is not drawn. */
  private featuredWorld(): World | null {
    if (this.worlds.length === 0) return null;

    const ultimoId = localStorage.getItem('loom.lastPlayedWorldId');
    // Only valid if the world still exists — deleting a world would leave an orphaned id here.
    const ultimo = ultimoId ? this.worlds.find((w) => w.id === ultimoId) : undefined;
    if (ultimo) return ultimo;

    const agendados = this.worlds
      .filter((w) => !!w.nextSession)
      .sort((a, b) => String(a.nextSession).localeCompare(String(b.nextSession)));
    return agendados[0] || this.worlds[0];
  }

  private featuredTemplate(): string {
    const world = this.featuredWorld();
    if (!world) return '';

    const cover = world.coverUrl || world.backgroundUrl || '';
    const agendada = world.nextSession
      ? new Date(world.nextSession).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : t('setupHub.worldsTab.notScheduled');
    const estado = world.isActive ? t('setupHub.worldsTab.inProgress') : t('setupHub.worldsTab.readyToStart');

    return `
      <section id="setup-featured" aria-label="${t('setupHub.worldsTab.featuredSession')}">
        <h2 class="featured-label">
          <i class="fa-solid fa-star" aria-hidden="true"></i> ${t('setupHub.worldsTab.featuredSession')}
        </h2>
        <div class="featured-card">
          <div class="featured-thumb" style="${cover ? `background-image:url('${this.escapeHtml(cover)}')` : ''}">
            <span class="featured-system">${this.escapeHtml(world.system || 'generic')}</span>
          </div>
          <div class="featured-info">
            <span class="featured-state ${world.isActive ? 'is-live' : ''}">${estado}</span>
            <h3>${this.escapeHtml(world.name)}</h3>
            <p><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${t('setupHub.worldsTab.nextSession')}: ${this.escapeHtml(agendada)}</p>
          </div>
          <div class="featured-actions">
            <button class="btn bright" data-action="launch-featured" data-id="${this.escapeHtml(world.id)}">
              <i class="fa-solid fa-play" aria-hidden="true"></i> ${t('setupHub.worldsTab.enterTable')}
            </button>
            <button class="btn" data-action="edit-featured" data-id="${this.escapeHtml(world.id)}">
              <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> ${t('setupHub.worldsTab.tableDetails')}
            </button>
          </div>
        </div>
      </section>
    `;
  }

  protected template(): string {
    const viewMode = localStorage.getItem('viewMode.worlds') || 'cards';
    return `
      <header class="setup-hub-panel-header">${renderSetupTabsNav('worlds')}</header>
      ${this.featuredTemplate()}
      <h2 class="worlds-section-label">
        <i class="fa-solid fa-table-cells-large" aria-hidden="true"></i> ${t('setupHub.worldsTab.yourWorlds')}
      </h2>
      <div class="tab-content-box">
        <div class="setup-hub-toolbar">
          <div id="search-container"></div>
          <button class="btn" data-action="create"><i class="fa-solid fa-plus"></i> ${t('setupHub.worldsTab.createWorld')}</button>
          <div class="view-mode-toggle">
            <button class="view-mode-btn" data-action="toggle-view" title="${t('setupHub.worldsTab.toggleView')}">
              <i class="fa-solid ${viewMode === 'list' ? 'fa-list' : viewMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>
            </button>
          </div>
        </div>
        ${renderGlobalProgressBar()}
        <div id="worlds-grid"></div>
      </div>
    `;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'launch-featured' && id) {
      this.launchWorld(id);
    } else if (action === 'edit-featured' && id) {
      const world = this.worlds.find((w) => w.id === id);
      if (world) this.editWorld(world);
    } else if (action === 'create') {
      this.openCreateWorldScreen();
    } else if (action === 'toggle-view') {
      const newMode = this.cardGrid?.toggleViewMode() || 'cards';
      target.innerHTML = `<i class="fa-solid ${newMode === 'list' ? 'fa-list' : newMode === 'grid' ? 'fa-table-cells-large' : 'fa-image'}"></i>`;
    }
  }

  render(): void {
    super.render();

    // Setup search filter
    const searchContainer = this.element.querySelector('#search-container');
    if (searchContainer) {
      const filter = createSearchFilter(
        t('setupHub.worldsTab.filterWorlds'),
        this.worlds.length,
        (query) => this.filterWorlds(query),
      );
      searchContainer.appendChild(filter);
    }

    // Setup card grid
    const gridContainer = this.element.querySelector('#worlds-grid');
    if (gridContainer) {
      const items: CardGridItem[] = this.filteredWorlds.map((w) => ({
        id: w.id,
        name: w.name,
        // Missing here: this mapping and the initial render one, and the one in filterWorlds()
        // below already brought `description`. Because of this the card opened as "No
        // description" and started showing the text as soon as you typed in the filter.
        description: w.description,
        coverUrl: w.coverUrl || w.backgroundUrl,
        meta: w.createdAt
          ? new Date(w.createdAt).toLocaleString('pt-BR')
          : t('setupHub.worldsTab.noDate'),
        tags: w.system ? [w.system] : [],
        progress: cardProgressTracker.get(w.id),
      }));

this.cardGrid = new CardGrid(gridContainer as HTMLElement, items, {
      storageKey: 'worlds',
      onCardClick: (item) => this.launchWorld(item.id),
      onCardContextMenu: (item, event) =>
        this.showContextMenu(item.id, event as MouseEvent),
      onCardPlay: (item) => this.launchWorld(item.id),
    });

      this.cardGrid.render();
    }
  }

  private filterWorlds(query: string): void {
    const lowerQuery = query.toLowerCase();
    this.filteredWorlds = this.worlds.filter(
      (w) =>
        w.name.toLowerCase().includes(lowerQuery) ||
        w.description?.toLowerCase().includes(lowerQuery),
    );

    const items: CardGridItem[] = this.filteredWorlds.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      coverUrl: w.coverUrl || w.backgroundUrl,
      meta: w.createdAt
        ? new Date(w.createdAt).toLocaleString('pt-BR')
        : 'No date',
      tags: w.system ? [w.system] : [],
      progress: cardProgressTracker.get(w.id),
    }));

    this.cardGrid?.setItems(items);
  }

  private async launchWorld(worldId: string): Promise<void> {
    if (cardProgressTracker.isActive(worldId)) return;
    try {
      // The bar has to cover the whole operation, not just the final part. Before
      // this it only woke up at "Activating world...", so migration and backup —
      // precisely the slow steps — ran with a frozen screen.
      //
      // NOTE: these percentages are estimated on the client. The server already emits
      // real and granular progress (`Signal.broadcast('operation.progress')` in
      // world-db.ts), but today that doesn't arrive here: it lacks a
      // `Signal.listen('operation.progress')` relaying to the WebSocket, and the
      // Setup Hub doesn't even open a WS connection. Until that exists, estimating is the
      // best we can do.
      cardProgressTracker.set(worldId, 5, t('setupHub.worldsTab.progressChecking'));
      await sleep(150);
      const statusRes = await api.get<{ needsMigration: boolean }>(`${API_PATHS.WORLDS}/${worldId}/migration-status`);

      if (statusRes.needsMigration) {
        cardProgressTracker.clear(worldId);
        const confirmed = await showConfirm(
          t('setupHub.worldsTab.updateRequiredTitle'),
          t('setupHub.worldsTab.updateRequiredDesc')
        );

        if (!confirmed) return;

        cardProgressTracker.set(worldId, 15, t('setupHub.worldsTab.progressBackup'));
        await api.post(`${API_PATHS.WORLDS}/${worldId}/backup`, {});
        await sleep(150);

        cardProgressTracker.set(worldId, 35, t('setupHub.worldsTab.progressMigrating'));
        await sleep(150);
      }

      cardProgressTracker.set(worldId, 45, t('setupHub.worldsTab.progressActivating'));
      await api.post(`${API_PATHS.WORLDS}/${worldId}/activate`, {});
      await sleep(150);

      // Feeds the "Featured session" banner. Stays in localStorage on purpose: the
      // Setup Hub is an admin screen (one person per installation), so "the last world
      // that I opened" is the right semantics — and there is no `lastPlayedAt` field in the
      // world schema. If one day it needs to be valid across machines, swap it for this field here
      // and in `featuredWorld()`, which are the only two points that read this.
      localStorage.setItem('loom.lastPlayedWorldId', worldId);

      const endpoints = [
        { path: `/actors?worldId=${worldId}`, label: t('setupHub.worldsTab.progressLoadingActors') },
        { path: `/items?worldId=${worldId}`, label: t('setupHub.worldsTab.progressLoadingItems') },
        { path: `/stages?worldId=${worldId}`, label: t('setupHub.worldsTab.progressLoadingScenes') },
        { path: `/macros?worldId=${worldId}`, label: t('setupHub.worldsTab.progressLoadingMacros') },
        { path: `/journals?worldId=${worldId}`, label: t('setupHub.worldsTab.progressLoadingJournals') },
      ];

      let completed = 0;
      const total = endpoints.length;

      await Promise.all(
        endpoints.map(async (ep) => {
          try {
            await api.get(ep.path);
          } catch (e) {
            // ignore pre-load error, admin might not have role for everything
          }
          completed++;
          // Pre-load occupies the 50-95 range: 0-45 now belong to
          // verification/backup/activation, which previously ran without any bar.
          const percentage = 50 + Math.round((completed / total) * 45);
          cardProgressTracker.set(worldId, percentage, ep.label);
          await sleep(100);
        })
      );

      cardProgressTracker.set(worldId, 100, t('setupHub.worldsTab.progressStartingHud'));
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      cardProgressTracker.clear(worldId);
      showToast(e?.message || t('setupHub.worldsTab.errorStarting'), 'error');
    }
  }

  private showContextMenu(worldId: string, event: MouseEvent): void {
    const world = this.worlds.find((w) => w.id === worldId);
    if (!world) return;

    const items: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-play"></i>',
        label: t('setupHub.worldsTab.ctxStart'),
        action: () => this.launchWorld(worldId),
      },
      {
        icon: '<i class="fa-solid fa-gear"></i>',
        label: t('setupHub.worldsTab.ctxWorldConfig'),
        action: () => this.editWorld(world),
      },
      {
        icon: '<i class="fa-solid fa-link"></i>',
        label: t('inviteLinks.title'),
        action: () => windowManager.open(`invite-links-${worldId}`, InviteLinksWindow, { worldId }),
      },
      { divider: true, label: '' },
      {
        icon: '<i class="fa-solid fa-trash"></i>',
        label: t('setupHub.worldsTab.ctxDeleteWorld'),
        danger: true,
        action: () => this.deleteWorld(world),
      },
    ];

    showContextMenu(event, items);
  }

  private openCreateWorldScreen(): void {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    new CreateWorldScreen(overlay, {
      onCreated: (worldId) => void router.navigate('world-users-setup', { worldId }),
      onClose: () => overlay.remove(),
    });
  }

  private editWorld(world: World): void {
    windowManager.open(`edit-world-${world.id}`, EditWorldWindow, {
      world,
      onSaved: () => this.load(),
    });
  }

  private async deleteWorld(world: World): Promise<void> {
    const confirmed = await showConfirm(
      t('setupHub.worldsTab.confirmDeleteTitle'),
      t('setupHub.worldsTab.confirmDeleteDesc', { name: world.name })
    );
    if (!confirmed) return;

    try {
      await api.delete(`${API_PATHS.WORLDS}/${world.id}`);
      showToast(t('setupHub.worldsTab.deleteSuccess'), 'success');
      await this.load();
    } catch (e) {
      showToast(t('setupHub.worldsTab.deleteError'), 'error');
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  destroy(): void {
    this.unsubProgress?.();
    super.destroy();
  }
}
