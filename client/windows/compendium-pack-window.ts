/*******************************************************************************
 * LoomVTT
 * client/windows/compendium-pack-window.ts
 * 
 * 
 * Window for browsing a Compendium pack.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { showPrompt, showConfirm, showColorDialog, showFolderEditDialog } from '../components/dialog.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { LoomDialog } from './loom-dialog.js';
import { ItemCreateWindow } from './item-create-window.js';
import { openCompendiumEntrySheet } from '../core/compendium-entry-dispatch.js';
import { wsClient } from '../core/ws-client.js';
import { showContextMenu, ContextMenuItem } from '../components/context-menu.js';
import { folderColorStyles } from '../lib/folder-color.js';

interface CompendiumFolder {
  id: string;
  name: string;
  parent: string;
  color: string;
}

interface CompendiumPack {
  id: string;
  worldId: string;
  name: string;
  type: string;
  entries: any[];
  folders: CompendiumFolder[];
}

// Pack-level types (`pack.type`) only — these are LoomVTT's own core document
// types, not a specific ruleset's vocabulary. A previous version of this map
// also guessed icons per entry SUBtype (`spell`/`race`/`class`/`subclass`/...)
// and even per spell school — all D&D-5e-specific terms that don't exist in
// other rulesets (wod5e, custom systems, etc.), so every non-5e-shaped item
// silently got no benefit from that list anyway. Kept it to the coarse,
// system-agnostic types only; anything else falls back to a generic icon.
const TYPE_ICONS: Record<string, string> = {
  Actor: 'fa-solid fa-user-group',
  Item: 'fa-solid fa-briefcase',
  Scene: 'fa-solid fa-map',
  JournalEntry: 'fa-solid fa-book-open',
  RollTable: 'fa-solid fa-dice',
  Cards: 'fa-solid fa-layer-group',
  Adventure: 'fa-solid fa-map-location-dot',
};

const TYPE_LABELS: Record<string, string> = {
  Actor: 'Actor',
  Item: 'Item',
  Scene: 'Scene',
  JournalEntry: 'Journal',
  RollTable: 'Roll Table',
  Cards: 'Cards',
  Adventure: 'Adventure',
};

export class CompendiumPackWindow extends BaseWindow {
  private pack: CompendiumPack | null = null;
  private loading = true;
  private searchQuery = '';
  private unsubscribeCompendium: (() => void) | null = null;
  private expandedFolders = new Set<string>();

  constructor(private props: { packId: string; packType?: string }) {
    super({
      id: `compendium-pack-${props.packId}`,
      title: t('sidebar.compendium'),
      icon: '<i class="fa-solid fa-book-atlas"></i>',
      width: 400,
      height: 580,
      documentId: props.packId,
      showFooter: false,
      bannerImage: '/images/general-banners/journal-banner.png',
    });
  }

  async mount(): Promise<void> {
    super.mount();
    this.element.classList.add('compendium-pack-window');

    // Search input – live filter
    this.element.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.getAttribute('name') === 'cp-search') {
        this.searchQuery = target.value.toLowerCase();
        this.rerenderBody();
      }
    });

    // Mesmo padrão de compendium-source-window.ts: um listener delegado só pra
    // pasta, via `data-folder-id` (nome próprio pra não colidir com
    // `data-entry-id`/`data-id`, já usados pelas entries nesta mesma lista).
    this.element.addEventListener('contextmenu', (e: MouseEvent) => {
      const header = (e.target as HTMLElement).closest<HTMLElement>('[data-folder-id]');
      if (!header) return;
      e.preventDefault();
      this.showFolderContextMenu(header.getAttribute('data-folder-id')!, e);
    });

    // Drag FROM this window onto sidebar/canvas
    this.element.addEventListener('dragstart', (e: DragEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-entry-id]');
      if (!row || !e.dataTransfer || !this.pack) return;
      const entryId = row.getAttribute('data-entry-id')!;
      const entry = this.pack.entries.find((en: any) => en.id === entryId);
      if (!entry) return;

      const payload = {
        type: this.pack.type.charAt(0).toUpperCase() + this.pack.type.slice(1),
        id: entry.id,
        uuid: `Compendium.${this.pack.id}.${entry.id}`,
        data: entry,
        packType: this.pack.type,
      };

      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Drop INTO this window (import doc from sidebar)
    this.element.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    this.element.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      if (!this.pack || !e.dataTransfer) return;

      try {
        const text = e.dataTransfer.getData('text/plain');
        if (!text) return;
        const payload = JSON.parse(text);

        const TYPE_ALIAS: Record<string, string> = { Journal: 'JournalEntry', Stage: 'Scene' };
        const normalizeType = (tp: string) => TYPE_ALIAS[tp] || tp;
        if (normalizeType(payload.type) !== normalizeType(this.pack.type)) {
          showToast(`Este compêndio só aceita entradas do tipo ${this.pack.type}.`, 'error');
          return;
        }

        let apiRoute = '';
        const resolvedType = normalizeType(payload.type);
        if (resolvedType === 'Actor') apiRoute = '/actors';
        else if (resolvedType === 'Item') apiRoute = '/items';
        else if (resolvedType === 'JournalEntry') apiRoute = '/journals';
        else if (resolvedType === 'Scene') apiRoute = '/stages';
        else {
          showToast(`Tipo de documento não suportado: ${payload.type}`, 'error');
          return;
        }

        const doc = await api.get<any>(`${apiRoute}/${payload.id}`);

        let entryData: Record<string, any>;
        if (resolvedType === 'Scene') {
          const { id: _id, worldId: _w, createdAt: _c, updatedAt: _u, tokens: _t, isActive: _a, ...stageFields } = doc;
          entryData = { ...stageFields };
        } else {
          entryData = doc.systemData ?? doc.data ?? (doc.pages ? { pages: doc.pages } : {});
        }

        const newEntry = {
          id: crypto.randomUUID(),
          name: doc.name,
          type: doc.type || resolvedType,
          imgUrl: doc.imgUrl || doc.avatarUrl || doc.backgroundUrl || '',
          data: entryData,
        };

        const entries = [...this.pack.entries, newEntry];
        await api.put(`/compendium/${this.pack.id}`, { entries });
        this.pack.entries = entries;
        this.rerenderBody();
        showToast('Entrada adicionada ao compêndio', 'success');
      } catch (err: any) {
        showToast(err?.message || 'Erro ao importar documento para o compêndio', 'error');
      }
    });

    this.unsubscribeCompendium = wsClient.on('compendium.entry.updated', (data) => {
      if (this.pack && data.packId === this.pack.id) {
        const idx = this.pack.entries.findIndex((e: any) => e.id === data.entry.id);
        if (idx !== -1) {
          this.pack.entries[idx] = data.entry;
          this.rerenderBody();
        }
      }
    });

    await this.load();
  }

  protected onClose(): void {
    if (this.unsubscribeCompendium) {
      this.unsubscribeCompendium();
    }
  }

  private async load(): Promise<void> {
    try {
      this.pack = await api.get<CompendiumPack>(`/compendium/${this.props.packId}`);

      const bgMap: Record<string, string> = {
        actor: '/images/compendium-bg/actor.png',
        item: '/images/compendium-bg/item.png',
        scene: '/images/compendium-bg/scenes.png',
        journalentry: '/images/compendium-bg/journal.png',
        rolltable: '/images/compendium-bg/roll-tabels.png',
        cards: '/images/compendium-bg/cards.png',
      };
      const bgUrl = bgMap[(this.pack.type || '').toLowerCase()] || '';
      if (bgUrl) {
        this.element.style.setProperty('--cp-banner-url', `url('${bgUrl}')`);
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar pack', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="cp-empty"><i class="fa-solid fa-spinner fa-spin"></i> ${t('common.loading')}</div>`;
    }
    if (!this.pack) {
      return `<div class="cp-empty"><i class="fa-solid fa-triangle-exclamation"></i> ${t('common.error')}</div>`;
    }

    const p = this.pack;
    const typeIcon = TYPE_ICONS[p.type] ?? 'fa-solid fa-book';
    const typeLabel = TYPE_LABELS[p.type] ?? p.type;

    const filtered = p.entries.filter((en: any) =>
      !this.searchQuery || (en.name ?? '').toLowerCase().includes(this.searchQuery),
    );

    return `
      <div class="cp-directory">

        <!-- Banner Header: pack name + type badge -->
        <div class="cp-dir-banner">
          <div class="cp-dir-banner-content">
            <i class="${typeIcon} cp-dir-type-icon"></i>
            <input
              type="text"
              name="cp-name"
              class="cp-dir-name-input"
              value="${this.esc(p.name)}"
              title="Pack name"
            />
            <span class="cp-dir-type-badge">${this.esc(typeLabel)}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="cp-dir-actions">
          <button class="btn btn-primary cp-dir-btn-create" data-action="add-entry">
            <i class="fa-solid fa-book-medical"></i>
            ${t('sidebar.compendiumAddEntry')}
          </button>
          <button class="btn cp-dir-btn-icon" data-action="create-folder" title="Criar pasta">
            <i class="fa-solid fa-folder-plus"></i>
          </button>
          <button class="btn cp-dir-btn-icon" data-action="export-pack" title="${t('sidebar.compendiumExport')}">
            <i class="fa-solid fa-arrow-up-from-bracket"></i>
          </button>
          <button class="btn cp-dir-btn-icon" data-action="import-pack" title="${t('sidebar.compendiumImport')}">
            <i class="fa-solid fa-arrow-down-to-bracket"></i>
          </button>
          <button class="btn cp-dir-btn-icon" data-action="save" title="Salvar nome">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
        </div>

        <!-- Search bar -->
        <div class="cp-dir-search-wrap">
          <i class="fa-solid fa-magnifying-glass cp-dir-search-icon"></i>
          <input
            type="search"
            name="cp-search"
            class="cp-dir-search"
            placeholder="${t('gameConfig.search')}"
            value="${this.esc(this.searchQuery)}"
          />
          <span class="cp-dir-count">${p.entries.length}</span>
        </div>

        <!-- Entry list -->
        <div class="cp-dir-list">
          ${p.entries.length === 0
        ? `<div class="cp-empty">
                 <i class="fa-solid fa-box-open"></i>
                 <span>${t('sidebar.emptyCompendium')}</span>
               </div>`
        : this.searchQuery
          ? filtered.map((entry: any) => this.entryTemplate(entry)).join('')
          : this.renderEntryTree()
      }
        </div>

      </div>
    `;
  }

  /** Fora de busca: agrupa por pasta (mesmo padrão de compendium-source-window.ts —
   * sem ícone de pasta, só chevron + nome + contador). Durante busca, a busca
   * atravessa as pastas (lista plana), igual ao pack de fonte. */
  private renderEntryTree(): string {
    if (!this.pack) return '';
    const folders = this.pack.folders || [];
    const byFolder = new Map<string, any[]>();
    const loose: any[] = [];
    for (const entry of this.pack.entries) {
      const fid = entry.folderId || '';
      if (fid && folders.some((f) => f.id === fid)) {
        if (!byFolder.has(fid)) byFolder.set(fid, []);
        byFolder.get(fid)!.push(entry);
      } else {
        loose.push(entry);
      }
    }
    const subfoldersByParent = new Map<string, CompendiumFolder[]>();
    const rootFolders: CompendiumFolder[] = [];
    for (const f of folders) {
      if (f.parent) {
        if (!subfoldersByParent.has(f.parent)) subfoldersByParent.set(f.parent, []);
        subfoldersByParent.get(f.parent)!.push(f);
      } else {
        rootFolders.push(f);
      }
    }

    const renderFolder = (f: CompendiumFolder): string => {
      const expanded = this.expandedFolders.has(f.id);
      const children = subfoldersByParent.get(f.id) || [];
      const entries = byFolder.get(f.id) || [];
      const count = entries.length + children.reduce((n, c) => n + this.countInFolder(c.id, byFolder, subfoldersByParent), 0);
      const { folderStyle, textStyle } = folderColorStyles(f.color);
      return `
        <div class="sidebar-folder">
          <div class="sidebar-folder-header" data-action="toggle-pack-folder" data-id="${f.id}" data-folder-id="${f.id}" ${folderStyle}>
            <i class="fa-solid fa-chevron-${expanded ? 'down' : 'right'} sidebar-folder-caret" ${textStyle}></i>
            <span class="sidebar-folder-name" ${textStyle}>${this.esc(f.name)}</span>
            <span class="sidebar-folder-count" ${textStyle}>${count}</span>
          </div>
          ${expanded ? `<div class="sidebar-folder-items">
            ${children.map((c) => renderFolder(c)).join('')}
            ${entries.map((entry) => this.entryTemplate(entry)).join('')}
          </div>` : ''}
        </div>
      `;
    };

    return `
      ${rootFolders.map((f) => renderFolder(f)).join('')}
      ${loose.map((entry) => this.entryTemplate(entry)).join('')}
    `;
  }

  private countInFolder(folderId: string, byFolder: Map<string, any[]>, subfoldersByParent: Map<string, CompendiumFolder[]>): number {
    const own = (byFolder.get(folderId) || []).length;
    const children = subfoldersByParent.get(folderId) || [];
    return own + children.reduce((n, c) => n + this.countInFolder(c.id, byFolder, subfoldersByParent), 0);
  }

  private entryTemplate(entry: any): string {
    const name = entry?.name || entry?.id || 'Entry';
    const imgUrl = entry?.imgUrl || entry?.data?.imgUrl || '';
    const typeIcon = TYPE_ICONS[this.pack?.type ?? ''] || 'fa-solid fa-file';

    const thumb = imgUrl
      ? `<img class="cp-entry-thumb" src="${this.esc(imgUrl)}" alt="" />`
      : `<span class="cp-entry-thumb cp-entry-thumb--placeholder"><i class="${typeIcon}"></i></span>`;

    return `
      <div class="cp-entry-row" data-entry-id="${this.esc(entry.id)}" draggable="true" data-action="edit-entry" data-id="${this.esc(entry.id)}">
        ${thumb}
        <span class="cp-entry-name">${this.esc(name)}</span>
        <button class="btn cp-entry-remove btn-icon"
          data-action="remove-entry"
          data-id="${this.esc(entry.id)}"
          title="${t('sidebar.compendiumEntryRemove')}"
        ><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'export-pack') { this.exportPack(); }
    else if (action === 'import-pack') { this.importPack(); }
    else if (action === 'add-entry') { this.addEntry(); }
    else if (action === 'save') { void this.save(); }
    else if (action === 'edit-entry' && id !== null) { this.editEntryById(id); }
    else if (action === 'remove-entry' && id !== null) { void this.removeEntryById(id); }
    else if (action === 'create-folder') { void this.createFolder(); }
    else if (action === 'toggle-pack-folder' && id !== null) {
      if (this.expandedFolders.has(id)) this.expandedFolders.delete(id);
      else this.expandedFolders.add(id);
      this.rerenderBody();
    }
  }

  // ── Pastas ─────────────────────────────────────────────────────────────────

  private async createFolder(parent = ''): Promise<void> {
    if (!this.pack) return;
    const existingNames = this.pack.folders.map((f) => f.name);
    const name = nextDefaultName('Nova Pasta', existingNames);
    try {
      const folder = await api.post<CompendiumFolder>('/folders', {
        worldId: this.pack.worldId,
        name,
        type: 'compendium-entry',
        packId: this.pack.id,
        parent,
      });
      this.pack.folders = [...this.pack.folders, folder];
      this.expandedFolders.add(folder.id);
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar pasta', 'error');
    }
  }

  private showFolderContextMenu(folderId: string, event: MouseEvent): void {
    if (!this.pack) return;
    const folder = this.pack.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const items: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-folder-plus"></i>',
        label: 'Criar Subpasta',
        action: () => void this.createFolder(folderId),
      },
      {
        icon: '<i class="fa-solid fa-pen-to-square"></i>',
        label: 'Editar Pasta',
        action: async () => {
          const result = await showFolderEditDialog('Editar Pasta', folder.name, folder.color || '');
          if (result === null) return;
          const { name, color } = result;

          try {
            const updated = await api.put<CompendiumFolder>(`/folders/${folderId}`, { name: name.trim(), color: color.trim() });
            if (!this.pack) return;
            this.pack.folders = this.pack.folders.map((f) => (f.id === folderId ? updated : f));
            this.rerenderBody();
            showToast('Pasta atualizada', 'success');
          } catch (e: any) {
            showToast(e?.message || 'Erro ao atualizar pasta', 'error');
          }
        },
      },
      { divider: true, label: '' },
      {
        icon: '<i class="fa-solid fa-trash"></i>',
        label: 'Excluir Pasta',
        danger: true,
        action: async () => {
          const confirmed = await showConfirm('Excluir Pasta', `Deseja mesmo excluir a pasta "${folder.name}"? As entries nela ficam soltas fora de pastas.`);
          if (!confirmed) return;
          try {
            await api.delete(`/folders/${folderId}`);
            if (!this.pack) return;
            const grandparent = this.pack.folders.find((f) => f.id === folderId)?.parent || '';
            this.pack.folders = this.pack.folders
              .filter((f) => f.id !== folderId)
              .map((f) => (f.parent === folderId ? { ...f, parent: grandparent } : f));
            this.pack.entries = this.pack.entries.map((en: any) => (en.folderId === folderId ? { ...en, folderId: '' } : en));
            this.expandedFolders.delete(folderId);
            this.rerenderBody();
            showToast('Pasta excluída', 'success');
          } catch (e: any) {
            showToast(e?.message || 'Erro ao excluir pasta', 'error');
          }
        },
      },
    ];
    showContextMenu(event, items);
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  private addEntry(): void {
    if (!this.pack) return;

    if (this.pack.type === 'Scene') {
      const name = nextDefaultName('Nova Cena', this.pack.entries.map((e: any) => e.name));
      const newEntry = { id: crypto.randomUUID(), name, type: 'Scene', data: {}, imgUrl: '' };
      void this.pushEntry(newEntry);
      return;
    }

    if (this.pack.type === 'Adventure') {
      void this.addAdventureEntry();
      return;
    }

    windowManager.open('compendium-add-entry', ItemCreateWindow, {
      title: t('compendiumPack.addEntryTitle'),
      onSubmit: async (data: { name: string; type: string }) => {
        if (!this.pack) return;
        const newEntry = { id: crypto.randomUUID(), name: data.name, type: data.type, data: {}, imgUrl: '' };
        await this.pushEntry(newEntry);
      },
    });
  }

  private async pushEntry(entry: any): Promise<void> {
    if (!this.pack) return;
    const entries = [...this.pack.entries, entry];
    try {
      await api.put(`/compendium/${this.pack.id}`, { entries });
      this.pack.entries = entries;
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao adicionar entrada', 'error');
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  private editEntryById(id: string): void {
    if (!this.pack) return;
    const entry = this.pack.entries.find((en: any) => en.id === id);
    if (!entry) return;
    if (this.pack.type === 'Adventure') {
      void this.importAdventureEntry(entry);
      return;
    }
    openCompendiumEntrySheet(this.pack, entry);
  }

  /** Constrói uma entrada "Adventure": empacota atores (+itens próprios), itens avulsos,
   * cenas (sem placeables — ver comentário da rota no servidor), diários, macros e
   * playlists (+sons) selecionados do mundo em um snapshot único e reimportável. */
  private async addAdventureEntry(): Promise<void> {
    if (!this.pack) return;
    const worldId = this.pack.worldId;

    let actors: any[], items: any[], stages: any[], journals: any[], macros: any[], playlists: any[];
    try {
      [actors, items, stages, journals, macros, playlists] = await Promise.all([
        api.get<any[]>(`/actors?worldId=${worldId}`),
        api.get<any[]>(`/items?worldId=${worldId}`),
        api.get<any[]>(`/stages?worldId=${worldId}`),
        api.get<any[]>(`/journals?worldId=${worldId}`),
        api.get<any[]>(`/macros?worldId=${worldId}`),
        api.get<any[]>(`/playlists?worldId=${worldId}`),
      ]);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar conteúdo do mundo', 'error');
      return;
    }

    // Constrói o conteúdo como elemento DOM real (não string) — o callback do botão captura
    // `checkboxGroups` por closure, sem depender do shim de `button.form` (esse existe só pra
    // compatibilidade com sistema convertido que emula `FormDataExtended(button.form)`; código
    // nativo não precisa passar por ali — ver `dialog.ts:prompt()` pro mesmo padrão).
    const container = document.createElement('div');
    const checkboxGroups: Record<string, HTMLInputElement[]> = {};

    const section = (title: string, key: string, list: any[]): void => {
      if (list.length === 0) return;
      const group = document.createElement('div');
      group.className = 'form-group';
      const label = document.createElement('label');
      label.textContent = title;
      group.appendChild(label);
      const listEl = document.createElement('div');
      listEl.style.cssText = 'max-height:120px;overflow-y:auto;border:1px solid var(--color-border);border-radius:4px;padding:0.35rem;';
      const boxes: HTMLInputElement[] = [];
      for (const d of list) {
        const itemLabel = document.createElement('label');
        itemLabel.style.cssText = 'display:flex;gap:0.35rem;align-items:center;padding:2px 0;font-weight:normal;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = d.id;
        boxes.push(checkbox);
        itemLabel.appendChild(checkbox);
        itemLabel.appendChild(document.createTextNode(' ' + d.name));
        listEl.appendChild(itemLabel);
      }
      group.appendChild(listEl);
      container.appendChild(group);
      checkboxGroups[key] = boxes;
    };

    section('Atores', 'actorIds', actors);
    section('Itens', 'itemIds', items);
    section('Cenas', 'stageIds', stages);
    section('Diários', 'journalIds', journals);
    section('Macros', 'macroIds', macros);
    section('Playlists', 'playlistIds', playlists);

    if (Object.keys(checkboxGroups).length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-secondary';
      empty.textContent = 'Nada pra empacotar neste mundo ainda.';
      container.appendChild(empty);
    }

    const name = nextDefaultName('Nova Aventura', this.pack.entries.map((e: any) => e.name));

    const picked = await LoomDialog.wait({
      window: { title: t('compendiumPack.packageDialogTitle', { name }) },
      content: container,
      width: 420,
      buttons: [
        { action: 'cancel', label: 'Cancelar', variant: 'ghost', callback: () => null },
        {
          action: 'create', label: 'Criar', variant: 'primary', default: true,
          callback: () => {
            const collect = (key: string) => (checkboxGroups[key] || []).filter((b) => b.checked).map((b) => b.value);
            return {
              actorIds: collect('actorIds'),
              itemIds: collect('itemIds'),
              stageIds: collect('stageIds'),
              journalIds: collect('journalIds'),
              macroIds: collect('macroIds'),
              playlistIds: collect('playlistIds'),
            };
          },
        },
      ],
    });
    if (!picked) return;

    try {
      const entry = await api.post<any>(`/compendium/${this.pack.id}/adventure-entry`, { name, ...picked });
      this.pack.entries = [...this.pack.entries, entry];
      this.rerenderBody();
      showToast('Aventura empacotada', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao empacotar aventura', 'error');
    }
  }

  private async importAdventureEntry(entry: any): Promise<void> {
    if (!this.pack) return;
    const confirmed = await showConfirm('Importar Aventura', `Importar "${entry.name}" pro mundo? Cria cópias novas de tudo que estiver empacotado.`);
    if (!confirmed) return;

    try {
      const result = await api.post<{ created: Record<string, number> }>(`/compendium/${this.pack.id}/adventure-entry/${entry.id}/import`, {});
      const c = result.created;
      const parts = Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
      showToast(parts.length > 0 ? `Importado: ${parts.join(', ')}` : 'Aventura vazia — nada pra importar', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao importar aventura', 'error');
    }
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  private async removeEntryById(id: string): Promise<void> {
    if (!this.pack) return;
    const entries = this.pack.entries.filter((en: any) => en.id !== id);
    try {
      await api.put(`/compendium/${this.pack.id}`, { entries });
      this.pack.entries = entries;
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover entrada', 'error');
    }
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  private async exportPack(): Promise<void> {
    if (!this.pack) return;
    const fileName = await showPrompt(
      t('compendium.exportTitle') || 'Exportar Pack',
      t('sidebar.compendiumFileName'),
      `${this.pack.name}.json`,
    );
    if (!fileName) return;
    try {
      await api.post(`/compendium/${this.pack.id}/export`, { fileName });
      showToast('Pack exportado', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao exportar', 'error');
    }
  }

  private async importPack(): Promise<void> {
    if (!this.pack) return;
    const filePath = await showPrompt(
      t('compendium.importTitle') || 'Importar Pack',
      t('sidebar.compendiumFilePath'),
    );
    if (!filePath) return;
    try {
      await api.post(`/compendium/${this.pack.id}/import`, { filePath });
      showToast('Importado', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao importar', 'error');
    }
  }

  // ── Save name ──────────────────────────────────────────────────────────────

  private async save(): Promise<void> {
    if (!this.pack) return;
    const nameInput = this.element.querySelector<HTMLInputElement>('[name="cp-name"]');
    const name = nameInput?.value || this.pack.name;
    try {
      await api.put(`/compendium/${this.pack.id}`, { name, entries: this.pack.entries });
      this.pack.name = name;
      showToast('Pack salvo', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar pack', 'error');
    }
  }

  // ── Util ───────────────────────────────────────────────────────────────────

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
