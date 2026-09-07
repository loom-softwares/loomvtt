/*******************************************************************************
 * LoomVTT
 * client/windows/roll-table-result-window.ts
 *
 *
 * Janela dedicada de edição de um resultado (entry) de Tabela de Rolagem —
 * separada do RollTableWindow porque um resultado agora carrega campos
 * demais (tipo, documento vinculado, intervalo manual, descrição rich-text)
 * pra caber num dialog pequeno.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { mountRichTextEditor, type RichTextEditorHandle } from '../lib/rich-text-registry.js';
import { FilePickerWindow } from './file-picker-window.js';
import { windowManager } from '../core/window-manager.js';
import { gameContext } from '../core/game-context.js';

export interface RollTableResultEntry {
  id: string;
  text: string;
  imgUrl: string;
  weight: number;
  drawn: string;
  type: string;
  documentCollection: string;
  documentId: string;
  description: string;
  rangeMin: number;
  rangeMax: number;
}

const DOCUMENT_COLLECTIONS: Record<string, string> = {
  actors: 'Atores',
  items: 'Itens',
  stages: 'Cenas',
  journals: 'Diários',
};

interface DocumentOption {
  id: string;
  name: string;
}

export class RollTableResultWindow extends BaseWindow {
  protected closeOnSave = false;
  private editorHandle: RichTextEditorHandle | null = null;

  constructor(private props: { tableId: string; entry: RollTableResultEntry; onSaved?: () => void }) {
    super({
      id: `roll-table-result-${props.entry.id}`,
      title: `Resultado da Tabela: ${props.entry.id}`,
      icon: '<i class="fa-solid fa-dice-d20"></i>',
      width: 420,
      height: 'auto',
      showFooter: false,
    } as BaseWindowOptions);
  }

  protected _postRender(): void {
    super._postRender();
    this.element.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('[name="type"]')) this.onTypeChange();
      else if (target.matches('[name="documentCollection"]')) void this.loadDocumentOptions();
    });
    this.mountEditor();
    void this.loadDocumentOptions();
  }

  async destroy(): Promise<void> {
    if (this.editorHandle) {
      this.editorHandle.destroy();
      this.editorHandle = null;
    }
    await super.destroy();
  }

  private mountEditor(): void {
    const container = this.element.querySelector<HTMLElement>('.roll-table-result-description-editor');
    if (!container) return;
    this.editorHandle = mountRichTextEditor(container, this.props.entry.description || '');
  }

  private onTypeChange(): void {
    const type = this.element.querySelector<HTMLSelectElement>('[name="type"]')?.value;
    const block = this.element.querySelector<HTMLElement>('.roll-table-result-document-fields');
    if (block) block.style.display = type === 'document' ? '' : 'none';
    if (type === 'document') void this.loadDocumentOptions();
  }

  /** Popula o <select> de documento a partir da coleção escolhida. Chamado
   * na montagem e sempre que a coleção muda — sem isso o select fica vazio. */
  private async loadDocumentOptions(): Promise<void> {
    const type = this.element.querySelector<HTMLSelectElement>('[name="type"]')?.value;
    if (type !== 'document') return;
    const collectionSelect = this.element.querySelector<HTMLSelectElement>('[name="documentCollection"]');
    const documentSelect = this.element.querySelector<HTMLSelectElement>('[name="documentId"]');
    if (!collectionSelect || !documentSelect) return;
    const collection = collectionSelect.value;
    const currentId = documentSelect.value || this.props.entry.documentId;
    documentSelect.innerHTML = `<option value="">Carregando...</option>`;
    try {
      const worldId = gameContext.worldId || '';
      const docs = await api.get<DocumentOption[]>(`/${collection}?worldId=${encodeURIComponent(worldId)}`);
      documentSelect.innerHTML = docs.length === 0
        ? `<option value="">Nenhum documento encontrado</option>`
        : docs.map((d) => `<option value="${this.esc(d.id)}" ${d.id === currentId ? 'selected' : ''}>${this.esc(d.name)}</option>`).join('');
    } catch (e: any) {
      documentSelect.innerHTML = `<option value="">Erro ao carregar</option>`;
      showToast(e?.message || 'Erro ao carregar documentos', 'error');
    }
  }

  private pickEntryImage(): void {
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: (path: string) => {
        const input = this.element.querySelector<HTMLInputElement>('[name="imgUrl"]');
        if (input) input.value = path;
      },
    });
  }

  protected onAction(action: string): void {
    if (action === 'pick-entry-image') this.pickEntryImage();
    else if (action === 'save-result') void this.save();
  }

  bodyTemplate(): string {
    const e = this.props.entry;
    const isDocument = e.type === 'document';
    return `
      <div class="form-group">
        <label>Nome do Resultado</label>
        <input type="text" name="text" value="${this.esc(e.text)}" />
      </div>
      <div class="form-group">
        <label>Tipo do Resultado</label>
        <select name="type">
          <option value="text" ${!isDocument ? 'selected' : ''}>Texto</option>
          <option value="document" ${isDocument ? 'selected' : ''}>Documento</option>
        </select>
      </div>
      <div class="roll-table-result-document-fields" style="${isDocument ? '' : 'display:none;'}">
        <div class="form-group">
          <label>Coleção</label>
          <select name="documentCollection">
            ${Object.entries(DOCUMENT_COLLECTIONS).map(([value, label]) =>
              `<option value="${value}" ${e.documentCollection === value ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Documento</label>
          <select name="documentId"><option value="">Carregando...</option></select>
        </div>
      </div>
      <div class="form-group">
        <label>Ícone do Resultado</label>
        <div style="display:flex; gap:0.5rem;">
          <input type="text" name="imgUrl" value="${this.esc(e.imgUrl)}" placeholder="caminho/da/imagem.png" style="flex:1;" />
          <button type="button" class="btn btn-secondary btn-sm" data-action="pick-entry-image" title="Escolher imagem"><i class="fa-solid fa-image"></i></button>
        </div>
      </div>
      <div class="form-group" style="display:flex; gap:0.75rem;">
        <div style="flex:1;">
          <label>Peso</label>
          <input type="number" name="weight" value="${e.weight}" min="0" />
        </div>
        <div style="flex:1;">
          <label>Intervalo</label>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <input type="number" name="rangeMin" value="${e.rangeMin}" min="0" style="width:100%;" />
            <span>–</span>
            <input type="number" name="rangeMax" value="${e.rangeMax}" min="0" style="width:100%;" />
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <div class="roll-table-result-description-editor" style="min-height:100px;"></div>
      </div>
      <div class="roll-table-actions">
        <button class="btn btn-primary" data-action="save-result"><i class="fa-solid fa-floppy-disk"></i> Atualizar Resultado da Tabela</button>
      </div>
    `;
  }

  private async save(): Promise<void> {
    const text = this.element.querySelector<HTMLInputElement>('[name="text"]')?.value || '';
    const type = this.element.querySelector<HTMLSelectElement>('[name="type"]')?.value || 'text';
    const documentCollection = this.element.querySelector<HTMLSelectElement>('[name="documentCollection"]')?.value || '';
    const documentId = this.element.querySelector<HTMLSelectElement>('[name="documentId"]')?.value || '';
    const imgUrl = this.element.querySelector<HTMLInputElement>('[name="imgUrl"]')?.value || '';
    const weight = Number(this.element.querySelector<HTMLInputElement>('[name="weight"]')?.value) || 0;
    const rangeMin = Number(this.element.querySelector<HTMLInputElement>('[name="rangeMin"]')?.value) || 0;
    const rangeMax = Number(this.element.querySelector<HTMLInputElement>('[name="rangeMax"]')?.value) || 0;
    const description = this.editorHandle ? this.editorHandle.getHTML() : this.props.entry.description;

    try {
      await api.put(`/roll-tables/entries/${this.props.entry.id}`, {
        text, type, documentCollection: type === 'document' ? documentCollection : '',
        documentId: type === 'document' ? documentId : '', imgUrl, weight, rangeMin, rangeMax, description,
      });
      showToast('Resultado atualizado', 'success');
      this.props.onSaved?.();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao atualizar resultado', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
