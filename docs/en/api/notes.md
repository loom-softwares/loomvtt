# Notes (Map Notes)

## Endpoints

**Base:** `/api/notes`
**Auth:** `requireAuth, requireWorldMatch`. `GET` is open to every logged-in user of the world (players see the pins and click them to open what they point to). `POST`, `PUT` and `DELETE` require GM (`requireGM`, 403 otherwise).

---

### GET `/stage/:stageId`

Lists notes of a stage.

---

### GET `/:id`

Fetches a single note. `404` with `{ "error": "Note not found" }` when it does not exist.

---

### POST `/`

Creates note. Returns `201` with the created note. `400` with `{ "error": "stageId is required" }` when `stageId` is missing.

| Field | Type | Default |
|-------|------|-------------|
| `stageId` | `string` | **yes** |
| `journalId` | `string` | `''` |
| `targetStageId` | `string` | `''` |
| `levelId` | `string` | `''` |
| `x` | `number` | `0` |
| `y` | `number` | `0` |
| `visibleToPlayers` | `boolean` | `false` |
| `floors` | `number` | `0` |
| `visibleGlobally` | `boolean` | `false` |
| `iconEntry` | `string` | `'bookmark'` |
| `iconFontSize` | `number` | `15` |
| `iconTint` | `string` | `'#ffffff'` |
| `textLabel` | `string` | `''` |
| `fontFamily` | `string` | `'Padrão'` |
| `fontSize` | `number` | `15` |
| `textColor` | `string` | `'#ffffff'` |
| `textAnchor` | `string` | `'center'` |

**WS Events:** `note.created` (sent by the route). The Document layer also emits `notes.created` on the server Signal bus, which is not relayed to WS clients.

---

### PUT `/:id`

Updates note. Accepts the same fields as `POST` (except `stageId`). Returns `200` with the updated note.

Linking is mutually exclusive: setting `targetStageId` clears `journalId`, and setting `journalId` clears `targetStageId`.

**Errors:** `400` with `{ "error": "Not found" }` when the note does not exist (the update reports it as a bad request, not `404`).

**WS Event:** `note.updated`

---

### DELETE `/:id`

Removes note. Returns `{ "success": true }`. `400` with `{ "error": "Not found" }` when the note does not exist.

**WS Event:** `note.deleted` with `{ id }`
