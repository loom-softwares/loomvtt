# Levels

## Overview

A Stage is a container for multiple **levels**. Each level holds the background
(`backgroundUrl`/`backgroundColor`) and the elevation range (`bottomElevation`/`topElevation`).

> **Migration:** in migration `031_levels_architecture`, existing stages received an automatic
> "Térreo" level with the background that previously lived in the stage itself, and the legacy
> columns `backgroundUrl`/`backgroundColor` were removed from `stages`. When creating a stage via
> `POST /api/stages`, the "Térreo" level is created automatically (`server/applications/api/stages.ts`).

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `id` | `string` | auto | Generated UUID |
| `stageId` | `string` | **(required)** | Stage owning the level |
| `name` | `string` | `'Térreo'` | Level name |
| `bottomElevation` | `number` | `0` | Bottom elevation |
| `topElevation` | `number` | `20` | Top elevation |
| `backgroundUrl` | `string` | `''` | Level background image |
| `backgroundColor` | `string` | `'#0d0d0f'` | Level background color |
| `flags` | `object` | `{}` | Arbitrary flags |
| `createdAt` / `updatedAt` | `string` | ISO | Timestamps |

The schema also defines appearance fields that are returned in responses: `backgroundTint`
(`'#ffffff'`), `alphaThreshold` (`0.75`), `foregroundUrl`, `foregroundTint`, `fogExplorationUrl`,
`anchorX`/`anchorY` (`0.5`), `offsetX`/`offsetY` (`0`), `scaleX`/`scaleY` (`1`), `fitMode`
(`'fill'`) and `rotation` (`0`). The PUT routes do not accept them (see PUT below).

> **CODE ISSUE:** `levelsRouter.put` and `stageLevelsRouter.put` only copy `name`, `bottomElevation`,
> `topElevation`, `backgroundUrl`, `backgroundColor` and `flags` (`LEVEL_FIELDS` in
> `server/applications/api/levels.ts`). The appearance fields above can only be set by other paths.

## Endpoints

**Base:** `/api/levels`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on POST, PUT, DELETE)

---

### GET `/`

Lists all levels. Use `?stageId=` to filter by stage.

**Query params:**

| Param | Type | Description |
|-------|------|-----------|
| `stageId` | `string` | Filters levels of the given stage |

**Response `200`:** `LevelsDocument[]`

---

### GET `/:id`

Fetches level by ID.

**Response `200`:** Level object
**Response `404`:** `{ "error": "Level not found" }`

---

### POST `/`

Creates a level. `requireGM`

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **yes** | - |
| `name` | `string` | no | `'Térreo'` |
| `bottomElevation` | `number` | no | the `topElevation` of the stage's highest level, or `0` if it has none |
| `topElevation` | `number` | no | `bottomElevation + 20` |
| `backgroundUrl` | `string` | no | `''` |
| `backgroundColor` | `string` | no | `'#0d0d0f'` |
| `flags` | `object` | no | `{}` |

The default elevation range stacks the new level on top of the highest one in the stage, so
two levels never share the same range.

**Response `201`:** Created level
**Response `400`:** `{ "error": "stageId is required" }` (or the Document error)

**WS Event:** `level.created` (relayed to all clients, see [WebSocket events](#websocket-events))

---

### PUT `/:id`

Updates a level. `requireGM`

**Request body:** Same fields as POST (except `stageId`). Only `name`, `bottomElevation`,
`topElevation`, `backgroundUrl`, `backgroundColor` and `flags` are used; other fields are ignored.

**Response `200`:** Updated level
**Response `400`:** `{ "error": "No valid fields provided for update." }`
**Response `404`:** `{ "error": "Not found" }`
**WS Event:** `level.updated`

---

### DELETE `/:id`

Removes a level. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Not found" }`
**WS Event:** `level.deleted`

---

## WebSocket events

The Document layer emits `levels.created`, `levels.updated` and `levels.deleted` on the server,
and `server/index.ts` relays them to clients as `level.created`, `level.updated` and `level.deleted`
(payload: the level row). The stage sub-resource routes also emit `levels.changed` with
`{ stageId }`, which the server relays to all clients as `levels.changed`.

## Stage Sub-resource

Also available nested within the stage (like lights/templates):

**Base:** `/api/stages/:stageId/levels`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on POST, PUT and DELETE, `403` otherwise)

| Method | Route | Description |
|--------|------|-----------|
| GET | `/api/stages/:stageId/levels` | Lists stage levels (ordered by `bottomElevation`) |
| POST | `/api/stages/:stageId/levels` | GM only. Creates level on stage (same defaults as `POST /api/levels`) |
| PUT | `/api/stages/:stageId/levels/:id` | GM only. Updates level; emits `levels.changed` |
| DELETE | `/api/stages/:stageId/levels/:id` | GM only. Removes level; emits `levels.changed` |

> **CODE ISSUE:** PUT and DELETE do not check that the level belongs to `:stageId`, so the URL's
> stage id is not enforced for an existing level.
