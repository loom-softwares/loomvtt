# WebSocket — Overview

Real-time connection between client and server for world state synchronization, built on
**Socket.IO** (`socket.io` server / `socket.io-client` client) — not a raw `WebSocket` server.
The `ws` npm package is still a dependency but is not used for this connection.

**Endpoint:** Socket.IO handshake at path `/ws` (both `websocket` and `polling` transports
enabled — Socket.IO negotiates the transport itself, this is not a plain HTTP `Upgrade`).

**Auth:** two `io.use()` middlewares run before `connection` fires:
1. License check.
2. JWT extracted from the `loom_world_token` cookie (`socket.handshake.headers.cookie`, or
   `handshake.auth.token` as a fallback) and verified. For a player session the middleware also
   checks that the account is not banned and that its `sessionVersion` still matches the token.
   Failures call `next(new Error(...))` — Socket.IO turns this into a `connect_error` event on the
   client (there is no literal HTTP 401 response, since the handshake may complete over polling
   before upgrading). The error messages are `LICENSE_REQUIRED: ...` (license), `Authentication error`
   (missing or invalid token), `ACCOUNT_BANNED` and `SESSION_REVOKED`. The client sends the browser
   to `/` for the last two.

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

The one exception is `world.deactivated`, which is sent with `io.emit` to every socket on the server
and disconnects every connected user, across all worlds (see [events.md](./events.md)).

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
switches on `type` to dispatch. Messages sent while the socket is offline are queued by
`wsClient` (up to 50, flushed after reconnecting); `token.drag` and `user.cursor` are dropped instead.

Display and stream sessions (`display`/`stream` kinds) are read-only: the server accepts only
`user.identify` from them and silently drops every other message type.

**Server → Client** is the opposite: each event is emitted under its **own name**
(`socket.emit('cast.created', data)`, `io.to(room).emit('chat.message', data)`, etc.), never
wrapped in a `{type, data}` envelope. The client's `wsClient` uses `socket.onAny()` to catch
every incoming event and re-dispatch it to handlers registered by name — see
[`events.md`](./events.md) for the full catalog.

**Internal `Signal` names are not wire names.** `Signal` is the server's internal event bus. Many
internal names differ from what clients receive: `actors.updated` goes out as `actor.updated`,
`stages.updated` as `stage.updated`, `tiles.created` as `tile.created`, `users.updated` as
`user.updated`, `macros.*` as `macro.*`, `worlds.*` as `world.*`, `levels.*` as `level.*`,
`decks.deleted` as `deck.deleted`, `compendium_packs.*` as `compendium.*`, `roll_tables.*` as
`roll-table.*` and `folders.*` as `folder.*`. The renames are made by the `Signal.listen` relays in
`server/index.ts`. Some events never pass through `Signal` at all and go straight to a room with `broadcastToWorld`
or `broadcastToStage` (for example `chat.message`, `ping`, `user.cursor`, `token.drag`). Only the wire names in [`events.md`](./events.md) are part of
the protocol; a `Signal` name in the server code is not a client-facing contract.

There is also a raw passthrough: any client-emitted event whose name starts with `module.`,
`system.`, or `socket.` is relayed as-is to the sender's world room, bypassing the `message`
envelope (limited to 20 messages per second and 64 KB per payload) — the escape hatch addons use for custom real-time events (see
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

Socket.IO's own client retries without a limit (`reconnectionAttempts: Infinity`), with the delay
growing from 1s up to a 16s cap. A server-initiated disconnect (`reason === 'io server disconnect'`,
e.g. after `world.deactivated`) is **not** retried by Socket.IO itself: `ws-client.ts` calls
`connect()` again by hand, using the delays 1s, 2s, 4s, 8s and then 16s for every later attempt,
also without a limit.

After any reconnect, if the client still has a session it sends `user.identify` with
`isReconnect: true` and then `context.update` for its current stage. The server answers the
identify with `users.online` and `cast.resync` instead of a new `init` (see the `user.identify`
section below).

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
When the client sends `isReconnect: true`, the server skips `init` and sends `users.online` to the
room plus `cast.resync` to that socket only.

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
