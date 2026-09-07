# WebSocket — Overview

Real-time connection between client and server for world state synchronization, built on
**Socket.IO** (`socket.io` server / `socket.io-client` client) — not a raw `WebSocket` server.
The `ws` npm package is still a dependency but is not used for this connection.

**Endpoint:** Socket.IO handshake at path `/ws` (both `websocket` and `polling` transports
enabled — Socket.IO negotiates the transport itself, this is not a plain HTTP `Upgrade`).

**Auth:** two `io.use()` middlewares run before `connection` fires:
1. License check.
2. JWT extracted from the `loom_world_token` cookie (`socket.handshake.headers.cookie`) and
   verified. If missing/invalid, the middleware calls `next(new Error(...))` — Socket.IO turns
   this into a `connect_error` event on the client (there is no literal HTTP 401 response,
   since the handshake may complete over polling before upgrading).

## Rooms

Broadcasts are scoped with Socket.IO rooms, not sent to every socket:

| Room | Joined via | Purpose |
|------|-----------|---------|
| `world:<worldId>` | `user.identify` or `context.update` | Everyone in a world |
| `stage:<stageId>` | `context.update` | Everyone currently viewing that stage |

`context.update` also leaves every `stage:*` room the socket was in before joining the new
one, so a client only ever sits in one stage room at a time. See
[`server/applications/ws/channels.ts`](../../../server/applications/ws/channels.ts) for the
room-naming helpers and broadcast functions.

Despite its name, the server's `broadcastToAll()` helper is usually **not** a true
all-sockets broadcast: it resolves `worldId` (or `stageId`, or `castId`) from the payload and
routes through `broadcastToWorld()`/`broadcastToStage()`, only falling back to a real
`io.emit(...)` to every connected socket when none of those can be resolved. A separate
`broadcastToWorldOwned()` helper exists for documents with per-row `ownership` (e.g. actors):
instead of one `io.to(room).emit(...)`, it iterates the room's live sockets and sends a
redacted payload to anyone below Owner-level permission — see `redactActorForLimited`.

## Message format

**Client → Server** is wrapped in a single Socket.IO event named `'message'`:

```typescript
socket.emit('message', { type: string, data: unknown });
```

`wsClient.send(type, data)` does this wrapping for you — see
[`sdk/ws-client.md`](../sdk/ws-client.md). The server's `socket.on('message', ...)` handler
switches on `type` to dispatch.

**Server → Client** is the opposite: each event is emitted under its **own name**
(`socket.emit('cast.created', data)`, `io.to(room).emit('chat.message', data)`, etc.), never
wrapped in a `{type, data}` envelope. The client's `wsClient` uses `socket.onAny()` to catch
every incoming event and re-dispatch it to handlers registered by name — see
[`events.md`](./events.md) for the full catalog.

There is also a raw passthrough: any client-emitted event whose name starts with `module.`,
`system.`, or `socket.` is relayed as-is to the sender's world room, bypassing the `message`
envelope — the escape hatch addons use for custom real-time events (see
[`events.md`](./events.md#custom-relay-for-addonsystem-events-module-system-socket)).

## Connection lifecycle

```
[Client]                                [Server]
   |                                        |
   |--- Socket.IO handshake (JWT cookie) -->|  io.use() license + JWT check
   |<-- 'connect' -------------------------|  (or 'connect_error' on auth failure)
   |                                        |
   |--- emit('message', {type:'user.identify', data:{worldId}}) -->|  join world:<id> room, query DB
   |<-- emit('init', {...full world state}) ------------------------|
   |<-- emit('users.online', [...]) --------------------------------|  (to the whole world room)
   |                                        |
   |--- emit('message', {type:'context.update', ...}) ------------->|  leave old stage:*, join stage:<id>
   |--- emit('message', {type:'token.move', ...}) ------------------>|  DB write + Signal cast.updated/token.moved
   |--- emit('message', {type:'chat.message', ...}) ----------------->|  DB write + broadcast to world room
   |--- emit('message', {type:'stage.activate', ...}) --------------->|  GM-only, Signal stage.activated
   |                                        |
   |<-- emit('cast.updated', {...}) --------------------------------|  (from Signals, room-scoped)
   |<-- emit('tiles.created'/'updated'/'deleted', {...}) -----------|  (from Signals, room-scoped)
   |<-- emit('actors.updated', {...}) -------------------------------|  (from Signals, room-scoped)
   |<-- emit('chat.message', {...}) ---------------------------------|  (from other clients in the room)
```

## Auto-reconnect

Handled entirely by Socket.IO's own client (`ws-client.ts` just configures it): up to 5
attempts with exponential backoff (1s, 2s, 4s, 8s, capped at 16s). A server-initiated
disconnect (`reason === 'io server disconnect'`, e.g. after `world.deactivated` force-closes
the room) does **not** trigger a client reconnect attempt.

## user.identify

Sent right after connecting to start the sync:

```json
{
  "type": "user.identify",
  "data": { "worldId": "world-uuid" }
}
```

The server extracts `userId`/`userName`/`userRole` from the JWT — the identity fields the
client sends are informational only, never trusted. This joins the `world:<worldId>` room and
triggers the `init` payload plus a `users.online` broadcast to the rest of that room.

## init

Immediate response to `user.identify` with the full world state (as a bare `init` event, not
`{type: 'init', data: {...}}`):

```json
{
  "system": { "id": "...", "title": "...", "version": "...", "changelogUrl": "...", "wikiUrl": "...", "bugsUrl": "..." },
  "modules": [{ "name": "...", "version": "..." }],
  "rulesets": [{ "name": "...", "version": "..." }],
  "permissions": { "compendiumEdit": [], "viewStages": [] },
  "isPaused": false,
  "cast": [...],
  "stages": [...],
  "actors": [...],
  "tiles": [...],
  "items": [...],
  "journals": [...],
  "folders": [...],
  "playlists": [...],
  "lights": [...],
  "drawings": [...],
  "levels": [...],
  "rollTables": [...],
  "combat": null,
  "chatHistory": [...],
  "onlineUsers": [...]
}
```

`cast` is sent unfiltered across all stages of the world — the client filters by the active
stage for rendering (see `game-hud.ts`'s `handleInit`/`stage.activated` handling), since
`stage.activated` broadcasts don't carry a cast list of their own.

## users.online

Sent whenever a user connects, disconnects, or switches stage (`context.update`):

```json
{
  "type": "users.online",
  "data": [
    { "clientId": "...", "worldId": "...", "userId": "...", "userName": "Rob", "userColor": "#e74c3c", "userRole": 4 }
  ]
}
```

## Client-side

```typescript
import { wsClient } from '../core/ws-client.js';

await wsClient.connect();
wsClient.identify(worldId, userId, userName, userColor, userRole);

const unsub = wsClient.on('cast.created', (data) => {
  console.log('Token:', data);
});

wsClient.send('chat.message', { content: 'Hello!' });
```

**`wsClient.on(...)` is never automatic per entity type.** Having an entry in
`docs/en/api/*.md` saying `WS Event: deck.updated` doesn't mean something is already
listening to this event — each screen/list that needs to stay synchronized has to register
its own `wsClient.on('deck.updated', ...)` and manually update its local state. A real
example: the sidebar (`client/screens/game-hud/sidebar.ts`) had listeners for
`actors.*`/`item.*` but not for `deck.*` — renaming a deck saved correctly to the database,
but the sidebar list never knew it needed to update because nothing was listening. When
adding a new tab/list in the sidebar, always register the three events (`created`/`updated`/
`deleted`) of the corresponding entity — and check [`events.md`](./events.md) for the exact
wire name, since it isn't always the singular of the entity name.
