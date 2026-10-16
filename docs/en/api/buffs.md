# Buffs (Effects)

## Endpoints

**Base:** `/api/buffs`
**Auth:** `requireAuth, requireWorldMatch` (POST, PUT and DELETE also need the permission below)

Buffs are the records behind effects. A buff with an `itemId` or `tileId` and no target is an effect **template**. An applied copy on an actor or cast is created by the routes in [Effects](effects.md), which also describe how durations count down.

## Permissions

| Route | Who can call it |
|-------|-----------------|
| `GET /actor/:actorId`, `GET /item/:itemId`, `GET /:id` | Any signed-in session of the world |
| `POST /`, `PUT /:id`, `DELETE /:id` | Assistant GM (role 3) and above, or the admin session |

An effect changes the actor's stats through its `changes`, so only the GM side can create, edit or delete one. Owning the actor is not enough. A caller without the role gets `403` `{ "error": "Assistant GM permission required" }`.

---

### GET `/:id`

One buff by id. Read access is open like the lists: a signed-in session can read a buff of its own world. A buff of another world, or an unknown id, answers `404`.

**Response `200`:** the buff (`BuffsDocument`)
**Response `404`:** `{ "error": "Buff not found" }`
**Response `500`:** `{ "error": "..." }` on an unexpected failure

---

### GET `/actor/:actorId`

List of an actor's buffs, ordered by `createdAt` ascending.

**Note:** read access is open on purpose. Any signed-in session can list the buffs of an actor by its id, whatever the actor's owner. The list holds only the buffs of the session's world; an admin session without a world sees all of them. A buff of another world answers `404` on `PUT` and `DELETE`.

---

### GET `/item/:itemId`

List of an item's buffs, ordered by `createdAt` ascending. Same as above: open to any signed-in session.

---

### POST `/`

Create buff.

| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | **yes** |
| `actorId` | `string` | yes, unless `itemId` or `tileId` is sent |
| `itemId` | `string` | yes, unless `actorId` or `tileId` is sent |
| `tileId` | `string` | yes, unless `actorId` or `itemId` is sent (max 64 characters) |
| `worldId` | `string` | yes, unless `itemId` is sent |
| `icon` | `string` | no (default `''`) |
| `origin` | `string` | no (default `''`) |
| `description` | `string` | no (default `''`, max 2000 characters) |
| `durationUnit` | `string` | no (default `permanent`) |
| `duration` | `number` | no (default `-1`) |
| `expireOn` | `string` | no (default `turn-end`) |
| `tags` | `array` | no (default `[]`) |
| `conditionId` | `string` | no (default `''`, max 64 characters) |
| `removeOnCombatEnd` | `boolean` | no (default `false`) |
| `transfer` | `boolean` | no (default `false`) |
| `repeatWhileInside` | `boolean` | no (default `false`) |
| `disabled` | `boolean` | no (default `false`) |
| `changes` | `array` | no (default `[]`) |

**Duration fields:** `durationUnit` is one of `permanent`, `rounds`, `turns`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` or `years`. When `durationUnit` is omitted, the buff is `permanent`, and any `duration` sent is ignored and stored as `-1`. For every other unit, `duration` must be a whole number of at least 1. A unit with no `duration` is therefore rejected, because the default `-1` is not valid for a counted unit. See [Effects](effects.md#duration-units).

**Other fields:** `expireOn` is `turn-start` or `turn-end`. `visual` is the look a token draws for the effect: an object with optional `kind` (`aura`, `tint`, `glow`, `icon` or `particles`), `color` (`#rrggbb`), `intensity` (0 to 1), `speed` (0 to 3), `size` (0.5 to 3) and `style`, the shape of a `particles` visual (`smoke`, `embers`, `bubbles`, `sparkles`, `hearts`, `drops` or `zzz`; default `smoke`). The other kinds accept `style` but do not draw it. The whole object is at most 200 characters of JSON. `{}` (the default) means the preset of the condition. An invalid visual answers `400` `{ "error": "..." }`. `tags` is an array of at most 20 strings, each at most 40 characters. `conditionId` is used for the no-stacking rule described in [Effects](effects.md#no-stacking). `removeOnCombatEnd` removes the effect when the combat ends. `transfer` and `repeatWhileInside` are stored as booleans; the server does not give them any behavior yet.

**Ignored fields:** the server sets `startedAt`, `expiresAt`, `templateId`, `castId`, `appliedBy`, `sourceType` and `sourceId` itself, so values sent for them in the body are ignored. `tileId` is read on POST only.

**Checks run in this order:** `name`, then the target (`actorId`, `itemId` or `tileId`), then `worldId`, then the permission (403), then the field validation (400).

**Response `201`:** the created buff (`BuffsDocument`)
**Response `400`:** `{ "error": "name is required" }` / `{ "error": "actorId or itemId is required" }` / `{ "error": "worldId or itemId is required" }`, or a validation message from the list below
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is below Assistant GM
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Note:** `worldId` is read from the body. The route does not compare it with the session's world.
**Internal events:** Signal `buff.created`, and the generic `buffs.created` from the Document layer (server-side, **not relayed** to WebSocket)

**Validation messages (400):**

- `description must be a string of at most 2000 characters`
- `unknown duration unit "<unit>"`
- `duration must be a whole number of at least 1 for the unit "<unit>"`
- `expireOn must be turn-start or turn-end`
- `tags must be an array of at most 20 strings of at most 40 characters`
- `conditionId must be a string of at most 64 characters`
- `tileId must be a string of at most 64 characters`

---

### PUT `/:id`

Update buff. Body: any of `name`, `icon`, `origin`, `description`, `durationUnit`, `duration`, `expireOn`, `tags`, `conditionId`, `removeOnCombatEnd`, `transfer`, `repeatWhileInside`, `disabled`, `changes` or `visual`. The same validation as POST applies to the fields that are sent. A duration check uses the stored unit and duration for any value the body leaves out. Setting `durationUnit` to `permanent` stores `duration` as `-1`.

`actorId`, `itemId`, `tileId` and the server-managed fields are not accepted here. An empty body returns the stored buff without a write.

**Response `200`:** the updated buff
**Response `400`:** a validation message from the list above
**Response `403`:** `{ "error": "Assistant GM permission required" }` (same rule as POST)
**Response `404`:** `{ "error": "Buff not found" }` when the id is unknown; also returned when the update itself fails
**Internal events:** Signal `buff.updated`, and the generic `buffs.updated` (server-side, **not relayed** to WebSocket)

---

### DELETE `/:id`

Remove buff.

**Response `200`:** `{ "success": true }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` (same rule as POST)
**Response `404`:** `{ "error": "Buff not found" }` when the id is unknown; also returned when the delete itself fails
**Internal events:** Signal `buff.deleted`, and the generic `buffs.deleted` (server-side, **not relayed** to WebSocket)
