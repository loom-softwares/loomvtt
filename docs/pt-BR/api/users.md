# Users (Usuários)

## Endpoints

**Base:** `/api/users`
**Auth:** `requireAuth, requireWorldMatch`

---

### PUT `/:id`

Atualiza usuário.

**Request body:**

| Campo | Tipo | Restrição |
|-------|------|-----------|
| `name` | `string` | — |
| `role` | `number` | — |
| `password` | `string` | (hash automático) |
| `color` | `string` | — |
| `colorHex` | `string` | — |
| `avatarUrl` | `string` | — |
| `pronouns` | `string` | — |
| `actorId` | `string` | — |

Só o próprio usuário, um GM (role >= 4) do mesmo mundo, ou uma sessão admin podem editar
outro usuário; só um GM/admin pode mudar `role`.

**Response `200`:** Safe user (sem password)
**Response `403`:** `{ "error": "Not authorized to edit this user" }` / `{ "error": "Only a Gamemaster can change roles" }`
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `users.updated` (auto-broadcast pela camada de documento)

---

### PUT `/:id/flags`

Merge-patch de flags de usuário. Só o próprio usuário ou um GM do mesmo mundo pode alterar.

**Request body:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `scope` | `string` | **sim** |
| `key` | `string` | **sim** |
| `value` | `any` | **sim** |

**Response `200`:** `{ "flags": {...} }`
**Response `400`:** `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Not authorized to set flags on this user" }`
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `users.updated` (auto-broadcast pela camada de documento, não filtrado só pra mudança de flags)

