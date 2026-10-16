# Settings (`settings-registry.ts`)

Real and persistent registry for addon/system settings — `register`, `registerMenu`,
`get`, `set`. Exposed at `window.Loom.settings` and as the `settings` export of the SDK.
The SDK export has `register`, `registerMenu`, `get`, `set` and `settings` only. `whenReady` exists
only on `window.Loom.settings`, so a module that imports from the SDK cannot await its saved values.

```typescript
import { settings } from '/_loom/sdk/index.js';
// or, without an import:
Loom.settings.register(/* ... */);
```

## API

```typescript
type SettingScope = 'world' | 'client';

interface SettingConfig {
  name?: string;
  hint?: string;
  scope?: SettingScope; // optional in the SDK typings; always pass it (see "Persistence and parity")
  config?: boolean;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor | 'string' | 'number' | 'boolean' | 'object' | 'array';
  default: any;
  choices?: Record<string, string>;
  onChange?: (value: any) => void;
}

interface SettingMenuConfig {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  restricted?: boolean;
  type?: new (...args: any[]) => any; // class to instantiate when opening the menu
}

Loom.settings.register(module: string, key: string, config: SettingConfig): void;
Loom.settings.registerMenu(module: string, key: string, config: SettingMenuConfig): void;
Loom.settings.get(module: string, key: string): any;
Loom.settings.set(module: string, key: string, value: any): Promise<void>;
Loom.settings.whenReady(module: string): Promise<void>; // window.Loom.settings only: resolves when the saved world settings of the module are loaded
Loom.settings.settings: Map<string, RegisteredSetting>; // key `module.key` -> config
```

> **Menu labels are translation keys.** The settings window passes `label` (or `name`, then the key) through the
> engine translator, so an unknown key is shown as the key itself. Use a key from your locale bundles to get a
> translated label; plain English text is shown as-is only because it is not a known key.
>
> **CODE ISSUE:** `getMenus()` and `getDefinitionsForModule(module)` exist on the internal registry
> (`client/core/settings-registry.ts`), but `window.Loom.settings` does not expose them. Use `Loom.settings.settings`
> to read the definitions. The map is named `settings`, not `settingsMap`, on `window.Loom`.

## Persistence and parity

- **scope `world`**: persists via REST (`/api/module-settings/:worldId/:module/:key`), per-world. `set()` rejects if no world is active.
- **scope `client`**: persists in `localStorage` (per user/browser).
- `set()` calls the `onChange` of the definition after saving.
- `get()` is **synchronous** (parity with what converted systems expect). For `world`,
  the registry triggers asynchronous preloading of all the module's settings — works
  because systems call `register()` in the `init` hook, way before `get()` in `ready`/render.
  Until the saved values arrive, `get()` returns the default. Await `Loom.settings.whenReady(module)`
  when a saved value must be read at startup.
- The preload has two preconditions. A world must be active when `register()` runs, and `scope: 'world'`
  must be written explicitly. Without an active world, `whenReady()` resolves at once, nothing is loaded and
  `get()` keeps returning defaults.
- A definition without `scope` is read and written as `world`, but `register()` does not preload it. Always
  pass `scope`.

## Pre-registered settings

Settings that the engine already registers with a default, assumed by converted systems without
explicit `register()` call:

| Module | Key | Type | Default |
|--------|-------|------|---------|
| `core` | `chatBubblesPan` | Boolean | `true` |
| `core` | `notesDisplayToggle` | Boolean | `false` |
| `core` | `language` | String | `'en'` |

## Example

```js
Loom.settings.register('my-addon', 'hardMode', {
  scope: 'client',
  type: Boolean,
  default: false,
  onChange: (v) => console.log('new value:', v),
});

const hard = Loom.settings.get('my-addon', 'hardMode');
await Loom.settings.set('my-addon', 'hardMode', true);
```
