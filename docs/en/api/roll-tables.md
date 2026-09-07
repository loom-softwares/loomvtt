# Roll Tables

## Endpoints

**Base:** `/api/roll-tables`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists tables. `?worldId=`

---

### POST `/`

Creates table.

| Field                  | Type        | Description                                        |
| ---------------------- | ----------- | -------------------------------------------------- |
| `id`                 | `string`  | Optional                                           |
| `worldId`            | `string`  | World                                              |
| `name`               | `string`  | Name                                               |
| `description`        | `string`  | Description                                        |
| `formula`            | `string`  | Roll formula                                       |
| `sortMode`           | `string`  | Sorting mode                                       |
| `imgUrl`             | `string`  | Image URL                                          |
| `replacement`        | `boolean` | With replacement?                                  |
| `displayRollFormula` | `boolean` | Show the roll formula alongside the result in chat |

**WS Event:** `roll_tables.created` (auto-broadcast by the document layer)

---

### GET `/:id`

Fetches table with `entries[]`.

---

### PUT `/:id`

Updates table.

**WS Event:** `roll_tables.updated` (auto-broadcast)

---

### DELETE `/:id`

Removes table + entries (cascade).

**WS Event:** `roll_tables.deleted` (auto-broadcast)

---

### POST `/:id/entries`

Adds entry. `rangeMin`/`rangeMax` are assigned automatically (contiguous with the last
entry's `rangeMax`, spanning `weight`) — pass them explicitly on `PUT` to override.

| Field                  | Type                                     | Description                                                                                            |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `text`               | `string`                               | Result name/label. When`type` is `document` and left empty, filled from the linked document's name |
| `imgUrl`             | `string`                               | Icon path. When`type` is `document` and left empty, filled from the linked document's image        |
| `weight`             | `number`                               | Used only to auto-assign the initial range on create                                                   |
| `drawn`              | `boolean`                              | Whether this result has already been drawn (no-replacement tables)                                     |
| `type`               | `'text' \| 'document'`                  | `document` links the result to a world document instead of plain text                                |
| `documentCollection` | `'actors'\|'items'\|'stages'\|'journals'` | Collection the linked document belongs to (`type: 'document'` only)                                  |
| `documentId`         | `string`                               | Id of the linked document (`type: 'document'` only)                                                  |
| `description`        | `string`                               | Rich-text body shown in the result's own editor window                                                 |

**WS Event:** `roll_table_entries.created` (auto-broadcast)

---

### PUT `/entries/:entryId`

Updates entry. Same fields as above, plus `rangeMin`/`rangeMax` (`number`) — editable
directly here, independent of `weight`, same as `POST /:id/normalize-results` below.

**WS Event:** `roll_table_entries.updated` (auto-broadcast)

---

### DELETE `/entries/:entryId`

Removes entry.

**WS Event:** `roll_table_entries.deleted` (auto-broadcast)

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

**Response `200`:** `{ result, formula, total, label }` — `total` is the actual rolled number.
**WS Event:** `roll-table.rolled`

---

### POST `/:id/reset-results`

GM only. Clears the `drawn` mark on every entry, making them eligible for `/:id/roll`
again without recreating the table.

**Response `200`:** `{ success: true }`

---

### POST `/:id/normalize-results`

GM only. Recomputes `rangeMin`/`rangeMax` for every entry, contiguous and in creation
order, from each entry's current `weight` —  "Normalize
Results". Use it to fix gaps/overlaps left by manual range edits.

**Response `200`:** `{ success: true }`
