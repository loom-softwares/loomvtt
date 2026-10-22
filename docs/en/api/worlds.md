# Worlds

## Endpoints

**Base:** `/api/worlds`
**Auth:** varies by route — most require `requireAuth, requireWorldMatch` or
`requireAdminSession` (Setup Hub session) or `requireAuth, requireGM` (game session
with GM role). World listing/selection routes (`GET /`, `GET /:id`, `GET
/:worldId/users`, `GET /:worldId/online-users`) respond **without any session** —
they are consumed by the login screen before any authentication exists.

`dataPath` and `permissions` only appear in the response if the caller has an admin session
(`toClientWorld`, `server/applications/api/worlds.ts:58`). `adminPassword` is never
returned.

---

## World (Basic CRUD)

### GET `/`

Lists all worlds. When a world has no `backgroundUrl` or `coverUrl`, the response fills `backgroundUrl` with the ruleset's art.

**Response `200`:** `World[]` (`adminPassword` never returned; `dataPath` and `permissions` only with an admin session)

---

### GET `/:id`

Fetches a world by ID.

**Response `200`:** `World`
**Response `404`:** `{ "error": "World not found" }`

---

### POST `/`

Creates a new world. **Auth:** `requireAdminSession`

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `system` | `string` | `'generic'` |
| `description` | `string` | `''` |
| `coverUrl` | `string` | `''` |
| `language` | `string` | `'en'` |
| `adminPassword` | `string` | `''` (hashed with bcrypt) |

The `id` is derived from the name (`'Night Campaign'` → `night-campaign`, with `-1`, `-2`… on collision). It
is also the folder name under `worlds/`. The route creates the world's assets folder, initializes the
world's database, saves the manifest, creates a default GM user (`name: 'Gamemaster'`, `role: 4`) and a
default scene (`'Cena Inicial'`) with one floor (`'Térreo'`) set as the scene's initial level.

**Response `201`:** `World` created
**Response `400`:** `{ "error": "name is required" }`
**WS Event:** `world.created` (wire name, sent to all connected sockets)

---

### PUT `/:id`

Updates a world. **Auth:** `requireAdminSession`

**Request body:** `name`, `system` (cannot change if already set), `description`,
`coverUrl`, `language`, `adminPassword`, `dataPath`, `backgroundUrl`, `theme`,
`nextSession`, `safeMode`, `resetPasswords` (boolean — if `true`, resets the password for all
users in the world)

**Response `200`:** `World` updated (with `dataPath`/`permissions`, since it requires admin
session)
**Response `404`:** world does not exist
**Response `400`:** `{ "error": "Cannot change the ruleset (system) of an existing world." }`
**WS Event:** `world.updated` (wire name, sent to all connected sockets). With `resetPasswords: true`, also `user.updated` with payload `{ worldId }` (no user id)

---

### DELETE `/:id`

Removes a world, its disk directory (`worlds/:id/`, including `world.sqlite`) and the
related records (`world_packages`, `users`). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**WS Events:** `world.deleted` and `user.deleted` (wire names, sent to all connected sockets; payloads `{ worldId }`)

---

## World — advanced fields

### GET `/:id/migration-status`

Checks if the world's database schema needs migration. **Auth:** `requireAdminSession`

**Response `200`:** `{ "needsMigration": boolean }`

---

### POST `/:id/backup`

Creates a full JSON dump of the world's database and saves it in the server's backup directory.
**Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`

---

### PUT `/:id/permissions`

GM (game session) adjusts the world's permission thresholds. **Auth:** `requireAuth,
requireGM`

**Request body:** `{ "permissions": object }`

**Response `200`:** `{ "permissions": object }`
**Response `400`:** `permissions` missing or is not an object

---

### GET `/:id/time`

Returns the world clock: the current world time, the clock speed, whether it is paused, and the calendar id. No session required.

The clock runs by itself on the server while the world is not paused (see `PUT` below), so `worldTime` is the value at the moment of the request.

**Response `200`:** `{ "worldId": string, "worldTime": number, "timeScale": number, "paused": boolean, "serverNow": number, "calendarId": string }`

| Field | Description |
|-------|-------------|
| `worldTime` | World seconds (a signed integer; negative means before the calendar epoch). |
| `timeScale` | World seconds per real second. Default `1`. |
| `paused` | `true` while the world is paused (the clock does not run). |
| `serverNow` | Server real time (ms since epoch) the snapshot was taken at. |
| `calendarId` | Id of the calendar the world uses. Default `gregorian`. |

**Response `404`:** `{ "error": "World not found" }`

---

### PUT `/:id/time`

Changes the world clock. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** at least one of:

| Field | Type | Description |
|-------|------|-------------|
| `advance` | `number` | Seconds to add to the current time. Wins over `worldTime` when both are sent. |
| `worldTime` | `number` | Sets the time directly. |
| `timeScale` | `number` | Clock speed in world seconds per real second. Greater than 0 and at most 100000. |
| `calendarId` | `string` | Calendar the world uses. Non-empty, at most 64 characters, trimmed. |

**Response `200`:** the same body as `GET`.
**Response `400`:** `{ "error": "Must provide advance, worldTime, timeScale or calendarId" }` (none of them was sent); `{ "error": "advance and worldTime must be finite numbers" }`; `{ "error": "timeScale must be a number greater than 0 and at most 100000" }`; `{ "error": "calendarId must be a non-empty string of at most 64 characters" }`
**Response `404`:** `{ "error": "World not found" }`
**WS Event:** `time.updated`, payload `{ worldId, worldTime, timeScale, paused, serverNow, calendarId }`. The server also sends it about every 30 seconds while the clock runs, and on pause and resume (those without `calendarId`), so clients can correct drift.

---

### PUT `/:id/basic-info`

GM (game session) edits superficial world information — never accepts
`system`/`dataPath`/`adminPassword` (exclusive to the admin route `PUT /:id`). **Auth:**
`requireAuth, requireWorldMatch, requireGM`

**Request body:** `name`, `backgroundUrl`, `theme`, `nextSession`, `description`, `effectsRequireGmApproval`
(any subset)

`effectsRequireGmApproval` is a boolean (the server stores its truthy value as `true` or `false`; the default is `false`). When it is `true`, a player's item effect waits for an Assistant GM or GM to approve it instead of applying at once. Tile effects are never gated. See [Effects: GM approval](effects.md#gm-approval).

**Response `200`:** `World` updated
**Response `404`:** world does not exist
**WS Event:** `world.updated`

---

### GET `/:worldId/invite-links`

Returns the addresses players use to join the world. **Auth:** a GM world session (`requireGM`
with a world token of this world, `401` without a token, `403` for a non-GM or another world's token),
or an admin session.

To find the Internet address when no tunnel runs, the server asks `https://api.ipify.org` for the
machine's public IPv4 (only the machine's own address is sent; cached for 10 minutes).

**Response `200`:**
```json
{
  "localLink": "http://192.168.0.10:3000",
  "tunnel": { "running": false, "mode": "off", "url": null },
  "publicLink": "",
  "port": 3000
}
```

`publicLink` is `http://<public-ip>:<port>` when no tunnel runs and a usable public address was found;
it only works if that port is open on the router. `tunnel` is the Cloudflare tunnel state
(see [tunnel.md](tunnel.md)).

---

## World Lifecycle

### POST `/:id/launch`

Activates the world (deactivates the others), without creating a GM session. The world starts
paused (`isPaused: true`), so its clock starts stopped until it is resumed. **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "..." }`
**Response `404`:** `{ "error": "World not found" }`
**WS Event:** `world.updated`

---

### POST `/:id/activate`

Activates the world for player login (without creating a GM session). Closes the previously active
world first, and the world starts paused, so its clock starts stopped until it is resumed. **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "...", "name": "..." }`
**Response `404`:** `{ "error": "World not found" }`
**WS Event:** `world.updated`; when another world was active, also `world.deactivated`, which disconnects every connected client

---

### POST `/:id/launch-gm`

Activates the world and returns a ready GM session (creates the GM user if they don't exist).
**Auth:** `requireAdminSession`

Also closes the previously active world, starts paused (so its clock starts stopped until it is resumed), and creates the `Gamemaster` user if the world has no `role: 4` user.

**Response `200`:** `{ "token": "...", "session": { worldId, worldName, userId, userName,
userColor, userRole } }` — also sets the `loom_world_token` cookie
**Response `400`:** `{ "error": "Este mundo não tem um sistema de RPG ativo. Configure um sistema antes de entrar." }` (world without defined `system`, or still `'generic'`)
**Response `404`:** `{ "error": "World not found" }`
**WS Event:** `world.updated`; `world.deactivated` (disconnects all clients) when another world was active

---

### POST `/:id/pause`

GM pauses the world (blocks player interaction). **Auth:** `requireAuth, requireWorldMatch, requireGM`

Pausing also stops the world clock (see `PUT /:id/time`); the time is saved.

**Response `200`:** `{ "isPaused": true }`
**WS Event:** `world.paused`

---

### POST `/:id/resume`

GM resumes the world. **Auth:** `requireAuth, requireWorldMatch, requireGM`

Resuming also restarts the world clock from the time it stopped at.

**Response `200`:** `{ "isPaused": false }`
**WS Event:** `world.resumed`

---

### POST `/deactivate`

Deactivates the active world for everyone (different from `session/logout`, which only logs out
the caller). Clears the caller's world cookie. **Auth:** `requireAuth, requireWorldMatch, requireGM`
(a GM game session, not the admin session)

**Response `200`:** `{ "success": true }`
**WS Event:** `world.deactivated`, which disconnects every connected client

---

## World Users

### GET `/:worldId/users`

Lists world users. Without any session, the `role` field is omitted (prevents an
anonymous user from identifying who the GM is before attempting `join`). `password`,
`siteAccountId` and `loomConnectAccountId` are never returned. The system users `Display Viewer` and
`Streamer` are filtered out. Users with `pendingApproval` or `banned` are hidden from callers that are
not a GM (or admin).

**Response `200`:** `User[]`

---

### GET `/:worldId/online-users`

IDs of currently connected users via WebSocket (used to gray out who is already online on the
user selection screen).

**Response `200`:** `string[]` (userIds)

---

### POST `/:worldId/users`

Creates a user in the world. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `role` | `number` | `1` (integer 0 to 4) |
| `password` | `string` | `''` (hashed) |
| `color` | `string` | `'#4f46e5'` |
| `avatarUrl` | `string` | `''` |

**Response `201`:** user created (without `password`)
**Response `400`:** `{ "error": "name is required" }` · `{ "error": "role must be an integer between 0 and 4" }`
**WS Event:** `user.created` (wire name; the Signal is `users.created`)

---

### PUT `/:worldId/users/:id`

Updates a user. **Auth:** `requireAuth, requireWorldMatch` (the route itself does not require GM).
A user can edit their own profile; a GM (role >= 4) or an admin can edit others. Editing another
user is refused if that user is a Gamemaster and the caller is not an admin session. Only a GM can
change `role` or assign `actorId` to someone else.
See also `PUT /api/users/:id` in [users.md](users.md), which has the same role rules.

**Request body:** `name`, `role`, `password` (if sent and different from `'••••'`, it is
re-hashed; changing it bumps `sessionVersion`), `color`, `avatarUrl`, `pronouns`, `actorId`

**Response `200`:** user updated (without `password`)
**Response `400`:** `{ "error": "role must be an integer between 0 and 4" }`
**Response `403`:** `{ "error": "Only a Gamemaster or the user themselves can update this profile" }` · `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Only a Gamemaster can change user roles" }` · `{ "error": "Only a Gamemaster can assign a character" }` · moderation errors (see [users.md](users.md), "Per-world user routes")
**Response `404`:** `{ "error": "User not found" }` (not in this world)
**WS Event:** `user.updated` (wire name, sent to all connected sockets)

---

### DELETE `/:worldId/users/:id`

Removes a user and disconnects its sessions. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`
**Response `403`:** moderation errors (you cannot delete your own account; only an admin session can moderate a Gamemaster)
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `user.deleted` (wire name, payload `{ id, worldId }`)

---

## World Packages

### GET `/:worldId/packages`

Complete catalog of addons + enabled/disabled state for this world. **Auth:** `requireAuth` (player, GM, admin, and the view-only display/stream sessions, which may call any GET).

**Response `200`:** `[{ id, name, version, description, author, repository, enabled }]` (`repository` is the manifest's link, returned only when it starts with `https://`, otherwise `""`)

---

### POST `/:worldId/packages`

Defines which addons are enabled in the world (admin). **Auth:** `requireAdminSession`

**Request body:** `{ "enabledModules"?: string[], "config"?: object }`

**Response `200`:** `{ "success": true, "enabledModules": [...], "worldId": "..." }`
**Response `404`:** world does not exist
**WS Event:** `world.updated`, payload `{ worldId, packageConfig }`

---

### POST `/:worldId/packages/gm`

Same as the route above, but called by the GM from inside the game session instead of the
Setup Hub. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body / Response:** identical to `POST /:worldId/packages`

---

---

### POST `/:worldId/connect-account`

Links the signed-in local user to a verified Loom Connect identity. The browser gets an access token from the site's popup and sends it here; the server confirms it with the site. A refusal from the site is never answered with `401`, so the rejected link does not reload the page (the client treats `401` as an expired session). **Auth:** `requireAuth, requireWorldMatch` (a local user session of this world; admin sessions are refused).

**Request body:** `{ "exchangeCode": "..." }` (required)

**Response `200`:** `{ "linked": true, "accountName": "...", "avatarUrl": "" }`
**Response `400`:** the site refused the code (the message says why) · `{ "error": "exchangeCode é obrigatório." }`
**Response `401`:** the local account of this world no longer exists
**Response `403`:** not signed in with a local account of this world, the user is banned or pending approval, or the account has no player role
**Response `409`:** the Loom Connect account (or the Loom account) is already linked to another user of the world
**Response `502`:** the site could not be reached or returned an invalid response

---

### DELETE `/:worldId/connect-account`

Removes the Loom Connect link of the signed-in local user.

**Response `403`:** not signed in with a local account of this world

## Game Session

### POST `/:worldId/join`

Authenticates a user in the world and returns a game session. Rate-limited (10
attempts/min per IP).

**Request body:** `{ "userId": "...", "password"?: "..." }`

**Response `200`:** `{ "token": "...", "session": { userId, userName, userColor,
userRole, worldId } }` — sets the `loom_world_token` cookie
**Response `400`:** world without active RPG system
**Response `401`:** `{ "error": "Incorrect password" }`; a GM/Assistant GM (`role >= 3`) without a password (`"GM/Assistant GM requires a password"`); or a Google-linked account (`authProvider: loom_site`) with no local password
**Response `403`:** `{ "error": "Usuário aguardando aprovação do Mestre." }` (pending approval) · `{ "error": "Esta conta foi banida deste mundo." }` (banned)
**Response `404`:** world or user not found
**Response `409`:** the account is already in use in another session (`ACCOUNT_IN_USE_MESSAGE`)

---

### POST `/:worldId/oauth-join`

Logs in (or requests access for) a player who authenticated with Google. **Rate-limited** (same limiter as `join`).

**Request body:** `{ "exchangeCode": "..." }` (single-use code; the server exchanges it with the Loom site)

The server creates the world user the first time (or queues it with `pendingApproval`).

**Response `200`:** `{ "pending": false, "token": "...", "session": { userId, userName, userColor, userRole, worldId } }`, sets the `loom_world_token` cookie
**Response `202`:** `{ "pending": true, "message": "..." }` (access requested, waiting for the GM's approval)
**Response `400`:** `{ "error": "exchangeCode é obrigatório." }` · world without an RPG system
**Response `403`:** banned user · a Gamemaster account (`role === 4`), which must use the local login
**Response `404`:** world not found
**Response `409`:** the account is already in use in another session
**Response `500`:** `{ "error": "Falha ao autenticar com Google." }`
**WS Event:** `user.created` when a new pending user is created

---

### POST `/session/logout`

Logs out the current user from the game (the world remains active for everyone else — different from
`POST /deactivate`).

**Response `200`:** `{ "success": true }`

---

### GET `/session/verify`

Resumes an already active game session (e.g. after F5). Independent from the admin
session — own cookie (`loom_world_token`), so a player/GM in-game never falls back to the
admin login screen upon reloading.

**Response `200`:** `{ "valid": true, "session": { userId, userName, userColor,
userRole, worldId } }` **or** `{ "valid": false }`

`valid` is `false` when there is no world token, the token is invalid, the world is not active, or the session has been idle too long. A valid check refreshes the idle timer.
