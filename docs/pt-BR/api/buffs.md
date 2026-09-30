# Buffs (Efeitos)

## Endpoints

**Base:** `/api/buffs`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/actor/:actorId`

Lista buffs de um actor, ordenados por `createdAt` ascendente.

---

### GET `/item/:itemId`

Lista buffs de um item, ordenados por `createdAt` ascendente.

---

### POST `/`

Cria buff.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `name` | `string` | **sim** |
| `actorId` | `string` | sim (se sem `itemId`) |
| `itemId` | `string` | sim (se sem `actorId`) |
| `worldId` | `string` | sim (se sem `itemId`) |
| `icon` | `string` | não (default `''`) |
| `origin` | `string` | não (default `''`) |
| `duration` | `number` | não (default `-1`) |
| `disabled` | `boolean` | não (default `false`) |
| `changes` | `array` | não (default `[]`) |

**Response `400`:** `{ "error": "name is required" }` / `{ "error": "actorId or itemId is required" }` / `{ "error": "worldId or itemId is required" }`
**Evento interno:** Signal `buff.created` (server-side, **não relayado** para WebSocket)

---

### PUT `/:id`

Atualiza buff. Body: qualquer um de `name`, `icon`, `origin`, `duration`, `disabled`, `changes`.

**Response `404`:** retornado pra qualquer erro da atualização (não só "não encontrado")
**Evento interno:** Signal `buff.updated` (server-side, **não relayado** para WebSocket)

---

### DELETE `/:id`

Remove buff.

**Response `200`:** `{ "success": true }`
**Response `404`:** retornado pra qualquer erro da remoção
**Evento interno:** Signal `buff.deleted` (server-side, **não relayado** para WebSocket)
