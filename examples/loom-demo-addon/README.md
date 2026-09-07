# Loom Demo Addon

A minimal, standalone addon (module) example for LoomVTT.

While `loom-demo-system` demonstrates sheet schemas and game rules, this package
demonstrates the **addon pattern**: a system-agnostic utility feature that operates
identically regardless of which ruleset (or world) is active.

## Features

- **Isolated Utility Window:** Extends `BaseWindow` directly without tying into documents or databases.
- **Client-Side Persistence:** Automatically saves text to the browser's `localStorage`.
- **Central Settings:** Configurable options via manifest (`"settings"`) and Loom's `settings.register()` / `settings.get()`.
- **Global Keybind:** `Ctrl+Shift+N` opens or focuses the Quick Notes panel.
- **Dedicated Stylesheet:** Injected automatically via the manifest's `"styles"` array.

## Directory Structure

```
loom-demo-addon/
├── addon.json          # Manifest: engine, type, name, title, version, client, styles, settings
├── main.mjs             # Client entry point: registers settings, keybinds, opens window
├── notes-window.mjs     # Class extending BaseWindow: custom UI, settings consumption, no documentId
├── styles/
│   └── system.css      # Addon styles, injected automatically
└── README.md
```

## Essential Developer Guidelines

### 1. Addons vs. Rulesets

* **Rulesets** define game systems (actors, items, sheet schemas, and rules). Only one ruleset is active per world.
* **Addons** are modular and additive. Any number of active addons can load concurrently across any world. They do not call `defineSystem()` or declare `actorTypes`/`itemTypes`.

### 2. The Manifest (`addon.json`) & Settings

The engine's package loader reads `addon.json` during boot:
- **`engine` & `type`:** Must declare `"engine": "loom"` and `"type": "addon"`.
- **`client`:** Relative path to the browser entry point (`main.mjs`).
- **`styles`:** Array of CSS files to inject. Only files explicitly listed in `"styles"` will be loaded into the page.
- **`settings`:** Array of configurable settings. Declaring settings here enables the **"Module Settings"** button in Setup Hub / Modules and allows in-game configuration:
  ```json
  "settings": [
    {
      "key": "fontSize",
      "type": "string",
      "default": "14px",
      "label": "Notes Font Size",
      "hint": "Default font size for the Quick Notes textarea",
      "scope": "client"
    }
  ]
  ```

### 3. Programmatic Settings Registration & Access

In `main.mjs`, import and register settings with the Loom SDK:
```javascript
import { settings } from '/_loom/sdk/index.js';

settings.register('loom-demo-addon', 'fontSize', {
  name: 'Notes Font Size',
  hint: 'Default font size for the Quick Notes textarea',
  scope: 'client',
  config: true,
  type: String,
  default: '14px',
});
```
Any component can then read configured values synchronously:
```javascript
const fontSize = settings.get('loom-demo-addon', 'fontSize') || '14px';
```

### 4. Why `BaseWindow` Instead of `LoomDocumentSheet`

Rulesets deal with database documents (`Actor`, `Item`) which have server REST routes (`/api/actors`, `/api/items`) and auto-save pipelines in `LoomDocumentSheet`.

Addons generally provide utility tools (calculators, notes, audio mixers, map overlays). `NotesWindow` extends `BaseWindow` directly:
- No `documentId` or database schema required.
- Does not make PUT requests to non-existent API routes.
- Persists user state in `localStorage` (or via client settings).

### 5. DOM and jQuery Compatibility in `activateListeners`

When overriding `activateListeners(html)` on `BaseWindow`:
```javascript
activateListeners(html) {
  // Safe DOM resolution: handles both native HTMLElement and jQuery wrapper
  const root = html instanceof HTMLElement ? html : (html?.[0] ?? this.element);
  const textarea = root?.querySelector('.loom-demo-notes-textarea');
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    localStorage.setItem('my-addon-key', textarea.value);
  });
}
```
LoomVTT provides global jQuery compatibility (`window.$`). When jQuery is present, `BaseWindow` may pass a jQuery collection to `activateListeners`. Using `html instanceof HTMLElement ? html : (html?.[0] ?? this.element)` ensures safe native DOM queries across all environments.

## How to Use

Copy this folder to:
`<DataRoot>/marketplace/addons/loom-demo-addon/`
and activate it in **Setup Hub → Modules**.

Press `Ctrl+Shift+N` inside any world to open the Quick Notes window.

### Scaffolding a New Addon

To create your own addon structure using the Loom CLI:

```bash
npm run create:addon -- my-addon
```

### Manifest & Code Validation

Validate the addon manifest, imports, and syntax at any time:

```bash
npm run validate:ruleset -- examples/loom-demo-addon
# or directly:
node tools/validate-system.mjs examples/loom-demo-addon
```
