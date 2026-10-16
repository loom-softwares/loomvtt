# Lights

Ambient lights of a stage.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `x` | `number` | `0` | X Position |
| `y` | `number` | `0` | Y Position |
| `radius` | `number` | `200` | Radius |
| `color` | `string` | `'#ffdd88'` | Color |
| `intensity` | `number` | `0.05` | Intensity |
| `rotation` | `number` | `0` | Rotation |
| `levelId` | `string` | `''` | Level ID |
| `allLevels` | `boolean` | `false` | Shared by every floor of the scene (off: the light shines only on its own floor) |
| `animation` | `string` | `'none'` | Animation |
| `darknessMin` | `number` | `0` | Minimum darkness |
| `darknessMax` | `number` | `1` | Maximum darkness |
| `isHidden` | `boolean` | `false` | Hidden? |
| `bright` | `number` | `100` | Bright radius |
| `dim` | `number` | `200` | Dim radius |
| `angle` | `number` | `360` | Angle |
| `walls` | `boolean` | `true` | Blocked by walls? |
| `vision` | `boolean` | `false` | Vision? |
| `animationSpeed` | `number` | `5` | Animation speed |
| `animationIntensity` | `number` | `5` | Animation intensity |

## Endpoints

**Base:** `/api/stages/:stageId/lights`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:stageId/lights`

Lists lights of a stage.

**Response `200`:** `AmbientLightsDocument[]`

---

### POST `/:stageId/lights`

Creates light. The `stageId` comes from the URL. Every body field is optional; defaults are the
schema defaults above, except `intensity` (`0.05`) and `dim`, which defaults to `radius` (`200` when
neither is given). `allLevels` is stored as `true` only when sent as `true`.

**Request body:** `x`, `y`, `radius`, `color`, `intensity`, `rotation`, `bright`, `dim`, `angle`,
`walls`, `vision`, `animationSpeed`, `animationIntensity`, `animation`, `isHidden`, `darknessMin`,
`darknessMax`, `levelId`, `allLevels`.

**Response `201`:** Created light
**Response `400`:** `{ "error": "..." }` (Document error)
**Response `500`:** `{ "error": "Failed to create light" }`
**WS Event:** `light.created` (payload: the created row, relayed to all clients)

---

### PUT `/:stageId/lights/:id`

Updates light. Only the fields below are copied; other fields (including `rotation`) are ignored.
`walls`, `vision`, `isHidden` and `allLevels` are coerced to boolean.

**Request body:** `x`, `y`, `radius`, `color`, `intensity`, `bright`, `dim`, `angle`, `walls`,
`vision`, `animationSpeed`, `animationIntensity`, `animation`, `isHidden`, `darknessMin`,
`darknessMax`, `levelId`, `allLevels`.

> **CODE ISSUE:** `rotation` is accepted by POST and stored, but the PUT handler does not copy it,
> so a light's rotation cannot be changed through this route.

**Response `200`:** Updated light
**Response `404`:** `{ "error": "..." }` (Document error)
**WS Event:** `light.updated` (payload: the updated row, relayed to all clients)

---

### DELETE `/:stageId/lights/:id`

Removes light.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "..." }` (Document error)
**WS Event:** `light.deleted` (payload: `{ "id", "stageId" }`, relayed to all clients)
