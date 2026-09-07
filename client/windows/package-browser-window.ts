/*******************************************************************************
 * LoomVTT
 * client/windows/package-browser-window.ts
 * 
 * 
 * Browser window for exploring packages.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { cardProgressTracker } from '../components/card-progress.js';

import '../styles/modules/package-browser.css';

interface CatalogEntry {
  id: string;
  title: string;
  short_description: string | null;
  type: 'system' | 'module' | 'world' | 'content';
  category: string | null;
  version: string | null;
  min_loom_version: string | null;
  manifest_url: string;
  banner_url: string | null;
  profiles?: { username: string } | null;
}

// Catalog (Supabase, via /marketplace/catalog) uses 'system'/'module'; the
// installer (/marketplace/install) uses 'ruleset'/'addon' -- two vocabularies
// for the same concept, done on purpose in separate layers.
const CATALOG_TO_INSTALLER_TYPE: Record<string, 'ruleset' | 'addon'> = {
  system: 'ruleset',
  module: 'addon',
};

export class PackageBrowserWindow extends BaseWindow {
  private entries: CatalogEntry[] = [];
  private categories: string[] = [];
  private loading = true;
  private loadError: string | null = null;
  private search = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private activeCategory = 'all';
  private installingIds = new Set<string>();
  private unsubProgress: (() => void) | null = null;
  private readonly catalogType: 'system' | 'module';
  private readonly onInstalled?: () => void;

  constructor(props: { catalogType: 'system' | 'module'; onInstalled?: () => void }) {
    super({
      id: `package-browser-${props.catalogType}`,
      title: props.catalogType === 'system'
        ? (t('setupHub.systems.browseTitle') || 'Instalar Sistema')
        : (t('setupHub.modules.browseTitle') || 'Instalar Módulo'),
      icon: '<i class="fa-solid fa-cubes"></i>',
      width: 1080,
      height: 660,
      showFooter: false,
    });
    this.catalogType = props.catalogType;
    this.onInstalled = props.onInstalled;
    this.unsubProgress = cardProgressTracker.onChange(() => this.rerenderBody());
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadCatalog();
  }

  async destroy(): Promise<void> {
    this.unsubProgress?.();
    await super.destroy();
  }

  private async loadCatalog(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    this.rerenderBody();

    try {
      const params = new URLSearchParams({ type: this.catalogType });
      if (this.activeCategory !== 'all') params.set('category', this.activeCategory);
      if (this.search.trim()) params.set('q', this.search.trim());

      const data = await api.get<{ packages: CatalogEntry[] }>(`/marketplace/catalog?${params.toString()}`);
      this.entries = data.packages ?? [];

      // Categorias observadas nesta resposta -- lista cresce organicamente
      // as the catalog gets more packages registered, without needing a
      // separate endpoint just to list categories.
      const seen = new Set(this.categories);
      for (const entry of this.entries) {
        if (entry.category && !seen.has(entry.category)) {
          seen.add(entry.category);
          this.categories.push(entry.category);
        }
      }
    } catch (err: any) {
      this.loadError = err?.message || 'Não foi possível carregar o catálogo do Loom Hub.';
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    return `
      <div class="package-browser-root">
        <div class="package-browser-toolbar">
          <input
            type="text"
            name="package-browser-search"
            class="package-browser-search"
            placeholder="${t('setupHub.browser.search') || 'Buscar sistema ou módulo'}"
            value="${this.esc(this.search)}"
            data-role="search-input"
          />
          <div class="package-browser-manual-row">
            <input type="text" id="package-browser-manual-url" placeholder="https://path/to/manifest.json" />
            <button class="btn" data-action="install-manual" title="${t('setupHub.browser.manualManifest') || 'URL do Manifesto'}">
              <i class="fa-solid fa-link"></i> ${t('setupHub.browser.installFromUrl') || 'Instalar de URL'}
            </button>
          </div>
        </div>

        <div class="package-browser-chips">
          <button type="button" class="package-browser-category ${this.activeCategory === 'all' ? 'active' : ''}" data-action="filter-category" data-id="all">
            ${t('setupHub.browser.allCategories') || 'Todos'}
          </button>
          ${this.categories.map((cat) => `
            <button type="button" class="package-browser-category ${this.activeCategory === cat ? 'active' : ''}" data-action="filter-category" data-id="${this.esc(cat)}">
              ${this.esc(cat)}
            </button>
          `).join('')}
        </div>

        <div class="package-browser-main">
          ${this.bodyListTemplate()}
        </div>
      </div>
    `;
  }

  private bodyListTemplate(): string {
    if (this.loading) {
      return `<div class="loading-state"><div class="loading-icon">⏳</div></div>`;
    }
    if (this.loadError) {
      return `<div class="empty-state"><div class="empty-state-title">${this.esc(this.loadError)}</div></div>`;
    }
    if (this.entries.length === 0) {
      return `
        <div class="empty-state package-browser-empty">
          <i class="fa-solid fa-box-open package-browser-empty-icon"></i>
          <div class="empty-state-title">${t('setupHub.browser.empty') || 'Nenhum pacote encontrado'}</div>
          <p class="package-browser-empty-hint">
            ${t('setupHub.browser.emptyHint') || 'Ajuste a busca ou o filtro, ou instale direto pela URL do manifesto no topo.'}
          </p>
        </div>
      `;
    }

    return `
      <div class="package-browser-list">
        ${this.entries.map((entry) => this.entryTemplate(entry)).join('')}
      </div>
    `;
  }

  private entryTemplate(entry: CatalogEntry): string {
    const progress = cardProgressTracker.get(entry.id);
    const installing = this.installingIds.has(entry.id) || (progress && progress.phase !== 'done' && progress.phase !== 'error');

    const actionHtml = installing
      ? `<button class="btn" disabled>⏳ ${progress ? `${this.esc(progress.label)} (${progress.percent}%)` : (t('common.installing') || 'Instalando...')}</button>`
      : `<button class="btn btn-primary" data-action="install-entry" data-id="${this.esc(entry.id)}">
           <i class="fa-solid fa-download"></i> ${t('common.install') || 'Instalar'}
         </button>`;

    return `
      <div class="package-browser-entry">
        <div class="package-browser-entry-banner" style="${entry.banner_url ? `background-image:url('${this.esc(entry.banner_url)}')` : ''}"></div>
        <div class="package-browser-entry-body">
          <div class="package-browser-entry-header">
            <h3>${this.esc(entry.title)}</h3>
            <span class="package-browser-entry-version">v${this.esc(entry.version || '1.0.0')}</span>
          </div>
          <p class="package-browser-entry-desc">${this.esc(entry.short_description || '')}</p>
          <div class="package-browser-entry-footer">
            <span class="package-browser-entry-author">
              <i class="fa-solid fa-user"></i> ${this.esc(entry.profiles?.username || 'Loom Hub')}
            </span>
            <a href="${this.esc(entry.manifest_url)}" target="_blank" rel="noopener noreferrer" class="package-browser-entry-link" title="${t('setupHub.browser.viewManifest') || 'Ver manifesto'}">
              <i class="fa-solid fa-up-right-from-square"></i>
            </a>
            ${actionHtml}
          </div>
        </div>
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'filter-category') {
      this.activeCategory = id || 'all';
      void this.loadCatalog();
    } else if (action === 'install-entry' && id) {
      const entry = this.entries.find((e) => e.id === id);
      if (entry) void this.installEntry(entry);
    } else if (action === 'install-manual') {
      const input = this.element.querySelector<HTMLInputElement>('#package-browser-manual-url');
      const url = input?.value.trim();
      if (url) void this.installManifestUrl(url, `manual-${Date.now()}`);
    }
  }

  protected _postRender(): void {
    const searchInput = this.element.querySelector<HTMLInputElement>('[data-role="search-input"]');
    searchInput?.addEventListener('input', () => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.search = searchInput.value;
        void this.loadCatalog();
      }, 300);
    });
  }

  private async installEntry(entry: CatalogEntry): Promise<void> {
    await this.installManifestUrl(entry.manifest_url, entry.id);
  }

  private async installManifestUrl(manifestUrl: string, operationId: string): Promise<void> {
    this.installingIds.add(operationId);
    this.rerenderBody();

    try {
      await api.post('/marketplace/install', {
        manifestUrl,
        type: CATALOG_TO_INSTALLER_TYPE[this.catalogType],
        operationId,
      });
      showToast(t('setupHub.modules.installSuccess') || 'Instalado com sucesso', 'success');
      this.onInstalled?.();
    } catch (err: any) {
      showToast(err?.message || t('setupHub.modules.installError') || 'Erro ao instalar', 'error');
    } finally {
      this.installingIds.delete(operationId);
      this.rerenderBody();
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
