# Settings (`settings-registry.ts`)

Real and persistent registry for addon/system settings — `register`, `registerMenu`,
`get`, `set`. Exposed at `window.Loom.settings`.

```typescript
// Not an SDK export — only exists as the window.Loom global.
Loom.settings.register(/* ... */);
```

## API

```typescript
type SettingScope = 'world' | 'client';

interface SettingConfig {
  name?: string;
  hint?: string;
  scope: SettingScope;
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
Loom.settings.getMenus(): RegisteredMenu[];
Loom.settings.getDefinitionsForModule(module: string): RegisteredSetting[];
Loom.settings.settingsMap: Map<string, RegisteredSetting>; // key `module.key` -> config
```

## Persistence and parity

- **scope `world`**: persists via REST (`/api/module-settings/:worldId/:module/:key`), per-world.
- **scope `client`**: persists in `localStorage` (per user/browser).
- `get()` is **synchronous** (parity with what converted systems expect). For `world`,
  the registry triggers asynchronous preloading of all the module's settings — works
  because systems call `register()` in the `init` hook, way before `get()` in `ready`/render.

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
