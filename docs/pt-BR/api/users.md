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
| `password` | `string` | bcrypt (custo 10). Envie `'••••'` para manter a senha atual; string vazia limpa a senha |
| `color` | `string` | — |
| `colorHex` | `string` | — |
| `avatarUrl` | `string` | — |
| `pronouns` | `string` | — |
| `actorId` | `string` | Vínculo com personagem. Só um GM do mundo ou um admin pode alterá-lo |

Só o próprio usuário, um GM (role >= 4) do mesmo mundo, ou uma sessão admin podem editar
outro usuário; só um GM/admin pode mudar `role`. Uma conta de Gamemaster (role >= 4) só pode ser
alterada por uma sessão admin quando a mudança envolve role, personagem ou a senha de outro usuário.

`role` deve ser um inteiro de 0 a 4. Uma mudança em `role` ou `password` incrementa o `sessionVersion`
do usuário, o que invalida as sessões existentes: quando o usuário troca a própria senha (e não o role),
um novo cookie do mundo é emitido para aquele navegador; caso contrário, as sessões ativas do usuário
são desconectadas com motivo `revoked`.

**Response `200`:** Safe user (sem `password`, `siteAccountId`, `loomConnectAccountId`)
**Response `400`:** `{ "error": "role must be an integer between 0 and 4" }`
**Response `403`:** `{ "error": "Not authorized to edit this user" }` · `{ "error": "Only a Gamemaster can change roles" }` · `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Only a Gamemaster can assign a character" }`
**Response `404`:** `{ "error": "User not found" }`
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `user.updated` (nome no fio, enviado a todos os sockets conectados; o Signal é `users.updated`, relayado pela camada de documento)

---

### PUT `/:id/flags`

Define uma flag: `flags[scope][key] = value`, mantendo as demais flags. Só o próprio usuário, um GM do
mesmo mundo, ou uma sessão admin podem alterá-la. Uma conta de Gamemaster (role >= 4) só pode ser alterada
por ela mesma ou por uma sessão admin.

**Request body:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `scope` | `string` | **sim** |
| `key` | `string` | **sim** |
| `value` | `any` | sem checagem na rota (um `value` ausente é guardado como `undefined`, ou seja, descartado) |

**Response `200`:** `{ "flags": {...} }`
**Response `400`:** `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Not authorized to set flags on this user" }`
**Response `404`:** `{ "error": "User not found" }`
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `user.updated` (nome no fio, enviado a todos os sockets conectados, carrega a linha completa do usuário)

---

## Rotas de usuário por mundo (`worlds.ts`)

Estas rotas ficam em `/api/worlds/:worldId/users`. Listar, criar, editar e remover usuários estão documentados em [worlds.md](worlds.md#usuários-do-mundo). As rotas de moderação abaixo estão só aqui.

### POST `/api/worlds/:worldId/users/:id/kick`

Desconecta todas as sessões ativas do usuário. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true, "disconnected": number }`
**Response `403`:** `{ "error": "You cannot moderate your own account." }` · `{ "error": "Only an admin session can moderate another Gamemaster." }`
**Response `404`:** `{ "error": "User not found" }`

---

### POST `/api/worlds/:worldId/users/:id/ban`

Bane o usuário do mundo: define `banned: true`, incrementa `sessionVersion` e desconecta as sessões ativas. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true, "disconnected": number }`
**Response `403`:** mesmos erros de moderação do kick
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `user.updated` (as rotas de moderação enviam o Signal `users.updated`, relayado como `user.updated`)

---

### POST `/api/worlds/:worldId/users/:id/unban`

Limpa `banned`. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`
**Response `403`:** mesmos erros de moderação do kick
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `user.updated`

---

### POST `/api/worlds/:worldId/users/:id/approve`

Aprova um vínculo pendente: limpa `pendingApproval` e define `role`. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** `{ "role"?: number }` (padrão `1`; limitado a `1..4`)

**Response `200`:** o usuário atualizado (campos seguros)
**Response `400`:** `{ "error": "..." }` (erro da camada de documento)
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `user.updated`

---

### POST `/api/worlds/:worldId/users/:id/reject`

Remove um usuário que está aguardando aprovação. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "Apenas usuários com vínculo pendente podem ser rejeitados." }` (o usuário não está pendente)
**Response `404`:** `{ "error": "User not found" }`
**Evento WS:** `user.deleted` (payload `{ id, worldId }`)

