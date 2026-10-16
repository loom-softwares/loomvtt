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

Lists all stages, oldest first. Each item is the stage plus `levels` (ordered by `bottomElevation`), `thumbUrl` and `bgUrl` (the same value; the background of the initial level, or of the first level).

**Response `200`:** `[{ ...stage, levels, thumbUrl, bgUrl }]`

---

### GET `/active`

Returns the active stage with tokens, `levels`, `thumbUrl` and `bgUrl`.

**Response `200`:**
```json
{
  "id": "stage-1",
  "name": "Dungeon",
  "isActive": true,
  "gridSize": 50,
  "gridColor": "#ffffff",
  "levels": [],
  "thumbUrl": "",
  "bgUrl": "",
  "tokens": [
    { "id": "member-1", "name": "Aragorn", "x": 500, "y": 300, "colorHex": "#e74c3c", "kind": "adventurer" }
  ]
}
```

**Response `404`:** `{ "error": "No active stage found" }`

---

### GET `/:id`

Fetches stage by ID, with `levels`, `thumbUrl` and `bgUrl` as in `GET /`.

**Response `200`:** Stage object
**Response `404`:** `{ "error": "Stage not found" }`

---

### POST `/`

Creates a new stage. `requireGM`

Automatically creates the default level, named `Térreo` (elevation 0–20), loading the provided background.

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
| `ambientPlaylistId` | `string` | `''` (ambient audio playlist ID) |
| `folderId`, `sceneType`, `parentStageId` | — | Ignored by POST; see the note below the table |
| `width` | `number` | — |
| `height` | `number` | — |

`sceneType`, `parentStageId` and `folderId` are not read by POST; set them with `PUT /:id`. Stages also get schema defaults for fields not listed here (for example `transitionType` = `'fade'`).

**Response `201`:** Created stage, including the created `levels` (`{ ...stage, levels: [level], thumbUrl, bgUrl }`)
**Response `400`:** `{ "error": "Name is required" }`

**WS Events:** `stage.created` (relayed from the `stages.created` Signal) and `level.created` for the default level (relayed from `levels.created`)

---

### PUT `/:id`

Updates stage. `requireGM`

> The background is now configured via `/api/levels` — background fields are no longer accepted here.

**Request body:** `name`, `gridSize`, `gridColor`, `navigationName`, `showInNavigation`, `darknessLevel`, `weatherEffect`, `gridDistance`, `gridUnit`, `gridStyle`, `gridOpacity`, `gridType`, `padding`, `offsetX`, `offsetY`, `ambientPlaylistId`, `ambientSoundId`, `ambientStartSoundId`, `width`, `height`, `flags`, `folderId`, `thumbnailUrl`, `transitionType`, `transitionDuration`, `sceneType`, `parentStageId`, `journalId`, `journalPageId`, `tokenVision`, `fogExplorationMode`, `fogExploredColor`, `fogUnexploredColor`, `fogImage`, `globalLight`, `globalLightThreshold`. Only the fields sent are changed. `worldId` is not accepted here.

**Response `200`:** the updated stage with `levels`, `thumbUrl` and `bgUrl`.
**Response `400`:** `{ "error": "No valid fields provided for update." }` when no accepted field is sent.
**Response `404`:** `{ "error": "Not found" }` when the stage does not exist.

If `darknessLevel` is included, also triggers `stage.darkness` (`{ stageId, darknessLevel, duration: 1000 }`).

**WS Events:** `stage.updated` (relayed from the `stages.updated` Signal), `stage.darkness` (when `darknessLevel` is included)

---

### PUT `/:id/music`

Changes only the scene music (`ambientPlaylistId`, `ambientSoundId`, `ambientStartSoundId`). Requires the `controlPlaylist` permission (not only GM): a player whose role has it can change what the table listens to. Body fields are optional, but at least one must be sent, otherwise `400`. Returns the updated stage, and clears the music timeline when the music really changed.

**WS Event:** `stage.updated`

---

### DELETE `/:id`

Removes stage. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Stage not found" }`

**WS Event:** `stage.deleted` (relayed from the `stages.deleted` Signal)

---

### POST `/:id/activate`

Activates a stage (deactivates others). `requireGM`

**Request body:** `{ "worldId": "..." }` (optional; limits which active stages are deactivated to that world)

**Response `200`:** the activated stage (the plain stage object, not the activation payload)
**Response `404`:** `{ "error": "..." }` when the stage does not exist.

Each stage whose `isActive` flag flips also emits `stages.updated` (WS `stage.updated`).

**WS Event:** `stage.activated` — the payload is the activation payload of `GET /:id/activation`. Its `levelId`, `bgUrl` and `backgroundColor` come from the level set in `flags.initialLevel`, or otherwise from the base level (lowest `bottomElevation`).

---

### GET `/:id/activation`

What a client needs to load this stage. Clients use it after a reconnect to catch up with a scene activated while their socket was down. Returns the same payload as the `stage.activated` event: `stageId`, `levels`, `levelId`, `bgUrl`, `backgroundColor`, grid settings, `ambientPlaylistId`, `darknessLevel`, fog/vision/lighting settings and more.

**Response `200`:** activation payload
**Response `404`:** `{ "error": "Stage not found" }` when the stage does not exist or belongs to another world (admins excepted).

---

### Sub-resources

- [`/api/stages/:stageId/levels`](./levels.md) — Levels
- `/api/stages/:stageId/lights` — Ambient lights
- `/api/stages/:stageId/templates` — Area templates

---

### GET `/:id/music-sync`

Which track of the scene music the table is on and when it started, so a client that reloads or joins late starts on the same track at the same point.

**Response `200`:** `{ "sync": { "key": "...", "trackId": "...", "startedAt": 1700000000000 } | null, "now": 1700000000500 }` — `startedAt` and `now` are the server clock. `sync` is `null` when nothing has been reported for the current music (it just started, or the server restarted).

---

### POST `/:id/music-track`

A client reports the track it just started: `{ "key", "trackId", "prevTrackId" }`. The first report for a music, and the first one that moves on from the stored track, set the timeline; the same report from the other clients changes nothing. The timeline is dropped when the scene's music changes.

**Response `200`:** `{ "sync": ..., "changed": true | false, "now": ... }`
