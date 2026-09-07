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

---

### GET `/:id`

Fetches actor by ID.

**Response `200`:** Actor (populated and with prepareData)
**Response `404`:** `{ "error": "Actor not found" }`
**Response `403`:** `{ "error": "Access denied" }`

---

### POST `/`

Creates actor.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** | — |
| `worldId` | `string` | no | `'world-1'` |
| `type` | `string` | no | First `actorType` declared by the world's active ruleset, or `'character'` if none |
| `avatarUrl` | `string` | no | `''` |
| `systemData` | `object` | no | `getDefaultData(type)` of the active system |
| `folderId` | `string` | no | `''` |

`type` must be `'character'`/`'npc'` or one of the `actorTypes` declared in the world's
ruleset manifest (`ruleset.json`).

**Response `201`:** Actor created (with prepareData)
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`
**WS Event:** `actors.created`

---

### PUT `/:id`

Updates actor.

**Request body:**

| Field | Type | Restriction |
|-------|------|-----------|
| `name` | `string` | — |
| `type` | `string` | `'character'`/`'npc'` or an `actorType` declared by the world's ruleset |
| `avatarUrl` | `string` | — |
| `systemData` | `object` | — |
| `folderId` | `string` | — |
| `ownership` | `object` | **GM only** can change |

**Response `200`:** Actor updated
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`
**Response `403`:** `{ "error": "Only the Gamemaster can change ownership." }`

**WS Event:** `actors.updated`

---

### DELETE `/:id`

Removes actor.

**Query:** `?cascade=false` — turns off cascade delete for children

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `actors.deleted`

---

### GET `/:actorId/items`

Lists actor's items.

**Response `200`:** `ItemsDocument[]`

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

---

### PUT `/:actorId/items/:itemId`

Updates actor's item.

**Request body:** any of `name`, `type`, `data`, `imgUrl`, `suppressed`

**Response `200`:** Item updated

---

### DELETE `/:actorId/items/:itemId`

Removes actor's item.

**Response `200`:** `{ "success": true, "id": "..." }`
