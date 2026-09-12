/*******************************************************************************
 * LoomVTT
 * client/windows/compendium-source-window.ts
 *
 *
 * Browse-only window for a compendium pack shipped by an addon/ruleset. Reads
 * straight from the source (`.sqlite` file) — never copies the pack into the
 * world's own database. Drag-and-drop uses the exact same payload shape as
 * CompendiumPackWindow, so every existing drop target (actor sheet, canvas,
 * sidebar, hotbar) already understands it with no changes on their side —
 * see project_compendio_arquitetura_2026_09_08.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';

interface SourceEntrySummary {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  imgUrl: string;
}

/** Dados de fonte remota vêm de uma API de terceiro (ver compendium-source.ts no
 * server) — nunca confiar direto num template de innerHTML. */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

/** `imgUrl` remoto também precisa ter o esquema validado antes de virar `src` —
 * um `javascript:`/`data:` malicioso não seria bloqueado só pelo escapeHtml. */
function safeImgUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return escapeHtml(url);
  } catch { /* URL relativa inválida ou malformada */ }
  return '';
}

// Pack-level types only — LoomVTT's own core document types, not any one
// ruleset's item/actor subtype vocabulary (see compendium-pack-window.ts for
// why: a per-subtype icon list only ever matches D&D-5e-shaped systems).
const TYPE_ICONS: Record<string, string> = {
  Actor: 'fa-solid fa-user-group',
  Item: 'fa-solid fa-briefcase',
  JournalEntry: 'fa-solid fa-book-open',
  Journal: 'fa-solid fa-book-open',
};

export class CompendiumSourceWindow extends BaseWindow {
  private packName = '';
  private packType = 'Item';
  private entries: SourceEntrySummary[] = [];
  private loading = true;
  private searchQuery = '';
  /** dataTransfer.setData só funciona de forma SÍNCRONA dentro do handler de
   * dragstart — não dá pra buscar a entry completa nesse momento (a listagem
   * é leve, sem `data`). Pré-busca no mousedown (antes do drag de fato
   * começar) e cacheia aqui, pra ter o payload pronto quando dragstart disparar. */
  private entryCache = new Map<string, any>();

  constructor(private props: { sourceId: string; worldId: string }) {
    super({
      id: `compendium-source-${props.sourceId}`,
      title: t('sidebar.compendium'),
      icon: '<i class="fa-solid fa-book-atlas"></i>',
      width: 400,
      height: 580,
      showFooter: false,
      bannerImage: '/images/general-banners/journal-banner.png',
    });
  }

  async mount(): Promise<void> {
    super.mount();
    this.element.classList.add('compendium-pack-window');

    this.element.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.getAttribute('name') === 'cp-search') {
        this.searchQuery = target.value.toLowerCase();
        this.rerenderBody();
      }
    });

    // Pré-busca a entry completa no mousedown (antes do drag de fato começar) —
    // dataTransfer.setData só aceita escrita SÍNCRONA dentro do handler de
    // dragstart, e a listagem exibida é leve (sem `data`).
    this.element.addEventListener('mousedown', (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-entry-id]');
      if (!row) return;
      const entryId = row.getAttribute('data-entry-id')!;
      if (this.entryCache.has(entryId)) return;
      void this.buildDragPayload(entryId).then((payload) => {
        if (payload) this.entryCache.set(entryId, payload);
      });
    });

    // Drag FROM this window — mesmo payload que CompendiumPackWindow monta,
    // então qualquer drop target já existente (ficha, canvas, sidebar) funciona
    // sem mudar nada do lado deles.
    this.element.addEventListener('dragstart', (e: DragEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-entry-id]');
      if (!row || !e.dataTransfer) { e.preventDefault(); return; }
      const entryId = row.getAttribute('data-entry-id')!;
      const payload = this.entryCache.get(entryId);
      if (!payload) {
        // Drag disparou antes da pré-busca do mousedown terminar (raro) —
        // aborta em vez de soltar um payload incompleto no drop target.
        e.preventDefault();
        showToast('Ainda carregando esta entrada, tente arrastar de novo.', 'info');
        return;
      }
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    });

    await this.load();
  }

  private async buildDragPayload(entryId: string): Promise<Record<string, any> | null> {
    try {
      const entry = await api.get<any>(`/compendium/sources/${encodeURIComponent(this.props.sourceId)}/entries/${entryId}`);
      return {
        type: this.packType.charAt(0).toUpperCase() + this.packType.slice(1),
        id: entry.id,
        uuid: `Compendium.${this.props.sourceId}.${entry.id}`,
        data: entry,
        packType: this.packType,
      };
    } catch {
      return null;
    }
  }

  private async load(): Promise<void> {
    try {
      const res = await api.get<{ sourceId: string; name: string; type: string; entries: SourceEntrySummary[] }>(
        `/compendium/sources/${encodeURIComponent(this.props.sourceId)}/entries`,
      );
      this.packName = res.name;
      this.packType = res.type;
      this.entries = res.entries;
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar compêndio', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  private async saveToMyCompendium(entryId: string): Promise<void> {
    try {
      await api.post(`/compendium/sources/${encodeURIComponent(this.props.sourceId)}/entries/${entryId}/import`, {
        worldId: this.props.worldId,
      });
      showToast('Salvo no seu compêndio', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar no compêndio', 'error');
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="cp-empty"><i class="fa-solid fa-spinner fa-spin"></i> ${t('common.loading')}</div>`;
    }

    const typeIcon = TYPE_ICONS[this.packType] ?? 'fa-solid fa-book';
    const filtered = this.entries.filter((en) =>
      !this.searchQuery || en.name.toLowerCase().includes(this.searchQuery),
    );

    return `
      <div class="cp-directory">
        <div class="cp-dir-banner">
          <div class="cp-dir-banner-content">
            <i class="${typeIcon} cp-dir-type-icon"></i>
            <span class="cp-dir-name-input">${escapeHtml(this.packName)}</span>
            <span class="cp-dir-type-badge">${escapeHtml(this.packType)}</span>
          </div>
        </div>

        <div class="cp-dir-search-wrap">
          <i class="fa-solid fa-magnifying-glass cp-dir-search-icon"></i>
          <input type="search" name="cp-search" class="cp-dir-search" placeholder="${t('gameConfig.search')}" value="${this.searchQuery}" />
          <span class="cp-dir-count">${this.entries.length}</span>
        </div>

        <div class="cp-dir-list">
          ${filtered.length === 0
            ? `<div class="cp-empty"><i class="fa-solid fa-box-open"></i><span>${t('sidebar.emptyCompendium')}</span></div>`
            : filtered.map((entry) => this.entryTemplate(entry)).join('')}
        </div>
      </div>
    `;
  }

  private entryTemplate(entry: SourceEntrySummary): string {
    const typeIcon = TYPE_ICONS[this.packType] || 'fa-solid fa-file';
    const safeUrl = safeImgUrl(entry.imgUrl);
    const thumb = safeUrl
      ? `<img class="cp-entry-thumb" src="${safeUrl}" alt="" />`
      : `<span class="cp-entry-thumb cp-entry-thumb--placeholder"><i class="${typeIcon}"></i></span>`;
    const safeId = escapeHtml(entry.id);

    return `
      <div class="cp-entry-row" data-entry-id="${safeId}" draggable="true">
        ${thumb}
        <span class="cp-entry-name">${escapeHtml(entry.name)}</span>
        <button class="btn cp-entry-remove btn-icon" data-action="save-to-compendium" data-id="${safeId}" title="Salvar no meu compêndio">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `;
  }

  onAction(action: string, id: string | null): void {
    if (action === 'save-to-compendium' && id) {
      void this.saveToMyCompendium(id);
    }
  }
}
