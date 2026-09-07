/*******************************************************************************
 * LoomVTT
 * client/core/text-enricher.ts
 * Component Version: 1.0.0
 *
 * Text->HTML enrichment (`@UUID[...]`, inline rolls) already exists — see
 * `enrichHTML` in main.ts, exposed at `Loom.applications.ux.TextEditor
 * .implementation.enrichHTML`. What's missing is the OTHER half: a click
 * handler that makes the `a.doc-link`/`span.inline-roll` markup it produces
 * actually clickable outside the journal window. `journal-window.ts` has its
 * own private `_handleRichTextClick`, bound only to its own element — an
 * item/actor sheet description field enriched with `Loom.applications.ux
 * .TextEditor.implementation.enrichHTML` had no click behavior at all.
 * This adds a single document-level delegated listener for the rest of the
 * app, reusing the exact `a.doc-link`/`span.inline-roll` class + data-attribute
 * contract the journal window already established.
 ******************************************************************************/

import { windowManager } from './window-manager.js';
import { sheetCatalog } from './sheet-catalog.js';
import { ActorSheetWindow } from '../windows/actor-sheet-window.js';
import { ItemSheetWindow } from '../windows/item-sheet-window.js';
import { dispatchRoll } from '../screens/game-hud/roll-dispatch.js';
import { wsClient } from './ws-client.js';

let handlersBound = false;

/**
 * Delegated click listener for `a.doc-link` / `span.inline-roll` anywhere in
 * the document (Regra 3 do CLAUDE.md — um único listener, nunca por
 * elemento) — call once at boot. Idempotent: a second call is a no-op.
 * `journal-window.ts` stops propagation on its own matching clicks (see its
 * `_handleRichTextClick`), so this never double-fires for journal pages.
 */
export function bindContentEnricherHandlers(): void {
  if (handlersBound) return;
  handlersBound = true;

  document.addEventListener('click', (e) => {
    // `<prose-mirror>` (item/actor description fields) renders its display
    // content inside a Shadow DOM (`attachShadow({mode:'open'})` — see
    // prose-mirror-element.ts). Outside the shadow tree, `e.target` is
    // retargeted to the shadow HOST (the `<prose-mirror>` element itself),
    // never the inner `a.doc-link`/`span.inline-roll` — `.closest()` on it
    // would silently find nothing. `composedPath()` returns the real
    // ancestor chain, innermost first, crossing shadow boundaries, so this
    // still finds the actual clicked element there.
    const path = e.composedPath();
    const findInPath = (selector: string): HTMLElement | null => {
      for (const el of path) {
        if (el instanceof HTMLElement && el.matches(selector)) return el;
      }
      return null;
    };

    const docLink = findInPath('a.doc-link');
    if (docLink) {
      e.preventDefault();
      const docType = docLink.dataset.docType;
      const docId = docLink.dataset.docId;
      if (!docType || !docId) return;
      const SheetClass = sheetCatalog.get(docType, '*') ||
        (docType === 'actor' ? ActorSheetWindow : docType === 'item' ? ItemSheetWindow : null);
      if (!SheetClass) return;
      void windowManager.open(`${docType}-sheet-${docId}`, SheetClass as any, { [`${docType}Id`]: docId });
      return;
    }

    const inlineRoll = findInPath('span.inline-roll');
    if (inlineRoll) {
      const formula = inlineRoll.dataset.formula;
      if (!formula) return;
      const session = wsClient.session;
      dispatchRoll({
        worldId: session?.worldId || '',
        userId: session?.userId || '',
        userName: session?.userName || 'Anonymous',
        userColor: session?.userColor || '#888',
        formula,
      });
    }
  });
}
