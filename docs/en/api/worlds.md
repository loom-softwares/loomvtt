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

Lists all worlds.

**Response `200`:** `World[]` (sensitive fields omitted without admin session)

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

Also creates the world's assets folder, initializes the world's database, saves the manifest, and
creates a default GM user (`role: 4`).

**Response `201`:** `World` created

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
**Response `400`:** attempt to change the `system` of a world that already has one defined

---

### DELETE `/:id`

Removes a world, its disk directory (`worlds/:id/`, including `world.sqlite`) and the
related records (`world_packages`, `users`). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**WS Events:** `worlds.deleted`, `users.deleted`

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

Returns the world's current time (internal in-game clock).

**Response `200`:** `{ "worldTime": number }`

---

### PUT `/:id/time`

Updates the world's time. **Auth:** `requireAuth, requireGM`

**Request body:** `{ "advance": number }` (adds to the current time) **or** `{ "worldTime":
number }` (sets directly)

**Response `200`:** `{ "worldTime": number }`
**Response `400`:** neither field provided
**WS Event:** `time.updated`

---

### PUT `/:id/basic-info`

GM (game session) edits superficial world information — never accepts
`system`/`dataPath`/`adminPassword` (exclusive to the admin route `PUT /:id`). **Auth:**
`requireAuth, requireGM`

**Request body:** `name`, `backgroundUrl`, `theme`, `nextSession`, `description`
(any subset)

**Response `200`:** `World` updated
**Response `404`:** world does not exist

---

### GET `/:worldId/invite-links`

Returns the LAN address for players to join the world. **Auth:** `requireAuth,
requireGM`

**Response `200`:** `{ "localLink": "http://<lan-ip>:<port>" }`

---

## World Lifecycle

### POST `/:id/launch`

Activates the world (deactivates the others), without creating a GM session. **Auth:**
`requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "..." }`
**WS Event:** `worlds.updated`

---

### POST `/:id/activate`

Activates the world for player login (without creating a GM session). **Auth:**
`requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "...", "name": "..." }`
**WS Event:** `worlds.updated`

---

### POST `/:id/launch-gm`

Activates the world and returns a ready GM session (creates the GM user if they don't exist).
**Auth:** `requireAdminSession`

**Response `200`:** `{ "token": "...", "session": { worldId, worldName, userId, userName,
userColor, userRole } }` — also sets the `loom_world_token` cookie
**Response `400`:** world without defined `system` (or still `'generic'`)
**Response `404`:** world does not exist

---

### POST `/:id/pause`

GM pauses the world (blocks player interaction). **Auth:** `requireAuth, requireGM`

**Response `200`:** `{ "isPaused": true }`
**WS Event:** `world.paused`

---

### POST `/:id/resume`

GM resumes the world. **Auth:** `requireAuth, requireGM`

**Response `200`:** `{ "isPaused": false }`
**WS Event:** `world.resumed`

---

### POST `/deactivate`

Deactivates the active world for everyone (different from `session/logout`, which only logs out
the caller). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**WS Event:** `world.deactivated`

---

## World Users

### GET `/:worldId/users`

Lists world users. Without any session, the `role` field is omitted (prevents an
anonymous user from identifying who the GM is before attempting `join`). `password` is never returned.

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
| `role` | `number` | `1` |
| `password` | `string` | `''` (hashed) |
| `color` | `string` | `'#4f46e5'` |
| `avatarUrl` | `string` | `''` |

**Response `201`:** user created (without `password`)

---

### PUT `/:worldId/users/:id`

Updates a user. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** `name`, `role`, `password` (if sent and different from `'••••'`, it is
re-hashed), `color`, `avatarUrl`, `pronouns`, `actorId`

**Response `200`:** user updated (without `password`)
**WS Event:** `user.updated`

---

### DELETE `/:worldId/users/:id`

Removes a user. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`

---

## World Packages

### GET `/:worldId/packages`

Complete catalog of addons + enabled/disabled state for this world.

**Response `200`:** `[{ id, name, version, description, enabled }]`

---

### POST `/:worldId/packages`

Defines which addons are enabled in the world (admin). **Auth:** `requireAdminSession`

**Request body:** `{ "enabledModules"?: string[], "config"?: object }`

**Response `200`:** `{ "success": true, "enabledModules": [...], "worldId": "..." }`
**Response `404`:** world does not exist
**WS Event:** `worlds.updated`

---

### POST `/:worldId/packages/gm`

Same as the route above, but called by the GM from inside the game session instead of the
Setup Hub. **Auth:** `requireAuth, requireGM`

**Request body / Response:** identical to `POST /:worldId/packages`

---

## Game Session

### POST `/:worldId/join`

Authenticates a user in the world and returns a game session. Rate-limited (10
attempts/min per IP).

**Request body:** `{ "userId": "...", "password"?: "..." }`

**Response `200`:** `{ "token": "...", "session": { userId, userName, userColor,
userRole, worldId } }` — sets the `loom_world_token` cookie
**Response `400`:** world without active RPG system
**Response `401`:** incorrect password, or GM/Assistant GM user (`role >= 3`) trying
to enter without a password
**Response `404`:** world or user not found

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
