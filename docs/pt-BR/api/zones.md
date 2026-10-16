# Zones (Zonas de Trigger)

## Endpoints

**Base:** `/api/zones`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista zonas de trigger de uma stage, da mais antiga para a mais nova.

**Response `200`:** `ZonesDocument[]`
**Response `500`:** `{ "error": "..." }`

---

### POST `/`

Cria zona. O id é gerado pelo servidor (`zone-<uuid>`).

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **sim** | — |
| `name` | `string` | **sim** | — |
| `shape` | `string` | não | `'rect'` |
| `x` | `number` | não | `0` |
| `y` | `number` | não | `0` |
| `width` | `number` | não | `100` |
| `height` | `number` | não | `100` |
| `points` | `array` | não | `[]` |
| `handlers` | `array` | não | `[]` |

**Response `201`:** Zona criada (a linha da zona)
**Response `400`:** `{ "error": "stageId and name are required" }`
**Response `500`:** `{ "error": "..." }`
**Evento interno:** Signal `zone.created` (só no servidor; **não** é relayado para os clientes WebSocket)

---

### PUT `/:id`

Atualiza zona. Atualização parcial de `name`, `shape`, `x`, `y`, `width`, `height`, `points`, `handlers`.

**Response `200`:** Zona atualizada (a linha da zona)
**Response `404`:** `{ "error": "..." }` (zona não encontrada)
**Response `500`:** `{ "error": "..." }`
**Evento interno:** Signal `zone.updated` (só no servidor; **não** é relayado para os clientes WebSocket)

---

### DELETE `/:id`

Remove zona.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }` (zona não encontrada)
**Response `500`:** `{ "error": "..." }`
**Evento interno:** Signal `zone.deleted` (só no servidor; **não** é relayado para os clientes WebSocket)
