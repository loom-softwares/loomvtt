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

Defaults: `type` `'chat'`, `command` `''`, `imgUrl` `''`, `slot` `-1`. `worldId` is not validated
here beyond `requireWorldMatch`.

Creating a `type: 'script'` macro requires role >= 3 (Assistant GM/GM).

**Response `201`:** Created macro (the row)
**Response `400`:** `{ "error": "..." }` (Document error)
**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem criar macros do tipo script" }`
**WS Event:** `macro.created` (payload: the created row, relayed to all clients). The route never calls `Signal.broadcast`; the document layer emits `macros.created` and `server/index.ts` relays it.

---

### PUT `/:id`

Updates macro. Editing a `script`-type macro also requires role >= 3; non-GM users may only
edit macros they own. Only `name`, `type`, `command`, `imgUrl` and `slot` are copied from the body.

**Response `200`:** `{ "success": true }` (not the updated row)
**Response `400`:** `{ "error": "..." }` (Document error)
**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem editar macros do tipo script" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**WS Event:** `macro.updated` (payload: the updated row, relayed to all clients)

---

### DELETE `/:id`

Removes macro. Non-GM users may only delete macros they own.

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "..." }` (Document error)
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**WS Event:** `macro.deleted` (payload: `{ id, worldId, stageId }`, relayed to all clients)
