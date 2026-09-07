// ══════════════════════════════════════════════════════════════
// Loom Demo Addon — notes-window.mjs
// ══════════════════════════════════════════════════════════════
//
// `extends BaseWindow` directly (NOT LoomDocumentSheet/LoomActorSheet) —
// this is the pattern for addons: a standalone panel with no actor/item
// behind it, no documentId, no auto-save-to-API. Addons run 100% client-side
// like rulesets do, so persistence here is plain localStorage, not a server
// route (no server route exists for addon data — there's nowhere to put one).
import { BaseWindow, settings } from '/_loom/sdk/index.js';

const STORAGE_KEY = 'loom-demo-addon-notes';

export class NotesWindow extends BaseWindow {
  /**
   * Initializes the quick notes window with default dimensions and options.
   * @param {Record<string, any>} [options={}] - Optional window overrides.
   */
  constructor(options = {}) {
    super({
      id: 'loom-demo-addon-notes',
      title: 'Quick Notes',
      icon: '📝',
      width: 320,
      height: 'auto',
      showFooter: false,
      ...options,
    });
  }

  /**
   * Abstract in BaseWindow — every window must implement this.
   * Returns raw HTML for the window body; re-run on every rerenderBody() call.
   * Reads configured font size from settings ('loom-demo-addon.fontSize').
   * @returns {string} Raw HTML string representing the window body.
   */
  bodyTemplate() {
    const saved = localStorage.getItem(STORAGE_KEY) || '';
    const fontSize = settings.get('loom-demo-addon', 'fontSize') || '14px';
    return `
      <div class="loom-demo-notes">
        <textarea class="loom-demo-notes-textarea" style="font-size: ${this.esc(fontSize)};" placeholder="Type anything...">${this.esc(saved)}</textarea>
      </div>
    `;
  }

  /**
   * Called after every render (base-window.ts calls this with the mounted element).
   * The right place to wire listeners the generic data-action click delegation
   * doesn't cover, like a plain 'input' event.
   *
   * Note for developers: If jQuery is globally loaded, BaseWindow passes a jQuery
   * wrapper to activateListeners. Resolving `root` via `html?.[0] ?? html` ensures
   * safe querySelector access regardless of whether html is a raw DOM node or jQuery object.
   * @param {HTMLElement|any} html - The mounted root DOM element or jQuery collection.
   * @returns {void}
   */
  activateListeners(html) {
    const root = html instanceof HTMLElement ? html : (html?.[0] ?? this.element);
    const textarea = root?.querySelector('.loom-demo-notes-textarea');
    if (!textarea) return;
    textarea.addEventListener('input', () => {
      localStorage.setItem(STORAGE_KEY, textarea.value);
    });
  }

  /**
   * Minimal HTML-escape — BaseWindow doesn't provide one for free outside
   * LoomDocumentSheet subclasses.
   * @param {any} text - Value to escape for HTML rendering.
   * @returns {string} Safely escaped string.
   */
  esc(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
