/*******************************************************************************
 * LoomVTT
 * client/windows/roll-table-window.ts
 * 
 * 
 * Window for editing and rolling tables.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { wsClient } from '../core/ws-client.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/dialog.js';
import { mountRichTextEditor, type RichTextEditorHandle } from '../lib/rich-text-registry.js';
import { FilePickerWindow } from './file-picker-window.js';
import { windowManager } from '../core/window-manager.js';
import { RollTableResultWindow, type RollTableResultEntry } from './roll-table-result-window.js';

type RollTableEntry = RollTableResultEntry;

interface RollTableData {
  id: string;
  name: string;
  description: string;
  formula: string;
  replacement: number;
  displayRollFormula: number;
  imgUrl: string;
  entries: RollTableEntry[];
}

/**
 * Roll Table Editor — LoomVTT specific visual: lines with weight, draw with/without replacement,
 * result always goes to chat (the POST /:id/roll posts there, server-side).
 */
export class RollTableWindow extends BaseWindow {
  private table: RollTableData | null = null;
  private loading = true;
  private editorHandle: RichTextEditorHandle | null = null;

  constructor(private props: { tableId: string; worldId: string }) {
    super({
      id: `roll-table-${props.tableId}`,
      title: 'Tabela de Rolagem',
      icon: '<i class="fa-solid fa-dice"></i>',
      width: 460,
      height: 'auto',
      // Fixed banner, like every config window (stage-config uses
      // map-banner.png) — doesn't depend on the table, never changes.
      bannerImage: '/images/general-banners/dice-banner.png',
      // Standard footer (Cancel/Save) only makes sense for those who can save —
      // jogador so consulta/sorteia, nao edita.
      showFooter: (wsClient.session?.userRole ?? 1) >= 4,
    } as BaseWindowOptions);
  }

  private get isGM(): boolean {
    return (wsClient.session?.userRole ?? 1) >= 4;
  }

  protected _postRender(): void {
    super._postRender();
    // Without this the .tabs CSS assumes window WITH banner (sticky + top:36px) and
    // overlaps the content — window-tabs-fixed switches to the normal flex layout
    // (ver stage-config-window.ts, mesma classe).
    this.element?.classList.add('window-tabs-fixed');
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
  }

  async destroy(): Promise<void> {
    if (this.editorHandle) {
      this.editorHandle.destroy();
      this.editorHandle = null;
    }
    await super.destroy();
  }

  private async load(): Promise<void> {
    try {
      this.table = await api.get<RollTableData>(`/roll-tables/${this.props.tableId}`);
    } catch {
      showToast('Erro ao carregar tabela', 'error');
    }
    this.loading = false;
    this.rerenderBody();
    this.mountEditor();
  }

  /** ProseMirror description editor — both tabs stay in the DOM at the same
   * time (swap is just .active class, like stage-config-window.ts), so
   * the container exists even with the Results tab visible. Mounts 1x per
   * render; never inside bodyTemplate() (which only returns string). */
  private mountEditor(): void {
    if (this.editorHandle) {
      this.editorHandle.destroy();
      this.editorHandle = null;
    }
    if (!this.table) return;
    const container = this.element.querySelector<HTMLElement>('.roll-table-description-editor');
    if (!container) return;
    this.editorHandle = mountRichTextEditor(container, this.table.description || '');
  }

  bodyTemplate(): string {
    if (this.loading) return `<div class="empty-state"><p>Carregando...</p></div>`;
    if (!this.table) return `<div class="empty-state"><p>Tabela não encontrada.</p></div>`;

    const t = this.table;
    return `
      <div style="min-height: 170px; padding: 2.5rem 1.5rem 1.5rem 1.5rem; display: flex; align-items: flex-end; gap: 1.5rem; position: relative; z-index: 2;">
        
        <!-- Portrait/Avatar -->
        <div class="roll-table-portrait" ${this.isGM ? 'data-action="pick-portrait"' : ''} style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid color-mix(in srgb, var(--color-bg-surface) 60%, transparent); box-shadow: 0 8px 24px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.15); flex-shrink: 0; position: relative; background: color-mix(in srgb, var(--color-bg-deep) 90%, transparent); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: var(--color-text-muted); transition: transform 0.2s, box-shadow 0.2s; cursor: ${this.isGM ? 'pointer' : 'default'};" ${this.isGM ? 'onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 12px 32px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,255,255,0.2)\'" onmouseout="this.style.transform=\'\'; this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.15)\'"' : ''}>
          ${t.imgUrl ? `<img src="${this.esc(t.imgUrl)}" style="width: 100%; height: 100%; object-fit: cover;" alt="${this.esc(t.name)}" />` : '<i class="fa-solid fa-dice-d20"></i>'}
        </div>
        
        <!-- Title & Subtitle Overlay -->
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 0.25rem;">
          <input type="text" name="name" value="${this.esc(t.name)}" ${this.isGM ? '' : 'readonly'} style="background: transparent; border: none; color: #ffffff; font-family: var(--font-header), 'Cinzel', serif; font-size: 2.25rem; font-weight: 800; padding: 0; margin: 0; outline: none; text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5); letter-spacing: -0.02em; width: 100%; transition: text-shadow 0.2s;" onfocus="this.style.textShadow='0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.8), 0 0 16px rgba(255,255,255,0.3)'" onblur="this.style.textShadow='0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)'" placeholder="Nome da Tabela" />
          <div style="font-family: var(--font-ui); font-size: 0.75rem; color: color-mix(in srgb, white 75%, transparent); text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.2rem; text-shadow: 0 1px 4px rgba(0,0,0,0.8); font-weight: 600;">
            <i class="fa-solid fa-table-list" style="margin-right: 0.4rem; opacity: 0.8;"></i> Tabela de Rolagem
          </div>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-button active" data-action="tab-results" data-tab="results"><i class="fa-solid fa-list"></i> Resultados</button>
        <button class="tab-button" data-action="tab-summary" data-tab="summary"><i class="fa-solid fa-file-lines"></i> Resumo</button>
      </div>
      <div class="tab-content active" data-tab="results">
        ${this.resultsTabTemplate()}
      </div>
      <div class="tab-content" data-tab="summary">
        ${this.summaryTabTemplate()}
      </div>
    `;
  }

  private resultsTabTemplate(): string {
    const t = this.table!;
    const totalWeight = t.entries.reduce((sum, e) => sum + e.weight, 0);
    return `
      <div class="roll-table-grid">
        <div class="roll-table-grid-header">
          <div class="roll-table-grid-col roll-table-col-image"></div>
            <div class="roll-table-grid-col roll-table-col-text">
              ${this.isGM ? `<button style="background:transparent; border:none; padding:0; margin-right:0.4rem; color:var(--color-text-secondary); cursor:pointer; font-size:0.9rem;" data-action="add-entry" title="Adicionar Resultado" onmouseover="this.style.color='var(--color-text-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'"><i class="fa-solid fa-plus"></i></button>` : ''}
              Resultado
            </div>
          <div class="roll-table-grid-col roll-table-col-range">Range</div>
          <div class="roll-table-grid-col roll-table-col-weight">Peso</div>
          ${this.isGM ? `<div class="roll-table-grid-col roll-table-col-actions" style="display:flex; justify-content:center; align-items:center;">
              <button style="background:transparent; border:none; padding:0; margin:0; color:var(--color-text-secondary); cursor:pointer; font-size:1.1rem;" data-action="normalize-results" title="Normalizar Intervalos de Resultados" onmouseover="this.style.color='var(--color-text-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'"><i class="fa-solid fa-scale-balanced"></i></button>
            </div>` : ''}
        </div>
        <div class="roll-table-grid-body">
          ${t.entries.length === 0
        ? `<div class="empty-state"><p>Nenhum item cadastrado.</p></div>`
        : this.entriesRowsTemplate(t.entries, totalWeight, t.replacement === 0)}
        </div>
      </div>

      <div class="roll-table-actions">
        ${this.isGM && t.replacement === 0 ? `<button class="btn btn-secondary" data-action="reset-results"><i class="fa-solid fa-arrow-rotate-left"></i> Resetar Resultados</button>` : ''}
        <button class="btn btn-primary roll-table-roll-btn" data-action="roll-table" ${t.entries.length === 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-dice"></i> Sortear Resultado
        </button>
      </div>
    `;
  }

  /** Range de cada entrada agora é persistido (rangeMin/rangeMax) e editável
   * na RollTableResultWindow — "Normalizar Intervalos" recalcula em sequência
   * a partir do peso quando o GM quer voltar ao layout automático. */
  private entriesRowsTemplate(entries: RollTableEntry[], totalWeight: number, withoutReplacement: boolean): string {
    return entries.map((e, index) => {
      const isDrawn = withoutReplacement && e.drawn === 'true';
      const rowClasses = ['roll-table-grid-row', index % 2 === 0 ? 'is-even' : '', isDrawn ? 'is-drawn' : ''].filter(Boolean).join(' ');
      const rangeLabel = e.rangeMax > 0
        ? (e.rangeMax > e.rangeMin ? `${e.rangeMin}-${e.rangeMax}` : `${e.rangeMin}`)
        : '—';
      return `
        <div class="${rowClasses}" data-id="${this.esc(e.id)}" ${this.isGM ? 'data-action="edit-entry"' : ''}>
          <div class="roll-table-grid-cell roll-table-col-image">
            ${e.imgUrl
          ? `<img src="${this.esc(e.imgUrl)}" class="roll-table-entry-icon" alt="" />`
          : `<span class="roll-table-entry-icon roll-table-entry-icon-default"><i class="fa-solid fa-dice-d20"></i></span>`}
          </div>
          <div class="roll-table-grid-cell roll-table-col-text">
            ${isDrawn ? '<i class="fa-solid fa-check roll-table-drawn-badge" title="Já sorteado"></i>' : ''}${this.esc(e.text)}
            ${e.type === 'document' ? '<i class="fa-solid fa-link" style="margin-left:0.35rem; opacity:0.6;" title="Vinculado a um documento"></i>' : ''}
          </div>
          <div class="roll-table-grid-cell roll-table-col-range">${rangeLabel}</div>
          <div class="roll-table-grid-cell roll-table-col-weight">
            <span class="roll-table-entry-weight" title="Peso: ${e.weight}">${e.weight} <small>/ ${totalWeight}</small></span>
          </div>
          ${this.isGM ? `<div class="roll-table-grid-cell roll-table-col-actions" style="display:flex; justify-content:center; align-items:center;">
              <button data-action="remove-entry" data-id="${this.esc(e.id)}" title="Remover" style="background:transparent; border:none; padding:0; margin:0; cursor:pointer; color:var(--color-text-muted); font-size:0.85rem; opacity:0.5; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-danger)'" onmouseout="this.style.opacity='0.5'; this.style.color='var(--color-text-muted)'"><i class="fa-solid fa-trash"></i></button>
            </div>` : ''}
        </div>
      `;
    }).join('');
  }

  private summaryTabTemplate(): string {
    const t = this.table!;
    return `
      <div class="form-group">
        <label>Descrição da Tabela</label>
        <div class="roll-table-description-editor" style="min-height:120px; ${this.isGM ? '' : 'pointer-events:none; opacity:0.85;'}"></div>
      </div>
      <div class="form-group">
        <label>Fórmula</label>
        <input type="text" name="formula" value="${this.esc(t.formula)}" placeholder="1d20" ${this.isGM ? '' : 'disabled'} />
      </div>
      <div class="form-group" style="display:flex; flex-direction:column; gap:0.5rem;">
        <label style="display:flex; align-items:center; gap:0.35rem;">
          <input type="checkbox" name="replacement" ${t.replacement ? 'checked' : ''} ${this.isGM ? '' : 'disabled'} />
          Sortear com reposição
        </label>
        <label style="display:flex; align-items:center; gap:0.35rem;">
          <input type="checkbox" name="displayRollFormula" ${t.displayRollFormula ? 'checked' : ''} ${this.isGM ? '' : 'disabled'} />
          Exibir fórmula no chat
        </label>
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action.startsWith('tab-')) {
      const body = this.element.querySelector('.loom-window-body')!;
      const tabName = action.replace('tab-', '');
      body.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
      body.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
      target.classList.add('active');
      body.querySelector(`.tab-content[data-tab="${tabName}"]`)?.classList.add('active');
    }
    else if (action === 'save') void this.saveTable();
    else if (action === 'add-entry') void this.addEntry();
    else if (action === 'edit-entry' && id) void this.editEntry(id);
    else if (action === 'remove-entry' && id) void this.removeEntry(id);
    else if (action === 'roll-table') void this.rollTable();
    else if (action === 'reset-results') void this.resetResults();
    else if (action === 'normalize-results') void this.normalizeResults();
    else if (action === 'pick-portrait') this.pickPortrait();
  }

  private pickPortrait(): void {
    if (!this.table) return;
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: async (path: string) => {
        if (!this.table) return;
        this.table.imgUrl = path;
        this.rerenderBody();
        this.mountEditor();
        try {
          await api.put(`/roll-tables/${this.props.tableId}`, { imgUrl: path });
        } catch (e: any) {
          showToast(e?.message || 'Erro ao trocar imagem', 'error');
        }
      },
    });
  }

  private async saveTable(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body');
    if (!body) return;
    // Summary fields — if the user saves without ever opening this tab,
    // keep what was already there (no input to read in the DOM yet).
    const nameInput = body.querySelector<HTMLInputElement>('[name="name"]');
    const formulaInput = body.querySelector<HTMLInputElement>('[name="formula"]');
    const replacementInput = body.querySelector<HTMLInputElement>('[name="replacement"]');
    const displayRollFormulaInput = body.querySelector<HTMLInputElement>('[name="displayRollFormula"]');
    const name = nameInput ? nameInput.value.trim() : this.table?.name;
    const formula = formulaInput ? formulaInput.value : this.table?.formula;
    const replacement = replacementInput ? (replacementInput.checked ? 1 : 0) : this.table?.replacement;
    const displayRollFormula = displayRollFormulaInput ? (displayRollFormulaInput.checked ? 1 : 0) : this.table?.displayRollFormula;
    const description = this.editorHandle ? this.editorHandle.getHTML() : this.table?.description;
    if (!name) { showToast('Nome é obrigatório', 'error'); return; }
    try {
      await api.put(`/roll-tables/${this.props.tableId}`, { name, description, formula, replacement, displayRollFormula });
      showToast('Tabela salva', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar tabela', 'error');
    }
  }

  /** "Adicionar" cria a entrada em branco na hora (igual : a linha já
   * aparece na tabela) e abre a janela dedicada de edição em seguida. */
  private async addEntry(): Promise<void> {
    try {
      const created = await api.post<RollTableEntry>(`/roll-tables/${this.props.tableId}/entries`, {
        text: 'Novo Resultado', weight: 1,
      });
      await this.load();
      this.openResultWindow(created);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao adicionar item', 'error');
    }
  }

  private editEntry(entryId: string): void {
    const entry = this.table?.entries.find((e) => e.id === entryId);
    if (!entry) return;
    this.openResultWindow(entry);
  }

  private openResultWindow(entry: RollTableEntry): void {
    windowManager.open(`roll-table-result-${entry.id}`, RollTableResultWindow, {
      tableId: this.props.tableId,
      entry,
      onSaved: () => void this.load(),
    });
  }

  private async removeEntry(entryId: string): Promise<void> {
    const confirmed = await showConfirm('Remover Item', 'Remover este item da tabela?');
    if (!confirmed) return;
    try {
      await api.delete(`/roll-tables/entries/${entryId}`);
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover item', 'error');
    }
  }

  private async rollTable(): Promise<void> {
    try {
      const result = await api.post<{ label: string }>(`/roll-tables/${this.props.tableId}/roll`, {});
      showToast(`Resultado: ${result.label}`, 'success');
      if (this.table && this.table.replacement === 0) await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao sortear', 'error');
    }
  }

  private async resetResults(): Promise<void> {
    try {
      await api.post(`/roll-tables/${this.props.tableId}/reset-results`, {});
      showToast('Resultados resetados', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao resetar resultados', 'error');
    }
  }

  private async normalizeResults(): Promise<void> {
    try {
      await api.post(`/roll-tables/${this.props.tableId}/normalize-results`, {});
      showToast('Intervalos normalizados', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao normalizar intervalos', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
