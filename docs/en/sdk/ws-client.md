# WebSocket Client (`ws-client.ts`)

Real-time client, built on **Socket.IO** (`socket.io-client`) — not a raw `WebSocket`. The
wrapper's public API is transport-agnostic on purpose (`connect`/`send`/`on`/`off`), so callers
never touch `socket.io-client` directly.

```typescript
import { wsClient } from '../core/ws-client.js';
```

## API

```typescript
wsClient.connect(): Promise<void>
wsClient.disconnect(): void
wsClient.send(type: string, data: unknown): void
wsClient.on(type: string, handler: (data: any) => void): () => void
wsClient.off(type: string, handler: (data: any) => void): void
wsClient.identify(worldId, userId, userName, userColor, userRole): void
wsClient.updateContext(worldId: string, stageId?: string): void
wsClient.session: { worldId, userId, userName, userColor, userRole } | null
```

## Connection

```typescript
await wsClient.connect();
```

Connects Socket.IO to the same origin, path `/ws` (both `websocket` and `polling` transports
enabled — Socket.IO negotiates, it isn't a raw WS upgrade). Auto-reconnection is handled by
Socket.IO itself: up to 5 attempts with exponential backoff (1s, 2s, 4s, 8s, capped at 16s).
A server-initiated disconnect (`reason === 'io server disconnect'`) does **not** trigger
reconnection.

## Sending events

```typescript
wsClient.send('chat.message', { content: 'Hello!' });
```

`send()` does not emit the event name directly on the socket — it wraps everything into a
single Socket.IO event named `'message'`: `socket.emit('message', { type, data })`. The
server's `message` handler unwraps `type`/`data` and dispatches internally.

## Receiving events

The server, by contrast, emits each event under its **own name** (`cast.created`,
`chat.message`, `init`, etc.) rather than wrapping them in a generic envelope. The client
uses `socket.onAny()` to catch every incoming event and re-dispatch it to whichever handlers
were registered under that name:

```typescript
const unsubscribe = wsClient.on('cast.created', (data) => {
  console.log('Token created:', data);
});

// Unsubscribe
unsubscribe();
// or
wsClient.off('cast.created', handler);
```

**`wsClient.on(...)` is never automatic per entity type.** An entry in `docs/en/api/*.md`
saying `WS Event: deck.updated` doesn't mean something is already listening — each
screen/list that needs to stay synchronized has to register its own
`wsClient.on('deck.updated', ...)` and manually update its local state.

## Identification

```typescript
wsClient.identify('world-1', 'user-1', 'Rob', '#e74c3c', 4);
```

Sends a `user.identify` event. The server derives the real `userId`/`userName`/`userRole`
from the JWT cookie — the identity fields in the payload are informational only, not trusted.
Joins the client to the `world:<worldId>` Socket.IO room server-side. After identifying, the
server sends the full world state via the `init` event.

## Room context (stage scoping)

```typescript
wsClient.updateContext(worldId, stageId);
```

Sends `context.update`. Beyond the `world:<worldId>` room joined at `identify()`, this also
(re)joins the client to a stage-scoped room — call it on login and whenever the player
switches stages/scenes, or stage-scoped broadcasts (e.g. fog reveals, if ever relayed) will be
missed.

## Session

```typescript
wsClient.session // { worldId, userId, userName, userColor, userRole } | null
```
