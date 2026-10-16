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
| `door` | `number` | `0` | Door type: `0` none, `1` door, `2` secret door, `3` window (opens and closes like a door, window icon) |
| `doorState` | `number` | `0` | Door state |
| `doorDistance` | `number` | `0` | How close a token owned by the player must be to open the door, in grid squares (`0` = no limit; the GM is exempt) |
| `doorSoundOpen` | `string` | `''` | Sound played when the door opens |
| `doorSoundClose` | `string` | `''` | Sound played when the door closes |

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

**Request body:** Schema fields above. Unsent fields take their defaults; no coordinate validation is done in the route.

**Response `201`:** Wall created
**Response `400`:** `{ "error": "..." }` (document-layer error)
**WS Event:** `wall.created`

---

### PUT `/:id`

Updates a wall. Partial update: only the fields sent are changed. Accepts `x1`, `y1`, `x2`, `y2`, `sight`, `light`, `movement`, `sound`, `direction`, `wallType`, `door`, `doorState`, `levelId`, `doorDistance` (clamped to `>= 0`), `doorSoundOpen` and `doorSoundClose` (both stored as strings).

**Response `200`:** Wall updated (the wall row)
**Response `404`:** `{ "error": "..." }` (wall not found)
**WS Event:** `wall.updated`

---

### PUT `/:id/state`

Updates only the door state.

**Request body:** `{ "doorState": 0 | 1 }`

**Response `200`:** Wall (the wall row)
**Response `404`:** `{ "error": "..." }` (wall not found)
**WS Event:** `door.state`, payload `{ wallId, door, doorState, worldId }`, scoped to the sender's world

---

### POST `/bulk-delete`

Deletes many walls in one request and sends one event. **Auth:** `requireAuth, requireWorldMatch, requireGM`.

**Request body:** `{ "ids": string[] }` (duplicates are removed; at most `20000` ids per request)

Only walls that belong to stages of the caller's world are deleted; other ids are ignored.

**Response `200`:** `{ "success": true, "deleted": ["..."] }` (the ids actually deleted)
**Response `400`:** `{ "error": "No wall ids given." }` or `{ "error": "At most 20000 walls per request." }`
**Response `403`:** `{ "error": "A world session is required." }`
**Response `500`:** `{ "error": "Failed to delete walls." }`
**WS Event:** `wall.bulkDeleted`, payload `{ ids }`, sent only when at least one wall was deleted

---

### DELETE `/:id`

Removes a wall.

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "..." }` (document-layer error)
**WS Event:** `wall.deleted`, payload `{ id }`
