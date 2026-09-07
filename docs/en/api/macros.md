# Macros

## Endpoints

**Base:** `/api/macros`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists macros. `?worldId=`

---

### POST `/`

Creates macro.

| Field | Type | Description |
|-------|------|-----------|
| `worldId` | `string` | World |
| `name` | `string` | Name |
| `type` | `string` | Type (`script` requires role >= 3) |
| `command` | `string` | Command/code |
| `imgUrl` | `string` | Image URL |
| `slot` | `number` | Hotbar slot |

Creating a `type: 'script'` macro requires role >= 3 (Assistant GM/GM).

**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem criar macros do tipo script" }`
**WS Event:** `macros.created` (auto-broadcast by the document layer — the route itself never calls `Signal.broadcast`)

---

### PUT `/:id`

Updates macro. Editing a `script`-type macro also requires role >= 3; non-GM users may only
edit macros they own.

**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem editar macros do tipo script" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**WS Event:** `macros.updated` (auto-broadcast)

---

### DELETE `/:id`

Removes macro. Non-GM users may only delete macros they own.

**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**WS Event:** `macros.deleted` (auto-broadcast)
