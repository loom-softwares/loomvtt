/*******************************************************************************
 * LoomVTT
 * client/core/sidebar-tab.ts
 *
 *
 * Base class for sidebar panel customization (chat log, compendium directory,
 * actor directory, settings, etc.) used by converted systems and addons.
 ******************************************************************************/

import { showContextMenu, type ContextMenuItem } from '../components/context-menu.js';

export type SidebarActionHandler = (event: Event, target: HTMLElement) => void;

export interface SidebarTabDefaultOptions {
  actions?: Record<string, SidebarActionHandler>;
}

/** One entry-context-menu option, resolved per right-clicked element. */
export interface SidebarEntryContextOption {
  name: string;
  icon?: string;
  /** Skip this option for a given entry element. Defaults to always shown. */
  condition?: (target: HTMLElement) => boolean;
  callback: (target: HTMLElement) => void;
  danger?: boolean;
}

/**
 * Render lifecycle for a sidebar panel: `render()` calls `_onRender()` then
 * wires up `[data-action]` clicks to whatever `DEFAULT_OPTIONS.actions` the
 * subclass declares, and `_getEntryContextOptions()` lets a subclass supply
 * right-click menu entries for `[data-entry-id]` rows without hand-rolling
 * its own listener.
 */
export class LoomSidebarTab {
  static DEFAULT_OPTIONS: SidebarTabDefaultOptions = {};

  private _actionsDelegated = false;

  constructor(..._args: any[]) {}

  get element(): HTMLElement | null {
    return document.querySelector('#sidebar');
  }

  async render(context?: any, options?: any): Promise<void> {
    await this._onRender(context, options);
    this._bindActions();
    this._bindEntryContextMenu();
  }

  /** Backward-compat entry point for callers that only invoke `_onRender` directly. */
  async _onRender(_context?: any, _options?: any): Promise<void> {}

  /** Override to supply right-click menu entries for `[data-entry-id]` rows. Empty by default. */
  _getEntryContextOptions(): SidebarEntryContextOption[] {
    return [];
  }

  private _bindActions(): void {
    const el = this.element;
    const actions = (this.constructor as typeof LoomSidebarTab).DEFAULT_OPTIONS.actions;
    if (!el || !actions) return;

    // Delegated once on the root element: chat messages (and other
    // entries) arrive after this initial render(), so a per-element
    // listener would never reach them.
    if (this._actionsDelegated) return;
    this._actionsDelegated = true;

    el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target || !el.contains(target)) return;
      const action = target.dataset.action;
      const handler = action ? actions[action] : undefined;
      if (handler) handler(event, target);
    });
  }

  private _bindEntryContextMenu(): void {
    const el = this.element;
    if (!el) return;
    const options = this._getEntryContextOptions();
    if (!options.length) return;

    el.querySelectorAll<HTMLElement>('[data-entry-id]').forEach((target) => {
      target.addEventListener('contextmenu', (event) => {
        const items: ContextMenuItem[] = options
          .filter((opt) => !opt.condition || opt.condition(target))
          .map((opt) => ({
            icon: opt.icon,
            label: opt.name,
            danger: opt.danger,
            action: () => opt.callback(target),
          }));
        if (items.length) showContextMenu(event as MouseEvent, items);
      });
    });
  }
}
