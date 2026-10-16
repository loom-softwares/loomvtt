# Roll Tables

## Endpoints

**Base:** `/api/roll-tables`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists tables. `?worldId=`

---

### POST `/`

Creates table. `requireGM`. Returns `201` with the created table.

| Field                  | Type        | Default | Description                                        |
| ---------------------- | ----------- | ------- | -------------------------------------------------- |
| `id`                 | `string`  | auto    | Optional                                           |
| `worldId`            | `string`  | —       | World                                              |
| `name`               | `string`  | —       | Name                                               |
| `description`        | `string`  | `''`    | Description (sanitized as rich text)               |
| `formula`            | `string`  | `'1d20'` | Roll formula                                      |
| `sortMode`           | `number`  | `0`     | Sorting mode                                       |
| `imgUrl`             | `string`  | `''`    | Image URL                                          |
| `replacement`        | `number`  | `1`     | With replacement? `0` = no replacement (`1` = yes)  |
| `displayRollFormula` | `number`  | `0`     | Show the roll formula alongside the result in chat (`1` = yes) |

An optional `entries` array creates the entries in the same request. Each item takes `text`, `imgUrl`, `weight`, `collectionId`, `type`, `documentCollection`, `documentId`, `description`, `rangeMin` and `rangeMax`. Entries always start with `drawn` = `'NONE'`. Their ranges are stored as sent (missing ranges become `1`, they are not computed from `weight`; see `POST /:id/normalize-results`).

**Errors:** `400` with `{ "error": "..." }` when the Document layer rejects the table.

**WS Event:** `roll-table.created` (the Document layer broadcasts `roll_tables.created`, which the server relays under this name)

---

### GET `/:id`

Fetches table with `entries[]`.

---

### PUT `/:id`

Updates table. `requireGM`. Returns `{ "success": true }` (not the table). Only the sent fields change.
`description` is sanitized as rich text.

**WS Event:** `roll-table.updated`

---

### DELETE `/:id`

Removes table and its entries (the controller deletes the entries explicitly). `requireGM`. Returns `{ "success": true }`.

**WS Event:** `roll-table.deleted`

---

### POST `/:id/entries`

Adds entry. `requireGM`. Returns `201` with the created entry.
`rangeMin`/`rangeMax` are assigned automatically (contiguous with the last
entry's `rangeMax`, spanning `weight`) — pass them explicitly on `PUT` to override.

| Field                  | Type                                     | Description                                                                                            |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `text`               | `string`                               | Result name/label. When`type` is `document` and left empty, filled from the linked document's name |
| `imgUrl`             | `string`                               | Icon path. When`type` is `document` and left empty, filled from the linked document's image        |
| `weight`             | `number`                               | Used only to auto-assign the initial range on create (default `1`)                                     |
| `collectionId`       | `string`                               | Optional collection id (default `''`)                                                                  |
| `drawn`              | `string`                               | `'NONE'` (default) or `'true'` once drawn (no-replacement tables)                                      |
| `type`               | `'text' \| 'document'`                  | `document` links the result to a world document instead of plain text                                |
| `documentCollection` | `'actors'\|'items'\|'stages'\|'journals'` | Collection the linked document belongs to (`type: 'document'` only)                                  |
| `documentId`         | `string`                               | Id of the linked document (`type: 'document'` only)                                                  |
| `description`        | `string`                               | Rich-text body shown in the result's own editor window                                                 |

**WS Event:** `roll-table-entry.created`

---

### PUT `/entries/:entryId`

Updates entry. `requireGM`. Returns `{ "success": true }`. Same fields as above (except `collectionId`), plus `rangeMin`/`rangeMax` (`number`) — editable
directly here, independent of `weight`, same as `POST /:id/normalize-results` below.
Unlike the table `description`, the entry `description` is stored as sent, not sanitized.

**WS Event:** `roll-table-entry.updated`

---

### DELETE `/entries/:entryId`

Removes entry. `requireGM`. Returns `{ "success": true }`.

**WS Event:** `roll-table-entry.deleted`

---

### POST `/:id/roll`

Rolls the table's `formula` for real (via the server dice engine) and matches the total
against each entry's `[rangeMin, rangeMax]` — this is not a blind weighted pick over
`weight` anymore. When `replacement` is `false`, entries already marked `drawn` are
excluded from the match and the picked entry is marked `drawn` afterwards (its
`weight`/range are left untouched, so `reset-results` can bring it back). Retries the
roll internally (up to 25 times) if it lands on a gap or an already-drawn range before
giving up with `400`. Also returns `400` if no entry has a configured range yet, or once
every entry has been drawn.

Any authenticated player can roll (no `requireGM`). Each roll also posts a chat message to the
world (`chat.message`, with the table name, the formula and the total when `displayRollFormula` is set).

**Response `200`:** `{ result, formula, total, label }` — `total` is the actual rolled number; `result` is the matched entry.
**Errors:** `404` `{ "error": "Roll table not found." }`; `400` when the table has no entries, has no configured range, or no drawable entry matches after 25 attempts.
**WS Event:** `roll-table.rolled` (`{ tableId, result, formula, total, label }`)

---

### POST `/:id/reset-results`

GM only. Clears the `drawn` mark on every entry, making them eligible for `/:id/roll`
again without recreating the table.

**Response `200`:** `{ success: true }`
**Response `404`:** `{ "error": "Roll table not found." }`

---

### POST `/:id/normalize-results`

GM only. Recomputes `rangeMin`/`rangeMax` for every entry, contiguous and in creation
order, from each entry's current `weight` —  "Normalize
Results". Use it to fix gaps/overlaps left by manual range edits.

**Response `200`:** `{ success: true }`
