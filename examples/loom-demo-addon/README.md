# Loom Demo Addon

A didactic, standalone addon example for LoomVTT — covering both halves of an
addon: the client-side UI (`main.mjs`/`notes-window.mjs`) and the server-side
half most examples skip (`core.js`): a real database table and a real REST
API the addon defines itself.

While `loom-demo-system` demonstrates sheet schemas and game rules, this
package demonstrates the **addon pattern**: a ruleset-agnostic utility
feature that operates identically regardless of which ruleset (or world) is
active, backed by its own data.

## Features

- **Isolated Utility Window:** Extends `BaseWindow` directly, not tied to any actor/item document.
- **Server-Side Persistence:** A real database table (`loom_demo_addon_notes`), created and queried by the addon's own `core.js` — not `localStorage`.
- **Its Own REST API:** `GET`/`PUT /api/addons/loom-demo-addon/notes`, registered via `registerAddonRoutes()`.
- **Reacts to Core Signals:** Logs a line whenever the core broadcasts `cast.created` — no route needed for that half.
- **Central Settings:** Configurable options via manifest (`"settings"`) and Loom's `settings.register()` / `settings.get()`.
- **Global Keybind:** `Ctrl+Shift+N` opens or focuses the Quick Notes panel.
- **Dedicated Stylesheet:** Injected automatically via the manifest's `"styles"` array.

## Directory Structure

```text
loom-demo-addon/
├── addon.json          # Manifest: engine, type, name, title, version, core, client, styles, settings
├── core.js              # Server entry point: own DB table, own REST route, Signal.listen example
├── main.mjs             # Client entry point: registers settings, keybinds, opens window
├── notes-window.mjs     # Class extending BaseWindow: fetches/saves notes via the addon's own API
├── styles/
│   └── system.css      # Addon styles, injected automatically
└── README.md
```

## Essential Developer Guidelines

### 1. Addons vs. Rulesets

* **Rulesets** define game systems (actors, items, sheet schemas, and rules). Only one ruleset is active per world. Rulesets are **client-only** — a ruleset's `core.js` field, if present, is ignored on purpose (security boundary, not a bug — see `server/applications/addons/loader.ts`).
* **Addons** are modular and additive. Any number of active addons can load concurrently across any world. They do not call `defineSystem()` or declare `actorTypes`/`itemTypes`. Unlike rulesets, **an addon's `core.js` DOES run** — server-side, once, at boot, in the same Node process as the rest of the app.

### 2. The Manifest (`addon.json`) & Settings

The engine's package loader reads `addon.json` during boot:
- **`engine` & `type`:** Must declare `"engine": "loom"` and `"type": "addon"`.
- **`core`:** Relative path to the server entry point (`core.js`) — omit this field entirely if your addon is client-only (most simple ones are).
- **`client`:** Relative path to the browser entry point (`main.mjs`).
- **`styles`:** Array of CSS files to inject. Only files explicitly listed in `"styles"` will be loaded into the page.
- **`settings`:** Array of configurable settings. Declaring settings here enables the **"Edit Package"**/settings entry point in Setup Hub → Addons and allows in-game configuration:

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

### 3. Server-Side & Database (`core.js`)

This is the part most addon examples skip. `core.js` runs **once**, at server
boot, imported the same way `server/index.ts` imports everything else — full
access to the database and every internal server module, **no sandbox**.
That's real power, and it's why installing a third-party addon is
equivalent to trusting it with the whole server, not just a UI plugin slot.

**Your own database table.** LoomVTT is relational end to end (knex, over
SQLite or Postgres depending on the world's config) — there's no NoSQL
client wired into the app to reach for, and there shouldn't be one. `db` is
a knex instance that always points at whichever world is currently active
(the server runs one world's database at a time):

```javascript
import { db } from '../../../server/applications/database/db.js';

async function ensureTable() {
  if (!(await db.schema.hasTable('loom_demo_addon_notes'))) {
    await db.schema.createTable('loom_demo_addon_notes', (t) => {
      t.string('worldId').primary();
      t.text('text').defaultTo('');
      t.timestamps(true, true, true);
    });
  }
}
```

No lifecycle hook fires specifically for "a world's database just became
ready" — check-and-create the table lazily, the first time a route actually
needs it (`ensureTable()` above is called at the top of each route handler
in `core.js`). It's one cheap metadata query after the first call.

**Your own REST API.** The main Express `app` is never exported to addon
code on purpose — handing out the raw app instance would let an addon
override core routes or slip middleware in ahead of auth. Instead,
`registerAddonRoutes()` mounts your router under your own namespace,
`/api/addons/<your-addon-name>/*`, with `requireAuth` already applied:

```javascript
import { Router } from 'express';
import { registerAddonRoutes } from '../../../server/applications/addons/addon-api.js';

const router = Router();
router.get('/notes', async (req, res) => {
  const worldId = req.auth?.worldId;
  // ...
});
registerAddonRoutes('loom-demo-addon', router);
```

The client calls it exactly like any core endpoint:

```javascript
import { api } from '/_loom/sdk/index.js';
const { text } = await api.get('/addons/loom-demo-addon/notes');
await api.put('/addons/loom-demo-addon/notes', { text: 'updated' });
```

**Reacting to what the core already broadcasts.** The other extension
point, no route involved — `Signal` is a plain server-side `EventEmitter`
(`server/applications/signals/index.ts`); it never reaches the browser by
itself. Listen for anything the core calls `Signal.broadcast(...)` on (grep
`server/applications/api/*.ts` for examples):

```javascript
import { Signal } from '../../../server/applications/signals/index.js';
Signal.listen('cast.created', (data) => {
  console.log('A cast member was created:', data?.id);
});
```

### 4. Programmatic Settings Registration & Access

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

### 5. Why `BaseWindow` Instead of `LoomDocumentSheet`

Rulesets deal with database documents (`Actor`, `Item`) which have server REST routes (`/api/actors`, `/api/items`) and auto-save pipelines in `LoomDocumentSheet`.

Addons generally provide utility tools (calculators, notes, audio mixers, map overlays) that aren't a document in that sense — but as shown above, they can absolutely still persist to a real database, just through a route the addon defines itself instead of the document pipeline. `NotesWindow` extends `BaseWindow` directly:
- No `documentId` or document schema required.
- Talks to its own addon route (`/api/addons/loom-demo-addon/notes`), not `/api/actors` or `/api/items`.
- No client-side fallback storage needed once the server route exists — this example doesn't use `localStorage` at all.

### 6. DOM and jQuery Compatibility in `activateListeners`

When overriding `activateListeners(html)` on `BaseWindow`:

```javascript
activateListeners(html) {
  // Safe DOM resolution: handles both native HTMLElement and jQuery wrapper
  const root = html instanceof HTMLElement ? html : (html?.[0] ?? this.element);
  const textarea = root?.querySelector('.loom-demo-notes-textarea');
  if (!textarea) return;
  textarea.addEventListener('input', () => { /* ... */ });
}
```

LoomVTT provides global jQuery compatibility (`window.$`). When jQuery is present, `BaseWindow` may pass a jQuery collection to `activateListeners`. Using `html instanceof HTMLElement ? html : (html?.[0] ?? this.element)` ensures safe native DOM queries across all environments.

## How to Use

Copy this folder to:
`<DataRoot>/marketplace/addons/loom-demo-addon/`
and activate it in **Setup Hub → Addons**.

Press `Ctrl+Shift+N` inside any world to open the Quick Notes window. What
you type is saved to that world's own database (debounced ~400ms after you
stop typing) and reloaded next time you open the panel.

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
