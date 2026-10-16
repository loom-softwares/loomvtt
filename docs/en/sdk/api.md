# API Client (`api.ts`)

HTTP client with cookie authentication (credentials: include). All calls are prefixed with `/api`.

```typescript
import { api, API_PATHS } from '/_loom/sdk/index.js';
```

> **In the SDK:** `import { api, API_PATHS, keybinds, LoomHooks, SystemRegistry, diceRegistry, sheets, wrap, showToast } from '/_loom/sdk/index.js'`

> **Note:** `ApiError` is **not** exported by the SDK. It exists in `client/core/api.ts`
> (client interior) and is not part of the `@loomvtt/sdk` public API. To check
> HTTP errors, inspect `e.status` or `e.message` directly in the `catch`.

## Methods

```typescript
api.get<T>(path: string): Promise<T>
api.post<T>(path: string, body?: unknown): Promise<T>
api.put<T>(path: string, body?: unknown): Promise<T>
api.delete<T>(path: string): Promise<T>
```

`T` is the body as it comes back, with no unwrapping. The client does not read `.data` for you:

- Some routes answer with the `{ "data": ..., "error": ... }` envelope (for example `/module-settings`), so
  read `res.data`. Others answer with a plain payload: `GET /api/actors` returns an array. Check the route's page.
- A response without a JSON body resolves to `null`.
- A non-2xx response throws. The thrown error has `status` and `message`, taken from the body's `error` or `message`.
- A 401 on any route other than the auth-attempt routes (setup login and init, world join, connect-account) reloads the page to `/`.

## SDK Exports

In addition to the HTTP client, the SDK exports:

| Export                  | Type                                                    | Description                                                      |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `api`                 | `API`                                                 | REST Client                                                     |
| `API_PATHS`           | `object`                                              | Path constants                                           |
| `LoomHooks`           | `HooksAPI`                                            | Event system                                               |
| `SystemRegistry`      | `SystemRegistryAPI`                                   | System registry                                             |
| `defineSystem`        | `(config) => LoomSystem`                              | Typed helper for defining systems                               |
| `diceRegistry`        | `DiceRegistryAPI`                                     | Dice registry                                                |
| `keybinds`            | `KeybindRegistryAPI`                                  | Keybind registry                                              |
| `sheets`              | `SheetCatalogAPI`                                     | Sheet catalog                                              |
| `windowManager`       | `WindowManagerAPI`                                    | Window manager                                           |
| `wrap`                | `(fn) => Wrappable`                                   | Create wrapping point                                          |
| `getWraps`            | `() => wraps`                                         | Existing wrap points                                        |
| `statusEffects`       | `StatusEffectRegistryAPI`                             | Status effects / conditions registry                           |
| `actorSheetMenu`      | `ActorSheetMenuAPI`                                   | Add entries to the dots menu of every actor sheet (`register(id, provider)`) |
| `loadThree`           | `() => Promise<typeof import('three')>`               | Loads Three.js on demand                                     |
| `loadCannon`          | `() => Promise<typeof import('cannon-es')>`           | Loads cannon-es on demand                                    |
| `showToast`           | `(msg, type?) => void`                                | Toast                                                            |
| `showConfirm`         | `(title, msg) => Promise<boolean>`                    | Confirmation                                                    |
| `showPrompt`          | `(message, default?) => Promise<string\|null>`         | Input                                                            |
| `showAlert`           | `(message) => Promise<void>`                          | Alert                                                           |
| `showSelectDialog`    | `(title, message, options[]) => Promise<string\|null>` | Selection dialog                                            |
| `BaseWindow`          | `class`                                               | Base class for any window                                  |
| `LoomDocumentSheet`   | `class`                                               | Sheet base with automatic data-binding                       |
| `LoomHandlebarsMixin` | `function`                                            | Mixin`(Base) => class` — render via `static PARTS`/`TABS` |
| `LoomDialog`          | `class`                                               | Modular dialog                                                 |
| `fields`              | `object`                                              | Data fields API (StringField, NumberField, etc)                  |
| `VERSION`             | `string`                                              | SDK version                                                   |

## Constants (API_PATHS)

```typescript
API_PATHS = {
  SETUP_STATUS: '/setup/status',
  SETUP_INIT: '/setup/init',
  SETUP_LOGIN: '/setup/login',
  SETUP_LOGOUT: '/setup/logout',
  SETUP_VERIFY: '/setup/verify',
  SETUP_CONFIG: '/setup/config',
  SETUP_LOCAL_ADDRESS: '/setup/local-address',
  WORLDS: '/worlds',
  WORLDS_INVITE_LINKS: '/worlds/:id/invite-links',
  WORLDS_REGENERATE_PASSWORD: '/worlds/:id/invite-links/regenerate-password',
  SYSTEMS: '/systems',
  MARKETPLACE: '/marketplace',
};
```

## Example

```typescript
try {
  const actors = await api.get('/actors');
} catch (e) {
  // There is no exported ApiError in the SDK — inspect directly:
  console.error(e.status, e.message);
}
```

> **Note:** `ApiError` is not exported by the SDK. In `catch`, inspect `e.status` or `e.message` directly.
