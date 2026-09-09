# System Creation (Rulesets)

Systems (rulesets) define the game rules: actor/item types, default data, validation, sheets.

## Structure

```
<DataRoot>/marketplace/rulesets/my-system/
├── ruleset.json    ← manifest
├── client.js       ← client-side entry point (the only code entry point that exists)
└── templates/      ← sheet templates, `.hbs` extension
```

> **Rulesets DO NOT have `core.js`.** Unlike addons, RPG systems run
> **100% client-side** — even if you declare `"core": "core.js"` in the manifest, the
> `AddonLoader` (`server/applications/addons/loader.ts`) detects that it is a `ruleset` and
> purposely ignores this field, just logging a warning. This is a deliberate security
> block, not a limitation to be bypassed: a `core.js` would run in the same Node
> process as the server, without a sandbox, with full access to `process.env`/database/filesystem —
> a third-party system shouldn't have that reach. (`core.js` only truly exists for
> **addons**, which are first/second-hand content, not just any pluggable systems.)
>
> Practical consequence: anything the **server** needs to know about your
> system (e.g., what item types are valid, see `itemTypes` below) must be
> declared as **static JSON in `ruleset.json`**, never in `client.js` logic —
> the server never executes that file.

> **Template extension is `.hbs`.** The render engine (`renderTemplate()`) does no extension
> rewriting — the file on disk must match exactly the path declared in `template:` (or `PARTS`).
> A mismatched path hits the dev server's SPA HTML fallback instead of the real template, and the
> render fails with `"[renderTemplate] ... returned HTML (likely dev server fallback, not the
> actual template)"`.

## Manifest (`ruleset.json`)

```json
{
  "name": "my-system",
  "title": "My System",
  "version": "1.0.0",
  "engine": "loom",
  "type": "ruleset",
  "engineVersion": ">=0.1.0",
  "author": "Your Name",
  "repository": "https://github.com/user/my-system",
  "description": "A complete system for LoomVTT.",
  "manifest": "https://github.com/user/my-system/releases/latest/download/ruleset.json",
  "download": "https://github.com/user/my-system/releases/latest/download/my-system.zip",
  "backgroundUrl": "https://mysite.com/background.jpg",
  "coverUrl": "https://mysite.com/cover.jpg",
  "active": true,
  "client": "client.js",
  "styles": ["styles/my-system.css"],
  "signals": ["my-custom-signal"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "dependencies": [],
  "conflicts": [],
  "compendiums": [
    "compendiums/classes.sqlite",
    { "type": "remote", "apiUrl": "https://xxxx.supabase.co/rest/v1", "apiKeyEnvVar": "MY_PUBLISHER_DB_KEY" }
  ]
}
```

| Field            | Type             | Description                                 |
| ---------------- | ---------------- | ------------------------------------------- |
| `name`         | `string`       | Unique identifier (letters, num, `_`, `-` only) |
| `title`        | `string`       | Display name                          |
| `version`      | `string`       | Semver                                      |
| `engine`       | `"loom"`       | **Required**. Defines that the package is for LoomVTT |
| `type`         | `"ruleset"`    | **Required**. Defines that it is a system    |
| `engineVersion`| `string`       | Required version range — min and/or max, e.g. `>=0.1.0`, `<2.0.0`, or `>=1.0.0 <2.0.0` |
| `author`       | `string`       | Author name                              |
| `repository`   | `string`       | Repository/source code URL            |
| `description`  | `string`       | Package description                       |
| `manifest`     | `string`       | Remote URL of this `ruleset.json` for auto-update |
| `download`     | `string`       | `.zip` URL for download during installation |
| `backgroundUrl`| `string`       | URL for background image in the Setup Hub      |
| `coverUrl`     | `string`       | URL for cover image (if applicable)      |
| `active`       | `boolean`      | Whether globally enabled (default: true)      |
| `client`       | `string`       | Client-side entry point (`.js`)           |
| `core`         | `string`       | **NOT USED**. (Systems run only on the client) |
| `styles`       | `string[]`     | Array of paths for CSS files          |
| `compendiums`  | `(string \| RemoteCompendiumSource)[]` | Local `.sqlite` pack paths, or remote source declarations |
| `languages`    | `Array`        | Array of language definitions (`lang`, `name`, `path`) |
| `signals`      | `string[]`     | Signal names that this system listens to      |
| `dependencies` | `string[]`     | Addons/systems that must be active      |
| `conflicts`    | `string[]`     | Addons/systems that MUST NOT be active |

- `engineVersion`: Informational, not a hard gate. Bare integers work (`"1"`, `">=2"`),
  and an unparseable clause is logged and ignored rather than blocking install. A version
  genuinely outside the declared range still installs — the installer returns a
  non-fatal `warning` string (shown as a toast) instead of refusing.
- `itemTypes`: Optional array with the extra item types that this system uses (e.g.,
  `["force-power", "talent", "class", "species"]`). **Required even if already declaring
  `itemTypes` in `defineSystem({...})` within `client.js`** — rulesets never execute code on
  the server (see `server/applications/addons/loader.ts`, it's a security block, not a bug),
  so the type validation in `POST/PUT /api/items` only sees what is here, in this
  static JSON. Types outside the native list (`weapon, spell, armor, equipment, consumable,
  tool, treasure, other`) and outside this array are silently downgraded to `equipment`.
- `compendiums`: Optional array of compendium sources, read live and browse-only — **never** copied into a world's database on activation. Each GM decides, per entry, whether to materialize it into their own world (drag-and-drop, or the "save to my compendium" action), which writes exactly that one entry, never the whole pack. Two kinds of entry:
  - **Local** — a plain string, the path (relative to the addon/ruleset folder) to a `.sqlite` file with a `pack_meta` table (1 row: `name`, `type`) and an `entries` table (`id`, `name`, `type`, `sortOrder`, `imgUrl`, `data`). Build one with `scripts/build-compendium-pack.mjs`.
  - **Remote** — an object `{ "type": "remote", "apiUrl": "...", "apiKeyEnvVar": "..." }`, for content hosted by a third party (e.g. a paid addon a publisher maintains on their own database). `apiUrl` must be an `https://` endpoint speaking the PostgREST contract (Supabase's auto-generated REST API works out of the box if the publisher names their tables/views `pack_meta`/`entries` with the columns above) — `http://` is rejected outright. **The credential itself never goes in the manifest** — `apiKeyEnvVar` is only the *name* of an environment variable that whoever installs the addon sets in their own server's `.env`, holding the key the publisher gave them out-of-band. See [Remote compendium sources: security model](#remote-compendium-sources-security-model) below before shipping one of these.
- `languages`: Optional array with system language packs. The VTT loads the JSON and performs automatic registration (using *deep merge*) to populate the `Loom.i18n` object.
- `styles`: Optional array with paths (relative to the ruleset folder) of `.css` files
  to inject. **Having the files in the `styles/` folder is not enough** — only what is
  listed here actually becomes a `<link rel="stylesheet">` (`injectPackageStyles()` in
  [`addon-client-loader.ts`](../../client/core/addon-client-loader.ts) only injects what is
  in this array). Forgetting to declare here is the most common reason for "the sheet renders but
  with no styles applied".

### Remote compendium sources: security model

A remote compendium source is real network access to a third party's database, gated by
a real credential — treat declaring one with the same care as any other integration that
holds someone else's secret. What the core actually guarantees, and what stays out of its
control:

- **The credential never travels through the manifest, a request, or a response.** The
  addon's `addon.json`/`ruleset.json` only ever carries `apiKeyEnvVar` (a *name*). The
  actual value is read server-side from `process.env` once, at boot, before any addon's
  own code (`core`) is imported — then deleted from `process.env` and kept only in a
  private map inside `server/applications/addons/compendium-source.ts`
  (`getScrubbedEnvVar`). No other addon loaded afterwards — malicious or not — can read it,
  even though every addon still runs in the same server process.
- **`http://` is refused.** `assertSecureApiUrl()` in `compendium-source.ts` rejects any
  `apiUrl` that isn't `https://`, so the key can't be sniffed in transit.
- **Browsing a remote source requires `compendiumEdit` (GM), not just being logged in.**
  Every `/api/compendium/sources*` route enforces this — otherwise any player account on
  the world could loop the endpoint and have the server proxy the entire paid pack on
  their behalf, not just what the GM licensed.
- **Remote-sourced content is escaped before rendering.** `name`, `imgUrl`, etc. come back
  as untrusted third-party data and are HTML-escaped (see `escapeHtml`/`safeImgUrl` in
  `client/windows/compendium-source-window.ts` and `sidebar.ts`) before going into any
  `innerHTML` template — a compromised publisher endpoint can't inject script into a GM's
  client just by returning malicious `name`/`imgUrl` values.

What this does **not** cover, because it isn't ours to cover:
- **The publisher's own database/backend security** (RLS policies, who else has the
  service key, rate limiting, audit logging) is entirely on the publisher. Recommend they
  issue a scoped, read-only key per license — never their Supabase `service_role` key —
  so a leaked key exposes only that one pack, not their whole project.
- **The machine running the Loom server** (the `.env` file lives on whoever installed the
  addon's own disk). Anyone with filesystem/root access to *that* machine can read it —
  same as any other secret in any other app. Protecting that machine is the operator's
  job, not something the core can enforce remotely.
- **A malicious addon's own arbitrary code isn't sandboxed** from the rest of the server
  process — every addon `core` entry point already runs with full server privilege
  (filesystem, DB, network) regardless of the compendium feature. The env-var scrub above
  closes the *specific* leak of one addon reading another's remote-source key; it is not
  process isolation. Only install addons from sources you trust.

## System Registration

> **Load order guarantee:** `client.js` is only imported (via dynamic `import()`,
> in [`addon-client-loader.ts`](../../client/core/addon-client-loader.ts)) after
> `window.Loom` is already 100% initialized — the app boot (`main.ts`) finishes well before the
> game screen (which is what triggers loading systems/addons) even mounts. In other words:
> **there is no need** to check `if (window.Loom?.sheets)` or wait/poll before using
> `window.Loom.*` at the top of `client.js`, including in `class X extends window.Loom.LoomActorSheet`.
> If this ever ceases to be guaranteed, this note will be updated — until then, treat it as a
> stable engine contract.

In `client.js`, the system registers via `SystemRegistry`:

```javascript
import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'my-system',
  title: 'My System',
  version: '1.0.0',

  // Actor and item types that this system defines
  actorTypes: ['character', 'npc', 'monster'],
  itemTypes: ['weapon', 'armor', 'spell', 'feature'],

  // Default data for each type
  getDefaultData(type) {
    if (type === 'character') {
      return {
        hp: { value: 10, max: 10 },
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      };
    }
    return {};
  },

  // Data validation
  validateData(type, data) {
    const errors = [];
    if (data.hp?.value > data.hp?.max) errors.push('HP cannot exceed maximum');
    return { valid: errors.length === 0, errors };
  },

  // ⚠️ Initiative roll — DECLARED BUT NOT INVOKED
  // See the "LoomSystem interface" section below for details.
  rollInitiative(actor) {
    return { formula: '1d20', total: Math.floor(Math.random() * 20) + 1 };
  },

  // Actor sheet schema
  getSheetSchema(actorType) {
    return {
      tabs: [{
        id: 'main',
        label: 'Main',
        fields: [
          { key: 'hp.value', label: 'HP', type: 'number' },
          { key: 'hp.max', label: 'Max HP', type: 'number' },
        ],
      }],
    };
  },

  // Item sheet schema
  getItemSheetSchema(itemType) {
    return { tabs: [{ id: 'main', label: 'General', fields: [] }] };
  },
}));
```

### LoomSystem interface

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  /**
   * ⚠️ **Declared in the interface, but NOT invoked by the engine** (checked on client and
   * server — no call site exists). Do not expect it to be called automatically when
   * starting combat. To customize initiative, use `Loom.settings.get(systemId, 'initiativeFormula')`.
   */
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}
```

## Activation

1. Upload the system to `<DataRoot>/marketplace/rulesets/my-system/`
2. In the Setup Hub > Systems, activate the system (or `POST /api/marketplace/install`)
3. In the world, set `world.system = 'my-system'`
4. Upon connecting, the server loads the system and the client imports `client.js`

## Custom sheets (optional)

If `getSheetSchema` is not enough, you can extend sheet classes:

```javascript
const { sheets } = window.Loom;

class MyActorSheet extends sheets.get('actor', '*') {
  // IMPORTANT: the `windowManager` stores each open window in its own key
  // (the first argument to `windowManager.open(id, SheetClass, props)`) — throughout
  // the engine this key is always `actor-sheet-<id>` (or `item-sheet-<id>`
  // for item sheets). The `id` that you pass to `super()` down below
  // MUST match this same key, otherwise the close button (and any
  // other call to `windowManager.close(this.options.id)`) fails
  // silently — no console error, it just doesn't close anything, because the
  // sought key does not exist in the manager's internal registry.
  constructor(props) {
    super({ id: props.id || `actor-sheet-${props.actorId}`, actorId: props.actorId });
  }

  // Customize the sheet
}
sheets.catalog('actor', 'character', MyActorSheet);
```
