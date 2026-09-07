export interface TabDef {
  id: string;
  label: string;
  icon?: string;
}

export interface TabsClassNames {
  nav?: string;
  button?: string;
  buttonActive?: string;
  content?: string;
  contentActive?: string;
}

export interface TabsOptions {
  classes?: TabsClassNames;
  onChange?: (tabId: string, tabs: Tabs) => void;
}

const DEFAULT_CLASSES: Required<TabsClassNames> = {
  nav: 'tabs',
  button: 'tab-button',
  buttonActive: 'active',
  content: 'tab-content',
  contentActive: 'active',
};

/**
 * Reusable tab state + markup for components/windows.
 * Supports auto-binding via bind(htmlElement), callbacks via onChange,
 * and programmatic activation with DOM updates via activateTab().
 * 
 */
export class Tabs {
  active: string;
  private classes: Required<TabsClassNames>;
  private onChange?: (tabId: string, tabs: Tabs) => void;
  private boundElement: HTMLElement | null = null;

  constructor(
    private tabs: readonly TabDef[],
    initial?: string,
    options: TabsOptions | TabsClassNames = {},
  ) {
    this.active = initial ?? tabs[0]?.id ?? '';

    // Normalize options for backward compatibility
    let optClasses: TabsClassNames = {};
    if ('classes' in options || 'onChange' in options) {
      const opts = options as TabsOptions;
      optClasses = opts.classes || {};
      this.onChange = opts.onChange;
    } else {
      optClasses = options as TabsClassNames;
    }

    this.classes = { ...DEFAULT_CLASSES, ...optClasses };
  }

  isActive(tabId: string): boolean {
    return this.active === tabId;
  }

  set(tabId: string): void {
    if (this.tabs.some((t) => t.id === tabId)) {
      this.active = tabId;
    }
  }

  /**
   * Programmatically activate a tab.
   * Updates DOM classes on the bound element if bind() was called,
   * and triggers the onChange callback.
   */
  activateTab(tabId: string, { triggerCallback = true } = {}): void {
    if (!this.tabs.some((t) => t.id === tabId)) return;
    this.active = tabId;

    if (this.boundElement) {
      const c = this.classes;

      // Update nav buttons
      this.boundElement.querySelectorAll<HTMLElement>(`[data-action^="tab-"]`).forEach((btn) => {
        const action = btn.getAttribute('data-action')!;
        const currentTabId = action.slice(4);
        if (currentTabId === tabId) {
          btn.classList.add(c.buttonActive);
          btn.setAttribute('aria-selected', 'true');
        } else {
          btn.classList.remove(c.buttonActive);
          btn.setAttribute('aria-selected', 'false');
        }
      });

      // Update content panels
      this.boundElement.querySelectorAll<HTMLElement>(`[data-tab]`).forEach((panel) => {
        const panelTabId = panel.getAttribute('data-tab')!;
        if (panelTabId === tabId) {
          panel.classList.add(c.contentActive);
        } else {
          panel.classList.remove(c.contentActive);
        }
      });
    }

    if (triggerCallback) {
      this.onChange?.(tabId, this);
    }
  }

  /**
   * Binds click event handlers to all tab controls inside the given container.
   * Enables automatic tab switching and DOM updating without manual window handling.
   */
  bind(htmlElement: HTMLElement): void {
    this.boundElement = htmlElement;

    htmlElement.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const btn = target.closest('[data-action^="tab-"]');
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();

      const action = btn.getAttribute('data-action')!;
      const tabId = action.slice(4);
      this.activateTab(tabId);
    });
  }

  /** Consumes a data-action of the form "tab-<id>"; returns true if it switched tabs. */
  handleAction(action: string): boolean {
    if (!action.startsWith('tab-')) return false;
    const tabId = action.slice(4);
    if (!this.tabs.some((t) => t.id === tabId)) return false;
    this.activateTab(tabId);
    return true;
  }

  navTemplate(options: { iconOnly?: boolean } = {}): string {
    const c = this.classes;
    return `
      <div class="${c.nav}" role="tablist">
        ${this.tabs
        .map((t) => {
          const iconHtml = t.icon
            ? (t.icon.startsWith('fa-') || t.icon.includes('fa-'))
              ? `<i class="${t.icon}" aria-hidden="true"></i>`
              : `<span aria-hidden="true">${t.icon}</span>`
            : '';
          const body = options.iconOnly
            ? iconHtml
            : `${iconHtml}${iconHtml ? ' ' : ''}${t.label}`;
          return `
          <button
            class="${c.button} ${this.isActive(t.id) ? c.buttonActive : ''}"
            data-action="tab-${t.id}"
            role="tab"
            aria-selected="${this.isActive(t.id) ? 'true' : 'false'}"
            title="${t.label}"
          >${body}</button>`;
        })
        .join('')}
      </div>
    `;
  }

  contentWrapper(tabId: string, html: string): string {
    const c = this.classes;
    return `<div class="${c.content} ${this.isActive(tabId) ? c.contentActive : ''}" data-tab="${tabId}" role="tabpanel">${html}</div>`;
  }
}
