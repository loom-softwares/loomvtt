# Walls

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `id` | `string` | UUID | |
| `stageId` | `string` | — | Stage |
| `x1` | `number` | — | Start point X |
| `y1` | `number` | — | Start point Y |
| `x2` | `number` | — | End point X |
| `y2` | `number` | — | End point Y |
| `sight` | `boolean` | `true` | Blocks sight |
| `light` | `boolean` | `true` | Blocks light |
| `movement` | `boolean` | `true` | Blocks movement |
| `sound` | `boolean` | `true` | Blocks sound |
| `levelId` | `string` | — | Level ID (floor) |
| `direction` | `number` | `0` | Direction |
| `wallType` | `string` | `'normal'` | Wall type (`normal`, etc.) |
| `door` | `number` | `0` | Door type |
| `doorState` | `number` | `0` | Door state |

## Endpoints

**Base:** `/api/walls`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lists walls of a stage.

**Response `200`:** `WallsDocument[]`

---

### POST `/stage/:stageId`

Creates a wall.

**Request body:** Schema fields above.

**Response `201`:** Wall created
**WS Event:** `wall.created`

---

### PUT `/:id`

Updates a wall.

**WS Event:** `wall.updated`

---

### PUT `/:id/state`

Updates only the door state.

**Request body:** `{ "doorState": 0 | 1 }`

**WS Event:** `door.state`

---

### DELETE `/:id`

Removes a wall.

**Response `200`:** `{ "success": true }`
**WS Event:** `wall.deleted`
