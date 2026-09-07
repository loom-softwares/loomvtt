# Zones (Trigger Zones)

## Endpoints

**Base:** `/api/zones`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lists trigger zones of a stage.

---

### POST `/`

Creates zone.

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **yes** | — |
| `name` | `string` | **yes** | — |
| `shape` | `string` | no | `'rect'` |
| `x` | `number` | no | `0` |
| `y` | `number` | no | `0` |
| `width` | `number` | no | `100` |
| `height` | `number` | no | `100` |
| `points` | `array` | no | `[]` |
| `handlers` | `array` | no | `[]` |

**Internal Event:** Signal `zone.created` (server-side, **not relayed** to WebSocket)

---

### PUT `/:id`

Updates zone.

**Internal Event:** Signal `zone.updated` (server-side, **not relayed** to WebSocket)

---

### DELETE `/:id`

Removes zone.

**Internal Event:** Signal `zone.deleted` (server-side, **not relayed** to WebSocket)
