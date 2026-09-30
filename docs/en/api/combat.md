# Combat

## Endpoints

**Base:** `/api/combat`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on every route except `GET /:worldId`)

---

### GET `/:worldId`

Returns the world's active combat.

**Response `200`:** Combat object or `null`

---

### POST `/:worldId/start`

Starts a new combat. Ends previous active combat.

**Request body:** `{ "combatants": [{ "id", "name", "initiative?" }] }`

If `initiative` is not provided, rolls a random 1d20 (result 1-20).

**Response `201`:** Combat created (ordered by initiative DESC)
**WS Event:** `combat.started`

---

### POST `/:worldId/dex-initiative`

Starts combat with initiative resolved via the active system's formula.

**Request body:** `{ "castIds"?: [ids], "initiativeFormula"?: "1d20+@attributes.dex.mod" }`

- If `initiativeFormula` is not sent, uses the active system's `initiativeFormula` (or default `1d20`).
- The formula is resolved using `@variables` from the entire flattened `systemData` (e.g. `@attributes.dex.mod`, `@skills.perception.value`).
- If `castIds` is not provided, uses all `CastsDocument` in the world.
- Final result: each combatant receives the total calculated roll value, keeping DEX only for display (doesn't affect the actual roll).

**Response `201`:** Combat created

---

### POST `/:worldId/next`

Advances to the next turn.

**Response `200`:** Combat updated (round/turn)
**WS Event:** `combat.next`

---

### POST `/:worldId/end`

Ends active combat.

**Response `200`:** `{ "success": true }`
**WS Event:** `combat.ended`

---

### POST `/:worldId/combatant`

Adds combatant by `castId` to the active combat. Creates combat if it doesn't exist.

**Request body:** `{ "castId": "..." }`

⚠️ **Note:** Initiative is always a random `1d20` (1-20) when added via this endpoint — it bypasses the system. For custom initiative, use `/dex-initiative`.

**Response `200`:** Combat updated
**WS Event:** `combat.updated`

---

### DELETE `/:worldId/combatant/:castId`

Removes combatant.

**Response `200`:** Combat updated

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
// In the system's setup script, register the setting:
Loom.settings.register(systemId, 'initiativeFormula', '1d20 + @attributes.dex.mod');
```

**Available variables:** any numeric field in the flattened `systemData`, referenced as `@nested.path` (e.g. `@attributes.dex.mod`, `@skills.perception.value`).

**Endpoints that use it:**
- `POST /dex-initiative` — rolls the system formula, orders by result, starts combat.
- `POST /start` — ignores the system, uses a fixed random d20.
- `POST /combatant` — ignores the system, uses a fixed random d20.
