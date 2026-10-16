# Compendium

## Endpoints

**Base:** `/api/compendium`
**Auth:** `requireAuth, requireWorldMatch`. Pack create/update/delete, import/export, the adventure routes and the entry writes need the `compendiumEdit` permission (`requirePermission`). The source lock, the source entry/folder writes and the `entries-sheet` PUT need the GM (`requireGM`). Pack routes check that the pack belongs to the signed-in world (admin sessions excepted).

**WebSocket names:** the internal `compendium_packs.*` signals reach clients as `compendium.created|updated|deleted`.

---

### GET `/`

Lists the world's packs, newest first. The world comes from the session; `?worldId=` is honored only for admin sessions.

**Response `200`:** `[{ id, worldId, name, type, folderId, entryCount, createdAt, updatedAt }]`

---

### POST `/`

Creates pack. The world comes from the session (admin sessions use the body's `worldId`). `type` defaults to `'Actor'`.

**Request body:** `{ id?, name, type? }`

**Response `201`:** the created pack with `entries: []`
**Response `400`:** `{ "error": "..." }` from the Document layer
**WS Event:** `compendium.created` (Signal `compendium_packs.created`)

---

### GET `/resolve-uuid?uuid=Compendium.<package>.<pack>[.<docType>].<entryId>`

Resolves a Compendium UUID to its pack and entry. Looks in the world's live addon/ruleset sources first, then in the world's own packs.

**Response `200`:** `{ found: true, kind: 'source' | 'world', pack: { id, type, name, worldId, apiRoute }, entry: { id, name, type } }`
**Response `400`:** `{ "error": "uuid is required." }` / `{ "error": "Only Compendium UUIDs supported." }` / `{ "error": "Invalid Compendium UUID format." }`
**Response `404`:** `{ "found": false, "error": "Entry not found in compendium." }`

---

### GET `/:id`

Fetches pack with its entries and folders.

**Response `200`:** the pack, with `entries` and `folders`
**Response `403`:** `{ "error": "Compendium pack belongs to a different world." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### PUT `/:id`

Updates the pack's `name` and/or `folderId`, and/or replaces its entries (full replace: the old entries are deleted and the new list is inserted).

**Request body:** `{ name?, folderId?, entries?: [] }`

**Response `200`:** `{ "success": true, "count": 12 }` (`count` only when `entries` was sent)
**Response `400`:** `{ "error": "entries must be an array." }` / `{ "error": "No valid fields provided for update." }`
**WS Event:** `compendium.updated` (Signal `compendium_packs.updated`, sent for the pack's own metadata update)

---

### DELETE `/:id`

Removes the pack and its entries.

**Response `200`:** `{ "success": true }`
**WS Event:** `compendium.deleted` (Signal `compendium_packs.deleted`)

---

### POST `/:id/import`

Restores entries from a JSON file: a backup made by `/export` (an array of entries), not a ruleset/addon format. The file must be inside `worlds/<worldId>/packs/`. Entries are appended after the existing ones.

**Request body:** `{ "filePath": "backup.json" }` (relative to the pack's `packs` folder)

**Response `200`:** `{ "success": true, "importedCount": 5, "totalCount": 17 }`
**Response `400`:** `{ "error": "filePath required." }`
**Response `403`:** `{ "error": "Access denied." }` (path outside the folder)
**Response `404`:** `{ "error": "File not found." }`

---

### POST `/:id/export`

Writes all the pack's entries to a JSON file in `worlds/<worldId>/packs/`. The file name is sanitized to letters, digits, `_`, `-` and `.`.

**Request body:** `{ "fileName": "backup.json" }`

**Response `200`:** `{ "success": true, "path": "backup.json" }`
**Response `400`:** `{ "error": "fileName required." }`

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

**Request body:** `name`, `imgUrl`, and the document data: `systemData` (Actor), `data` (Item and others), or the journal page fields (Journal)
**Response `200`:** the entry in the same shape as the GET above
**Response `403`:** pack belongs to a different world
**Response `404`:** pack or entry not found
**Response `500`:** `{ "error": "Failed to update entry." }`
**WS Event:** `compendium.entry.updated` (`{ packId, entry }`)

---

### POST `/:id/adventure-entry`

Bundles actors (with their owned items), items, stages, journals, macros and playlists
(with sounds) into a single self-contained "Adventure" entry stored in the pack — only for
packs of `type: 'Adventure'`. Ownership and IDs are stripped; a reimport creates fresh copies.

**Request body:** `{ "name": "...", "actorIds"?: [], "itemIds"?: [], "stageIds"?: [], "journalIds"?: [], "macroIds"?: [], "playlistIds"?: [] }`

Only documents of the pack's world are bundled. Stages are saved without their placeables (cast, walls, lights, tiles, notes, drawings).

**Response `201`:** Created entry (`{ id, name, type: 'Adventure', data }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }` / `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### POST `/:id/adventure-entry/:entryId/import`

Recreates every document bundled in an Adventure entry as new documents in the pack's world
(fresh IDs — cross-references inside `systemData`/`data` are not remapped). Stages come back inactive, as blank maps.

**Response `200`:** `{ "success": true, "created": { actors, items, stages, journals, macros, playlists } }` (each a count)
**Response `400`:** `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }` / `{ "error": "Entry not found." }`

---

## Addon/ruleset sources (read-only, never copied into the world)

These routes browse live compendium sources declared by active addons/rulesets
(`manifest.compendiums` — local `.sqlite` files or remote APIs, see
[system-creation.md](../guide/system-creation.md#remote-compendium-sources-security-model)
for the security model of the remote kind). Browsing never writes anything to the
world's database — only `.../import` materializes a single entry.

Every listing is scoped to the request's authenticated world (admin sessions use the active world): only that world's own
ruleset (`world.system`), addons enabled for that world (`world_packages` — not the old
`world.packageIds`, which is never written by any live code path), and among those, only
the ones that don't restrict `systems` to a different one. A `remote` source with
`requiresApiKey: true` and no license redeemed for this server simply doesn't appear in
the list — it's omitted, not a 403.

**Auth on `/sources*`:** the reads (`GET`) need only the signed-in session, the same as `/browse/*`. The import needs `compendiumEdit`. The lock, the entry and folder writes, and the `entries-sheet` PUT need the GM (`requireGM`), because they change the shared source file for every world that uses it.

**CODE ISSUE:** the `GET /sources*` reads are not role-gated. Any player can read the full data of every entry of a source (including the `data` of `GET .../entries/:entryId`), not only what the GM imports. Remote sources are proxied with a server-held credential, so this read access is not limited to what the GM licensed.

### GET `/sources`

Lists every live source scoped to the request's world (see the scoping note above).

**Response `200`:** `[{ sourceId, name, type, ownerName, ownerType, locked }]`

---

### GET `/sources/:sourceId/entries`

Lightweight entry listing for one source (no `data` payload), plus its folders. `?search=`

**Response `200`:** `{ sourceId, name, type, locked, entries: [{ id, name, type, sortOrder, imgUrl }], folders }`
**Response `404`:** `{ "error": "Compendium source not found." }`

---

### GET `/sources/:sourceId/entries/:entryId`

Full entry, including `data` (the raw shape used by drag-and-drop).

**Response `404`:** `{ "error": "Entry not found." }`

---

### POST `/sources/:sourceId/entries/:entryId/import`

Materializes ONE entry into the world's own compendium (creates the destination pack on
first use, named after the source). Never copies the rest of the source pack.

**Request body:** `{ "worldId": "..." }` (required)

**Response `201`:** `{ packId, entry }`
**Response `400`:** `{ "error": "worldId is required." }`
**Response `403`:** `{ "error": "Access denied." }` when `worldId` doesn't match the caller's authenticated world
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`

---

### POST `/sources/:sourceId/lock`

GM only. Locks (`true`) or unlocks (`false`) the whole source pack. The lock is stored in the source file and affects every world that uses it.

**Request body:** `{ "locked": true }` (must be a boolean)

**Response `200`:** `{ "sourceId": "...", "locked": true }`
**Response `400`:** `{ "error": "\"locked\" (boolean) is required." }`
**Response `404`:** `{ "error": "Compendium source not found or not editable." }`
**Note:** the `compendium.sourceLockChanged` signal is not relayed to WebSocket clients.

---

### GET `/sources/:sourceId/entries-sheet/:entryId`

The entry in the shape a document sheet reads: `systemData` for Actor sources, `pages`/`categories` for Journal sources, `data` for the rest. Any signed-in session.

**Response `200`:** `{ id, name, type, imgUrl, ownership: {}, worldId, ... }`
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`

---

### PUT `/sources/:sourceId/entries-sheet/:entryId`

GM only, and the source must be unlocked. Saves the sheet edits back to the source file. Accepts `name`, `imgUrl` and the data field of the type (`systemData` for Actor, the journal fields for Journal, `data` otherwise).

**Response `200`:** the entry, in the same shape as the GET
**Response `403`:** `{ "error": "Compendium source is locked. Unlock it first." }`
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`
**Response `500`:** `{ "error": "Failed to update compendium entry." }`
**WS Event:** `compendium.sourceEntryUpdated` (`{ sourceId, entryId }`)

---

### Journal pages and categories: `/sources/:sourceId/entries-sheet/:entryId/:collection/:childId?` and `/:packId/entries/:entryId/:collection/:childId?`

For `Journal`/`JournalEntry` entries only. `:collection` is `pages` or `categories`. `POST` without `:childId` creates a row, `PUT` with `:childId` updates it, `DELETE` with `:childId` removes it (deleting a category clears `categoryId` on its pages). Other methods return `405`.

- Source entries (`/sources/...`): GM only, source must be unlocked, pack type must be `Journal`/`JournalEntry`. Writes `compendium.sourceEntryUpdated`.
- World packs (`/:packId/...`): needs `compendiumEdit`, the pack must belong to the signed-in world, and its type must be `Journal`/`JournalEntry`. Writes `compendium.entry.updated`.

**Response `200`:** the created or updated row (`{ ok: true }` for `DELETE`)
**Response `400`:** the pack is not a journal (or the entry update failed)
**Response `403`:** `{ "error": "Desbloqueie o compêndio antes de editar." }` for a locked source; a bare `403` (no JSON body) when the caller is not the GM or the pack belongs to another world
**Response `404`:** pack, entry or child not found (bare `404`, no JSON body)

---

### POST `/sources/:sourceId/entries`

GM only, source must be unlocked. Creates a new entry in the source file.

**Response `201`:** the created entry
**Response `400`:** `{ "error": "..." }` from the source writer
**Response `403`:** source is locked
**Note:** the `compendium.sourceFolderChanged` signal is not relayed to WebSocket clients.

---

### PUT `/sources/:sourceId/entries/:entryId/folder`

GM only, source must be unlocked. Moves an entry to another folder of the source.

**Request body:** `{ "folderId": "..." }` (required)

**Response `200`:** `{ "success": true, "folderId": "..." }`
**Response `400`:** `{ "error": "folderId is required." }`
**Response `403`:** source is locked
**Response `404`:** `{ "error": "Entry not found." }`

---

### POST / PUT / DELETE `/sources/:sourceId/folders[/:folderId]`

GM only, source must be unlocked. Creates (`POST`, `201`, returns the folder), renames or moves (`PUT`, returns the folder) or deletes (`DELETE`, `{ "success": true, "id": "..." }`) a folder of the source.

**Response `403`:** source is locked
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Folder not found." }`

---

## Addon/ruleset sources — player-facing read (`/browse/*`)

Same scope/data as `/sources*` above, but **without requiring `compendiumEdit`** — just
authenticated in the world. Exists for player-facing pickers (e.g. the character wizard
picking race/class) that need to browse compendium without being GM. No write/import
route here, ever.

### GET `/browse/sources`

Same as `/sources`, with an optional `?type=` filter.

**Response `200`:** `[{ sourceId, name, type }]`

---

### GET `/browse/sources/:sourceId/entries`

Same as `/sources/:sourceId/entries`. `?search=`

**Response `200`:** `{ sourceId, name, type, entries: [...] }`

---

### GET `/browse/sources/:sourceId/entries/:entryId`

Same as `/sources/:sourceId/entries/:entryId`.

---

### GET `/browse/entries?entryType=X&search=Y`

Searches every source scoped to the world at once, filtered by the entry's own `type`
(`class`/`race`/`feat`/`subclass`/`spell`/...) — not the pack's `type` (which is just a
generic bucket: `Actor`/`Item`/`Journal`). Lets a picker ask "every class
entry named X, in any pack" without knowing which `sourceId`s exist ahead of time.

**Query:** `entryType` (required), `search`, `includeData` (`"true"` to include each
entry's `data` field — needed when the caller filters client-side by a mechanical field,
e.g. a subclass picker filtering by `classIdentifier`)

**Response `200`:** `{ entries: [{ ...entry, sourceId, sourceName }] }`
**Response `400`:** missing `entryType`
