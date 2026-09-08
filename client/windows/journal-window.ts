/*******************************************************************************
 * LoomVTT
 * client/windows/journal-window.ts
 * 
 * 
 * Window for viewing journal entries.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { showConfirm, showCreatePageDialog, showPrompt } from '../components/dialog.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { JournalEditWindow } from './journal-edit-window.js';
import { wsClient } from '../core/ws-client.js';
import { sheetCatalog } from '../core/sheet-catalog.js';
import { ActorSheetWindow } from './actor-sheet-window.js';
import { ItemSheetWindow } from './item-sheet-window.js';
import { dispatchRoll } from '../screens/game-hud/roll-dispatch.js';

interface JournalPage {
  id: string;
  name: string;
  content: string;
  sort: number;
  type?: 'text' | 'image' | 'pdf';
  src?: string;
  categoryId?: string;
}

interface JournalCategory {
  id: string;
  name: string;
  sort: number;
}

interface Journal {
  id: string;
  name: string;
  content: string;
  pages: JournalPage[];
  categories: JournalCategory[];
}

export class JournalWindow extends BaseWindow {
  protected override popoutEnabled = true;
  private journal: Journal | null = null;
  private loading = true;
  private activePageId: string | null = null;
  private _richTextClickBound: ((e: Event) => void) | null = null;

  constructor(private props: { journalId: string; pageId?: string }) {
    super({
      id: `journal-${props.journalId}`,
      title: 'Diário',
      icon: '<i class="fa-solid fa-book-open"></i>',
      width: 720,
      height: 'auto',
      documentId: props.journalId,
      bannerImage: '/images/general-banners/journal-banner.png'
    });
    if (props.pageId) {
      this.activePageId = props.pageId;
    }
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-fixed-header');
    }
  }

  private unsubscribe: (() => void) | null = null;

  async mount(): Promise<void> {
    super.mount();
    await this.load();

    this.unsubscribe = wsClient.on('journal.updated', (doc: Journal) => {
      if (this.journal && doc.id === this.journal.id) {
        this.journal = doc;
        this.rerenderBody();
      }
    });
  }

  async destroy(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    await super.destroy();
  }

  protected _apiRouteOverride: string | undefined;
  protected get apiRoute(): string { return this._apiRouteOverride ?? '/journals'; }

  private async load(): Promise<void> {
    try {
      this.journal = await api.get<Journal>(`${this.apiRoute}/${this.props.journalId}`);
      if (this.journal.pages && this.journal.pages.length > 0) {
        if (!this.activePageId || !this.journal.pages.some(p => p.id === this.activePageId)) {
          this.activePageId = this.journal.pages[0].id;
        }
      } else {
        this.activePageId = null;
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar diário', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  private get activePage(): JournalPage | null {
    if (!this.journal || !this.activePageId) return null;
    return this.journal.pages?.find(p => p.id === this.activePageId) ?? null;
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>Carregando diário...</p></div>`;
    }
    if (!this.journal) {
      return `<div class="empty-state"><p>Diário não encontrado.</p></div>`;
    }

    const pages = this.journal.pages || [];
    const categories = [...(this.journal.categories || [])].sort((a, b) => a.sort - b.sort);
    const categoryIds = new Set(categories.map(c => c.id));

    const pageItemHtml = (p: JournalPage) => `
      <div class="journal-page-item${p.id === this.activePageId ? ' active' : ''}"
           data-action="select-page" data-id="${p.id}">
        <span class="journal-page-name" title="${this.esc(p.name)}">${this.esc(p.name)}</span>
        <select class="journal-page-category-select" data-id="${p.id}" title="Mover para categoria" onclick="event.stopPropagation()">
          <option value="">Sem categoria</option>
          ${categories.map(c => `<option value="${c.id}"${p.categoryId === c.id ? ' selected' : ''}>${this.esc(c.name)}</option>`).join('')}
        </select>
        <button class="journal-page-delete" data-action="delete-page" data-id="${p.id}" title="Remover página" onclick="event.stopPropagation()">✕</button>
      </div>
    `;

    const groupedHtml = categories.map(c => `
      <div class="journal-category-group">
        <div class="journal-category-header">
          <span class="journal-category-name" title="${this.esc(c.name)}">${this.esc(c.name)}</span>
          <div class="journal-category-actions">
            <button class="journal-category-btn" data-action="rename-category" data-id="${c.id}" title="Renomear categoria">✏️</button>
            <button class="journal-category-btn" data-action="delete-category" data-id="${c.id}" title="Remover categoria">✕</button>
          </div>
        </div>
        <div class="journal-category-pages">
          ${pages.filter(p => p.categoryId === c.id).map(pageItemHtml).join('')}
        </div>
      </div>
    `).join('');

    const uncategorized = pages.filter(p => !p.categoryId || !categoryIds.has(p.categoryId));
    const pageListHtml = `
      ${groupedHtml}
      ${categories.length > 0 && uncategorized.length > 0 ? `
        <div class="journal-category-group">
          <div class="journal-category-header journal-category-header--uncategorized">
            <span class="journal-category-name">Sem categoria</span>
          </div>
          <div class="journal-category-pages">
            ${uncategorized.map(pageItemHtml).join('')}
          </div>
        </div>
      ` : uncategorized.map(pageItemHtml).join('')}
    `;

    const currentPage = this.activePage;
    let currentContentHtml = '';

    if (currentPage) {
      const isText = currentPage.type === 'text' || !currentPage.type;
      const isImage = currentPage.type === 'image';
      const isPdf = currentPage.type === 'pdf';

      let viewerArea = '';
      if (isText) {
        viewerArea = `<div class="journal-page-content-view">${currentPage.content || '<p class="text-secondary italic">Nenhum conteúdo.</p>'}</div>`;
      } else if (isImage) {
        viewerArea = `
          <div class="journal-image-viewer">
            ${currentPage.src ? `<img src="${currentPage.src}" class="journal-image" />` : '<p class="text-secondary">Nenhuma imagem selecionada</p>'}
          </div>
        `;
      } else if (isPdf) {
        viewerArea = `
          <div class="journal-pdf-viewer">
            ${currentPage.src ? `<iframe src="${currentPage.src}" class="journal-pdf-frame"></iframe>` : '<p class="text-secondary">Nenhum PDF selecionado</p>'}
          </div>
        `;
      }

      currentContentHtml = `
        <div class="journal-page-header">
          <h2 class="journal-page-title">${this.esc(currentPage.name)}</h2>
          <button class="journal-header-btn" data-action="edit-page-mode" title="Editar Página">
            <i class="fa-solid fa-pen"></i> Editar
          </button>
        </div>
        ${viewerArea}
      `;
    } else {
      currentContentHtml = `<div class="empty-state"><p>Nenhuma página.</p></div>`;
    }

    return `
      <div class="banner-spacer"></div>
      <div class="scroll-content">
        <div class="journal-layout">
          <div class="journal-sidebar">
            <div class="journal-sidebar-header">
              <input type="text" name="name" value="${this.esc(this.journal.name)}" class="journal-title-input" />
            </div>
            <div class="journal-sidebar-actions">
              <button class="journal-sidebar-btn" data-action="add-page"><i class="fa-solid fa-file-circle-plus"></i> Nova Página</button>
              <button class="journal-sidebar-btn" data-action="add-category"><i class="fa-solid fa-folder-plus"></i> Nova Categoria</button>
            </div>
            <div class="journal-page-list">
              ${pageListHtml}
            </div>
          </div>
          <div class="journal-content-area">
            ${currentContentHtml}
          </div>
        </div>
      </div>
    `;
  }

  protected onRender(): void {
    // Auto-save journal name on change
    const journalTitleInput = this.element.querySelector<HTMLInputElement>('.journal-title-input');
    journalTitleInput?.addEventListener('change', async () => {
      if (this.journal) {
        this.journal.name = journalTitleInput.value.trim() || this.journal.name;
        try {
          await api.put(`${this.apiRoute}/${this.journal.id}`, {
            name: this.journal.name,
            pages: this.journal.pages,
          });
          showToast('Nome do diário atualizado', 'success');
        } catch (e: any) {
          console.error(e);
        }
      }
    });

    // Click delegation for rich text content links and inline rolls.
    if (!this._richTextClickBound) {
      this._richTextClickBound = this._handleRichTextClick.bind(this);
      this.element.addEventListener('click', this._richTextClickBound);
    }

    this.element.querySelectorAll<HTMLSelectElement>('.journal-page-category-select').forEach(select => {
      select.addEventListener('click', (e) => e.stopPropagation());
      select.addEventListener('change', () => this.movePageToCategory(select.dataset.id!, select.value));
    });
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'select-page' && id) {
      this.activePageId = id;
      this.rerenderBody();
    } else if (action === 'add-page') {
      this.addPage();
    } else if (action === 'delete-page' && id) {
      this.deletePage(id);
    } else if (action === 'add-category') {
      this.addCategory();
    } else if (action === 'rename-category' && id) {
      this.renameCategory(id);
    } else if (action === 'delete-category' && id) {
      this.deleteCategory(id);
    } else if (action === 'edit-page-mode') {
      const page = this.activePage;
      if (page && this.journal) {
        this.renderChild(JournalEditWindow, `journal-edit-${this.journal.id}-${page.id}`, {
          journalId: this.journal.id,
          pageId: page.id
        });
      }
    }
  }

  protected rerenderBody(): void {
    super.rerenderBody();
    const footer = this.element.querySelector<HTMLElement>('.loom-window-footer');
    if (footer) {
      footer.style.display = 'none';
    }
  }

  private async addPage(): Promise<void> {
    const result = await showCreatePageDialog();
    if (!result) return;

    try {
      const newPage = await api.post<JournalPage>(`${this.apiRoute}/${this.journal!.id}/pages`, {
        name: result.name,
        type: result.type,
      });
      if (!this.journal!.pages.some(p => p.id === newPage.id)) this.journal!.pages.push(newPage);
      this.activePageId = newPage.id;
      this.rerenderBody();
      showToast('Página criada', 'success');

      // Auto open edit window for the newly created page
      this.renderChild(JournalEditWindow, `journal-edit-${this.journal!.id}-${newPage.id}`, {
        journalId: this.journal!.id,
        pageId: newPage.id
      });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar página', 'error');
    }
  }

  private async deletePage(pageId: string): Promise<void> {
    if (!this.journal) return;
    const page = this.journal.pages.find(p => p.id === pageId);
    if (!page) return;
    const confirmed = await showConfirm('Excluir Página', `Deseja remover a página "${page.name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`${this.apiRoute}/${this.journal.id}/pages/${pageId}`);
      this.journal.pages = this.journal.pages.filter(p => p.id !== pageId);

      if (this.activePageId === pageId) {
        this.activePageId = this.journal.pages.length > 0 ? this.journal.pages[0].id : null;
      }
      this.rerenderBody();
      showToast('Página removida', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover página', 'error');
    }
  }

  private async addCategory(): Promise<void> {
    if (!this.journal) return;
    const existingNames = (this.journal.categories || []).map(c => c.name);
    const name = nextDefaultName('Nova Categoria', existingNames);

    try {
      const newCategory = await api.post<JournalCategory>(`${this.apiRoute}/${this.journal.id}/categories`, { name });
      // Guard: WebSocket 'journal.updated' echo may arrive before or after this optimistic push.
      if (!this.journal.categories.some(c => c.id === newCategory.id)) {
        this.journal.categories = [...(this.journal.categories || []), newCategory];
      }
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar categoria', 'error');
    }
  }

  private async renameCategory(categoryId: string): Promise<void> {
    if (!this.journal) return;
    const category = this.journal.categories?.find(c => c.id === categoryId);
    if (!category) return;
    const name = await showPrompt('Renomear Categoria', 'Nome da categoria', category.name);
    if (!name || !name.trim()) return;

    try {
      await api.put(`${this.apiRoute}/${this.journal.id}/categories/${categoryId}`, { name: name.trim() });
      category.name = name.trim();
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao renomear categoria', 'error');
    }
  }

  private async deleteCategory(categoryId: string): Promise<void> {
    if (!this.journal) return;
    const category = this.journal.categories?.find(c => c.id === categoryId);
    if (!category) return;
    const confirmed = await showConfirm('Excluir Categoria', `Deseja remover a categoria "${category.name}"? As páginas voltam para "Sem categoria".`);
    if (!confirmed) return;

    try {
      await api.delete(`${this.apiRoute}/${this.journal.id}/categories/${categoryId}`);
      this.journal.categories = (this.journal.categories || []).filter(c => c.id !== categoryId);
      for (const page of this.journal.pages || []) {
        if (page.categoryId === categoryId) page.categoryId = undefined;
      }
      this.rerenderBody();
      showToast('Categoria removida', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover categoria', 'error');
    }
  }

  private async movePageToCategory(pageId: string, categoryId: string): Promise<void> {
    if (!this.journal) return;
    const page = this.journal.pages?.find(p => p.id === pageId);
    if (!page) return;
    page.categoryId = categoryId || undefined;

    try {
      await api.put(`${this.apiRoute}/${this.journal.id}/pages/${pageId}`, { categoryId });
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao mover página', 'error');
    }
  }

  private _handleRichTextClick(e: Event): void {
    const docLink = (e.target as HTMLElement).closest<HTMLElement>('a.doc-link');
    if (docLink) {
      e.preventDefault();
      // Stops the click from bubbling to the new document-level delegated
      // listener (client/core/text-enricher.ts) added for doc-link/inline-roll
      // clicks OUTSIDE the journal window — without this, a click here would
      // fire twice: this handler, then the global one re-opening the same
      // sheet / re-dispatching the same roll.
      e.stopPropagation();
      const docType = docLink.dataset.docType;
      const docId = docLink.dataset.docId;
      if (docType && docId) {
        const SheetClass = sheetCatalog.get(docType, '*') ||
          (docType === 'actor' ? ActorSheetWindow : ItemSheetWindow);
        windowManager.open(`${docType}-sheet-${docId}`, SheetClass as any, { [`${docType}Id`]: docId });
      }
      return;
    }

    const inlineRoll = (e.target as HTMLElement).closest<HTMLElement>('span.inline-roll');
    if (inlineRoll) {
      e.stopPropagation();
      const formula = inlineRoll.dataset.formula;
      if (formula) {
        const session = wsClient.session;
        dispatchRoll({
          worldId: session?.worldId || '',
          userId: session?.userId || '',
          userName: session?.userName || 'Anonymous',
          userColor: session?.userColor || '#888',
          formula,
        });
      }
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
