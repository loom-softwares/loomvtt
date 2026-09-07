# SDK

The SDK is served by LoomVTT itself at `/_loom/sdk/index.js`. Addons perform direct imports:

```js
import { LoomHooks, api, SystemRegistry } from '/_loom/sdk/index.js';
```

## Complete API

| Export | Type | Origin |
|--------|------|--------|
 | `LoomHooks` | `{ on, off, once, callAll }` | Event system (client-side) |
| `api` | `{ get, post, put, delete }` | REST Client |
| `API_PATHS` | `object` | Route constants |
| `windowManager` | `{ open, focus, close, closeAll }` | Window manager |
| `sheets` | `{ catalog, get }` | Sheet catalog |
| `wrap` | `(fn) => Wrappable` | Function interception |
| `getWraps` | `() => wraps` | Existing wrap points |
| `showToast` | `(msg, type?) => void` | Notification |
| `showConfirm` | `(title, msg) => Promise<boolean>` | Confirmation |
| `showPrompt` | `(message, default?) => Promise<string\|null>` | Input |
| `showAlert` | `(message) => Promise<void>` | Alert |
| `showSelectDialog` | `(title, message, options[]) => Promise<string\|null>` | Selection dialog |
| `SystemRegistry` | `{ register, get, getAll, getActive, setActive }` | System registry |
| `defineSystem` | `(config) => LoomSystem` | Helper for defining systems |
| `diceRegistry` | `{ register, create, has }` | Dice registry |
| `keybinds` | `{ register, unregister, getKey, setBinding, resetBinding, resetAll }` | Keybind registry |
| `statusEffects` | `{ register, get, getAll }` | Conditions / status effects registry |
| `loadThree` | `() => Promise<typeof import('three')>` | Loads Three.js on demand |
| `loadCannon` | `() => Promise<typeof import('cannon-es')>` | Loads cannon-es on demand |
| `VERSION` | `string` | SDK version |
| `BaseWindow` | `class` | Window base class |
| `LoomDocumentSheet` | `class` | Sheet base with data-binding |
| `LoomHandlebarsMixin` | `function` | Mixin `(Base) => class` — render via `static PARTS`/`TABS` |
| `LoomDialog` | `class` | Modular dialog |
| `fields` | `object` | Data fields API (StringField, NumberField, etc.) |

## Exported Types

| Type | Description |
|------|-----------|
| `LoomSystem` | Ruleset contract |
| `SheetSchema`, `SheetTab`, `SheetField` | Sheet schema |
| `DiceEvaluation` | Roll result |
| `CastMemberData`, `StageData`, `TileData` | Scene data |
| `AmbientLightData`, `DrawingData`, `WallData` | Canvas data |
| `NoteData`, `NoiseData` | Auxiliary data |
| `InitData` | Initial sync payload |
| `Wrappable<Fn>` | Wrapping type |
| `WindowLike` | Window contract |
| `ToastType` | `'info' \| 'success' \| 'warning' \| 'error'` |
| `KeybindRegistryAPI` | `{ register, unregister, getKey, setBinding, resetBinding, resetAll }` |

## Alternative via window.Loom

Addons can also access via `window.Loom.*` without imports (legacy):

```js
Loom.api.get('/actors');
Loom.LoomHooks.on('actor.created', handler);
Loom.windowManager.open('id', MyWindow);
```
