# Items

Valid types: `weapon`, `spell`, `armor`, `equipment`, `consumable`, `tool`, `treasure`, `other`

## Endpoints

**Base:** `/api/items`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists items, oldest first (`createdAt` asc). `?worldId=`, `?limit=`, `?offset=`, `?populate=true`.

Non-GM users only get the items they can view (`canView` on the item's ownership; embedded items are checked on the owning actor's ownership).

**Response `200`:** `ItemsDocument[]`

---

### GET `/:id`

Fetches item by ID.

**Response `200`:** Item
**Response `404`:** `{ "error": "Item not found" }`
**Response `403`:** `{ "error": "Access denied" }` (non-GM without view access; an embedded item needs at least Observer (2) on the owning actor)

---

### POST `/`

Creates item.

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `worldId` | `string` | `'world-1'` |
| `type` | `string` | `'equipment'` |
| `data` | `object` | `{}` |
| `imgUrl` | `string` | `''` |
| `folderId` | `string` | `''` |
| `actorId` | `string` | — (optional; attaches the item to that actor and triggers an `actor.updated` broadcast) |

`type` also accepts any `itemType` declared by the world's ruleset manifest; an unrecognized
value silently falls back to `'equipment'` (no error).

Triggers `onCreateItem` hook.

**Response `201`:** Created item
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**Response `500`:** `{ "error": "Failed to create item" }`
**WS Events:** `item.created`; plus `actor.updated` (the actor with its items) when `actorId` is set.

---

### PUT `/:id`

Updates item. Non-GM users need edit access (`canEdit`; for embedded items, on the owning actor's ownership), otherwise `403`.

| Field | Notes |
|-------|-------|
| `name` | Trimmed. |
| `type` | Must be a native type or a ruleset `itemType`; an invalid value is ignored and the current type is kept (unlike `POST`, which falls back to `'equipment'`). |
| `data`, `imgUrl`, `folderId`, `suppressed`, `flags` | Stored as sent. |

Only the fields sent are changed. No valid field returns `400` `{ "error": "No valid fields provided for update." }`. `404` if the item does not exist.

Triggers `preUpdateItem(id, updates)` before the write and `onUpdateItem(updated)` after it.

**Response `200`:** Updated item
**WS Events:** `item.updated`; plus `actor.updated` when the item is embedded (`actorId` set).

---

### DELETE `/:id`

Removes item. Non-GM users need edit access (`403` otherwise). `?cascade=false` skips deleting the item's child documents (cascade is on by default).

Triggers `preDeleteItem(id)` before and `onDeleteItem(id)` after the delete.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Item not found" }`
**WS Events:** `item.deleted` (payload `{ id }`); plus `actor.updated` when the item was embedded.
