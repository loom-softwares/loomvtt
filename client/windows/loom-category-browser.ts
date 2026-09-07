/*******************************************************************************
 * LoomVTT
 * client/windows/loom-category-browser.ts
 * 
 * 
 * Browser window for categorizing Loom items.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';

export interface CategoryBrowserOptions extends BaseWindowOptions {
  initialCategory?: string;
}

export interface CategoryGroup {
  id: string;
  label: string;
  entries: object[];
}

export abstract class LoomCategoryBrowser extends BaseWindow {
  declare protected options: CategoryBrowserOptions;

  static DEFAULT_OPTIONS: Partial<CategoryBrowserOptions> = {};

  protected selectedCategory: string | null = null;
  private _categoryData: Record<string, CategoryGroup> = {};
  private _loading = true;
  private _error: string | null = null;
  private _searchQuery = '';

  constructor(options: CategoryBrowserOptions) {
    super(options);
    this.selectedCategory = options.initialCategory ?? null;
  }

  /** Subclasses implement to return category data (id -> { id, label, entries }). */
  protected async _prepareCategoryData(): Promise<Record<string, any>> {
    throw new Error(`${this.constructor.name} must implement the _prepareCategoryData method.`);
  }

  /** Optional async hook to load remote data before categories render. Shows loading state while pending. */
  protected async _loadCategoryData(): Promise<void> {
    // no-op — subclass overrides when remote data is needed
  }

  /** Called after category data finishes loading. */
  protected _dataLoaded(): void { }

  /** Default sort by label. Override for custom ordering. */
  protected _sortCategories(a: CategoryGroup, b: CategoryGroup): number {
    return a.label.localeCompare(b.label);
  }

  /** Programmatic search: filters visible entries by query text. */
  search(query: string): void {
    this._searchQuery = query;
    this.rerenderBody();
  }

  async mount(): Promise<void> {
    this._loading = true;
    try {
      await this._loadCategoryData();
    } catch (e: any) {
      this._error = e?.message ?? 'Error loading data';
    }
    try {
      this._categoryData = (await this._prepareCategoryData()) as Record<string, CategoryGroup>;
    } catch (e: any) {
      this._error = e?.message ?? 'Error preparing category data';
    }
    this._loading = false;
    super.mount();
  }

  bodyTemplate(): string {
    if (this._loading) {
      return '<div class="empty-state"><p>Carregando...</p></div>';
    }
    if (this._error) {
      return `<div class="empty-state"><p>${this._error}</p></div>`;
    }

    const categories = Object.values(this._categoryData).sort(this._sortCategories.bind(this));

    const items = categories.map(c => {
      const count = c.entries.length;
      return `<div class="category-browser-item${c.id === this.selectedCategory ? ' active' : ''}" data-action="select-category" data-id="${c.id}">
        <span class="category-browser-item-label">${c.label}</span>
        <span class="category-browser-item-count">${count}</span>
      </div>`;
    }).join('');

    const sidebarHtml = items || '<div class="empty-state"><p>Nenhuma categoria</p></div>';

    let mainHtml: string;
    if (!this.selectedCategory) {
      mainHtml = '<div class="empty-state"><p>Selecione uma categoria</p></div>';
    } else {
      const active = this._categoryData[this.selectedCategory];
      if (!active) {
        mainHtml = '<div class="empty-state"><p>Categoria não encontrada</p></div>';
      } else {
        const filtered = this._searchQuery
          ? active.entries.filter(e => this._entryMatchesSearch(e, this._searchQuery))
          : active.entries;
        mainHtml = filtered.length === 0
          ? '<div class="empty-state"><p>Nenhum resultado</p></div>'
          : this._renderCategoryContent(this.selectedCategory, filtered);
      }
    }

    return `<div class="category-browser">
      <div class="category-browser-sidebar">
        <div class="category-browser-list">
          ${sidebarHtml}
        </div>
      </div>
      <div class="category-browser-main">
        ${mainHtml}
      </div>
    </div>`;
  }

  /** Subclasses override to render the main panel HTML for a category's entries. */
  protected abstract _renderCategoryContent(categoryId: string, entries: object[]): string;

  /** Subclasses override for custom search matching on individual entries. */
  protected _entryMatchesSearch(entry: object, query: string): boolean {
    const q = query.toLowerCase();
    return JSON.stringify(entry).toLowerCase().includes(q);
  }

  protected selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
    this.rerenderBody();
  }

  protected onAction(action: string, id: string | null, _target: HTMLElement): void {
    if (action === 'select-category' && id) {
      this.selectCategory(id);
    }
  }

  // Stub compatível — sistemas convertidos chamam `super._onSearchFilter(query)`
  protected _onSearchFilter(query: string): void {
    this.search(query);
  }

  // Stub compatível — sistemas convertidos chamam `super.configureTabs()`
  protected configureTabs(): void {
    // Category browser typically doesn't use tabs, but stub exists for compatibility
    // Subclasses can override if they need tab functionality
  }
}
