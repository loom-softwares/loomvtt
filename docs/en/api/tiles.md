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
**Response `404`:** `{ "error": "Tile not found" }`

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
| `tintColor` | `string` | no | `'#ffffff'` |
| `opacity` | `number` | no | `1` |
| `locked` | `boolean` | no | `false` |
| `videoLoop` | `boolean` | no | `true` |
| `videoAutoplay` | `boolean` | no | `true` |
| `videoVolume` | `number` | no | `0` |
| `anchorX` | `number` | no | `0.5` |
| `anchorY` | `number` | no | `0.5` |
| `elevation` | `number` | no | `0` |
| `levelId` | `string` | no | `''` |
| `floors` | `array` | no | `[]` |
| `triggers` | `array` | no | `[]` |
| `conditions` | `array` | no | `[]` |
| `actions` | `array` | no | `[]` |

`name` is trimmed. The JSON fields (`floors`, `triggers`, `conditions`, `actions`) are accepted as arrays or as JSON strings. POST does not read `hidden`, `isOverhead`, `isRoof` or `occlusion`; set them with PUT.

**Response `201`:** Tile created
**Response `400`:** `{ "error": "Fields \"stageId\" and \"name\" are required." }` (or the document-layer error)
**Response `500`:** `{ "error": "Failed to create tile" }`
**WS Event:** `tile.created` (wire name; relayed to the clients of the stage only)

---

### PUT `/:id`

Updates a tile. Partial update: only the fields sent are changed. Accepts the POST fields (except `stageId`) plus `hidden`, `isOverhead`, `isRoof` and `occlusion` (`{ mode, radius, alpha }`, default `{ "mode": "fade", "radius": 100, "alpha": 0 }`). `name` is trimmed.

**Response `200`:** Tile updated
**Response `400`:** `{ "error": "..." }` (document-layer error)
**Response `404`:** `{ "error": "Tile not found" }`
**Response `500`:** `{ "error": "Failed to update tile" }`
**WS Event:** `tile.updated` (wire name; relayed to the clients of the stage only)

---

### DELETE `/:id`

Removes tile.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `400`:** `{ "error": "..." }` (document-layer error)
**Response `404`:** `{ "error": "Tile not found" }`
**Response `500`:** `{ "error": "Failed to delete tile" }`
**WS Event:** `tile.deleted` (wire name; relayed to the clients of the stage only)

---

## Active Tile Triggers

Trigger engine executed on the client (`client/canvas/tile-trigger-engine.ts` + `tile-trigger-integration.ts`), plugged in via `CanvasManager`.

### Supported Events

| Event | Trigger |
|--------|---------|
| `token-enter` | Token enters the tile area |
| `token-exit` | Token exits the tile area |
| `token-move-inside` | Token moves inside the area |
| `click` | Click on the tile (fired from the canvas tile click handler) |

### Conditions

| Condition | Parameters | Description |
|----------|------------|-----------|
| `user-role-gte` | `value: <role>` | Only triggers if the user's role is >= the value (GM always passes) |
| `flag-equals` | `value: { flag, expectedValue }` | Only triggers if the token's field `flag` equals `expectedValue` |

### Actions

The config fields below are the ones the engine reads (`client/canvas/tile-trigger-engine.ts`). The local-effect actions (the ones the engine broadcasts) accept an optional `recipient` (`trigger`, `gm`, `all`, `trigger+gm`) that limits who runs them.

| Action | Config fields | Description |
|------|------------|-----------|
| `teleport` | `targetX`, `targetY`, `targetTokenId?`, `stageId?` | Moves the token to a coordinate; with `stageId`, moves it to another stage |
| `toggle-visibility` | `targetTokenId?`, `visible?` | Hides or shows a token (`visible` absent = toggle) |
| `play-sound` | `soundUrl`, `volume` | Plays a sound |
| `show-dialog` | `journalId?`, `pageId?`, `title?`, `content?`, `imageUrl?` | Shows a dialog |
| `pause-game` | `duration?` | Pauses the game |
| `toggle-lock` | `targetTileId?`, `locked?` | Locks or unlocks a tile |
| `activate-tile` | `targetTileId?`, `active?` | Activates or deactivates another tile (`PUT /api/tiles/:id` with `isActive`) |
| `show-notification` | `message`, `type?`, `duration?` | Shows a notification |
| `chat-message` | `content`, `speaker?` | Posts a chat message |
| `run-animation` | `payload` | Runs a visual animation |
| `floating-text` | `text`, `color?` | Shows floating text over the tile |

### UI Configuration

The "Active Tiles" tab in `TileConfigWindow` allows configuring triggers/conditions/actions visually without editing JSON.
