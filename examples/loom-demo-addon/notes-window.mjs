// ══════════════════════════════════════════════════════════════
// Loom Demo Addon — notes-window.mjs
// ══════════════════════════════════════════════════════════════
//
// `extends BaseWindow` directly (NOT LoomDocumentSheet/LoomActorSheet) —
// this is the pattern for addons: a standalone panel with no actor/item
// behind it, no documentId, no auto-save-to-API for a whole document.
//
// The note text itself IS persisted server-side though — via `api.get`/
// `api.put` against this same addon's own REST route (GET/PUT
// /api/addons/loom-demo-addon/notes), which core.js registers and backs
// with a real database table. See core.js for that half; from here it's
// just two fetch calls, same as any core window talking to `/api/actors`
// or `/api/items`.
import { BaseWindow, settings, api } from '/_loom/sdk/index.js';

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
    this.text = '';
    this.loaded = false;
  }

  /**
   * Called once the window's DOM element exists (base-window.ts convention
   * — see CompendiumSourceWindow for the same shape). Kicks off the fetch
   * from here, not the constructor, since `rerenderBody()` needs a mounted
   * element to write into.
   * @returns {Promise<void>}
   */
  async mount() {
    super.mount();
    await this.load();
  }

  /**
   * Fetches the current note text from this addon's own server route.
   * Rerenders the body once the response lands.
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const res = await api.get('/addons/loom-demo-addon/notes');
      this.text = res?.text ?? '';
    } catch {
      // No active world session yet, or the route isn't reachable — the
      // textarea just starts empty instead of throwing.
    } finally {
      this.loaded = true;
      this.rerenderBody();
    }
  }

  /**
   * Abstract in BaseWindow — every window must implement this.
   * Returns raw HTML for the window body; re-run on every rerenderBody() call.
   * Reads configured font size from settings ('loom-demo-addon.fontSize').
   * @returns {string} Raw HTML string representing the window body.
   */
  bodyTemplate() {
    const fontSize = settings.get('loom-demo-addon', 'fontSize') || '14px';
    return `
      <div class="loom-demo-notes">
        <textarea class="loom-demo-notes-textarea" style="font-size: ${this.esc(fontSize)};" placeholder="Type anything..." ${this.loaded ? '' : 'disabled'}>${this.esc(this.text)}</textarea>
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
    // Debounced save — one PUT per pause in typing, not one per keystroke.
    let saveTimer = null;
    textarea.addEventListener('input', () => {
      this.text = textarea.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void api.put('/addons/loom-demo-addon/notes', { text: this.text });
      }, 400);
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
