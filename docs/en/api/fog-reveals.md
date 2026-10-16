# Fog Reveals

## Endpoints

**Base:** `/api/fog-reveals`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on `DELETE /stage/:stageId`)

---

### GET `/stage/:stageId/user/:userId`

Fetches explored areas for one floor (query `?levelId=`, max 64 chars, empty for a scene without floors).

- The record read depends on the stage's `fogExplorationMode`: in `shared` mode the record of the shared pool (`userId: 'shared'`) is returned for everyone. Otherwise a GM can read any `:userId`; a player always gets their own record, whatever `:userId` is in the path.
- `404` `{ "error": "Stage not found" }` if the stage does not exist.

**Response `200`:** Fog reveal record or `{ "explored": [] }` if there is none yet.

---

### POST `/`

Adds explored areas for a stage and floor. The record is keyed on `stageId` + `levelId` + the owner: in `shared` mode the owner is `'shared'` for every user; otherwise it is the caller's own user ID. Polygons are merged with the stored ones (duplicates are dropped by a signature of the points).

| Field | Type | Required | Notes |
|-------|------|-------------|-------|
| `stageId` | `string` | **yes** | |
| `newPolygons` | `array` | no | Preferred input: the new polygons. Used when it is a non-empty array. |
| `explored` | `array` | no (default `[]`) | Fallback input when `newPolygons` is empty or missing. |
| `levelId` | `string` | no (default empty) | The floor the polygons were explored on: each floor keeps its own record. |
| `userId` | — | ignored | Taken from the auth token instead — a client-supplied `userId` would let a player overwrite another player's fog, so the body value is never used. |

**Response `201`:** The created record (first reveal for that owner/stage/floor).
**Response `200`:** `{ "id", "stageId", "userId", "levelId", "newPolygons" }`, where `newPolygons` is the delta received in this request (the stored record is not returned).
**Response `400`:** `{ "error": "stageId and authenticated user are required" }`, or `{ "error": "Fog exploration is disabled on this stage" }` when the stage mode is `none`.
**Response `404`:** `{ "error": "Stage not found" }`.

**WS Event:** `fog.updated` for both the first and later reveals, sent to the stage room (`stage:<id>`). In `shared` mode everyone in the stage receives it; in individual mode only the owner and GMs do. The payload has `newPolygons` (the delta) and `userId`.

---

### DELETE `/stage/:stageId/mine`

Clears the exploration of the calling user in a stage (individual mode).

**Response `200`:** `{ "success": true }`
**Response `401`:** `{ "error": "Unauthorized" }` if there is no authenticated user.

**WS Event:** `fog.reset`, sent to the stage room; with a `userId` in the payload only that user and GMs receive it.

---

### DELETE `/stage/:stageId`

Clears exploration for every user in a stage. **GM only** (`403` for other users).

**Response `200`:** `{ "success": true }`

**WS Event:** `fog.reset`, sent to everyone in the stage room (no `userId` in the payload).
