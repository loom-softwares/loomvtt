# Effects

Effects are the applied copies of effect templates. A **template** lives on an item or a tile and is never consumed. Applying a template creates an **applied effect** on an actor or a cast. The applied effect is the record that counts down, expires and changes stats through its `changes`.

The rules are in `shared/effect-rules.ts`. The routes are in `server/applications/api/effects.ts`. Effects are stored in the same table as buffs, so the routes in [Buffs](buffs.md) read and edit them too.

## Endpoints

**Base:** `/api/effects`
**Auth:** `requireAuth, requireWorldMatch`

## Permissions

| Route | Who can call it |
|-------|-----------------|
| `POST /apply` | Assistant GM (role 3) and above, or the admin session, for any template. A player only when the template comes from an item of an actor they can edit, or when it is a tile template applied to a cast they own that stands inside the tile. |
| `POST /clear` | Assistant GM (role 3) and above, or the admin session. A player only for a tile clear on a target they own (see [Player tile clear](#player-tile-clear)). |
| `POST /condition` | Assistant GM (role 3) and above, or the admin session |
| `GET /target` | Any signed-in session of the world |
| `GET /requests` | Assistant GM (role 3) and above, or the admin session |
| `POST /requests/:id/approve` | Assistant GM (role 3) and above, or the admin session |
| `POST /requests/:id/deny` | Assistant GM (role 3) and above, or the admin session |

A player who applies a tile template to a cast that is not theirs, or outside the tile, gets `403`.

When the world has GM approval turned on (see [GM approval](#gm-approval)), a player who applies an item template does not apply it directly. The request is parked and waits for an Assistant GM (role 3) or the GM to answer it.

---

## Concepts

### Templates and applied effects

A template is a buff with an `itemId` or a `tileId` and no `actorId` or `castId`. It is created with `POST /api/buffs`.

An applied effect is a buff with an `actorId` or a `castId`. It is created only by `POST /api/effects/apply`. Applying copies the template's `name`, `icon`, `description`, `durationUnit`, `expireOn`, `conditionId`, `tags`, `removeOnCombatEnd` and `changes` onto the new record. The `changes` are deep-copied, so later edits to the template do not change effects that were already applied.

The applied copy also sets these fields:

- `origin` to the template's name.
- `disabled` to `false`, whatever the template holds.
- `templateId` to the template's id.
- `sourceType` to `item` or `tile`, and `sourceId` to the item or tile id.
- `appliedBy` to the user who applied it.
- `startedAt` to the current world time, in seconds.

### Duration units

| `durationUnit` | `duration` | How it counts down |
|----------------|------------|--------------------|
| `permanent` | Ignored; stored as `-1` | Never |
| `rounds` | Whole number, at least 1 | One count per round change |
| `turns` | Whole number, at least 1 | One count per matching turn boundary of the target (see `expireOn`) |
| `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years` | Whole number, at least 1 | Against world time |

For time units, the applied copy stores `expiresAt`. It is the start time plus the duration, converted to seconds with the world's calendar, so months and years follow that calendar's lengths.

Validation messages:

- `unknown duration unit "<unit>"` when the unit is not in the table above.
- `duration must be a whole number of at least 1 for the unit "<unit>"` when a non-permanent unit has a duration that is not a whole number or is below 1.

### No stacking

An applied effect is blocked when an enabled applied effect already sits on the same target with the same key. The key is `conditionId` when it is set, and `templateId` otherwise. Two different templates that share a `conditionId` therefore block each other. Disabled effects never block.

### Clear filter

A clear request removes the applied effects on a target that match a filter. Each key below is one criterion. When several are given, every one must match.

| Key | Matches |
|-----|---------|
| `all` | Every applied effect. Must be `true`; it overrides the other keys. |
| `origin` | Effects whose `origin` is equal to the value. |
| `sourceType` | Effects whose `sourceType` is equal to the value. |
| `sourceId` | Effects whose `sourceId` is equal to the value. |
| `conditionId` | Effects whose `conditionId` is equal to the value. |
| `tag` | Effects whose `tags` include the value. |
| `templateId` | Effects whose `templateId` is equal to the value. |

Keys other than these are ignored. An empty filter matches nothing and is rejected with `400`. Templates are never matched.

### GM approval

The world field `effectsRequireGmApproval` (default `false`) turns on GM approval for player effects. The GM sets it with `PUT /api/worlds/:id/basic-info` (see [Worlds](worlds.md)). While it is `true`:

- Only a player applying an **item** template is parked. Tile templates are never gated, and an Assistant GM or GM applies any template directly.
- Before parking, the server runs the same checks as a direct apply (template, target, duration, No stacking). A request that could not succeed is refused at once with `400`, `404` or `409`, and nothing is stored.
- At least one connected user with role 3 or above (Assistant GM or GM) must be in the world. Otherwise the request is refused with `409`.
- Pending requests are held in memory only. Each one lives 5 minutes, a player may have at most 5 pending requests, and a server restart drops all of them. Nothing is written to the database.
- Answering a request removes it, whatever the result. Expired requests are treated as missing, so answering one returns `404`.
- On **approve**, the server checks the request again as the player would now: the target and the template must still exist, the player must still be in the world, and the player must still be allowed to use the template (own the actor of the item). If not, the response is `403`. Otherwise the effect is applied with the same rules as a direct apply, so `409` is still possible.
- The target is the cast or actor the player sent, resolved again when the GM answers.

---

## Routes

### POST `/apply`

Copies an effect template onto a cast or an actor.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `templateId` | `string` | **yes** |
| `targetCastId` | `string` | yes, unless `targetActorId` is sent |
| `targetActorId` | `string` | yes, unless `targetCastId` is sent |

When both target fields are sent, `targetCastId` is used. A cast linked to an actor (a player character) receives the effect on the actor, so it follows the character across scenes. An unlinked cast (an NPC) keeps the effect on itself.

**Checks run in this order:** body, then world, then target, then template, then permission.

**Response `201`:** `{ "effect": <applied effect> }` when the effect is applied directly.
**Response `202`:** `{ "requestId": "<id>" }` when a player's item effect is parked for GM approval (see [GM approval](#gm-approval)). Nothing is applied yet.
**Response `400`:** `{ "error": "worldId is required" }` when neither the session nor the body gives a world; `{ "error": "templateId and a target are required" }`; `{ "error": "Not an effect template" }` when `templateId` is not a template; or a duration validation message (see above).
**Response `403`:** `{ "error": "You cannot use this effect" }` when a player does not own the actor of the template's item, or when a tile template's target is not a cast the player owns inside the tile (on the tile's stage).
**Response `404`:** `{ "error": "Target not found" }` when the target is missing or belongs to another world; `{ "error": "Effect template not found" }` when the template is missing or belongs to another world.
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id of the blocking effect>" }` (see No stacking). Also `{ "error": "No GM is connected to approve this effect" }` when a player's effect needs approval and no Assistant GM or GM is connected to the world.
**Response `429`:** `{ "error": "Too many pending effect requests" }` when the player already has 5 requests waiting.
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Internal events:** Signal `buff.created` with the applied effect when it is applied directly. A parked request sends `effect.requested` instead (see Signals).

---

### POST `/clear`

Removes the applied effects of a target that match a filter. Templates are not affected.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `targetCastId` | `string` | yes, unless `targetActorId` is sent |
| `targetActorId` | `string` | yes, unless `targetCastId` is sent |
| `filter` | `object` | **yes**, with at least one criterion (see Clear filter) |

For an Assistant GM, the role check runs before the body checks, so a caller below Assistant GM is refused even when the body is also invalid. For a player, the filter is checked first against the rules in [Player tile clear](#player-tile-clear): anything other than a tile clear is refused with `403`, before the target and the other body checks run.

**Response `200`:** `{ "removed": ["<id>", "..."] }`. The array is empty when nothing matched.
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "A target is required" }`; `{ "error": "A clear needs at least one criterion" }` when `filter` is missing, is not an object, or has no usable key.
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is a player and the request is not an allowed tile clear, or when the player does not own the target
**Response `404`:** `{ "error": "Target not found" }` when the target is missing or belongs to another world
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Internal events:** Signal `buff.deleted` with `{ "id": "<id>" }` for each removed effect

### Player tile clear

A player may clear the effects that a tile put on one of their casts or actors. Every other clear stays with the Assistant GM. The player's request is allowed only when all of these hold:

- `filter.sourceType` is `"tile"`.
- `filter` also names `sourceId` (the tile id) or `templateId` (the tile template id).
- The target exists in the caller's world.
- The caller owns the target. For a cast, that means edit rights on the cast, or on the actor the cast is linked to. For an actor, it means edit rights on the actor. This is the same ownership rule that a player's tile apply uses.

For a player, the server then changes the filter before matching:

- `all` is removed, because `all` matches every effect and would ignore the `sourceType` check.
- `sourceType` is forced to `"tile"`, so only effects applied from a tile are removed. Item effects and manual conditions on the same target stay.

The other keys (`sourceId`, `templateId`, `conditionId`, `origin`, `tag`) still narrow the match as usual.

Applied copies of tile templates always carry `sourceType: "tile"` and `sourceId` set to the tile id, so they are what a player clear removes.

### POST `/condition`

Turns a manual condition on or off on a cast or an actor. A manual condition is a permanent applied effect with no template, which the GM chooses by hand.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `conditionId` | `string` | **yes**, not empty |
| `on` | `boolean` | **yes** |
| `targetCastId` | `string` | yes, unless `targetActorId` is sent |
| `targetActorId` | `string` | yes, unless `targetCastId` is sent |
| `name` | `string` | no. The shown name when `on` is `true`; defaults to `conditionId`. |
| `icon` | `string` | no. Used when `on` is `true`. |

The target is resolved as in `POST /apply`: a linked cast gets the condition on its actor, and when both target fields are sent, `targetCastId` is used.

**Checks run in this order:** role, then world, then the target is present, then `conditionId`, then `on`, then the target is found in the world.

**`on: true`:** creates an applied effect with `sourceType: "manual"`, `sourceId: ""`, `templateId: ""`, `durationUnit: "permanent"`, `duration: -1`, `conditionId` set to the given id, and `appliedBy` set to the caller. The condition also appears in the status markers of the target's casts (see [Status markers](#status-markers)). The same No stacking rule as a template applies: a second active effect with the same `conditionId` on the target is refused.

**`on: false`:** removes the applied effects on the target that carry this `conditionId`. It also removes the condition from the status markers of the target's casts, even when no effect backs that marker (for example a marker set by hand). The marker stays only while another applied effect on the target still carries the same condition.

**Response `201`:** `{ "effect": <applied effect> }` when `on` is `true` and the effect was created.
**Response `200`:** `{ "removed": ["<id>", "..."] }` when `on` is `false`. The array is empty when nothing matched; the status markers are still updated.
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "A target is required" }`; `{ "error": "conditionId is required" }` when it is missing or blank; `{ "error": "on must be true or false" }`; `{ "error": "<message>" }` when the stored effect is invalid.
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is below Assistant GM
**Response `404`:** `{ "error": "Target not found" }` when the target is missing or belongs to another world
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id>" }` when `on` is `true` and the condition is already active on the target
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Internal events:** Signal `buff.created` when a condition is turned on; `buff.deleted` for each removed effect when it is turned off.

---

### GET `/target`

Lists the applied effects of a cast or an actor. Templates are never listed.

**Query parameters:** `castId` or `actorId`. A cast is resolved the same way as in `POST /apply`, so a linked cast returns the effects of its actor.

**Response `200`:** `{ "effects": [<applied effect>, ...] }`
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "castId or actorId is required" }`
**Response `404`:** `{ "error": "Target not found" }` when the target is missing or belongs to another world
**Response `500`:** `{ "error": "..." }` on an unexpected failure

---

### GET `/requests`

Lists the player requests waiting for an answer in the caller's world, oldest first. Expired requests are not listed. The world comes from the session.

**Response `200`:** `{ "requests": [{ "id", "worldId", "userId", "templateId", "target", "createdAt" }, ...] }`. `target` holds the `castId` or `actorId` the player sent. `createdAt` is a server time in milliseconds.
**Response `400`:** `{ "error": "worldId is required" }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is below Assistant GM
**Response `500`:** `{ "error": "..." }` on an unexpected failure

---

### POST `/requests/:id/approve`

Applies a waiting player effect. The request is removed first, so it is answered once whatever the outcome. The checks are described under [GM approval](#gm-approval).

**Response `200`:** `{ "effect": <applied effect> }`. Unlike a direct apply, this returns `200`, not `201`.
**Response `400`:** a duration validation message, or the same error as a direct apply
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is below Assistant GM; `{ "error": "The player can no longer use this effect" }` when the player or the template no longer qualifies
**Response `404`:** `{ "error": "Effect request not found" }` when the id is unknown, expired or belongs to another world; `{ "error": "Target not found" }`; `{ "error": "Effect template not found" }`
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id of the blocking effect>" }`
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Internal events:** Signal `buff.created` with the applied effect

---

### POST `/requests/:id/deny`

Drops a waiting player effect without applying it and tells the player.

**Response `200`:** `{ "ok": true }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` when the caller is below Assistant GM
**Response `404`:** `{ "error": "Effect request not found" }` when the id is unknown, expired or belongs to another world
**Response `500`:** `{ "error": "..." }` on an unexpected failure
**Internal events:** Signal `effect.denied`

---

## Lifecycle

### Round and turn ticks

Ticks happen inside `POST /api/combat/:worldId/next`. For each call, the server runs these steps in order:

1. **Turn end.** For the combatant whose turn ends, turn-based effects on its target with `expireOn: "turn-end"` lose one count. This is the default for `expireOn`.
2. **Round change.** When the call moves to a new round, every rounds-based effect in the world loses one count. This includes effects on actors that are not in the combat.
3. **Turn start.** For the combatant whose turn starts, turn-based effects on its target with `expireOn: "turn-start"` lose one count.

A count that reaches `0` removes the effect. A count that drops without reaching `0` emits `buff.updated`, and a removal emits `buff.deleted`. Templates and disabled effects never tick. For a linked cast, the ticks go to the effects of its actor.

`POST /api/combat/:worldId/previous` does not tick anything and does not give back counts that were already spent.

### Time-based expiry

A timer runs every 2 seconds for each loaded world, even when the world clock is paused, so a manual time change still ends effects. An applied effect with a time unit is removed once its `expiresAt` is at or before the current world time. Disabled effects do not expire.

### Combat end

Applied effects with `removeOnCombatEnd: true` are removed when:

- `POST /api/combat/:worldId/end` is called, or
- `POST /api/combat/:worldId/start` or `POST /api/combat/:worldId/dex-initiative` replaces a combat that was active.

Starting a combat when none was active removes nothing. `POST /api/combat/:worldId/reset` and `previous` do not remove them either. Templates are never touched.

### Deleting a cast, stage or actor

Deleting an object also deletes the applied effects that belong to it. Templates are never deleted by this.

- `DELETE /api/cast/:id` deletes every applied effect on that cast.
- `DELETE /api/stages/:id` deletes the applied effects of every cast on the stage. The casts themselves are not deleted by this step.
- `DELETE /api/actors/:id` deletes the applied copies of the actor's effects. Item templates stay.

Each removal sends `buff.deleted`, and it also updates the status markers of the affected casts (see below).

### Status markers

A cast's `statusMarkers` follows the applied effects on its target. The target is the cast itself, or the actor when the cast is linked (a linked cast shows the markers of its actor on every stage).

- Applying an effect that has a `conditionId` adds that condition to the markers of the target's casts.
- Removing an effect (by clear, tick, expiry, combat end or the cascades above) removes its condition from the markers only when no other applied effect on the target still has it.
- Markers that no removed condition names are never changed, so a marker set by hand stays.
- `POST /api/effects/condition` with `on: false` also removes the condition's marker from the target's casts when no applied effect on the target still carries it. This is how the GM removes a marker set by hand.
- `DELETE /api/buffs/:id` on an applied effect updates status markers the same way: the condition is removed from the cast when no other applied effect on the target still has it.
- The `blinded` condition removes the token's own vision: a blinded token gives no sight, darkvision or light-extended view, while the vision of the player's other tokens still counts.

---

## Signals

| Signal | When it is sent | Payload |
|--------|-----------------|---------|
| `buff.created` | An effect is applied, directly or by approval, or a manual condition is turned on | The applied effect |
| `buff.updated` | A tick lowers a count | The updated effect |
| `buff.deleted` | An effect is cleared, expires, reaches a count of `0`, ends with the combat, or is removed by a cascade | `{ "id": "<id>" }` |
| `effect.requested` | A player's item effect is parked for approval | `{ "requestId", "worldId", "userId", "templateId", "targetCastId", "targetActorId", "templateName" }`. The unused target field is an empty string. |
| `effect.denied` | A GM denies a parked request | `{ "requestId", "userId" }` |

The routes in [Buffs](buffs.md) send the same `buff.*` signals for their own writes.
