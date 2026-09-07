export interface CardGridItem {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  meta?: string;
  tags?: string[];
  type?: string;
  progress?: { percent: number; label: string };
  author?: string;
  repository?: string;
}

export interface CardGridOptions {
  storageKey: string;
  onCardClick?: (item: CardGridItem) => void;
  onCardContextMenu?: (item: CardGridItem, event: MouseEvent) => void;
  onCardPlay?: (item: CardGridItem) => void;
}

export class CardGrid {
  private viewMode: 'cards' | 'grid' | 'list';
  private cardListeners = new Map<
    string,
    { click: EventListener; contextmenu: EventListener }
  >();

  constructor(
    private container: HTMLElement,
    private items: CardGridItem[],
    private options: CardGridOptions,
  ) {
    this.viewMode =
      (localStorage.getItem(`viewMode.${options.storageKey}`) as any) ||
      'cards';
  }

  setItems(items: CardGridItem[]): void {
    this.items = items;
    this.render();
  }

  setViewMode(mode: 'cards' | 'grid' | 'list'): void {
    this.viewMode = mode;
    localStorage.setItem(`viewMode.${this.options.storageKey}`, mode);
    this.render();
  }

  toggleViewMode(): 'cards' | 'grid' | 'list' {
    const modes: ('cards' | 'grid' | 'list')[] = ['cards', 'list', 'grid'];
    const nextMode = modes[(modes.indexOf(this.viewMode) + 1) % modes.length];
    this.setViewMode(nextMode);
    return nextMode;
  }

  getViewMode(): 'cards' | 'grid' | 'list' {
    return this.viewMode;
  }

  render(): void {
    this.cardListeners.forEach(({ click, contextmenu }, itemId) => {
      const pkg = this.container.querySelector(
        `.package[data-id="${itemId}"]`,
      );
      if (pkg) {
        pkg.removeEventListener('click', click);
        pkg.removeEventListener('contextmenu', contextmenu);
      }
    });
    this.cardListeners.clear();

    const listClass = `package-list view-${this.viewMode}`;
    this.container.innerHTML = `<ol class="${listClass}" role="list" aria-label="Lista de itens"></ol>`;
    const list = this.container.querySelector('.package-list')!;

    this.items.forEach((item) => {
      const pkg = document.createElement('li');
      const typeClass = item.type ? ` ${item.type}` : '';
      pkg.className = `package${typeClass}`;
      pkg.setAttribute('data-id', item.id);
      pkg.setAttribute('role', 'listitem');
      pkg.setAttribute('tabindex', '0');

      let html = '';

      html += `<div class="package-cover">`;
      if (item.coverUrl) {
        const url = this.isSafeUrl(item.coverUrl) ? item.coverUrl : '';
        if (url) {
          html += `<img class="thumbnail" src="${url}" alt="${this.escapeHtml(item.name)}" loading="lazy">`;
        }
      }
      if (this.options.onCardPlay) {
        html += `<a class="control play" href="#" role="button" aria-label="Play ${this.escapeHtml(item.name)}"><span class="card-play-icon">▶</span></a>`;
      }
      html += `</div>`; // Close .package-cover

      html += `<div class="package-info">`;
      html += `<h3 class="package-title">${this.escapeHtml(item.name)}</h3>`;

      if (item.meta || item.author || item.repository || (item.tags && item.tags.length > 0)) {
        html += `<div class="package-meta">`;
        if (item.meta) {
          html += `<span class="badge neutral">${this.escapeHtml(item.meta)}</span>`;
        }
        if (item.author) {
          html += `<span class="badge neutral" title="Autor: ${this.escapeHtml(item.author)}"><i class="fa-solid fa-user"></i> ${this.escapeHtml(item.author)}</span>`;
        }
        if (item.repository) {
          const repoSafe = this.isSafeUrl(item.repository) ? item.repository : '#';
          html += `<a href="${repoSafe}" target="_blank" rel="noopener noreferrer" class="badge neutral repo-link" title="Ir para o Repositório" style="color: inherit; text-decoration: none;" onclick="event.stopPropagation()"><i class="fa-brands fa-github"></i></a>`;
        }
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach((tag) => {
            html += `<span class="badge neutral">${this.escapeHtml(tag)}</span>`;
          });
        }
        html += `</div>`;
      }

      // Extracts only pure text (removes HTML tags like <p>)
      let pureText = '';
      if (item.description) {
        const tmp = document.createElement('div');
        tmp.innerHTML = item.description;
        pureText = tmp.textContent || tmp.innerText || '';
      }
      
      const descText = pureText.trim() ? this.escapeHtml(pureText) : 'Sem descrição';
      html += `<div class="package-description">${descText}</div>`;

      pkg.innerHTML = html;

      const clickHandler = (e: Event) => {
        if (item.progress) return;
        const me = e as MouseEvent;
        if ((me.target as HTMLElement).closest('.control.play')) {
          this.options.onCardPlay?.(item);
        } else {
          this.options.onCardClick?.(item);
        }
      };

      const contextMenuHandler = (e: Event) => {
        const me = e as MouseEvent;
        me.preventDefault();
        this.options.onCardContextMenu?.(item, me);
      };

      const keyHandler = (e: Event) => {
        if (item.progress) return;
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          this.options.onCardClick?.(item);
        }
      };

      pkg.addEventListener('click', clickHandler);
      pkg.addEventListener('contextmenu', contextMenuHandler);
      pkg.addEventListener('keydown', keyHandler);
      this.cardListeners.set(item.id, {
        click: clickHandler,
        contextmenu: contextMenuHandler,
      });

      list.appendChild(pkg);
    });
  }

  private isSafeUrl(url: string): boolean {
    // Same-origin relative path (e.g. /uploads/bg.png) — format returned by asset upload
    if (url.startsWith('/') && !url.startsWith('//')) {
      return true;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
