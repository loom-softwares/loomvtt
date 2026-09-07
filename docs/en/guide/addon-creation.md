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
| `engineVersion`| `string`       | Required version range (e.g., `>=0.1.0`)     |
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

The `core.js` (if specified) is imported on the server during boot. It has access to the Signal system and the database:

```typescript
// core.js — relative path starting from marketplace/addons/<your-addon>/core.js
import { Signal } from '../../../server/applications/signals/index.js';

Signal.listen('cast.created', (data) => {
  console.log('Cast member created:', data);
});
```

## Lifecycle

1. Server boot → `loadAllAddons()` scans `marketplace/addons/**/addon.json`
2. Validates dependencies and conflicts
3. Imports `core.js` via dynamic `import()`
4. Client connect → `GET /marketplace/packages` → imports `client.js`
5. Active addon receives Signals/LoomHooks in real time

## Installation

Via Setup Hub > Modules or API:

```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://raw.githubusercontent.com/user/repo/main/addon.json", "type": "addon"}'
```

## Available APIs

See [sdk/](../sdk/window-loom.md) for the complete list of exposed APIs.
