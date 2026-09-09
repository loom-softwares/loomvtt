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

## Addon/ruleset sources (read-only, never copied into the world)

These routes browse live compendium sources declared by active addons/rulesets
(`manifest.compendiums` — local `.sqlite` files or remote APIs, see
[system-creation.md](../guide/system-creation.md#remote-compendium-sources-security-model)
for the security model of the remote kind). Browsing never writes anything to the
world's database — only `.../import` materializes a single entry.

**Auth on all four:** `requirePermission('compendiumEdit')` — intentionally not open to
every authenticated player, since a remote source proxies through the server using a
credential the server holds; anyone able to call these could otherwise loop them to make
the server dump an entire third-party paid pack, not just what the GM licensed.

### GET `/sources`

Lists every live source from currently active addons/rulesets.

**Response `200`:** `[{ sourceId, name, type, ownerName, ownerType }]`

---

### GET `/sources/:sourceId/entries`

Lightweight entry listing for one source (no `data` payload). `?search=`

**Response `200`:** `{ sourceId, name, type, entries: [{ id, name, type, sortOrder, imgUrl }] }`
**Response `404`:** source not found

---

### GET `/sources/:sourceId/entries/:entryId`

Full entry, including `data`.

**Response `404`:** entry not found

---

### POST `/sources/:sourceId/entries/:entryId/import`

Materializes ONE entry into the world's own compendium (creates the destination pack on
first use, named after the source). Never copies the rest of the source pack.

**Request body:** `{ "worldId": "..." }`

**Response `201`:** `{ packId, entry }`
**Response `403`:** `worldId` doesn't match the caller's authenticated world
**Response `404`:** source or entry not found
