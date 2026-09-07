# Drawings

## Schema (persisted columns — `server/applications/schemas/drawings.schema.ts`)

| Field | Type | Default |
|-------|------|---------|
| `id` | `string` | UUID |
| `stageId` | `string` | — |
| `levelId` | `string` | `''` |
| `type` | `string` | `'rectangle'` |
| `x` | `number` | `0` |
| `y` | `number` | `0` |
| `width` | `number` | `100` |
| `height` | `number` | `100` |
| `rotation` | `number` | `0` |
| `z` | `number` | `0` |
| `fillColor` | `string` | `'#000000'` |
| `fillOpacity` | `number` | `0.3` |
| `strokeColor` | `string` | `'#ffffff'` |
| `strokeWidth` | `number` | `1` |
| `text` | `string` | `''` |
| `fontFamily` | `string` | `'Arial'` |
| `fontSize` | `number` | `16` |
| `points` | `array` | `[]` |
| `imgUrl` | `string` | `''` |
| `isHidden` | `boolean` | `false` |
| `isLocked` | `boolean` | `false` |
| `authorId` | `string` | `''` |
| `createdAt` / `updatedAt` | `string` | — |

> `imgUrl` and `authorId` are schema columns the `POST`/`PUT /:id` handlers don't set — they
> always sit at their default (no UI writes them yet).

## Endpoints

**Base:** `/api/drawings`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lists drawings in a stage (ordered by `z`, then `createdAt`, both ascending).

**Response `200`:** `DrawingsDocument[]`

---

### GET `/:id`

Fetches drawing by ID.

**Response `200`:** Drawing object
**Response `404`:** `{ "error": "Drawing not found." }`

---

### POST `/`

Creates drawing.

**Request body:** `stageId`, `type` (default `'rectangle'`), `x`, `y`, `width` (100), `height`
(100), `rotation` (0), `points` ([]), `fillColor` (`'#ffffff'` — note: this route default
differs from the schema's own default of `'#000000'`), `fillOpacity` (0.5 — differs from the
schema default of 0.3), `strokeColor` (`'#000000'` — differs from the schema default of
`'#ffffff'`), `strokeWidth` (1), `text` (''), `fontFamily` (`'Signika'` — differs from the
schema default of `'Arial'`), `fontSize` (32 — differs from the schema default of 16), `z`
(0), `isHidden` (false), `isLocked` (false), `levelId` ('').

**Response `201`:** Created drawing
**Response `400`:** `{ "error": "..." }` (validation error from the document layer)
**WS Event:** `drawing.created`

---

### PUT `/:id`

Updates drawing. Partial update — accepts the same field set as `POST` above.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }`
**WS Event:** `drawing.updated`

---

### DELETE `/:id`

Removes drawing.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }`
**WS Event:** `drawing.deleted`

---

### DELETE `/stage/:stageId`

Clears all drawings from a stage.

**Response `200`:** `{ "success": true, "count": N }`
**WS Event:** `drawing.cleared`
