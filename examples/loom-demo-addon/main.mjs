// ══════════════════════════════════════════════════════════════
// Loom Demo Addon — client-side entry point
// ══════════════════════════════════════════════════════════════
//
// An addon is ruleset-agnostic: it works no matter which ruleset is active
// (or none at all). This is why it has no actorTypes/itemTypes/defineSystem()
// — it isn't a system, it's a standalone feature. Unlike a ruleset, an addon
// CAN run server-side too — see core.js (declared via addon.json's "core"
// field) for the database + REST API half of this same addon.
import { keybinds, windowManager, settings } from '/_loom/sdk/index.js';
import { NotesWindow } from './notes-window.mjs';

// ── Settings registration ────────────────────────────────────
// Registers settings with Loom's central settings registry.
// Settings declared in addon.json also appear in Setup Hub / Module Settings.
settings.register('loom-demo-addon', 'fontSize', {
  name: 'Notes Font Size',
  hint: 'Default font size for the Quick Notes textarea',
  scope: 'client',
  config: true,
  type: String,
  default: '14px',
});

// `windowManager.open(id, Class, props)` opens a new window, or focuses the
// existing one if that id is already open — no extra "is it open?" check
// needed for a simple open/focus shortcut like this.
keybinds.register({
  id: 'loom-demo-addon-notes',
  label: 'Open Quick Notes',
  description: "Opens the demo addon's notes panel",
  defaultKey: 'Ctrl+Shift+N',
  category: 'Loom Demo Addon',
  /**
   * Dispatches windowManager.open to show or focus the quick notes window.
   * @returns {void}
   */
  onPress: () => {
    windowManager.open('loom-demo-addon-notes', NotesWindow, {});
  },
});

console.log('[Loom Demo Addon] Loaded!');
