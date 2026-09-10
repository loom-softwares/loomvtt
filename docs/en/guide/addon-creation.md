# Addon Creation

Addons are packages that extend LoomVTT with additional functionality.

## Structure

```
<DataRoot>/marketplace/addons/my-addon/
├── addon.json     ← manifest (required)
└── client.js      ← client-side entry point (optional)
```

## Manifest (`addon.json`)

```json
{
  "name": "my-addon",
  "title": "My Addon",
  "version": "1.0.0",
  "engine": "loom",
  "type": "addon",
  "engineVersion": ">=0.1.0",
  "author": "Your Name",
  "repository": "https://github.com/user/my-addon",
  "description": "An awesome addon for LoomVTT.",
  "manifest": "https://github.com/user/my-addon/releases/latest/download/addon.json",
  "download": "https://github.com/user/my-addon/releases/latest/download/my-addon.zip",
  "backgroundUrl": "https://mysite.com/background.jpg",
  "coverUrl": "https://mysite.com/cover.jpg",
  "active": true,
  "core": "core.js",
  "client": "client.js",
  "mount": "my-addon-root",
  "styles": ["styles/my-addon.css"],
  "signals": ["my-addon-signal"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "dependencies": ["another-addon"],
  "conflicts": [],
  "settings": [
    {
      "key": "darkMode",
      "type": "boolean",
      "default": false,
      "label": "Dark mode",
      "scope": "world"
    }
  ]
}
```

| Field            | Type             | Description                                 |
| ---------------- | ---------------- | ------------------------------------------- |
| `name`         | `string`       | Unique identifier (letters, num, `_`, `-` only) |
| `title`        | `string`       | Display name                          |
| `version`      | `string`       | Semver                                      |
| `engine`       | `"loom"`       | **Required**. Defines that the package is for LoomVTT |
| `type`         | `"addon"`      | **Required**. Defines that it is an addon      |
| `engineVersion`| `string`       | Required version range — min and/or max, e.g. `>=0.1.0`, `<2.0.0`, or `>=1.0.0 <2.0.0` |
| `author`       | `string`       | Author name                              |
| `repository`   | `string`       | Repository/source code URL            |
| `description`  | `string`       | Package description                       |
| `manifest`     | `string`       | Remote URL of this `addon.json` for auto-update |
| `download`     | `string`       | `.zip` URL for download during installation |
| `backgroundUrl`| `string`       | URL for background image in the Setup Hub      |
| `coverUrl`     | `string`       | URL for cover image (if applicable)      |
| `active`       | `boolean`      | Whether globally disabled (default: true)   |
| `core`         | `string`       | Server-side entry point (`.js/.ts`)       |
| `client`       | `string`       | Client-side entry point (`.js`)           |
| `mount`        | `string`       | DOM element ID to mount UI           |
| `styles`       | `string[]`     | Array of paths for CSS files          |
| `languages`    | `Array`        | Array of language definitions (`lang`, `name`, `path`) |
| `signals`      | `string[]`     | Signal names that this addon listens to      |
| `dependencies` | `string[]`     | Addons/systems that must be active      |
| `conflicts`    | `string[]`     | Addons/systems that MUST NOT be active |
| `settings`     | `SettingDef[]` | Addon settings                    |

- `engineVersion` is informational, not a hard gate. Bare integers work (`"1"`, `">=2"`), as
  does a plain typo or unparseable clause — those get logged and ignored rather than
  blocking the install. If the version genuinely falls outside the declared range, the
  install still proceeds; the installer just returns a non-fatal `warning` string (shown
  as a toast) so whoever's installing can judge for themselves whether it's safe.

## Client-side

The `client.js` is loaded via dynamic `import()` in the browser. Use the LoomVTT SDK:

```javascript
// client.js
import { LoomHooks, api, sheets, showToast, showConfirm, windowManager, wrap } from '/_loom/sdk/index.js';

console.log('My addon loaded!');

// Register hook
LoomHooks.on('actor.created', (actor) => {
  console.log('New actor:', actor.name);
});

// Register custom sheet
class MySheet extends sheets.get('actor', '*') {
  // ...
}
sheets.catalog('actor', 'my-type', MySheet);

// Function wrapper
const unsub = wrap(resolveFOVOrigins).wrap((original, cast) => {
  console.log('Calculating FOV for', cast.id);
  return original(cast);
});

// API
api.get('/actors').then(actors => {
  console.log(actors);
});

// Windows
await windowManager.open('my-window', MyWindow);

// Notifications
showToast('Addon activated!', 'success');
showConfirm('Are you sure?').then(ok => {});
```

## Server-side

The `core.js` (if specified) is imported on the server during boot, once, in
the same Node process as the rest of the app — full access to the database
and every internal module, no sandbox. Two extension points:

**Your own database table.** LoomVTT is relational end to end (knex, over
SQLite or Postgres) — there's no NoSQL client wired in to reach for. `db` is
a knex instance pointed at whichever world is currently active:

```javascript
// core.js — relative path starting from marketplace/addons/<your-addon>/core.js
import { db } from '../../../server/applications/database/db.js';

async function ensureTable() {
  if (!(await db.schema.hasTable('my_addon_notes'))) {
    await db.schema.createTable('my_addon_notes', (t) => {
      t.string('worldId').primary();
      t.text('text').defaultTo('');
    });
  }
}
```

No hook fires for "the world's DB just became ready" — check/create your
table lazily, the first time a route needs it.

**Your own REST API.** The main Express `app` is never exported to addon
code (handing it out would let an addon override core routes or slip
middleware in ahead of auth). `registerAddonRoutes()` mounts your router
under `/api/addons/<your-addon-name>/*` instead, with `requireAuth` already
applied:

```javascript
import { Router } from 'express';
import { registerAddonRoutes } from '../../../server/applications/addons/addon-api.js';

const router = Router();
router.get('/notes', async (req, res) => {
  const worldId = req.auth?.worldId;
  res.json({ text: '...' });
});
registerAddonRoutes('my-addon', router);
```

The client calls it like any core endpoint: `api.get('/addons/my-addon/notes')`.

**Reacting to what the core already broadcasts** — the other extension
point, no route needed:

```javascript
import { Signal } from '../../../server/applications/signals/index.js';

Signal.listen('cast.created', (data) => {
  console.log('Cast member created:', data);
});
```

`Signal` is a plain server-side `EventEmitter` — it never reaches the
browser by itself; it's for reacting to something else on the server, not
for talking to the client (see the [full example addon](https://github.com/sammore2/loom-exemple-addon) for all three together).

## Lifecycle

1. Server boot → `loadAllAddons()` scans `marketplace/addons/**/addon.json`
2. Validates dependencies and conflicts
3. Imports `core.js` via dynamic `import()`
4. Client connect → `GET /marketplace/packages` → imports `client.js`
5. Active addon receives Signals/LoomHooks in real time

## Installation

Via Setup Hub > Addons or API:

```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://raw.githubusercontent.com/user/repo/main/addon.json", "type": "addon"}'
```

## Available APIs

See [sdk/](../sdk/window-loom.md) for the complete list of exposed APIs.
