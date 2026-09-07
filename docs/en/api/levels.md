# Levels

## Overview

A Stage is a container for multiple **levels**. Each level holds the background
(`backgroundUrl`/`backgroundColor`) and the elevation range (`bottomElevation`/`topElevation`).

> **Migration:** in migration `031_levels_architecture`, existing stages received an automatic
> "Ground" level with the background that previously lived in the stage itself, and the legacy
> columns `backgroundUrl`/`backgroundColor` were removed from `stages`. When creating a stage via
> `POST /api/stages`, the "Ground" level is created automatically.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `id` | `string` | auto | Generated UUID |
| `stageId` | `string` | **(required)** | Stage owning the level |
| `name` | `string` | `'Ground'` | Level name |
| `bottomElevation` | `number` | `0` | Bottom elevation |
| `topElevation` | `number` | `20` | Top elevation |
| `backgroundUrl` | `string` | `''` | Level background image |
| `backgroundColor` | `string` | `'#0d0d0f'` | Level background color |
| `flags` | `object` | `{}` | Arbitrary flags |
| `createdAt` / `updatedAt` | `string` | ISO | Timestamps |

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
| `name` | `string` | no | `'Ground'` |
| `bottomElevation` | `number` | no | `0` |
| `topElevation` | `number` | no | `20` |
| `backgroundUrl` | `string` | no | `''` |
| `backgroundColor` | `string` | no | `'#0d0d0f'` |
| `flags` | `object` | no | `{}` |

**Response `201`:** Created level
**Response `400`:** `{ "error": "stageId is required" }`

**WS Event:** `levels.created`

---

### PUT `/:id`

Updates a level. `requireGM`

**Request body:** Same fields as POST (except `stageId`).

**Response `200`:** Updated level
**WS Event:** `levels.updated`

---

### DELETE `/:id`

Removes a level. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `levels.deleted`

---

## Stage Sub-resource

Also available nested within the stage (like lights/templates):

**Base:** `/api/stages/:stageId/levels`
**Auth:** `requireAuth, requireWorldMatch`

| Method | Route | Description |
|--------|------|-----------|
| GET | `/api/stages/:stageId/levels` | Lists stage levels |
| POST | `/api/stages/:stageId/levels` | Creates level on stage |
| PUT | `/api/stages/:stageId/levels/:id` | Updates level |
| DELETE | `/api/stages/:stageId/levels/:id` | Removes level |
