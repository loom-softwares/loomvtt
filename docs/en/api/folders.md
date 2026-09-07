# Folders

## Endpoints

**Base:** `/api/folders`
**Auth:** `requireAuth, requireWorldMatch`

Valid types: `actor`, `item`, `scene`, `journal`, `roll-table`, `macro`

---

### GET `/`

Lists folders. `?worldId=`, `?type=` to filter.

**Response `200`:** `FoldersDocument[]`

---

### GET `/:id`

Fetches folder by ID.

---

### POST `/`

Creates folder.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** | — |
| `type` | `string` | **yes** | — |
| `worldId` | `string` | no | `'world-1'` |
| `parent` | `string` | no | `''` |
| `sorting` | `string` | no | `'m'` |
| `color` | `string` | no | `''` |

Validates parent exists and type matches.

**WS Event:** `folder.created`

---

### PUT `/:id`

Updates folder. Prevents circular reference.

**WS Event:** `folder.updated`

---

### DELETE `/:id`

Removes folder. Reparents children, unlinks documents.

**WS Event:** `folder.deleted`
