# Lights

Ambient lights of a stage.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `x` | `number` | `0` | X Position |
| `y` | `number` | `0` | Y Position |
| `radius` | `number` | `200` | Radius |
| `color` | `string` | `'#ffdd88'` | Color |
| `intensity` | `number` | `0.5` | Intensity |
| `levelId` | `string` | `''` | Level ID |
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

Creates light.

**Response `201`:** Created light
**WS Event:** `light.created`

---

### PUT `/:stageId/lights/:id`

Updates light.

**WS Event:** `light.updated`

---

### DELETE `/:stageId/lights/:id`

Removes light.

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `light.deleted`
