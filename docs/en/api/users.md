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
| `password` | `string` | (auto hash) |
| `color` | `string` | — |
| `colorHex` | `string` | — |
| `avatarUrl` | `string` | — |
| `pronouns` | `string` | — |
| `actorId` | `string` | — |

Only the user themselves, a GM (role >= 4) from the same world, or an admin session may edit
another user; only a GM/admin may change `role`.

**Response `200`:** Safe user (without password)
**Response `403`:** `{ "error": "Not authorized to edit this user" }` / `{ "error": "Only a Gamemaster can change roles" }`
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `users.updated` (auto-broadcast by the document layer)

---

### PUT `/:id/flags`

Merge-patch of user flags. Only the user themselves or a GM from the same world can change it.

**Request body:**

| Field | Type | Required |
|-------|------|-------------|
| `scope` | `string` | **yes** |
| `key` | `string` | **yes** |
| `value` | `any` | **yes** |

**Response `200`:** `{ "flags": {...} }`
**Response `400`:** `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Not authorized to set flags on this user" }`
**Response `404`:** `{ "error": "User not found" }`
**WS Event:** `users.updated` (auto-broadcast by the document layer, not scoped to the flags change)
