# Stages

## Overview

A Stage is a container for **Levels** — the background (`backgroundUrl`/`backgroundColor`)
and elevation live in the levels, not on the stage anymore. See [`levels.md`](./levels.md).

> In migration `031_levels_architecture`, the background of existing stages was moved to an
> automatic "Ground" level, and legacy columns were removed.

## Endpoints

**Base:** `/api/stages`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on POST, PUT, DELETE, activate)

---

### GET `/`

Lists all stages.

**Response `200`:** `StagesDocument[]`

---

### GET `/active`

Returns the active stage with tokens.

**Response `200`:**
```json
{
  "id": "stage-1",
  "name": "Dungeon",
  "isActive": true,
  "gridSize": 50,
  "gridColor": "#ffffff",
  "tokens": [
    { "id": "member-1", "name": "Aragorn", "x": 500, "y": 300, "colorHex": "#e74c3c", "kind": "adventurer" }
  ]
}
```

**Response `404`:** `{ "error": "No active stage found" }`

---

### GET `/:id`

Fetches stage by ID.

**Response `200`:** Stage object
**Response `404`:** `{ "error": "Stage not found" }`

---

### POST `/`

Creates a new stage. `requireGM`

Automatically creates the "Ground" level (elevation 0–20) loading the provided background.

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `worldId` | `string` | — |
| `bgUrl` | `string` | `''` (goes to default level) |
| `backgroundColor` | `string` | `'#0d0d0f'` (goes to default level) |
| `gridSize` | `number` | `50` |
| `gridColor` | `string` | `'#ffffff'` |
| `navigationName` | `string` | — |
| `showInNavigation` | `boolean` | — |
| `darknessLevel` | `number` | — |
| `weatherEffect` | `string` | — |
| `gridDistance` | `number` | — |
| `gridUnit` | `string` | — |
| `gridStyle` | `string` | — |
| `gridOpacity` | `number` | — |
| `gridType` | `string` | — |
| `padding` | `number` | — |
| `offsetX` | `number` | — |
| `offsetY` | `number` | — |
| `ambientPlaylistId` | `string` | — |
| `width` | `number` | — |
| `height` | `number` | — |

**Response `201`:** Created stage, including the created `levels` (`{ ...stage, levels: [level] }`)
**Response `400`:** `{ "error": "Name is required" }`

**WS Event:** `stages.created` (+ `levels.created` for the default level)

---

### PUT `/:id`

Updates stage. `requireGM`

> The background is now configured via `/api/levels` — background fields are no longer accepted here.

**Request body:** Other fields from POST. If `darknessLevel` is included, triggers `stage.darkness` event.

**WS Events:** `stages.updated`, `stage.darkness` (if darknessLevel changed)

---

### DELETE `/:id`

Removes stage. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`

**WS Event:** `stages.deleted`

---

### POST `/:id/activate`

Activates a stage (deactivates others). `requireGM`

**Request body:** `{ "worldId": "..." }`

**Response `200`:** Activated stage

**WS Event:** `stage.activated` — the payload includes `levelId`, `bgUrl` and `backgroundColor`
from the base level (lowest `bottomElevation`) of the stage.

---

### Sub-resources

- [`/api/stages/:stageId/levels`](./levels.md) — Levels
- `/api/stages/:stageId/lights` — Ambient lights
- `/api/stages/:stageId/templates` — Area templates
