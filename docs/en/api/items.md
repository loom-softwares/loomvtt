# Items

Valid types: `weapon`, `spell`, `armor`, `equipment`, `consumable`, `tool`, `treasure`, `other`

## Endpoints

**Base:** `/api/items`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists items. `?worldId=`, `?populate=true`

**Response `200`:** `ItemsDocument[]`

---

### GET `/:id`

Fetches item by ID.

**Response `200`:** Item
**Response `404`:** `{ "error": "Item not found" }`
**Response `403`:** `{ "error": "Access denied" }`

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
| `actorId` | `string` | — (optional; attaches the item to that actor and broadcasts `actors.updated`) |

`type` also accepts any `itemType` declared by the world's ruleset manifest; an unrecognized
value silently falls back to `'equipment'` (no error).

Triggers `onCreateItem` hook.

**Response `201`:** Created item
**WS Event:** `item.created`

---

### PUT `/:id`

Updates item. Checks ownership.

Triggers `preUpdateItem`, `onUpdateItem` hooks.

**Response `200`:** Updated item
**WS Event:** `item.updated`

---

### DELETE `/:id`

Removes item. `?cascade=false` disables cascade.

Triggers `preDeleteItem`, `onDeleteItem` hooks.

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `item.deleted`
