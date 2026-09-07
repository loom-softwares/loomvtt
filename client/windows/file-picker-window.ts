/*******************************************************************************
 * LoomVTT
 * client/windows/file-picker-window.ts
 * 
 * 
 * Window for browsing and selecting files.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { windowManager } from '../core/window-manager.js';
import { t } from '../lib/i18n.js';

interface AssetFile {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface ListResponse {
  directories: string[];
  files: AssetFile[];
}

const DEFAULT_GRID_SIZE = 100;
const LS_FAVORITES = 'filepicker_favorites';
const LS_GRID_SIZE = 'filepicker_grid_size';

import { LoomHandlebarsMixin, ApplicationOptions } from './application.js';

export class FilePickerWindow extends LoomHandlebarsMixin(BaseWindow) {
  static PARTS = {
    body: { template: '/templates/generic/file-picker.hbs' }
  };

  // The mixin constructor (application.ts:69-91) reads title/icon/width/height
  // ONLY from here (static DEFAULT_OPTIONS, nested window/position format) — the
  // fields passed loosely in the super() of the instance constructor below are
  // silently ignored. Without this, this.options.title was always "",
  // triggering the "invalid title" warning in the console every time the window opened.
  static DEFAULT_OPTIONS: Partial<BaseWindowOptions> & ApplicationOptions = {
    window: { title: 'Navegador de Texturas', icon: 'fa-solid fa-images' },
    position: { width: 700, height: 680 },
  };

  private assetScope: 'world' | 'global' = 'world';
  private currentDir: string = 'uploads/';
  private selectedPath: string | null = null;
  private onSelect: ((path: string) => void) | null;
  private onDoubleClick: ((path: string) => void) | null;
  private data: ListResponse = { directories: [], files: [] };
  private loading: boolean = true;
  private viewMode: 'list' | 'grid' = 'grid';
  private gridSize: number = DEFAULT_GRID_SIZE;
  private favorites: string[] = [];
  private searchQuery: string = '';
  private worldId: string = '';

  constructor(props: {
    id?: string;
    onSelect?: (path: string) => void;
    onDoubleClick?: (path: string) => void;
    currentDir?: string;
    scope?: 'world' | 'global';
    worldId?: string;
  }) {
    // `renderChild` registra a instancia no windowManager sob o id que o chamador
    // passou (ex.: 'file-picker-bg'). Se aqui a gente ignorasse `props.id` e sempre
    // usasse 'file-picker', `this.options.id` nunca bateria com a chave real no
    // Map — todo `windowManager.close(this.options.id)` dentro desta classe mirava
    // um id que nunca existiu, então a janela nunca fechava sozinha (nem no
    // duplo-clique, nem no botão de confirmar).
    super({ id: props.id || 'file-picker' } as BaseWindowOptions);
    this.onSelect = props.onSelect ?? null;
    this.onDoubleClick = props.onDoubleClick ?? null;
    if (props.currentDir) this.currentDir = props.currentDir;
    if (props.scope) this.assetScope = props.scope;
    if (props.worldId) {
      this.worldId = props.worldId;
      if (!props.currentDir && this.assetScope === 'world') {
        this.currentDir = `worlds/${props.worldId}/assets/`;
      }
    }
    this.gridSize = parseInt(localStorage.getItem(LS_GRID_SIZE) || `${DEFAULT_GRID_SIZE}`, 10);
    try {
      const saved = localStorage.getItem(LS_FAVORITES);
      if (saved) this.favorites = JSON.parse(saved);
    } catch { /* ignore */ }
  }

  async mount(): Promise<void> {
    // Wait for the window to finish its setup and render the template
    await super.mount();
    await this.loadDir();
  }

  private async loadDir(): Promise<void> {
    this.loading = true;
    this.selectedPath = null;
    this.rerenderBody();
    try {
      this.data = await api.get<ListResponse>(
        `/assets/list?dir=${encodeURIComponent(this.currentDir)}&scope=${this.assetScope}`
      );
    } catch (e: any) {
      showToast(e?.message || 'Erro ao listar arquivos', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  private get breadcrumbParts(): { label: string; path: string }[] {
    const parts = this.currentDir === '.' ? [] : this.currentDir.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [{ label: 'Raiz', path: '.' }];
    let acc = '.';
    for (const p of parts) {
      acc = acc === '.' ? p : acc.endsWith('/') ? acc + p : acc + '/' + p;
      crumbs.push({ label: p.replace('/', ''), path: acc });
    }
    return crumbs;
  }

  private toggleFavorite(dir: string): void {
    const idx = this.favorites.indexOf(dir);
    if (idx >= 0) this.favorites.splice(idx, 1);
    else this.favorites.push(dir);
    localStorage.setItem(LS_FAVORITES, JSON.stringify(this.favorites));
    this.rerenderBody();
  }

  private get isCurrentFavorite(): boolean {
    return this.favorites.includes(this.currentDir);
  }

  protected async _prepareContext(): Promise<Record<string, any>> {
    const base = await super._prepareContext();

    const breadcrumbs = this.breadcrumbParts.map((cr, i, arr) => ({
      ...cr,
      isLast: i === arr.length - 1
    }));

    const favorites = this.favorites.map(f => ({
      path: f,
      label: f === '.' ? 'Raiz' : f.replace(/\/$/, '').split('/').pop(),
      isActive: f === this.currentDir
    }));

    const dirs = this.data.directories.map(dir => {
      const fullPath = this.currentDir === '.' ? dir : this.currentDir + dir;
      return {
        name: dir.replace('/', ''),
        rawName: dir,
        fullPath,
        isFav: this.favorites.includes(fullPath)
      };
    });

    const files = this.data.files.map(file => {
      const isImage = file.type === 'image';
      return {
        ...file,
        isSelected: this.selectedPath === file.path,
        isImage,
        previewStyle: isImage ? `background-image: url('${file.path}')` : '',
        formattedSize: file.size ? this.formatSize(file.size) : ''
      };
    });

    return {
      ...base,
      loading: this.loading,
      loadingMessage: t('common.loading') || 'Carregando...',
      breadcrumbs,
      hasFavorites: this.favorites.length > 0,
      favorites,
      dirs,
      files,
      emptyState: this.data.directories.length === 0 && this.data.files.length === 0 && this.currentDir === '.',
      assetScope: this.assetScope,
      isWorldScope: this.assetScope === 'world',
      isGlobalScope: this.assetScope === 'global',
      isCurrentFavorite: this.isCurrentFavorite,
      searchQuery: this.searchQuery,
      hasSearchQuery: !!this.searchQuery,
      gridSize: this.gridSize,
      viewMode: this.viewMode,
      isListView: this.viewMode === 'list',
      isGridView: this.viewMode === 'grid',
      currentDir: this.currentDir,
      isNotRoot: this.currentDir !== '.',
      gridSizeStyle: this.viewMode === 'grid' ? `style="--grid-size: ${this.gridSize}px"` : '',
      selectedPath: this.selectedPath,
      hasSelectedPath: !!this.selectedPath
    };
  }

  protected onRender(): void {
    this.setupSearch();
    this.setupViewMode();
    this.setupGridSize();
    this.setupUpload();
    this.setupTabs();
    this.setupDrag();
    this.setupDoubleClick();
  }

  private setupTabs(): void {
    this.element.querySelectorAll('.fp-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-tab') as 'world' | 'global';
        if (scope && scope !== this.assetScope) {
          this.assetScope = scope;
          this.currentDir = scope === 'world' && this.worldId
            ? `worlds/${this.worldId}/assets/`
            : 'uploads/';
          void this.loadDir();
        }
      });
    });
  }

  private setupSearch(): void {
    const input = this.element.querySelector<HTMLInputElement>('.search-input');
    if (!input) return;

    const doFilter = () => {
      this.searchQuery = input.value;
      const val = input.value.toLowerCase();
      this.element.querySelectorAll('.file-picker-browser .file-picker-item').forEach((item) => {
        if (item.classList.contains('nav-back-item')) return;
        const nameEl = item.querySelector('.file-picker-name');
        const name = nameEl?.textContent?.toLowerCase() || '';
        (item as HTMLElement).style.display = name.includes(val) ? '' : 'none';
      });
    };
    input.addEventListener('input', doFilter);

    this.element.querySelector('[data-action="clear-search"]')?.addEventListener('click', () => {
      input.value = '';
      this.searchQuery = '';
      doFilter();
      this.rerenderBody();
    });
  }

  private setupViewMode(): void {
    this.element.querySelectorAll('.btn-view-mode').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute('data-mode') as 'list' | 'grid';
        if (mode && mode !== this.viewMode) {
          this.viewMode = mode;
          this.rerenderBody();
        }
      });
    });
  }

  private setupGridSize(): void {
    const input = this.element.querySelector<HTMLInputElement>('.fp-grid-size-input');
    if (!input) return;
    input.addEventListener('change', () => {
      const val = parseInt(input.value, 10);
      if (val >= 40 && val <= 300) {
        this.gridSize = val;
        localStorage.setItem(LS_GRID_SIZE, `${val}`);
        const browser = this.element.querySelector('.file-picker-browser.grid-view') as HTMLElement;
        if (browser) browser.style.setProperty('--grid-size', `${val}px`);
      }
    });
  }

  private setupUpload(): void {
    const fileInput = this.element.querySelector<HTMLInputElement>('#file-picker-upload-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const statusEl = this.element.querySelector('#fp-upload-status');
      if (statusEl) statusEl.textContent = file.name;

      const formData = new FormData();
      formData.append('file', file);
      try {
        showToast('Enviando arquivo...', 'info');
        const qs = new URLSearchParams();
        if (this.worldId) qs.set('worldId', this.worldId);
        if (this.currentDir && this.currentDir !== '.') qs.set('dir', this.currentDir);

        const res = await fetch(`/api/assets/upload?${qs.toString()}`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload falhou');
        showToast('Arquivo enviado!', 'success');
        await this.loadDir();
      } catch (err: any) {
        showToast(err?.message || 'Erro ao enviar arquivo', 'error');
      }
    });

    this.element.querySelector('[data-action="trigger-upload"]')?.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      fileInput?.click();
    });
  }

  private setupDrag(): void {
    this.element.querySelectorAll('.file-item[draggable]').forEach((el) => {
      el.addEventListener('dragstart', (e: Event) => {
        const de = e as DragEvent;
        const path = el.getAttribute('data-path') || '';
        de.dataTransfer?.setData('text/plain', path);
        de.dataTransfer!.effectAllowed = 'copy';
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
      });
    });
  }

  private setupDoubleClick(): void {
    this.element.querySelectorAll('.file-item').forEach((el) => {
      el.addEventListener('dblclick', () => {
        const path = el.getAttribute('data-id');
        if (!path) return;
        if (this.onDoubleClick) {
          this.onDoubleClick(path);
        } else if (this.onSelect) {
          this.onSelect(path);
          windowManager.close(this.options.id);
        }
      });
    });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'nav-dir' && id) {
      this.currentDir = id;
      void this.loadDir();
    } else if (action === 'nav-back') {
      const parts = this.currentDir === '.' ? [] : this.currentDir.split('/').filter(Boolean);
      parts.pop();
      this.currentDir = parts.length > 0 ? parts.join('/') + '/' : '.';
      void this.loadDir();
    } else if (action === 'select-file' && id) {
      this.selectedPath = id;
      this.rerenderBody();
    } else if (action === 'toggle-fav' && id) {
      this.toggleFavorite(id);
    } else if (action === 'clear-search') {
      this.searchQuery = '';
      this.rerenderBody();
    } else if (action === 'confirm-selection') {
      if (this.selectedPath && this.onSelect) {
        this.onSelect(this.selectedPath);
        windowManager.close(this.options.id);
      }
    } else if (action === 'save') {
      if (this.selectedPath && this.onSelect) {
        this.onSelect(this.selectedPath);
        windowManager.close(this.options.id);
      }
    }
  }
}
