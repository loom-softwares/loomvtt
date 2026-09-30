# Tiles

Active tiles (scenery objects).

## Endpoints

**Base:** `/api/tiles`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists tiles. `?stageId=` to filter.

JSON fields (`floors`, `triggers`, `conditions`, `actions`, `occlusion`) are parsed automatically.

**Response `200`:** `TilesDocument[]`

---

### GET `/:id`

Fetches tile by ID.

**Response `200`:** Tile (parsed)

---

### POST `/`

Creates a tile.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **yes** | — |
| `name` | `string` | **yes** | — |
| `x` | `number` | no | `0` |
| `y` | `number` | no | `0` |
| `width` | `number` | no | `100` |
| `height` | `number` | no | `100` |
| `imgUrl` | `string` | no | `''` |
| `isActive` | `boolean` | no | `true` |
| `rotation` | `number` | no | `0` |
| `tintColor` | `string` | no | `''` |
| `opacity` | `number` | no | `1` |
| `locked` | `boolean` | no | `false` |
| `videoLoop` | `boolean` | no | `true` |
| `videoAutoplay` | `boolean` | no | `true` |
| `videoVolume` | `number` | no | `1` |
| `anchorX` | `number` | no | `0.5` |
| `anchorY` | `number` | no | `0.5` |
| `floors` | `array` | no | `[]` |
| `triggers` | `array` | no | `[]` |
| `conditions` | `array` | no | `[]` |
| `actions` | `array` | no | `[]` |

**Response `201`:** Tile created
**WS Event:** `tiles.created`

---

### PUT `/:id`

Updates tile.

**Response `200`:** Tile updated
**WS Event:** `tiles.updated`

---

### DELETE `/:id`

Removes tile.

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `tiles.deleted`

---

## Active Tile Triggers

Trigger engine executed on the client (`client/canvas/tile-trigger-engine.ts` + `tile-trigger-integration.ts`), plugged in via `CanvasManager`.

### Supported Events

| Event | Trigger |
|--------|---------|
| `token-enter` | Token enters the tile area |
| `token-exit` | Token exits the tile area |
| `token-move-inside` | Token moves inside the area |
| `click` | Click on the tile (GM) |

### Conditions

| Condition | Parameters | Description |
|----------|------------|-----------|
| `user-role-gte` | `role: 4` | Only triggers if the user's role is >= the value |

### Actions

| Action | Parameters | Description |
|------|------------|-----------|
| `teleport` | `{ stageId, x, y }` | Teleports token to absolute coordinate |
| `toggle-visibility` | `{}` | Toggles tile visibility |
| `play-sound` | `{ src, volume }` | Plays sound |
| `show-dialog` | `{ title, message, image? }` | Shows dialog |
| `pause-game` | `{}` | Pauses the game |
| `toggle-lock` | `{}` | Toggles tile lock |

### UI Configuration

The "Active Tiles" tab in `TileConfigWindow` allows configuring triggers/conditions/actions visually without editing JSON.
