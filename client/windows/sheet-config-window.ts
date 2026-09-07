/*******************************************************************************
 * LoomVTT
 * client/windows/sheet-config-window.ts
 * 
 * 
 * Window for configuring default sheets.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { sheetCatalog } from '../core/sheet-catalog.js';

interface DocTypeEntry {
  type: string;
  label: string;
}

const DOC_TYPES: DocTypeEntry[] = [
  { type: 'actor', label: 'Atores' },
  { type: 'item', label: 'Itens' },
  { type: 'journal', label: 'Diários' },
  { type: 'deck', label: 'Baralhos' },
  { type: 'playlist', label: 'Playlists' },
];

export class SheetConfigWindow extends BaseWindow {
  constructor() {
    super({
      id: 'sheet-config',
      title: 'Configurar Fichas Padrão',
      icon: '<i class="fa-solid fa-clipboard-list"></i>',
      width: 540,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    const saved = this.loadDefaults();

    const rows = DOC_TYPES.map((dt) => {
      const current = saved[dt.type] || '*';
      return `
        <div class="form-group form-group-checkbox">
          <label>${dt.label}</label>
          <select data-action="set-default-sheet" data-doc-type="${dt.type}">
            <option value="*" ${current === '*' ? 'selected' : ''}>Padrão do sistema</option>
          </select>
        </div>`;
    }).join('');

    return `
      <div style="padding: 1rem;">
        <p style="margin-bottom: 1rem; color: var(--color-text-secondary);">
          Escolha qual ficha abre por padrão para cada tipo de documento.
          Nenhuma ficha personalizada registrada ainda — as opções aparecerão
          automaticamente conforme módulos e sistemas registrarem fichas.
        </p>
        ${rows}
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'set-default-sheet') {
      const docType = target.getAttribute('data-doc-type');
      const sel = target as HTMLSelectElement;
      if (docType && sel) {
        const saved = this.loadDefaults();
        saved[docType] = sel.value;
        localStorage.setItem('loom_default_sheets', JSON.stringify(saved));
      }
    }
  }

  private loadDefaults(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem('loom_default_sheets') || '{}');
    } catch {
      return {};
    }
  }
}
