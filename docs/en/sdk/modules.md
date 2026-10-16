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
| `settings` | `{ register, registerMenu, get, set, settings }` | Module/system settings (see `settings.md`) |
| `actorSheetMenu` | `{ register, unregister }` | Extra entries in the dots menu of every actor sheet |
| `effects` | `{ forActor, forItem, create, update, delete }` | Active effects (buffs) over the REST `/buffs` routes |
| `dispatchRoll` | `(opts) => void` | Rolls a formula to the chat from a system or sheet |
| `LoomActorSheet` | `class` | Actor sheet base class (`actor` and `token` getters) |
| `LoomItemSheet` | `class` | Item sheet base class (`item` and `actor` getters; `apiRoute` sets the GET/save URL, default `/items`, see `sheets.md`) |
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
| `EffectData`, `EffectChange`, `EffectsAPI` | Active effects (buffs) data and API |
| `StatusEffectDef` | Definition for `statusEffects.register` |
| `ActorSheetMenuItem`, `ActorSheetMenuContext`, `ActorSheetMenuProvider` | Dots menu entries and provider |
| `SettingConfigSDK`, `SettingMenuConfigSDK`, `SettingsAPI` | Settings configuration and API |

## Alternative via window.Loom

Addons can also access via `window.Loom.*` without imports (legacy):

```js
Loom.api.get('/actors');
Loom.LoomHooks.on('actor.created', handler);
Loom.windowManager.open('id', MyWindow);
```
