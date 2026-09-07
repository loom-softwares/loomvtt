# Cast (Tokens)

Cast members — characters, NPCs, monsters placed on a stage.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | UUID (`member-<uuid>`) | Unique identifier |
| `worldId` | `string` | — | World (from auth context or body; no fallback) |
| `stageId` | `string` | active stage's id, or `'stage-1'` | Current stage |
| `levelId` | `string` | `''` | Level within the stage |
| `name` | `string` | — | Name (**required**) |
| `kind` | `string` | `'adventurer'` | Type (`adventurer`, `monster`, `npc`, etc.) |
| `traits` | `object` | `{}` | System attributes (e.g. `{ hp: { value: 10 } }`) |
| `x` | `number` | `100` | Position X on the grid |
| `y` | `number` | `100` | Position Y on the grid |
| `colorHex` | `string` | random hex | Token color |
| `avatarUrl` | `string` | `''` | Avatar URL |
| `ringColor` | `string` | `colorHex` | Ring color |
| `shape` | `string` | `'circle'` | Shape (`circle`, `square`, etc.) |
| `effects` | `array` | `[]` | Active visual effects |
| `statusMarkers` | `array` | `[]` | Status markers |
| `systemData` | `object` | `{}` | System data (ruleset) |
| `actorId` | `string` | `''` | Linked actor ID |
| `isLinked` | `boolean` | `false` | Linked to the actor? |
| `ownership` | `object` | creator-only | Owner permissions |
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
| `createdAt` | `string` | — | Creation timestamp |
| `updatedAt` | `string` | — | Update timestamp |

---

## Endpoints

**Base:** `/api/cast`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists all cast members, ordered by `createdAt` ascending.

**Query:** `?limit=`, `?offset=`

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

---

### POST `/:actorId/propagate`

Copies `name`, `systemData` and `avatarUrl` from the actor to every token where
`actorId` matches **and** `isLinked` is `true`.

**Response `200`:** `{ "success": true, "propagatedCount": 3 }`
**Response `404`:** `{ "error": "Actor not found." }`

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

**Response `201`:** Created cast object
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**WS Event:** `cast.created`

---

### PUT `/:id`

Updates token fields. Partial update (only send what you want to change) — accepts any
field from the schema above except `id`/`worldId`/`actorId`/`isLinked`/`ownership`/`createdAt`/`updatedAt`.

**Response `200`:** Updated object
**Response `400`:** `{ "error": "No valid fields provided for update." }`
**WS Event:** `cast.updated`

---

### PUT `/:id/token`

Updates only the token's visual/config properties (same handler shape as `PUT /:id`, but
excludes `name`, `kind`, `colorHex`, `x`, `y`, `folderId`, `stageId`).

**Request body:** `avatarUrl`, `ringColor`, `shape`, `effects`, `statusMarkers`, `systemData`,
`elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`,
`opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`,
`detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`,
`barGridSize`

**Response `200`:** Updated object
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
**WS Event:** `token.target` (not `cast.updated`)

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

---

### DELETE `/:id`

Removes a token.

**Response `200`:** `{ "success": true, "id": "member-abc123" }`
**Response `404`:** `{ "error": "Cast member not found" }`
**WS Event:** `cast.deleted`
