# Folders

## Endpoints

**Base:** `/api/folders`
**Auth:** `requireAuth, requireWorldMatch`

Valid types: `actor`, `item`, `scene`, `journal`, `roll-table`, `macro`, `deck`, `playlist`, `compendium`, `compendium-entry`, `compendium-source-owner`

---

### GET `/`

Lists folders, oldest first (`createdAt` asc). `?worldId=`, `?type=` to filter; `?packId=` filters by pack (applied to any type, but only useful for `compendium-entry`).

**Response `200`:** `FoldersDocument[]`

---

### GET `/:id`

Fetches folder by ID. `404` `{ "error": "Folder not found" }` if missing.

---

### POST `/`

Creates folder. Responds `201` with the created folder.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** (non-empty after trim) | — |
| `type` | `string` | **yes** (one of the valid types) | — |
| `worldId` | `string` | no | `'world-1'` |
| `packId` | `string` | **yes** for `compendium-entry`, otherwise no | `''` |
| `parent` | `string` | no | `''` |
| `sorting` | `string` | no | `'m'` |
| `color` | `string` | no | `''` |

Validates parent exists, type matches and, for `compendium-entry`, the same `packId`. Validation errors return `400`.

**WS Event:** `folder.created`

---

### PUT `/:id`

Updates folder. Accepts `name`, `parent`, `sorting`, `color`, `hubLogoUrl`, `hubBackground`; no valid field returns `400`. A `parent` equal to the folder's own id or to its current parent is ignored. A new parent must exist and have the same type. The route does **not** check ancestor cycles (A → B → A is accepted).

**WS Event:** `folder.updated`

---

### DELETE `/:id`

Removes folder. Query or body options:

| Option | Default | Effect |
|--------|---------|--------|
| `deleteSubfolders` | `false` | Deletes all descendant folders too (recursive); documents inside them are unlinked. |
| `reparentTo` | `'root'` | Only `'root'` is honored: child folders go to the root. Any other value is ignored and children move to the deleted folder's parent (see CODE ISSUE). |
| `deleteContents` | `false` | Deletes the world items inside the folder(s). GM only (`403` otherwise); only for `item` folders (`400` otherwise). |

Documents in the folder are unlinked (`folderId` set to `''`). Responses: `{ "success": true, "id", "deletedItems" }`, or with `deleteSubfolders`: `{ "success": true, "deletedIds", "deletedItems" }`.

**WS Events:** `folder.deleted` per removed folder (`{ id }`), `item.deleted` per deleted item when `deleteContents` is set.

> CODE ISSUE: `reparentTo` other than `'root'` is ignored (`server/applications/api/folders.ts`, `newParent` line). Documented as the actual behavior until fixed.
