# Zones (Zonas de Trigger)

## Endpoints

**Base:** `/api/zones`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista zonas de trigger de uma stage.

---

### POST `/`

Cria zona.

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

**Evento interno:** Signal `zone.created` (server-side, **não relayado** para WebSocket)

---

### PUT `/:id`

Atualiza zona.

**Evento interno:** Signal `zone.updated` (server-side, **não relayado** para WebSocket)

---

### DELETE `/:id`

Remove zona.

**Evento interno:** Signal `zone.deleted` (server-side, **não relayado** para WebSocket)
