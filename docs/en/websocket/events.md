# WebSocket Events

Complete catalog of Server→Client events, delivered over **Socket.IO** — each row is a
distinct Socket.IO event name (`socket.on('<event>', ...)` client-side), not a `{type, data}`
envelope. See [overview.md](./overview.md) for the transport and room-scoping model.

## Naming convention

Naming is **not consistent** across entities — some are singular, some plural, some
underscored, some hyphenated. The wire name is **not** the table name: the generic
`Document.create/update/delete()` layer emits `Signal.broadcast(`${schema.tableName}.<action>`, ...)`
(for example `stages.updated`), but that internal signal only reaches clients if
`server/index.ts` has a `Signal.listen` for it, and that relay re-emits it under its own wire name
(`stages.updated` goes out as `stage.updated`). The table below lists the exact wire names; don't
assume a pattern from one entity applies to another. Known renames: `actors.*` → `actor.*`,
`stages.*` → `stage.*`, `levels.*` → `level.*`, `tiles.*` → `tile.*`, `macros.*` → `macro.*`,
`users.*` → `user.*`, `worlds.*` → `world.*`, `decks.deleted` → `deck.deleted`,
`compendium_packs.*` → `compendium.*`, `roll_tables.*` → `roll-table.*`,
`roll_table_entries.*` → `roll-table-entry.*`.

## Canvas / Scene Events

| Event | Payload (`data`) | Description |
|--------|-------------------|-----------|
| `stage.created` | Full Stage | Stage created (wire name of the `stages.created` signal) |
| `stage.activated` | `{ stageId, id, levelId, levels, name, bgUrl, backgroundColor, gridSize, gridColor, gridType, gridStyle, gridOpacity, gridDistance, gridUnit, width, height, ambientPlaylistId, ambientSoundId, ambientStartSoundId, darknessLevel, weatherEffect, transitionType, transitionDuration, flags, ...fog and vision config }` | Stage activated (`levelId`/`bgUrl`/`backgroundColor` come from the initial level, or the first level by elevation). Built by `buildActivationPayload()` in `server/applications/api/stages.ts` |
| `stage.updated` | Full Stage | Stage updated |
| `stage.deleted` | `{ id, worldId, stageId }` | Stage removed |
| `stage.darkness` | `{ stageId, darknessLevel, duration }` | Darkness changed |
| `stage.theaterToggled` | `{ stageId, active }` | Theater mode turned on or off (sent after a GM `stage.theater` message) |
| `stage.theaterSkinChanged` | `{ stageId, skinId }` | Theater frame changed |
| `stage.theaterEffectChanged` | `{ stageId, effect, worldId }` | Theater effect changed |
| `stage.theaterItemsChanged` | `{ stageId, items }` | The pictures and texts of a scene's theater screen changed (`items` is the whole list) |
| `stage.castChanged` | `{ stageId, activeCast, activeCastMembers }` | The cinema tray's visible actors changed |
| `stage.castRosterChanged` | `{ stageId, castRoster, activeCast, activeCastMembers }` | The scene roster changed (`activeCast` is trimmed to the roster) |
| `level.created` | Full Level | Level created (wire name of the `levels.created` signal) |
| `level.updated` | Full Level | Level updated |
| `level.deleted` | `{ id, worldId, stageId }` | Level removed |
| `levels.changed` | `{ stageId }` | All levels of a stage changed |
| `cast.created` | Full Cast member | Token created. A token with `hidden: true` goes only to GM sockets (see Notes) |
| `cast.updated` | Full Cast member | Token updated. The server removes `_socketId` before sending; it is used only to skip the sender |
| `cast.deleted` | `{ id, worldId, stageId }` | Token removed |
| `cast.resync` | `{ cast: [...] }` | Sent only to a client that reconnected: every token again (same redaction as `init`), because events during the drop were never delivered |
| `token.moved` | `{ id, x, y, worldId, movedAt, movePath? }` | Token moved (`movePath`: the points the mover marked, so other screens walk the token along the same line). The sender is skipped |
| `token.target` | `{ castId, targetedBy }` | Token targeted |
| `tile.created` | Full Tile | Tile created (wire name of the `tiles.created` signal). Sent to the room of the tile's stage only |
| `tile.updated` | Full Tile | Tile updated (stage room only) |
| `tile.deleted` | `{ id, worldId, stageId }` | Tile removed (stage room only) |
| `tile.triggered` | `{ action, tokenId }` | Sent directly to one target socket (`targetSocket.emit(...)`), not a room broadcast — see [overview.md](./overview.md) |
| `light.created` | Full Light | Light created |
| `light.updated` | Full Light | Light updated |
| `light.deleted` | `{ id, stageId }` | Light removed |
| `drawing.created` | Full Drawing | Drawing created |
| `drawing.updated` | Full Drawing | Drawing updated |
| `drawing.deleted` | `{ id }` | Drawing removed |
| `drawing.cleared` | `{ stageId }` | Drawings cleared |
| `wall.created` | Full Wall | Wall created |
| `wall.updated` | Full Wall | Wall updated |
| `wall.deleted` | `{ id }` | Wall removed |
| `wall.bulkDeleted` | `{ ids: [...] }` | Several walls removed in one request |
| `door.state` | `{ wallId, door, doorState, worldId }` | Door state changed |
| `noise.created` | Full Noise | Sound ambiance created |
| `noise.updated` | Full Noise | Sound ambiance updated |
| `noise.deleted` | `{ id }` | Sound ambiance removed |
| `note.created` | Full Note | Note created |
| `note.updated` | Full Note | Note updated |
| `note.deleted` | `{ id }` | Note removed |
| `fog.updated` | Fog delta: `{ id, stageId, userId, levelId, newPolygons }` | Fog reveal changed. Sent to the stage room; in individual exploration mode only to the user it belongs to and to GM sockets |
| `fog.created` | `{ id, stageId, userId, levelId, ... }` | Fog reveal created. Same audience as `fog.updated` |
| `fog.reset` | `{ stageId, userId? }` | Fog cleared. With `userId`, only that user and GM sockets; without it, the whole stage room |
| `ping` | Original ping payload | Rebroadcast to the world room (Ctrl+click-style latency/position ping) |
| `pong` | `{ timestamp, ...originalData }` | Sent back only to the sender of `ping` |
| `canvas.ping` | `{ ...data, userColor }` | Shared visual ping marker (Ctrl+click) |
| `canvas.floatingText` | `{ x, y, text, color, options }` | Synchronized floating text/damage on the canvas for all players |

## World Data Events

| Event | Payload (`data`) | Description |
|--------|-------------------|-----------|
| `actor.created` | Full Actor | Actor created. Sent to the world room; a Limited player gets the trimmed version (`redactActorForLimited`) |
| `actor.updated` | Full Actor | Actor updated (same audience and trimming as `actor.created`). Also the wire name of the `actors.updated` signal |
| `actor.deleted` | `{ id, worldId, stageId }` | Actor removed |
| `item.created` | Full Item | Item created (world room, filtered by the item's `ownership`) |
| `item.updated` | Full Item | Item updated (world room, filtered by `ownership`) |
| `item.deleted` | `{ id }` | Item removed |
| `journal.created` | Full Journal | Journal created (world room, filtered by `ownership`) |
| `journal.updated` | Full Journal | Journal updated (also fired for page and category CRUD — see [journals.md](../api/journals.md)) |
| `journal.deleted` | `{ id }` | Journal removed |
| `folder.created` | Full Folder | Folder created |
| `folder.updated` | Full Folder | Folder updated |
| `folder.deleted` | `{ id }` | Folder removed |
| `deck.created` | Full Deck | Deck created (world room, filtered by ownership; with no ownership, GM sockets only) |
| `deck.updated` | Full Deck | Deck updated (same audience as `deck.created`) |
| `deck.deleted` | `{ id, worldId, stageId }` | Deck removed (wire name of the `decks.deleted` signal; note the signal name is plural while the wire name is singular) |
| `playlist.created` | Full Playlist | Playlist created |
| `playlist.updated` | Full Playlist | Playlist updated |
| `playlist.deleted` | `{ id }` | Playlist removed |
| `playlist.sound.created` | Full Sound | Sound added |
| `playlist.sound.updated` | Full Sound | Sound updated |
| `playlist.sound.deleted` | `{ id, playlistId, soundCount }` | Sound removed |
| `macro.created` | Full Macro | Macro created (wire name of the `macros.created` signal) |
| `macro.updated` | Full Macro | Macro updated |
| `macro.deleted` | `{ id, worldId, stageId }` | Macro removed |
| `user.created` | Full User | User created (wire name of the `users.created` signal) |
| `user.updated` | Full User (also fired for `/users/:id/flags`) | User updated |
| `user.deleted` | `{ id }` | User removed |
| `combat.started` | Full Combat | A combat encounter was started. World room, filtered with `defaultPerm` 0: only GM sockets receive it (see Notes) |
| `combat.next` | Full Combat | Turn advanced. Same audience as `combat.started` |
| `combat.updated` | Full Combat | Combat changed (combatants, round, etc.). Same audience as `combat.started` |
| `combat.ended` | `{ worldId }` | Combat ended. Same audience as `combat.started` |
| `display.push` | `{ worldId, journalId, pageId, targetUserIds, journal }` | A journal page was pushed to the display screens and players. Only the GM and the targeted users get the full payload (with `journal`); everyone else gets it without `journal` |
| `display.media` | `{ worldId, src, title, targetUserIds }` | A media item was shown on the display screens. Sent to the world room |
| `display.revoked` | `{ worldId, linkId, token }` | A display link was revoked. The display device itself is disconnected at once (see the Notes) |

## System Events

| Event | Payload (`data`) | Description |
|--------|-------------------|-----------|
| `init` | Full world state | Initial sync (after `user.identify`) — see [overview.md](./overview.md) for the exact shape |
| `users.online` | `OnlineUser[]` | List of online users in the world (also resent on stage switch) |
| `session.kicked` | `{ reason }` | Sent to one socket before it is disconnected. `reason` is `kicked`, `banned` or `revoked` |
| `world.created` | Full World | World created (wire name of the `worlds.created` signal) |
| `world.updated` | Full World | World updated |
| `world.deleted` | `{ worldId }` | World removed |
| `world.deactivated` | `{}` | World deactivated. Sent with `io.emit` to **every** socket on the server, and the server disconnects every connected user in every world (see Notes) |
| `world.paused` | `{ worldId }` | World paused by GM |
| `world.resumed` | `{ worldId }` | World resumed by GM |
| `time.updated` | `{ worldId, worldTime, timeScale, paused, serverNow, calendarId? }` | World clock snapshot: sent on every change, on pause and resume, and about every 30 s while the clock runs. Clients compute the current time from the last snapshot |

## Effect Events

Relayed by `server/index.ts` through `lib/effect-relay.ts`. See [api/effects.md](../api/effects.md#signals) for when each is sent.

| Event | Payload (`data`) | Who receives it |
|--------|-------------------|-----------|
| `buff.created` | The applied effect | Every socket of the effect's world |
| `buff.updated` | The updated effect | Every socket of the world |
| `buff.deleted` | `{ id, worldId }` | Every socket of the world (relayed from the internal `buff.removed` signal, which carries the world) |
| `effect.requested` | `{ requestId, worldId, userId, templateId, targetCastId, targetActorId, templateName }` | Only the world's Assistant GM and Gamemaster sockets (role 3 and above) |
| `effect.denied` | `{ requestId, userId }` | Only the sockets of the player whose request was denied |

A `buff.*` or `effect.requested` payload without `worldId` is dropped (nothing is sent); `effect.denied` is routed by `userId`.

## Chat Events

| Event | Payload (`data`) | Description |
|--------|-------------------|-----------|
| `chat.message` | `{ id, userId, userName, userColor, type: 'chat', content, speaker, createdAt, worldId }` | Chat message |
| `chat.roll` | `{ id, userId, userName, userColor, formula, roll, actorId, speaker, createdAt, worldId }` | Dice roll. A hidden roll (`gmroll`, `blindroll`, `selfroll`) reaches every socket, but only the roller and the GM get the real values; the others get `roll: { mode }` and an empty `formula` |
| `chat.messageUpdated` | `{ id, worldId, roll, userId }` | A chat message's roll was changed (for example a reroll). Same visibility rule as `chat.roll` |
| `chat.messageDeleted` | `{ id, worldId }` | Message deleted via `DELETE /api/chat-messages/:id` |
| `chat.cleared` | `{ worldId }` | Whole chat history cleared via `DELETE /api/chat-messages` |

## Addon/System Events

| Event | Payload (`data`) | Description |
|--------|-------------------|-----------|
| `addon.installed` | `{ type, name, version }` | Addon installed |
| `addon.uninstalled` | `{ type, name }` | Addon removed |
| `roll-table.created` | Full Roll table | Roll table created (wire name of the `roll_tables.created` signal) |
| `roll-table.updated` | Full Roll table | Roll table updated |
| `roll-table.deleted` | `{ id, worldId, stageId }` | Roll table removed |
| `roll-table-entry.created` | Full Entry | Table entry created (wire name of the `roll_table_entries.created` signal) |
| `roll-table-entry.updated` | Full Entry | Table entry updated |
| `roll-table-entry.deleted` | `{ id, worldId, stageId }` | Table entry removed |
| `roll-table.rolled` | `{ tableId, result, formula, total, label }` | Roll table used — note the hyphen, unlike the underscored CRUD events above |
| `compendium.created` | Full Compendium pack | Pack created (wire name of the `compendium_packs.created` signal) |
| `compendium.updated` | Full Compendium pack | Pack updated |
| `compendium.deleted` | `{ id, worldId, stageId }` | Pack removed |
| `compendium.entry.updated` | `{ packId, entry }` | Compendium entry updated |
| `compendium.sourceEntryUpdated` | `{ sourceId, entryId }` | Entry of an addon/ruleset source changed; clients should reload the entry from the source route |
| `template.created` | Full Template | Area template created |
| `template.updated` | Full Template | Area template updated |
| `template.deleted` | `{ id, stageId }` | Area template removed |

## Custom relay for addon/system events (`module.*`, `system.*`, `socket.*`)

Any event a client emits whose name starts with `module.`, `system.`, or `socket.` is
automatically relayed to every other socket in the sender's world room — no server code
needs to register it. This is the escape hatch addons use for their own real-time events
without touching `server/index.ts`. The direct path (the event name emitted as-is on the socket,
`wsClient.socket.emit(name, data)`) is limited to 20 messages per second per socket and 64 KB per
payload; oversized or excess messages are dropped with a log entry. Display and stream sessions
are read-only and never relay. The same prefixes also work inside the `message` envelope
(`wsClient.send('module.x', data)`), which has no rate limit. The relayed event keeps its name and
its `data` unchanged; the sender does not receive its own event.

## Client→Server Events

Sent by wrapping in a single Socket.IO event named `'message'`: `socket.emit('message', {
type, data })`. `wsClient.send(type, data)` does this wrapping for you.

| Type | Payload (`data`) | Description |
|------|-------------------|-----------|
| `user.identify` | `{ worldId, isReconnect? }` | Identify and start sync; joins the `world:<id>` room. With `isReconnect: true` the server sends no `init`: it resends `users.online` and `cast.resync` instead |
| `context.update` | `{ worldId, stageId? }` | Re-scope rooms: (re)join `world:<id>`, leave all `stage:*` rooms, join `stage:<id>` if given |
| `token.move` / `moveMember` | `{ id, x, y, path? }` | Move token — broadcasts `cast.updated` and `token.moved`; `path` is the optional list of points marked on the way (relayed, not stored). A rejected move gets `token.move.rejected` back (`reason`: `rate-limited`, `not-found` or `forbidden`) |
| `token.drag` | `{ tokens: [{ id, x, y }], waypoints?, ended? }` | Live preview of a drag (not stored): the others see the line the mover is drawing, with the marked points; `ended: true` when the drag was cancelled. Relayed to the world room, sender excluded |
| `chat.message` | `{ content, speaker? }` | Send message |
| `chat.roll` | `{ formula, mode?, actorId?, speaker? }` | Roll dice. A rejected roll gets `chat.roll.rejected` back (`reason`: `rate-limited` or `invalid-formula`) |
| `stage.activate` | `{ stageId, worldId }` | Activate stage (GM only). Emits `stages.updated` and `stage.activated` |
| `stage.theater` | `{ stageId, active }` | Turn theater mode on or off (GM only). Persists `flags.theaterActive`, emits `stage.theaterToggled` |
| `stage.theaterSkin` | `{ stageId, skinId }` | Change the theater frame (GM only). Persists `flags.theaterSkin`, emits `stage.theaterSkinChanged` |
| `stage.theaterEffect` | `{ stageId, effect }` | Change the theater effect (GM only). Persists `flags.theaterEffect`, emits `stage.theaterEffectChanged` |
| `stage.theaterItems` | `{ stageId, items, worldId }` | Set the theater screen's pictures and texts (GM only). The server rebuilds the list field by field (max 80 items, picture addresses must be a file of this server or an https page), saves it in the scene's `flags.theaterItems` and broadcasts `stage.theaterItemsChanged` |
| `stage.cast` | `{ stageId, activeCast: [actorId, ...] }` | Set which actors appear as cards in theater mode (GM only, whole list every time). Persists `flags.activeCast` and emits `stage.castChanged` |
| `stage.castRoster` | `{ stageId, castRoster: [actorId, ...] }` | Set the scene roster (GM only). Actors removed from the roster also leave `activeCast`. Emits `stage.castRosterChanged` |
| `ping` | `{ timestamp? }` | Measure latency — server replies `pong` to sender and rebroadcasts `ping` to the world room |
| `canvas.ping` | `{ ...marker data }` | Shared visual ping (Ctrl+click) |
| `canvas.floatingText` | `{ x, y, text, color, options }` | Floating text or damage number, relayed to the world room as-is |
| `combat.animation` | `{ ...animation data }` | Combat animation cue, relayed to the world room as-is |
| `tile.effect` | `{ tileId, actionIndex, tokenId? }` | Run a tile's action. The server reads the action from the database and sends `tile.triggered` to the other sockets of the world, chosen by the action's `recipient`: `all` reaches everyone, `gm` and `trigger+gm` reach GM sockets only (the sender is never a target). `show-dialog` actions with a `journalId` are also filtered by that journal's ownership. Rate limited (shared move bucket) |
| `user.cursor` | `{ stageId, x, y }` | High-frequency cursor position — relayed to the stage room, excluding the sender, never persisted |
| `module.*` / `system.*` / `socket.*` | any | Custom relay, same as the section above |

## Notes

- **Documents with embedded fields (`ChildrenField`, e.g., `items` on Actor) always arrive populated in `*.updated`** — `Document.update()` (core) populates these fields before doing a `Signal.broadcast`, so it never comes with `items: undefined`/missing by mistake. An empty array in the payload is a real value (last child removed), not "unpopulated" — whoever listens to the event and merges local state must treat `undefined` and `[]` as different things.
- `_socketId` in a payload is used for sender exclusion (avoiding echo). The server removes it before sending `cast.updated` and `token.moved`, so clients never receive it.
- Events with a Signal but **no WS relay at all** (no `Signal.listen()` for them in `server/index.ts`, so `wsClient.on(...)` will never fire): `bug-report.*`, `campaign.*`, `zone.*`, `compendium.sourceFolderChanged`, `compendium.sourceLockChanged`, `operation.progress`, and the generic `<tableName>.*` events of tables without a relay (for example `settings.*`, `module_settings.*`, `walls.*`, `drawings.*`). `fog.*` is relayed (see the canvas table).
- **CODE ISSUE:** `client/components/card-progress.ts` (and a comment in `client/screens/setup-hub/worlds-tab.ts`) listens for `operation.progress`, but no `Signal.listen('operation.progress')` exists, so those listeners never fire. `compendium.sourceFolderChanged` and `compendium.sourceLockChanged` have the same problem: the client listens for them and nothing forwards them.
- **Audience of world-room events:** the relays filter by each document's `ownership` and a default permission level. When the ownership map is empty, the default decides: `0` means only GM sockets receive the event (`deck.*`, `combat.*`, `item.*` with no ownership), `1` means every player in the world. `actor.*` and `journal.*` also redact the payload for Limited players. `cast.*` tokens with `hidden: true` go only to GM sockets.
- `world.deactivated` is the exception to room scoping: it goes to every connected socket and disconnects every connected user, including users of other worlds.
- Most broadcasts are **room-scoped**, not truly global, despite the server-side helper being named `broadcastToAll()` — it resolves `worldId`/`stageId` from the payload and routes through `broadcastToWorld`/`broadcastToStage`, only falling back to a true all-sockets broadcast when neither can be resolved.
- `broadcastToWorldOwned()` exists for documents with per-row `ownership` (e.g. actors) — it iterates the room's live sockets and sends a redacted payload to anyone below Owner-level permission, instead of a single `io.to(room).emit(...)`.
- Addons can trigger custom events via the `module.*`/`system.*`/`socket.*` relay above, or coordinate through a server-side `Signal` listener directly.
