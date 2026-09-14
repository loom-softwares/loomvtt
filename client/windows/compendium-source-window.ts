/*******************************************************************************
 * LoomVTT
 * client/windows/compendium-source-window.ts
 *
 *
 * Directory window for a compendium pack shipped by an addon/ruleset — a real
 * read/write `.sqlite` database, never copied into the world's own tables.
 * Two ways out of this list, both reusing existing machinery instead of
 * reinventing it:
 *
 * - Drag: the exact same payload shape as CompendiumPackWindow, so every drop
 *   target (actor sheet, canvas, sidebar, hotbar) already understands it.
 * - Click: opens the REAL document sheet via `openCompendiumEntrySheet`
 *   (`compendium-entry-dispatch.ts`) — the same one a materialized world pack
 *   entry opens, just pointed at `/compendium/sources/:id/entries-sheet`
 *   instead of `/compendium/:packId/entries`. Works even while the pack is
 *   locked (read it either way); the server rejects the save with 403 if
 *   still locked.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';
import { openCompendiumEntrySheet } from '../core/compendium-entry-dispatch.js';
import { gameContext } from '../core/game-context.js';
import { showContextMenu, ContextMenuItem } from '../components/context-menu.js';
import { showPrompt, showColorDialog, showConfirm } from '../components/dialog.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { folderColorStyles } from '../lib/folder-color.js';

interface SourceEntrySummary {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  imgUrl: string;
  folderId: string;
}

/** Pasta DENTRO do pack — vive na própria `.sqlite` do pack (ver
 * compendium-source.ts::ensureFolderSchema no server), não na tabela
 * `folders` do mundo. Mesmo shape que `FolderSummary` (sidebar.ts) menos
 * `worldId`/`type`, que não fazem sentido aqui: o pack já é o escopo. */
interface SourceFolder {
  id: string;
  name: string;
  parent: string;
  color: string;
  sorting: string;
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
  private folders: SourceFolder[] = [];
  /** Aberta/fechada só em memória desta janela — mesmo modelo já usado em
   * `sidebar.ts` (`expandedMapStages`), não precisa de estado no servidor. */
  private expandedFolders = new Set<string>();
  private loading = true;
  private searchQuery = '';
  /** `pack_meta.locked` do arquivo — não é por mundo, é do pack (ver
   * compendium-source.ts no server). Só exibida como selo no cabeçalho; quem
   * decide se dá pra editar de verdade é o servidor no PUT da ficha real. */
  private locked = true;
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

    // Mesmo padrão de sidebar.ts (linha ~516): um listener delegado só pra
    // pasta, via `data-folder-id` (nome próprio pra não colidir com
    // `data-entry-id`/`data-id`, já usados pelas entries nesta mesma lista).
    this.element.addEventListener('contextmenu', (e: MouseEvent) => {
      const header = (e.target as HTMLElement).closest<HTMLElement>('[data-folder-id]');
      if (!header) return;
      e.preventDefault();
      this.showSourceFolderContextMenu(header.getAttribute('data-folder-id')!, e);
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
      const res = await api.get<{ sourceId: string; name: string; type: string; locked: boolean; entries: SourceEntrySummary[]; folders: SourceFolder[] }>(
        `/compendium/sources/${encodeURIComponent(this.props.sourceId)}/entries`,
      );
      this.packName = res.name;
      this.packType = res.type;
      this.locked = res.locked;
      this.entries = res.entries;
      this.folders = res.folders || [];
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar compêndio', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  /** Abre a FICHA REAL da entry — mesmo `resolveSheetClass`/janela que abre
   * pra um item do mundo (ver `compendium-entry-dispatch.ts`, já usado por
   * `CompendiumPackWindow` pros packs materializados). A única diferença é a
   * rota: aqui aponta pro `.sqlite` da fonte (`/compendium/sources/:id/entries`)
   * em vez do compêndio do mundo — a ficha em si não sabe a diferença.
   *
   * Abre mesmo travado (o usuário pediu explicitamente "pelo menos pra ler a
   * ficha"): o servidor já rejeita o PUT com 403 se o pack estiver travado
   * (`compendium.ts`), então tentar salvar travado dá erro claro em vez de
   * gravar. Não há gate de clique aqui — só o servidor decide quem escreve. */
  private openSourceEntry(entry: SourceEntrySummary): void {
    openCompendiumEntrySheet(
      { id: this.props.sourceId, type: this.packType, worldId: this.props.worldId, apiRoute: `/compendium/sources/${encodeURIComponent(this.props.sourceId)}/entries-sheet` },
      { id: entry.id, type: entry.type },
    );
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="cp-empty"><i class="fa-solid fa-spinner fa-spin"></i> ${t('common.loading')}</div>`;
    }

    const typeIcon = TYPE_ICONS[this.packType] ?? 'fa-solid fa-book';
    // Com busca ativa, pasta só atrapalha (teria que decidir "abre a pasta
    // que contém o resultado?", "mostra o caminho?") — vira lista plana, como
    // já era antes das pastas existirem. Sem busca, agrupa por pasta.
    const searching = !!this.searchQuery;
    const filtered = searching
      ? this.entries.filter((en) => en.name.toLowerCase().includes(this.searchQuery))
      : this.entries;

    const canManageFolders = !this.locked && gameContext.isGM;

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
          ${canManageFolders ? `<button class="btn-icon" data-action="create-source-folder" title="Criar pasta"><i class="fa-solid fa-folder-plus"></i></button>` : ''}
        </div>

        <div class="cp-dir-list">
          ${filtered.length === 0
            ? `<div class="cp-empty"><i class="fa-solid fa-box-open"></i><span>${t('sidebar.emptyCompendium')}</span></div>`
            : searching
              ? filtered.map((entry) => this.entryTemplate(entry)).join('')
              : this.renderEntryTree()}
        </div>
      </div>
    `;
  }

  /** Monta pastas (raiz primeiro, recursivo) + entries soltas (`folderId ===
   * ''`) depois — mesma ordem de composição de `renderGroupedList` em
   * sidebar.ts (`folderBlocks + noFolder`). */
  private renderEntryTree(): string {
    const byFolder = new Map<string, SourceEntrySummary[]>();
    const loose: SourceEntrySummary[] = [];
    for (const entry of this.entries) {
      if (entry.folderId) {
        const list = byFolder.get(entry.folderId);
        if (list) list.push(entry);
        else byFolder.set(entry.folderId, [entry]);
      } else {
        loose.push(entry);
      }
    }

    const subfoldersByParent = new Map<string, SourceFolder[]>();
    const rootFolders: SourceFolder[] = [];
    for (const f of this.folders) {
      if (f.parent) {
        const list = subfoldersByParent.get(f.parent);
        if (list) list.push(f);
        else subfoldersByParent.set(f.parent, [f]);
      } else {
        rootFolders.push(f);
      }
    }

    const renderNode = (folder: SourceFolder, depth: number): string => {
      const expanded = this.expandedFolders.has(folder.id);
      const { folderStyle, textStyle } = folderColorStyles(folder.color);
      const indentStyle = depth > 0 ? `style="margin-left: ${depth * 10}px;"` : '';
      const items = byFolder.get(folder.id) ?? [];
      const subfolders = subfoldersByParent.get(folder.id) ?? [];

      const childrenHtml = expanded
        ? `<div class="sidebar-folder-items">
            ${subfolders.map((sub) => renderNode(sub, depth + 1)).join('')}
            ${items.map((entry) => this.entryTemplate(entry)).join('')}
          </div>`
        : '';

      return `
        <div class="sidebar-folder" ${indentStyle}>
          <div class="sidebar-folder-header ${folderStyle ? 'has-color' : ''}" data-action="toggle-source-entry-folder" data-id="${folder.id}" data-folder-id="${folder.id}" ${folderStyle}>
            <span class="sidebar-folder-caret" ${textStyle}><i class="fa-solid fa-chevron-${expanded ? 'down' : 'right'}"></i></span>
            <span class="sidebar-folder-name" ${textStyle}>${escapeHtml(folder.name)}</span>
            <span class="sidebar-folder-count" ${textStyle}>${items.length + subfolders.length}</span>
          </div>
          ${childrenHtml}
        </div>
      `;
    };

    return rootFolders.map((f) => renderNode(f, 0)).join('') + loose.map((entry) => this.entryTemplate(entry)).join('');
  }

  private entryTemplate(entry: SourceEntrySummary): string {
    const typeIcon = TYPE_ICONS[this.packType] || 'fa-solid fa-file';
    const safeUrl = safeImgUrl(entry.imgUrl);
    const thumb = safeUrl
      ? `<img class="cp-entry-thumb" src="${safeUrl}" alt="" />`
      : `<span class="cp-entry-thumb cp-entry-thumb--placeholder"><i class="${typeIcon}"></i></span>`;
    const safeId = escapeHtml(entry.id);

    // Mesmo padrão do resto da sidebar (sidebar-actor-item): a linha inteira é
    // draggable E clicável — arrastar solta na ficha de outro documento,
    // clicar abre a ficha REAL desta entry (ver `openSourceEntry`). Nenhum
    // botão à parte; nunca existiu "salvar no meu compêndio" aqui — o pack
    // fica separado de propósito, só a cópia que cai na ficha é sua.
    return `
      <div class="cp-entry-row" data-entry-id="${safeId}" data-id="${safeId}" data-action="open-source-entry" draggable="true">
        ${thumb}
        <span class="cp-entry-name">${escapeHtml(entry.name)}</span>
      </div>
    `;
  }

  /** Cria uma pasta RAIZ (sem pai) — "Criar Subpasta" no menu de contexto de
   * uma pasta existente é o caminho pra criar uma pasta dentro de outra;
   * este botão (na busca) é o único jeito de criar a PRIMEIRA pasta, quando
   * ainda não existe nenhuma pra clicar com o botão direito. Mesmo padrão de
   * `sidebar.ts::createFolder`: nome padrão sequencial, sem prompt — renomear
   * depois é "Editar Pasta". */
  private async createSourceFolder(parent: string = ''): Promise<void> {
    const name = nextDefaultName('Nova Pasta', this.folders.map((f) => f.name));
    try {
      const folder = await api.post<SourceFolder>(`/compendium/sources/${encodeURIComponent(this.props.sourceId)}/folders`, { name, parent });
      this.folders.push(folder);
      this.expandedFolders.add(folder.id);
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar pasta', 'error');
    }
  }

  /** Mesmos 3 itens que uma pasta de mundo tem (`sidebar.ts::showFolderContextMenu`
   * é o modelo linha a linha) — só troca `/folders/:id` por
   * `/compendium/sources/:sourceId/folders/:id`. Sem "Criar Item" aqui: uma
   * pasta de pack de fonte não cria conteúdo novo, só organiza o que já veio
   * do addon/ruleset. */
  private showSourceFolderContextMenu(folderId: string, event: MouseEvent): void {
    const folder = this.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const items: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-folder"></i>',
        label: 'Criar Subpasta',
        action: () => void this.createSourceFolder(folderId),
      },
      {
        icon: '<i class="fa-solid fa-pen-to-square"></i>',
        label: 'Editar Pasta',
        action: async () => {
          const name = await showPrompt('Editar Pasta', 'Nome da pasta', folder.name);
          if (name === null) return;
          const color = await showColorDialog('Editar Pasta', 'Cor da pasta', folder.color || '');
          if (color === null) return;

          try {
            const updated = await api.put<SourceFolder>(
              `/compendium/sources/${encodeURIComponent(this.props.sourceId)}/folders/${folderId}`,
              { name: name.trim(), color: color.trim() },
            );
            folder.name = updated.name;
            folder.color = updated.color;
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
            await api.delete(`/compendium/sources/${encodeURIComponent(this.props.sourceId)}/folders/${folderId}`);
            const idx = this.folders.findIndex((f) => f.id === folderId);
            if (idx !== -1) this.folders.splice(idx, 1);
            for (const f of this.folders) if (f.parent === folderId) f.parent = '';
            for (const entry of this.entries) if (entry.folderId === folderId) entry.folderId = '';
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

  onAction(action: string, id: string | null): void {
    if (action === 'open-source-entry' && id) {
      const entry = this.entries.find((e) => e.id === id);
      if (entry) this.openSourceEntry(entry);
    } else if (action === 'create-source-folder') {
      void this.createSourceFolder();
    } else if (action === 'toggle-source-entry-folder' && id) {
      if (this.expandedFolders.has(id)) this.expandedFolders.delete(id);
      else this.expandedFolders.add(id);
      this.rerenderBody();
    }
  }
}
