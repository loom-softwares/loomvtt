# Compendium

## Endpoints

**Base:** `/api/compendium`
**Auth:** `requireAuth` (+ `requirePermission('compendiumEdit')` on POST/PUT/DELETE/import/export)

---

### GET `/`

Lists packs. `?worldId=`

**Response `200`:** `[{ id, name, type, entryCount }]`

---

### POST `/`

Creates pack.

**Request body:** `{ id, worldId, name, type }`

**WS Event:** `compendium_packs.created` (auto-broadcast by the document layer)

---

### GET `/:id`

Fetches pack with entries.

---

### PUT `/:id`

Replaces entries (full replace).

**Request body:** `{ entries[] }`

**WS Event:** `compendium_packs.updated` (auto-broadcast)

---

### DELETE `/:id`

Removes pack.

**WS Event:** `compendium_packs.deleted` (auto-broadcast)

---

### POST `/:id/import`

Imports entries from a JSON file.

**Request body:** `{ filePath }`

---

### POST `/:id/export`

Exports entries to JSON.

**Request body:** `{ fileName }`

---

### GET `/:packId/entries/:entryId`

Virtual endpoint that simulates the real document API (`Actor`/`Item`/`JournalEntry`) for a compendium entry — used to open the entry directly in a normal sheet.

**Response `200`:** format varies by `pack.type`:
- `Actor`: `{ id, name, type, systemData, imgUrl, ownership, worldId }`
- `Item`: `{ id, name, type, data, imgUrl, ownership, worldId }`
- `JournalEntry`/`Journal`: `{ id, name, type, pages, ownership, worldId }`
- others: `{ id, name, type, data, imgUrl, ownership, worldId }`

**Response `404`:** pack or entry not found

---

### PUT `/:packId/entries/:entryId`

Virtual endpoint that saves edits made in a real sheet back to the compendium entry. **Auth:** `requirePermission('compendiumEdit')`

**Request body:** fields of the entry to update (varies by type)
**Response `404`:** pack or entry not found

---

### POST `/:id/adventure-entry`

Bundles actors (with their owned items), items, stages, journals, macros and playlists
(with sounds) into a single self-contained "Adventure" entry stored in the pack — only for
packs of `type: 'Adventure'`. Ownership and IDs are stripped; a reimport creates fresh copies.

**Request body:** `{ "name": "...", "actorIds"?: [], "itemIds"?: [], "stageIds"?: [], "journalIds"?: [], "macroIds"?: [], "playlistIds"?: [] }`

**Response `201`:** Created entry (`{ id, name, type: 'Adventure', data }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }` / `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### POST `/:id/adventure-entry/:entryId/import`

Recreates every document bundled in an Adventure entry as new documents in the pack's world
(fresh IDs — cross-references inside `systemData`/`data` are not remapped).

**Response `200`:** `{ "success": true, "created": { actors, items, stages, journals, macros, playlists } }`
**Response `400`:** `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }` / `{ "error": "Entry not found." }`

---

### POST `/restore-from-system`

Manually restores the compendiums that come with the active world's system (ruleset) — the same process that runs automatically when activating a world. **Auth:** `requirePermission('compendiumEdit')`

**Request body:** `{ "worldId": "..." }`

**Response `200`:** `{ "success": true, "count": number }`
**Response `400`:** missing `worldId`
