# Cast (Tokens)

Cast members — characters, NPCs, monsters placed on a stage.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | UUID (`member-<uuid>`) | Unique identifier |
| `worldId` | `string` | `'world-1'` | World: taken from the session, or from the body when the session has none. The schema default applies only when neither is set |
| `stageId` | `string` | active stage's id, or `'stage-1'` | Current stage |
| `levelId` | `string` | `''` | Level within the stage |
| `name` | `string` | — | Name (**required**) |
| `kind` | `string` | `'adventurer'` | Type (`adventurer`, `monster`, `npc`, etc.) |
| `traits` | `object` | `{}` | System attributes (e.g. `{ hp: { value: 10 } }`) |
| `x` | `number` | `100` | Position X on the grid |
| `y` | `number` | `100` | Position Y on the grid |
| `colorHex` | `string` | random hex | Token color |
| `avatarUrl` | `string` | `''` | Avatar URL |
| `ringColor` | `string` | `colorHex` when sent, otherwise `'#e74c3c'` | Ring color |
| `ringUrl` | `string` | `''` | Ring image URL |
| `ringEffect` | `string` | `'none'` | Ring effect |
| `ringScale` | `number` | `1.6` | Ring scale |
| `shape` | `string` | `'circle'` | Shape (`circle`, `square`, etc.) |
| `effects` | `array` | `[]` | Active visual effects |
| `statusMarkers` | `array` | `[]` | Status markers |
| `systemData` | `object` | `{}` | System data (ruleset) |
| `actorId` | `string` | `''` | Linked actor ID |
| `isLinked` | `boolean` | `false` | Linked to the actor? |
| `ownership` | `object` | creator-only (plus the linked actor's owners with edit level, on create) | Owner permissions |
| `folderId` | `string` | `''` | Folder |
| `elevation` | `number` | `0` | Elevation |
| `locked` | `boolean` | `false` | Locked? |
| `hidden` | `boolean` | `false` | Hidden? |
| `movementAction` | `string` | `'walk'` | Type of movement |
| `targetedBy` | `array` | `[]` | Who is targeting this token |
| `tintColor` | `string` | `'#ffffff'` | Tint color |
| `opacity` | `number` | `1` | Opacity |
| `rotation` | `number` | `0` | Rotation (degrees) |
| `scale` | `number` | `1` | Scale |
| `sightEnabled` | `boolean` | `true` | Vision enabled? |
| `sightRange` | `number` | `0` | Vision range |
| `sightAngle` | `number` | `360` | Vision angle |
| `sightMode` | `string` | `'basic'` | Vision mode |
| `detectionModes` | `array` | `[]` | Detection modes |
| `lightDimRange` | `number` | `0` | Light range (dim) |
| `lightBrightRange` | `number` | `0` | Light range (bright) |
| `lightColor` | `string` | `'#ffffff'` | Light color |
| `lightAnimation` | `string` | `'none'` | Light animation |
| `barGridSize` | `number` | `1` | Bar grid size |
| `bar1` | `object` | `{"attribute":"attributes.hp","color":"dynamic"}` | Bar 1 config (bottom - health) |
| `bar2` | `object` | `{"attribute":"","color":"#3498db"}` | Bar 2 config (top - mana/resource) |
| `displayBars` | `number` | `20` | Bar display mode (`0` Never, `10` Control, `20` Owner/GM Hover, `30` Hover, `40` Owner/GM Always, `50` Always) |
| `createdAt` | `string` | — | Creation timestamp |
| `updatedAt` | `string` | — | Update timestamp |

---

## Endpoints

**Base:** `/api/cast`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists all cast members, ordered by `createdAt` ascending.

**Query:** `?stageId=` (only the tokens of that stage), `?limit=`, `?offset=`

**Response `200`:** `CastsDocument[]`
**Response `500`:** `{ "error": "Failed to retrieve cast members" }`

---

### GET `/:id`

Fetches a cast member by ID.

**Response `200`:** Cast member object
**Response `404`:** `{ "error": "Cast member not found" }`

---

### GET `/by-actor/:actorId`

Returns all tokens linked to an actor (`actorId` match, regardless of `isLinked`).

**Response `200`:** `CastsDocument[]`
**Response `500`:** `{ "error": "Failed to retrieve linked tokens." }`

---

### POST `/:actorId/propagate`

Copies `name`, `systemData` and `avatarUrl` from the actor to every token where
`actorId` matches **and** `isLinked` is `true`. `avatarUrl` falls back to the token's own value when the actor has none. Each token update also emits `cast.updated`. There is no GM or ownership check.

**Response `200`:** `{ "success": true, "propagatedCount": 3 }`
**Response `404`:** `{ "error": "Actor not found." }`
**Response `500`:** `{ "error": "Failed to propagate actor changes." }`

---

### POST `/`

Creates a new token.

**Request body:** see schema above — `name` is required, everything else falls back to its
default.

If `actorId` is given:
- `isLinked: true` → `name`, `kind`, `avatarUrl` and `systemData` are copied from the
  actor (fully synced).
- `isLinked: false` → `systemData` is copied as an independent snapshot, and if `traits`
  was not provided, `traits.hp` is seeded from the actor's `systemData.hp.value` (or `10`).
  The snapshot is not synced afterwards. Clicking the token still opens the actor sheet, not this snapshot.

The owners of the linked actor with edit level (3) also get edit access on the token, and the creator always does. Any signed-in session can create a token; there is no GM check.

**Response `201`:** Created cast object
**Response `500`:** `{ "error": "Failed to create cast member" }`
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**WS Event:** `cast.created`

---

### PUT `/:id`

Updates token fields. Partial update (only send what you want to change). Accepted fields: `name`, `kind`, `traits`, `colorHex`, `x`, `y`, `avatarUrl`, `ringColor`, `shape`, `effects`, `statusMarkers`, `systemData`, `folderId`, `stageId`, `elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`, `opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`, `detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`, `barGridSize`, `bar1`, `bar2`, `displayBars`. The ring fields `ringUrl`, `ringEffect` and `ringScale` are ignored here (use `PUT /:id/token`). `id`, `worldId`, `actorId`, `isLinked`, `ownership` and the timestamps are ignored too.

The actor owners rule from `POST /` also runs here before the update. Non-editors get `403`.

`systemData` is deep-merged into the stored JSON value, as on actors: plain objects merge key by key, arrays and scalars replace the old value, and a key written as `"-=key"` deletes that key. A partial `systemData` only changes the keys you send.

Clicking a token does not edit this snapshot. The client opens the actor sheet for any token with an `actorId`, linked or not, and that sheet writes to the actor (see `sdk/sheets.md`).

**Response `200`:** Updated object
**Response `400`:** `{ "error": "No valid fields provided for update." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Not found" }`
**WS Event:** `cast.updated`

---

### PUT `/:id/token`

Updates only the token's visual/config properties (same handler shape as `PUT /:id`, but
excludes `name`, `kind`, `colorHex`, `x`, `y`, `folderId`, `stageId`).

**Request body:** `avatarUrl`, `ringColor`, `ringUrl`, `ringEffect`, `ringScale`, `shape`, `effects`, `statusMarkers`, `systemData`,
`elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`,
`opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`,
`detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`,
`barGridSize`, `bar1`, `bar2`, `displayBars`

**Response `200`:** Updated object
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Not found" }`
**WS Event:** `cast.updated`

---

### PUT `/:id/target`

Marks/unmarks who is targeting the token. Any authenticated user in the world can use it.

**Request body:**
```json
{ "targetedBy": ["user-id-1", "user-id-2"] }
```

**Response `200`:** Updated object
**Response `400`:** `{ "error": "targetedBy must be an array" }`
**Response `404`:** `{ "error": "Not found" }`
**WS Event:** `token.target` (sent to every connected client, all worlds). The update itself also emits `cast.updated`.

---

### POST `/:id/position`

Updates only the token's position (used for real-time drag — lighter than `PUT /:id`, no
WS broadcast of its own beyond what `CastsDocument.update` triggers).

**Request body:**
```json
{ "x": 500, "y": 300 }
```

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "Cast member not found" }`
**Note:** the result of the update is not checked. A session without edit access gets `200` and nothing changes.

---

### POST `/:actorId/apply-token-image`

GM only. Copies the actor's token art (the prototype token image, otherwise the sheet portrait) onto **every** cast of that
actor on all stages, linked or not, and sets their shape to `none` (free-form art). Only `avatarUrl` and `shape` are touched; the rest of each cast's data stays.

**Response `200`:** `{ "success": true, "count": 3, "image": "/worlds/my-world/assets/tokens/hero-1a2b3c4d.Token.webp" }`
**Response `400`:** `{ "error": "The actor has no image to apply." }`
**Response `403`:** `{ "error": "Only the GM can apply the token image to the stages." }`
**Response `404`:** `{ "error": "Actor not found." }`
**Response `500`:** `{ "error": "Failed to apply the token image." }`
**WS Event:** `cast.updated` for each cast

---

### DELETE `/:id`

Removes a token.

**Response `200`:** `{ "success": true, "id": "member-abc123" }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Cast member not found" }`
**WS Event:** `cast.deleted`
