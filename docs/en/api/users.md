# Users

## Endpoints

**Base:** `/api/users`
**Auth:** `requireAuth, requireWorldMatch`

---

### PUT `/:id`

Updates user.

**Request body:**

| Field | Type | Restriction |
|-------|------|-----------|
| `name` | `string` | — |
| `role` | `number` | — |
| `password` | `string` | bcrypt-hashed (cost 10). Send `'••••'` to keep the current password; an empty string clears it |
| `color` | `string` | — |
| `colorHex` | `string` | — |
| `avatarUrl` | `string` | — |
| `pronouns` | `string` | — |
| `actorId` | `string` | Character link. Only a GM of the world or an admin may change it |

Only the user themselves, a GM (role >= 4) from the same world, or an admin session may edit
another user; only a GM/admin may change `role`. A Gamemaster account (role >= 4) can only be
changed by an admin session when the change touches role, character, or another user's password.

`role` must be an integer from 0 to 4. A change to `role` or `password` increments the user's
`sessionVersion`, which invalidates existing sessions: when a user changes their own password
(and not their role), a new world cookie is issued to that browser; otherwise the user's live
sessions are disconnected with reason `revoked`.

**Response `200`:** Safe user (without `password`, `siteAccountId`, `loomConnectAccountId`)
**Response `400`:** `{ "error": "role must be an integer between 0 and 4" }`
**Response `403`:** `{ "error": "Not authorized to edit this user" }` · `{ "error": "Only a Gamemaster can change roles" }` · `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Only a Gamemaster can assign a character" }`
**Response `404`:** `{ "error": "User not found" }`
**Response `500`:** `{ "error": "..." }`
**WS Event:** `user.updated` (wire name, sent to all connected sockets; the Signal is `users.updated`, relayed by the document layer)

---

### PUT `/:id/flags`

Sets one flag: `flags[scope][key] = value`, keeping the other flags. Only the user themselves, a GM
from the same world, or an admin session can change it. A Gamemaster account (role >= 4) can be
changed only by itself or an admin session.

**Request body:**

| Field | Type | Required |
|-------|------|-------------|
| `scope` | `string` | **yes** |
| `key` | `string` | **yes** |
| `value` | `any` | no check in the route (a missing `value` is stored as `undefined`, i.e. dropped) |

**Response `200`:** `{ "flags": {...} }`
**Response `400`:** `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Not authorized to set flags on this user" }`
**Response `404`:** `{ "error": "User not found" }`
**Response `500`:** `{ "error": "..." }`
**WS Event:** `user.updated` (wire name, sent to all connected sockets, carries the whole user row)

---

## Per-world user routes (`worlds.ts`)

These routes live under `/api/worlds/:worldId/users`. Listing, creating, editing and deleting users are documented in [worlds.md](worlds.md#world-users). The moderation routes below are only here.

### POST `/api/worlds/:worldId/users/:id/kick`

Disconnects every live session of the user. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true, "disconnected": number }`
**Response `403`:** `{ "error": "You cannot moderate your own account." }` · `{ "error": "Only an admin session can moderate another Gamemaster." }`
**Response `404`:** `{ "error": "User not found" }`

---

### POST `/api/worlds/:worldId/users/:id/ban`

Bans the user from the world: sets `banned: true`, bumps `sessionVersion`, and disconnects live sessions. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true, "disconnected": number }`
**Response `403`:** same moderation errors as kick
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `user.updated` (the moderation routes send the `users.updated` Signal, relayed to `user.updated`)

---

### POST `/api/worlds/:worldId/users/:id/unban`

Clears `banned`. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`
**Response `403`:** same moderation errors as kick
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `user.updated`

---

### POST `/api/worlds/:worldId/users/:id/approve`

Approves a pending user link: clears `pendingApproval` and sets `role`. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** `{ "role"?: number }` (default `1`; clamped to `1..4`)

**Response `200`:** the updated user (safe fields)
**Response `400`:** `{ "error": "..." }` (document-layer error)
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `user.updated`

---

### POST `/api/worlds/:worldId/users/:id/reject`

Deletes a user that is pending approval. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "Apenas usuários com vínculo pendente podem ser rejeitados." }` (the user is not pending)
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `user.deleted` (payload `{ id, worldId }`)
