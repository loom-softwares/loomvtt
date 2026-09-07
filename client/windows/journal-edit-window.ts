/*******************************************************************************
 * LoomVTT
 * client/windows/journal-edit-window.ts
 * 
 * 
 * Window for editing journal entries.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { mountRichTextEditor, type RichTextEditorHandle } from '../lib/rich-text-registry.js';
import { FilePickerWindow } from './file-picker-window.js';

interface JournalPage {
  id: string;
  name: string;
  content: string;
  sort: number;
  type?: 'text' | 'image' | 'pdf';
  src?: string;
}

interface Journal {
  id: string;
  name: string;
  content: string;
  pages: JournalPage[];
}

export class JournalEditWindow extends BaseWindow {
  private journal: Journal | null = null;
  private loading = true;
  private showHtmlView = false;
  private editorHandle: RichTextEditorHandle | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private props: { journalId: string; pageId: string }) {
    super({
      id: `journal-edit-${props.journalId}-${props.pageId}`,
      title: 'Editar Página de Diário',
      icon: '<i class="fa-solid fa-pen-to-square"></i>',
      width: 600,
      height: 500,
      documentId: props.pageId,
      bannerImage: '/images/general-banners/journal-banner.png'
    });
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-fixed-header');
    }
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
    this.startAutosave();

    // Position next to the parent journal window if no stored position exists
    const stored = localStorage.getItem(`loom-window-rect:${this.options.id}`);
    if (!stored) {
      const parentEl = document.getElementById(`journal-${this.props.journalId}`);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        let left = parentRect.right + 15;
        let top = parentRect.top;

        const winWidth = typeof this.options.width === 'number' ? this.options.width : 600;
        if (left + winWidth > window.innerWidth) {
          left = parentRect.left - winWidth - 15;
        }
        if (left < 0) {
          left = parentRect.left + 30;
          top = parentRect.top + 30;
        }

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
      }
    }
  }

  protected get apiRoute(): string { return '/journals'; }

  private async load(): Promise<void> {
    try {
      this.journal = await api.get<Journal>(`${this.apiRoute}/${this.props.journalId}`);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar diário', 'error');
      windowManager.close(this.options.id);
    } finally {
      this.loading = false;
      this.rerenderBody();
      this.mountEditor();
    }
  }

  private get page(): JournalPage | null {
    if (!this.journal) return null;
    return this.journal.pages?.find(p => p.id === this.props.pageId) ?? null;
  }

  private mountEditor(): void {
    const page = this.page;
    if (!page) return;

    const isText = page.type === 'text' || !page.type;
    if (!isText || this.showHtmlView) {
      if (this.editorHandle) {
        this.editorHandle.destroy();
        this.editorHandle = null;
      }
      return;
    }

    const container = this.element.querySelector<HTMLElement>('.journal-editor');
    if (!container) return;

    if (this.editorHandle) {
      this.editorHandle.destroy();
    }

    this.editorHandle = mountRichTextEditor(container, page.content);
  }

  private saveEditorContent(): void {
    const page = this.page;
    if (!page) return;

    const isText = page.type === 'text' || !page.type;
    if (isText) {
      if (this.showHtmlView) {
        const textarea = this.element.querySelector<HTMLTextAreaElement>('.journal-html-editor');
        if (textarea) {
          page.content = textarea.value;
        }
      } else {
        if (this.editorHandle) {
          page.content = this.editorHandle.getHTML();
        }
      }
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>Carregando dados da página...</p></div>`;
    }
    const page = this.page;
    if (!page) {
      return `<div class="empty-state"><p>Página não encontrada.</p></div>`;
    }

    const isText = page.type === 'text' || !page.type;
    const isImage = page.type === 'image';
    const isPdf = page.type === 'pdf';

    let editorArea = '';
    if (isText) {
      if (this.showHtmlView) {
        editorArea = `<textarea class="journal-html-editor" style="width: 100%; height: 320px; font-family: monospace; background: #0b0a13; color: #a3e635; border: 1px solid var(--color-border); border-radius: 4px; padding: 0.5rem; resize: vertical; box-sizing: border-box;">${page.content || ''}</textarea>`;
      } else {
        editorArea = `<div class="journal-editor" style="min-height: 280px; flex: 1;"></div>`;
      }
    } else if (isImage) {
      editorArea = `
        <div class="journal-image-viewer" style="display: flex; flex-direction: column; gap: 0.5rem; height: 100%;">
          <div style="display: flex; gap: 0.25rem;">
            <input type="text" class="journal-page-src-input" value="${page.src || ''}" placeholder="Caminho da imagem" style="flex: 1; background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: 4px; padding: 0.25rem 0.5rem;" data-binding="page-src" readonly />
            <button class="btn btn-secondary" data-action="pick-page-src" style="padding: 0 0.5rem;">📁 Escolher</button>
          </div>
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: var(--color-bg-deep); border-radius: 4px; border: 1px solid var(--color-border); overflow: hidden; min-height: 240px;">
            ${page.src ? `<img src="${page.src}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '<p style="color: var(--color-text-secondary);">Nenhuma imagem selecionada</p>'}
          </div>
        </div>
      `;
    } else if (isPdf) {
      editorArea = `
        <div class="journal-pdf-viewer" style="display: flex; flex-direction: column; gap: 0.5rem; height: 100%;">
          <div style="display: flex; gap: 0.25rem;">
            <input type="text" class="journal-page-src-input" value="${page.src || ''}" placeholder="Caminho do PDF" style="flex: 1; background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: 4px; padding: 0.25rem 0.5rem;" data-binding="page-src" readonly />
            <button class="btn btn-secondary" data-action="pick-page-src" style="padding: 0 0.5rem;">📁 Escolher</button>
          </div>
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: var(--color-bg-deep); border-radius: 4px; border: 1px solid var(--color-border); overflow: hidden; min-height: 240px; width: 100%;">
            ${page.src ? `<iframe src="${page.src}" style="width: 100%; height: 240px; border: none;"></iframe>` : '<p style="color: var(--color-text-secondary);">Nenhum PDF selecionado</p>'}
          </div>
        </div>
      `;
    }

    return `
      <div class="banner-spacer"></div>
      <div class="scroll-content" style="display: flex; flex-direction: column; gap: 0.75rem; min-height: 100%; box-sizing: border-box;">
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input type="text" class="journal-page-title-input" value="${this.esc(page.name)}" data-binding="page-name" style="flex: 1; background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: 4px; padding: 0.35rem 0.5rem;" />
          
          ${isText ? `
            <button class="btn btn-secondary" data-action="toggle-html-view" style="padding: 0.35rem 0.5rem;">
              ${this.showHtmlView ? '👁️ Editor Visual' : '⌨️ Editar HTML'}
            </button>
          ` : ''}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-height: 0;">
          ${editorArea}
        </div>
      </div>
    `;
  }

  protected onRender(): void {
    const page = this.page;
    if (!page) return;

    const textarea = this.element.querySelector<HTMLTextAreaElement>('.journal-html-editor');
    textarea?.addEventListener('input', () => {
      page.content = textarea.value;
    });

    this.element.querySelector('[data-action="pick-page-src"]')?.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (url: string) => {
          this.saveEditorContent();
          page.src = url;
          this.rerenderBody();
          this.mountEditor();
        }
      });
    });
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'toggle-html-view') {
      this.saveEditorContent();
      this.showHtmlView = !this.showHtmlView;
      this.rerenderBody();
      this.mountEditor();
    } else if (action === 'save') {
      this.save();
    }
  }

  private async save(): Promise<void> {
    if (!this.journal) return;

    this.saveEditorContent();

    const titleInput = this.element.querySelector<HTMLInputElement>('[data-binding="page-name"]');
    const page = this.page;
    if (titleInput && page) {
      page.name = titleInput.value.trim() || page.name;
    }

    try {
      await api.put(`${this.apiRoute}/${this.journal.id}`, {
        name: this.journal.name,
        pages: this.journal.pages,
      });
      showToast('Página salva com sucesso', 'success');
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar página', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  async destroy(): Promise<void> {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this.editorHandle) {
      this.editorHandle.destroy();
    }
    await super.destroy();
  }

  private startAutosave(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    const intervalStr = localStorage.getItem('loom_autosave_interval') || '30000';
    const interval = parseInt(intervalStr, 10);
    if (isNaN(interval) || interval <= 0) return;
    this.autosaveTimer = setInterval(() => {
      if (!this.journal) return;
      this.saveEditorContent();
      const titleInput = this.element.querySelector<HTMLInputElement>('[data-binding="page-name"]');
      const page = this.page;
      if (titleInput && page) {
        page.name = titleInput.value.trim() || page.name;
      }
      api.put(`${this.apiRoute}/${this.journal.id}`, {
        name: this.journal.name,
        pages: this.journal.pages,
      }).catch((e: any) => console.error('Autosave failed:', e));
    }, interval);
  }
}
