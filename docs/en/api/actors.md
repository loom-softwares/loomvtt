# Actors

## Endpoints

**Base:** `/api/actors`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists actors. Filters by `?worldId=`. Non-GM users only see what they have permission for.

**Query:**
- `?worldId=`: filter by world
- `?populate=true`: include embedded children
- `?limit=`, `?offset=`: pagination

**Response `200`:** `ActorsDocument[]` (with `systemData` processed via `prepareData` and `withActiveEffects`)

Every actor route returns `systemData` with the active effects already applied. None of them returns the raw base values; only `GET /api/cast/:id` returns the raw token row.

---

### GET `/:id`

Fetches actor by ID.

**Response `200`:** Actor (populated and with prepareData). A user with Limited access (ownership level 1) gets the redacted version: only the `systemData` fields the ruleset lists in `limitedFields`. As on every actor route, `systemData` here has the active effects applied.
**Response `404`:** `{ "error": "Actor not found" }`
**Response `403`:** `{ "error": "Access denied" }`

---

### POST `/`

Creates actor. Requires the world permission `createActor` (the GM always passes; other roles only if listed in the world's permissions).

The world is taken from the signed-in session (`req.auth.worldId`); a `worldId` sent in the body is not used.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** | — |
| `type` | `string` | no | First `actorType` declared by the world's active ruleset, or `'character'` if none |
| `avatarUrl` | `string` | no | `''` |
| `systemData` | `object` | no | `getDefaultData(type)` of the active system |
| `folderId` | `string` | no | `''` |

`type` must be `'character'`/`'npc'` or one of the `actorTypes` declared in the world's
ruleset manifest (`ruleset.json`).

**Response `201`:** Actor created (with prepareData)
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }` or `{ "error": "Invalid actor type \"...\" for this world." }`
**Response `403`:** `{ "error": "Permission \"createActor\" required." }`, or no world session
**WS Event:** `actor.created` (Signal `actors.created`)

---

### PUT `/:id`

Updates actor.

**Request body:**

| Field | Type | Restriction |
|-------|------|-----------|
| `name` | `string` | — |
| `type` | `string` | `'character'`/`'npc'` or an `actorType` declared by the world's ruleset |
| `avatarUrl` | `string` | — |
| `systemData` | `object` | — (deep-merged, see below) |
| `folderId` | `string` | — |
| `ownership` | `object` | **GM only** can change |
| `flags` | `object` | — |

Non-GM users can only update an actor they can edit (ownership level 3); otherwise the response is 403.

**`systemData` is deep-merged** into the stored value, not replaced. Plain objects merge key by key, arrays and scalars replace the old value, and a key written as `"-=key"` deletes that key. A partial `systemData` is therefore a safe partial write.

**Response `200`:** Actor updated. The body is the actor row with `systemData` already effect-applied. Writing that object back as base data stores the active effects in the base values, so send only the fields you change.
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`, or `{ "error": "No valid fields provided for update." }` when the body has no known field
**Response `403`:** `{ "error": "Only the Gamemaster can change ownership." }`, or `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Actor not found" }`

**WS Event:** `actor.updated` (Signal `actors.updated`)

---

### DELETE `/:id`

Removes actor. Requires the GM or edit access (ownership level 3) to the actor.

**Query:** `?cascade=false` — turns off cascade delete for children

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Actor not found" }`
**WS Event:** `actor.deleted` (Signal `actors.deleted`)

---

### GET `/:actorId/items`

Lists actor's items.

**Response `200`:** `ItemsDocument[]`. A user with Limited access (ownership level 1) gets `[]`.
**Response `403`:** `{ "error": "Access denied" }` when the user has no access to the actor
**Response `404`:** `{ "error": "Actor not found" }`

---

### POST `/:actorId/items`

Creates item linked to the actor.

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `type` | `string` | `'equipment'` |
| `data` | `object` | `{}` |
| `imgUrl` | `string` | `''` |

**Response `201`:** Item created
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }` (the GM or edit access to the actor is required)
**Response `404`:** `{ "error": "Actor not found" }` (also when the actor belongs to another world)
**WS Event:** `actor.updated` (the whole actor, with its items)

---

### PUT `/:actorId/items/:itemId`

Updates actor's item.

**Request body:** any of `name`, `type`, `data`, `imgUrl`, `suppressed`

**Response `200`:** Item updated
**Response `404`:** `{ "error": "Item not found or does not belong to this actor" }`
**WS Event:** `actor.updated` (the whole actor, with its items)

There is no `GET /:actorId/items/:itemId`, so a sheet cannot load an embedded item from this route. To load an embedded item by id, use the world route `GET /api/items/:id`. The same route with `PUT` saves it, and when the item has an `actorId` the change is also cascaded to the actor.

---

### DELETE `/:actorId/items/:itemId`

Removes actor's item.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Item not found or does not belong to this actor" }`
**WS Event:** `actor.updated` (the whole actor, with its items)

---

### POST `/import-package`

Creates a character from a `loom-character-backup` package (a Loom Connect slot or a saved `.json`). The importer owns it. Allowed for the GM and for roles listed in the world's `importCharacter` permission (players by default). When the importer is not the GM the character waits for approval and nobody else sees it.

**Request body:** `{ "package": { "format": "loom-character-backup", "version": 1, "character": { ... } } }`

**Response `201`:** `{ "id": "...", "name": "...", "pending": false }` (`pending: true` when the importer is not the GM)
**Response `400`:** not a Loom character package, the character has no name, or more than 1000 items / 500 effects
**Response `403`:** not signed in to a world, or the GM has not allowed imports for this role
**Response `409`:** the world has no RPG system configured, or `{ "code": "SYSTEM_MISMATCH" }` when the package comes from another system
**WS Event:** `actor.updated` (Signal `actor.updated`, sent for the new actor)

---

### POST `/:id/approve-import`

GM only. Accepts a character imported by a player; it becomes visible according to its ownership.

**Response `200`:** `{ "id": "...", "status": "approved" }`
**Response `400`:** the character is not waiting for approval
**Response `403`:** `{ "error": "Só o Mestre pode aprovar um personagem importado." }` when the caller is not the GM
**Response `404`:** the character does not exist in the signed-in world

---

### POST `/:id/export-package`

Builds the same package for saving as a `.json` file. Needs a local account that owns the character, is assigned to it, or can edit it (the GM can export any).

**Response `200`:** `{ "package": { ... }, "displayName": "...", "systemVersion": "..." }`
**Response `403`:** no local account in the world, the account is banned or pending approval, or the character is not the caller's
**Response `404`:** the character does not exist in the world
**Response `409`:** the world has no RPG system, or its version cannot be identified

---

### POST `/:id/backup-package`

Same package, used by "Export to Loom Connect" (the browser then sends it to the site with the Loom Connect token).

**Request body:** `{ "exchangeCode": "..." }` — the Loom Connect exchange code. It is required (`400` when missing). The server exchanges it on the Loom site (`/api/oauth/exchange`).

**Response `200`:** same shape as `export-package`.
**Response `400`:** `{ "error": "Reautentique sua conta Loom Connect para salvar o backup." }` when `exchangeCode` is missing
**Response `401`:** the Loom Connect session expired, or the local session changed
**Response `403`:** the account is not linked to Loom Connect, or the Loom Connect account is not the one linked to this world user; also when the character is not the caller's
