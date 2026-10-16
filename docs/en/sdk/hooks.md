# LoomHooks (`hooks.ts`)

Global event system of LoomVTT. Exposed in `window.Loom.LoomHooks` and aliased globally as `window.Hooks` for compatibility.

```typescript
import { LoomHooks } from '/_loom/sdk/index.js';
```

## API

```typescript
LoomHooks.on(hookName: string, callback: (...args) => void): void
LoomHooks.once(hookName: string, callback: (...args) => void): void
LoomHooks.off(hookName: string, callback: (...args) => void): void
LoomHooks.callAll(hookName: string, ...args: any[]): void
LoomHooks.call(hookName: string, ...args: any[]): boolean
```

> **Note:** `LoomHooks` is the client-side event system.
> - `call` is available on `window.Loom.LoomHooks` (and `window.Hooks`), but the `LoomHooks` object exported by the SDK import only has `on`, `once`, `off` and `callAll`.
> - `callAll(name, ...args)` executes all registered callbacks, handling async promises and logging errors individually without breaking execution.
> - `call(name, ...args)` executes listeners in sequence (it does not await promises) and returns `false` if any synchronous callback returns `false`. Only `chatRollCommand` uses that return value. The client `preUpdate*` / `preDelete*` hooks ignore it, so returning `false` there does not cancel the update (see the CODE ISSUE note below).
> - On the client, `ClientDocument` fires local document hooks via `LoomHooks.call()`: `preUpdate<Doc>`, `update<Doc>`, `preDelete<Doc>`, `delete<Doc>` (for example `preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`).
> - The server relays its `actors.*` signals to the client as the singular names used in the examples (`actor.created`, `actor.updated`, `actor.deleted`, see `server/index.ts`). Items are already emitted as `item.created` / `item.updated` / `item.deleted`. The sidebar and HUD then fire the same name plus the `create…`, `update…`, `delete…` aliases and the `createDocument` / `updateDocument` / `deleteDocument` forms (see the list below). Window events (`renderWindow`, `closeWindow`, `renderActorSheet`, etc.) are also fired here.
>
> Other hooks the client fires: `init`, `setup` and `ready` (HUD boot); `combatStart`, `combatTurn`, `combatRound` and `combatEnd`; `updateWorldTime`, `timeScaleChanged` and `timePausedChanged` (see `time.md`); `stage.updated`, `updateScene`; `preRoll` and `chatRollCommand` (a listener that returns `false` takes over the roll); `chat.roll`; `combatantLabel` and `combatInitiative`; `window.<event>` for `render`, `close`, `position`, `minimize` and `maximize`; `getWindowOptionsMenuItems`; `render<Class>` and `close<Class>`.
>
> `targetToken` is triggered directly from the Socket.IO event `token.target` (target/untarget). Payload: `{ castId, targetedBy }`. To inspect current user targets without listening, use `Loom.user.targets` — see `window-loom.md`.
>
> **Combat hooks (contracts):**
> - `combatStart`, `combatTurn`, `combatRound` and `combatEnd` fire on GM clients only. The server relays `combat.*`
>   events with no ownership, so players receive no combat events at all. A player panel has to poll `GET /api/combat/:worldId`.
> - `combatantLabel` is synchronous, through `LoomHooks.call('combatantLabel', ctx)` with `ctx = { combat, combatant, label }`.
>   A listener writes `ctx.label`. A listener that returns `false` stops the chain.
> - `combatInitiative` runs through `callAll` with `ctx = { castIds, initiatives, health, rolls, pending }`. Write the
>   totals into `ctx.initiatives[castId]`. Push async work into `ctx.pending`: the UI awaits it before the POST. A rejected
>   promise aborts the whole start, and the UI only shows a toast. It runs only from the "Start Combat (DEX Initiative)" button, for the
>   selected tokens, not from `POST /start`, `POST /combatant` or the encounter sheet.
> - `combatantLabelsChanged` is listened for by the sidebar, which re-renders on it, but no engine code emits it. A system
>   that fills badges asynchronously has to emit it itself, for example with `LoomHooks.callAll('combatantLabelsChanged')`.

## Example

```typescript
// Register listener
const handler = (actor) => console.log('Actor:', actor.name);
// WS Events (client-side) — names: actor.created, actor.updated, actor.deleted
LoomHooks.on('actor.created', handler);

// Pre-hook listener (receives the document, the changes and the context).
// Its return value is ignored: returning false does NOT cancel the update.
LoomHooks.on('preUpdateActor', (actor, changes, context) => {
  if (changes.system?.hp?.value < 0) {
    console.warn('HP cannot be negative');
  }
});

// Remove
LoomHooks.off('actor.created', handler);

// Trigger
LoomHooks.callAll('actor.created', actorData);
```

Errors in hooks are caught and logged via `console.error`, without breaking the execution of other hooks.

> **CODE ISSUE:** `ClientDocument.update()` and `delete()` (`client/core/client-document.ts`) call `LoomHooks.call('preUpdate…')` and `LoomHooks.call('preDelete…')` without checking the result, so a `false` return does not stop the request. The server-side `preUpdate*` hooks have the same limit (`server/applications/utils/hooks.ts`: `call` returns `void`).
