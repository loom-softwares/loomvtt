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
> - `callAll(name, ...args)` executes all registered callbacks, handling async promises and logging errors individually without breaking execution.
> - `call(name, ...args)` executes listeners sequentially and returns `false` if any callback returns `false` (allowing lifecycle short-circuiting in pre-hooks such as `preUpdateActor`).
> - On the client, `ClientDocument` fires local document hooks via `LoomHooks.call()` (`preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, `createActor`, etc.).
> - Additionally, the client listens to Socket.IO events relayed from the server (e.g. `actors.created`, `actors.updated`, `actors.deleted` — naming isn't consistent across entities, see [`websocket/events.md`](../websocket/events.md)) and Window events (`renderWindow`, `closeWindow`, `renderActorSheet`, etc.).
>
> `targetToken` is triggered directly from the Socket.IO event `token.target` (target/untarget). Payload: `{ castId, targetedBy }`. To inspect current user targets without listening, use `Loom.user.targets` — see `window-loom.md`.

## Example

```typescript
// Register listener
const handler = (actor) => console.log('Actor:', actor.name);
// WS Events (client-side) — names: actor.created, actor.updated, actor.deleted
LoomHooks.on('actor.created', handler);

// Listener with lifecycle cancellation
LoomHooks.on('preUpdateActor', (actor, changes, context) => {
  if (changes.system?.hp?.value < 0) {
    console.warn('HP cannot be negative');
    return false; // Prevents update
  }
});

// Remove
LoomHooks.off('actor.created', handler);

// Trigger
LoomHooks.callAll('actor.created', actorData);
```

Errors in hooks are caught and logged via `console.error`, without breaking the execution of other hooks.
