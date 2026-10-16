# Combat

## Endpoints

**Base:** `/api/combat`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on every route except `GET /:worldId` and `POST /:worldId/combatant/:castId/initiative`)

---

### GET `/:worldId`

Returns the world's active combat.

**Response `200`:** Combat object or `null`

---

### POST `/:worldId/start`

Starts a new combat. Ends previous active combat and starts the world's combat music.

**Request body:** `{ "combatants": [{ "id", "name", "initiative?" }] }`

If `initiative` is not provided, rolls a random 1d20 (result 1-20). A value that is provided is stored as sent: unlike `dex-initiative`, this route does not clamp it to -20..100.

**Response `201`:** Combat created (ordered by initiative DESC)
**Response `400`:** the insert failed
**Response `500`:** `{ "error": "..." }`
**WS Event:** `combat.ended` (always sent first, for the combat it replaces), then `combat.started`

---

### POST `/:worldId/dex-initiative`

Starts combat with DEX-based initiative. A total that a `combatInitiative` handler supplies is used as given. The formula is used only for combatants without a supplied total, and only when `deferred` is not `true`.

**Request body:** `{ "castIds"?: [ids], "initiativeFormula"?: "1d20+@attributes.dex.mod" }`

- If `initiativeFormula` is not sent, the server uses `1d20`. The client sends the active system's formula, but the server reads it only when `deferred` is absent. The "Start Combat (DEX Initiative)" button always sends `deferred: true`, so on that path the formula is never used: every combatant without a supplied total starts with `initiative: null` and rolls its own d20 in the combat tab.
- The formula is resolved using `@variables` from the entire flattened `systemData` (e.g. `@attributes.dex.mod`, `@skills.perception.value`).
- If `castIds` is missing or empty, uses all casts in the world. Otherwise only the listed casts take part.
- Final result: each combatant receives the total calculated roll value, keeping DEX only for display (doesn't affect the actual roll).
- Optional body fields: `initiatives` (`{ [castId]: total }`, a ruleset-provided total, clamped to -20..100, used instead of the formula), `health` (`{ [castId]: { hp, maxHp } }`), `deferred` (when `true`, combatants without a given total start with `initiative: null` and roll later through `POST /:worldId/combatant/:castId/initiative`), and `rolls` (`{ [castId]: { bonus, mode } }`, stored for the deferred roll).
- Combatants with `null` initiative are sorted last.

**Response `201`:** Combat created
**Response `400`:** `{ "error": "No cast members in this world." }`
**WS Event:** `combat.started` (the previous active combat is ended silently, with no `combat.ended`)

---

### POST `/:worldId/next`

Advances to the next turn. When the turn wraps around to a new round, the `duration` of every active buff in the world goes down by 1, and buffs that reach 0 are deleted (`-1` is permanent).

**Response `200`:** Combat updated (round/turn)
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.next`

---

### POST `/:worldId/previous`

Steps back one turn (for when the GM advanced by mistake). Buff durations already ticked are not restored.

**Response `200`:** Combat updated. At round 1, turn 0 it returns the combat unchanged.
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.updated` (not `combat.next`, so start-of-turn effects do not run again)

---

### POST `/:worldId/reset`

Back to round 1, turn 0, with every initiative set to `null` again (each combatant rolls again). The combat stays active.

**Response `200`:** Combat updated
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.updated` (no `combat.ended`)

---

### POST `/:worldId/end`

Ends active combat.

**Response `200`:** `{ "success": true }`
**WS Event:** `combat.ended`

---

### POST `/:worldId/combatant`

Adds combatant by `castId` to the active combat. Creates combat if it doesn't exist. If the cast is already in the combat, returns the combat unchanged.

**Request body:** `{ "castId": "...", "hp"?: number, "maxHp"?: number }` (`hp` and `maxHp` default to the cast's own `systemData.hp`)

⚠️ **Note:** Initiative is always a random `1d20` (1-20) when added via this endpoint — it bypasses the system. For custom initiative, use `/dex-initiative`.

**Response `200`:** Combat updated
**Response `400`:** `{ "error": "castId is required" }`
**Response `404`:** `{ "error": "Cast member not found" }`
**WS Event:** `combat.updated`

---

### DELETE `/:worldId/combatant/:castId`

Removes combatant.

**Response `200`:** Combat updated
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.updated`

---

### POST `/:worldId/combatant/:castId/initiative`

Lets the token's owner set their own initiative. Only while it is still `null`. The GM is always allowed. Not GM-only: any signed-in user of the world can call it, but non-GM users must own the token (same ownership rule as `POST /api/cast/:id/position`).

**Request body:** `{ "initiative": number }` (clamped to -20..100)

**Response `200`:** Combat updated
**Response `400`:** `{ "error": "initiative must be a number" }`
**Response `403`:** `{ "error": "Only the owner of this token can set its initiative" }`
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Combatant not found" }`
**Response `409`:** `{ "error": "Initiative is already set" }`
**WS Event:** `combat.updated`

---

---

### PUT `/:worldId/combatant/:castId`

Updates combatant. Allowed fields: `hp`, `maxHp`, `initiative`, `isActive`, `name`, `groupId`.
Also accepts `flags: { [namespace]: {...} }` — shallow-merged per namespace (same pattern as
`ChatMessage`/`User` flags), so one addon's flags don't overwrite another's.

**Response `200`:** Combat updated
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Combatant not found" }`
**WS Event:** `combat.updated`

---

### POST `/:worldId/group`

Adds a combatant group — a shared initiative row multiple combatants can join.

**Request body:** `{ "name": "..." }`

**Response `201`:** Created group (`{ id, name, initiative: null }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.updated`

---

### PUT `/:worldId/group/:groupId`

Renames a group and/or sets its shared initiative.

**Request body:** `{ "name"?: "...", "initiative"?: number | null }`

**Response `200`:** Updated group
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Group not found" }`
**WS Event:** `combat.updated`

---

### DELETE `/:worldId/group/:groupId`

Removes a group. Its members keep their combatant entries but lose their `groupId` (they fall
back to their own initiative).

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "No active combat" }`
**WS Event:** `combat.updated`

---

## Initiative: how to customize per system

Systems customize initiative via the `initiativeFormula` setting (registered in `Loom.settings`).

**For the system author:**
```javascript
// In the system's setup script, register the setting. The third argument must be a config object:
// a bare string is spread into the definition, so no default is stored.
Loom.settings.register(systemId, 'initiativeFormula', {
  scope: 'world',
  type: String,
  default: '1d20 + @attributes.dex.mod',
});
```

**Available variables:** any numeric field in the flattened `systemData`, referenced as `@nested.path` (e.g. `@attributes.dex.mod`, `@skills.perception.value`).

**Endpoints that use it:**
- `POST /dex-initiative` — orders by result and starts combat. The formula rolls only for combatants without a supplied total and only when `deferred` is absent; the Start combat button sends `deferred: true`, so it normally leaves each d20 to be rolled in the combat tab.
- `POST /start` — ignores the system, uses a fixed random d20.
- `POST /combatant` — ignores the system, uses a fixed random d20.
