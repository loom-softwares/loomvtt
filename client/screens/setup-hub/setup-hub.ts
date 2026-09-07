import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api, API_PATHS } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { windowManager } from '../../core/window-manager.js';
import { AppConfigWindow } from '../../windows/app-config-window.js';
import { showToast } from '../../components/toast.js';
import { showContextMenu } from '../../components/context-menu.js';
import { WorldsTab } from './worlds-tab.js';
import { SystemsTab } from './systems-tab.js';
import { ModulesTab } from './modules-tab.js';
import { UpdatesScreen } from './updates-screen.js';
import { LoomAccountWidget } from './loom-account-widget.js';

interface PackageUpdate {
  type: 'addon' | 'ruleset';
  name: string;
  title?: string;
  localVersion?: string;
  remoteVersion?: string;
}

interface NewsItem {
  id: string;
  title: string;
  date: string;
  summary: string;
  imageUrl?: string;
  link?: string;
}

export class SetupHubScreen extends BaseComponent {
  private currentTab: 'worlds' | 'systems' | 'modules' = 'worlds';
  private news: NewsItem[] = [];
  private tabInstances: {
    worlds?: WorldsTab;
    systems?: SystemsTab;
    modules?: ModulesTab;
  } = {};
  private mountedTabs = new Set<string>();
  private loomAccountWidget?: LoomAccountWidget;
  private packageUpdates: PackageUpdate[] = [];
  private showingNews = false;
  private changelog = '';
  private changelogVersion = '';
  private changelogLoaded = false;

  constructor(container: HTMLElement) {
    super(container);
    this.news = this.defaultNews();
    this.render();
    this.mountTab(this.currentTab);
    this.mountLoomAccountWidget();
    this.loadPackageUpdates();
  }

  private mountLoomAccountWidget(): void {
    const slot = this.element.querySelector<HTMLElement>('#loom-account-widget-slot');
    if (!slot) return;
    this.loomAccountWidget?.destroy();
    this.loomAccountWidget = new LoomAccountWidget(slot);
  }

  private async loadPackageUpdates(): Promise<void> {
    try {
      const data = await api.get<{ updates: PackageUpdate[] }>('/marketplace/updates');
      this.packageUpdates = data.updates ?? [];
    } catch {
      this.packageUpdates = [];
    }
    this.updateNotificationsBadge();
  }

  private updateNotificationsBadge(): void {
    const btn = this.element.querySelector<HTMLElement>('[data-action="notifications"]');
    if (!btn) return;
    btn.querySelector('.badge-count')?.remove();
    if (this.packageUpdates.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge-count';
      badge.textContent = String(this.packageUpdates.length);
      btn.appendChild(badge);
    }
  }

  private defaultNews(): NewsItem[] {
    return [
      {
        id: '1',
        title: t('setupHub.hub.mockWelcome'),
        date: '',
        summary: t('setupHub.hub.mockWelcomeDesc'),
        imageUrl: '/bgs/03_treasure_room.png',
        link: 'https://loomvtt.com/news/welcome'
      },
      {
        id: '2',
        title: t('setupHub.hub.mockCreate'),
        date: '',
        summary: t('setupHub.hub.mockCreateDesc'),
        imageUrl: '/bgs/06_ritual_chamber.png',
        link: 'https://loomvtt.com/docs/worlds'
      },
      {
        id: '3',
        title: t('setupHub.hub.mockExplore'),
        date: '',
        summary: t('setupHub.hub.mockExploreDesc'),
        imageUrl: '/bgs/05_ancient_library.png',
        link: 'https://loomvtt.com/systems'
      },
    ];
  }

  private tabId(tab: string): string {
    return `tab-${tab}`;
  }

  private panelId(tab: string): string {
    return `panel-${tab}`;
  }

  protected template(): string {
    const tabIds = ['worlds', 'systems', 'modules'];
    const tabLabels = [t('setupHub.hub.navWorlds'), t('setupHub.hub.navSystems'), t('setupHub.hub.navAddons')];
    const railItems = [
      { id: 'worlds', label: t('setupHub.hub.navWorlds'), icon: 'fa-globe' },
      { id: 'systems', label: t('setupHub.hub.navSystems'), icon: 'fa-dice-d20' },
      { id: 'modules', label: t('setupHub.hub.navModules'), icon: 'fa-puzzle-piece' },
    ];
    const guideIcons = ['fa-rocket', 'fa-hammer', 'fa-compass'];

    return `
      <section id="setup" role="main" aria-label="Configuration Panel">

        <aside id="setup-rail" aria-label="Main Navigation">
          <div class="rail-brand">
            <img src="/images/loom-logo.png" alt="LoomVTT" />
            <span>LOOM</span>
          </div>

          <nav class="rail-nav" role="tablist">
            ${railItems.map((item) => `
              <button
                class="rail-item ${!this.showingNews && this.currentTab === item.id ? 'active' : ''}"
                data-action="tab-${item.id}"
                role="tab"
                id="tab-${item.id}"
                aria-controls="panel-${item.id}"
                aria-selected="${!this.showingNews && this.currentTab === item.id ? 'true' : 'false'}"
              >
                <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
                <span>${item.label}</span>
              </button>
            `).join('')}

            <button class="rail-item ${this.showingNews ? 'active' : ''}" data-action="news" role="tab" aria-selected="${this.showingNews ? 'true' : 'false'}">
              <i class="fa-solid fa-bell" aria-hidden="true"></i>
              <span>${t('setupHub.hub.navNews')}</span>
            </button>
          </nav>

          <button class="rail-item rail-item-bottom" data-action="config">
            <i class="fa-solid fa-sliders" aria-hidden="true"></i>
            <span>${t('setupHub.hub.navSettings')}</span>
          </button>
        </aside>

        <div id="setup-main">

          <header id="setup-topbar">
            <div class="topbar-titles">
              <h1>${t('setupHub.hub.topbarTitle')}</h1>
              <p>${t('setupHub.hub.topbarSubtitle')}</p>
            </div>
            <nav class="setup-hub-global-actions" aria-label="Global Actions">
              <div class="loom-account-widget-slot" id="loom-account-widget-slot"></div>
              <button class="btn-icon" data-action="reload" title="${t('setupHub.hub.btnReload')}" aria-label="${t('setupHub.hub.btnReload')}"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i></button>
              <button class="btn-icon" data-action="updates" title="${t('setupHub.hub.btnUpdateApp')}" aria-label="${t('setupHub.hub.btnUpdateApp')}" style="position: relative;"><i class="fa-solid fa-download" aria-hidden="true"></i></button>
              <button class="btn-icon" data-action="logout" title="${t('setupHub.hub.btnLogout')}" aria-label="${t('setupHub.hub.btnLogout')}"><i class="fa-solid fa-lock" aria-hidden="true"></i></button>
            </nav>
          </header>

          ${this.showingNews ? `
          <section id="setup-news-panel" aria-label="${t('setupHub.hub.newsTitle')}">
            <h2>${t('setupHub.hub.newsTitle')}</h2>
            ${this.changelog.trim() ? `
              <article class="news-entry">
                ${this.changelogVersion ? `<span class="news-version">${t('setupHub.hub.newsVersion', { version: this.escapeHtml(this.changelogVersion) })}</span>` : ''}
                <pre class="news-body">${this.escapeHtml(this.changelog)}</pre>
              </article>
            ` : `
              <div class="news-empty">
                <i class="fa-regular fa-bell-slash" aria-hidden="true"></i>
                <p>${t('setupHub.hub.newsEmpty')}</p>
                <small>${this.changelogLoaded ? t('setupHub.hub.newsEmptyDesc') : 'Loading…'}</small>
              </div>
            `}
          </section>` : ''}

          <section id="setup-packages" ${this.showingNews ? 'hidden' : ''}>
            ${tabIds.map((tab, i) => `
              <section class="tab ${this.currentTab === tab ? 'active' : ''}"
                id="${this.panelId(tab)}"
                role="tabpanel"
                aria-label="${tabLabels[i]}"
              >
              </section>
            `).join('')}
          </section>

          <section id="setup-guide" aria-label="${t('setupHub.hub.quickGuide')}">
            <h2>${t('setupHub.hub.quickGuide')}</h2>
            <div class="guide-cards">
              ${this.news.map((item, i) => `
                <a href="${item.link || '#'}" target="_blank" rel="noopener noreferrer" class="guide-card">
                  <span class="guide-card-icon"><i class="fa-solid ${guideIcons[i] || 'fa-book'}" aria-hidden="true"></i></span>
                  <span class="guide-card-text">
                    <strong>${this.escapeHtml(item.title)}</strong>
                    <em>${this.escapeHtml(item.summary || '')}</em>
                  </span>
                </a>
              `).join('')}
            </div>
          </section>

          <footer id="setup-footer">
            <span>${t('setupHub.hub.footerSubtitle')}</span>
            <span>v0.0.1</span>
          </footer>

        </div>
      </section>
    `;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action.startsWith('tab-')) {
      const tabName = action.replace('tab-', '') as 'worlds' | 'systems' | 'modules';

      if (this.showingNews) {
        // Leaving the news panel is the only case that requires redrawing the body.
        // render() recreates the empty <section class="tab"> elements, so mountedTabs needs
        // to be cleared — otherwise mountTab() thinks it's already mounted and the tab comes back blank.
        this.showingNews = false;
        this.currentTab = tabName;
        this.mountedTabs.clear();
        this.render();
        this.mountTab(tabName);
        this.mountLoomAccountWidget();
      } else {
        // switchTab() already handles currentTab, the panels and mountTab (see the method).
        // No render() here: it would destroy the DOM of already mounted tabs and they would return
        // empty, because mountedTabs would still say they were already mounted.
        this.switchTab(tabName);
      }

      // switchTab() used to mark the old `.tab-button`, which stopped existing when the nav
      // became a rail — the active state of the rail needs to be updated here.
      this.element.querySelectorAll('.rail-item').forEach((el) => el.classList.remove('active'));
      this.element.querySelector(`.rail-item[data-action="tab-${tabName}"]`)?.classList.add('active');
    } else if (action === 'news') {
      this.openNews();
    } else if (action === 'reload') {
      window.location.reload();
    } else if (action === 'updates') {
      this.openUpdatesScreen();
    } else if (action === 'config') {
      windowManager.open('app-config', AppConfigWindow);
    } else if (action === 'notifications') {
      this.showNotifications(target);
    } else if (action === 'logout') {
      this.logout();
    }
  }

  private showNotifications(target: HTMLElement): void {
    if (this.packageUpdates.length === 0) {
      showToast(t('setupHub.hub.noUpdates'), 'info');
      return;
    }

    const rect = target.getBoundingClientRect();
    const fakeEvent = { preventDefault: () => {}, clientX: rect.left, clientY: rect.bottom + 4 } as MouseEvent;

    showContextMenu(fakeEvent, this.packageUpdates.map((pkg) => ({
      icon: pkg.type === 'ruleset' ? '<i class="fa-solid fa-dice-d20"></i>' : '<i class="fa-solid fa-puzzle-piece"></i>',
      label: `${pkg.title || pkg.name} — v${pkg.localVersion} → v${pkg.remoteVersion}`,
      action: () => this.switchTab(pkg.type === 'ruleset' ? 'systems' : 'modules'),
    })));
  }

  /** News panel: reads the notes of the last published release (same source as the
   * Updates screen — GitHub releases via `/system/update-check`). There is no separate
   * news feed; when there is no published note, it shows the empty state instead
   * of inventing content. */
  private async openNews(): Promise<void> {
    this.showingNews = true;
    this.render();
    this.mountLoomAccountWidget();

    if (this.changelogLoaded) return;
    try {
      const info = await api.get<{ changelog?: string; latestVersion?: string }>(
        '/system/update-check?channel=stable',
      );
      this.changelog = info.changelog || '';
      this.changelogVersion = info.latestVersion || '';
    } catch {
      this.changelog = '';
      this.changelogVersion = '';
    }
    this.changelogLoaded = true;
    if (this.showingNews) {
      this.render();
      this.mountLoomAccountWidget();
    }
  }

  private openUpdatesScreen(): void {
    const overlay = document.createElement('div');
    document.body.appendChild(overlay);
    new UpdatesScreen(overlay, { onClose: () => overlay.remove() });
  }

  private switchTab(tab: 'worlds' | 'systems' | 'modules'): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;

    this.element.querySelectorAll('.tab').forEach((p) => p.classList.remove('active'));
    const panel = this.element.querySelector<HTMLElement>(`#${this.panelId(tab)}`);
    if (panel) {
      panel.classList.add('active');
      panel.querySelector<HTMLElement>('.tab-button.active')?.focus();
    }

    this.mountTab(tab);
  }

  private mountTab(tab: 'worlds' | 'systems' | 'modules'): void {
    if (this.mountedTabs.has(tab)) return;
    this.mountedTabs.add(tab);

    const panel = this.element.querySelector<HTMLElement>(`#${this.panelId(tab)}`);
    if (!panel) return;

    if (tab === 'worlds') {
      this.tabInstances.worlds = new WorldsTab(panel);
    } else if (tab === 'systems') {
      this.tabInstances.systems = new SystemsTab(panel);
    } else if (tab === 'modules') {
      this.tabInstances.modules = new ModulesTab(panel);
    }
  }

  private async logout(): Promise<void> {
    try {
      await api.post(API_PATHS.SETUP_LOGOUT, {});
      showToast(t('setupHub.hub.logoutSuccess'), 'success');
      await router.navigate('admin-login', { mode: 'login' });
    } catch (e) {
      console.error('[Logout] Error:', e);
      showToast(t('setupHub.hub.logoutError'), 'error');
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.tabInstances.worlds?.destroy();
    this.tabInstances.systems?.destroy();
    this.tabInstances.modules?.destroy();
    this.loomAccountWidget?.destroy();
    this.mountedTabs.clear();
    super.destroy();
  }
}
