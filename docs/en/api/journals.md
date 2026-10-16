# Journals

Multi-page support. Each journal has a `pages` array.

## JournalPage

| Field | Type | Description |
|-------|------|-----------|
| `id` | `string` | UUID |
| `name` | `string` | Page name |
| `content` | `string` | HTML (sanitized) for `text`; Markdown source for `markdown` |
| `type` | `string` | `'text'`, `'markdown'`, `'image'`, `'pdf'`, `'video'`, `'audio'` or `'index'` (`server/applications/lib/journal-content.ts`) |
| `src` | `string` | Local file or HTTP(S) URL (used by image, pdf, video and audio) |
| `categoryId` | `string?` | Category of the page; absent for uncategorized pages |
| `index` | `object?` | Data of an `index` page (title, subtitle, description, cards pointing to pages) |
| `theme` | `string?` | Page-specific theme; overrides the journal default |
| `themeVars` | `object?` | Color variable values of the page-specific theme |
| `sort` | `number` | Order |

## Endpoints

**Base:** `/api/journals`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists journals. `?worldId=`. Non-GM users only see the journals they can view (`canView`).

**Response `200`:** `JournalsDocument[]`
**Response `500`:** `{ "error": "Failed to retrieve journal entries" }`

---

### GET `/:id`

Fetches journal by ID. Non-GM users without view access get `403`.

**Response `200`:** Journal
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`

---

### POST `/`

Creates journal. `content` is sanitized. If `pages` is omitted, one initial page is created from `name` and `content`.

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required, non-empty)** |
| `worldId` | `string` | `'world-1'` |
| `content` | `string` | `''` |
| `pages` | `JournalPage[]` | one initial page when omitted |
| `categories` | `JournalCategory[]` | `[]` |
| `flags` | `object` | `{}` |
| `folderId` | `string` | `''` |
| `isPinned` | `boolean` | `false` |
| `pinX` | `number` | `0` |
| `pinY` | `number` | `0` |

**Response `201`:** Created journal
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**WS Event:** `journal.created`

---

### PUT `/:id`

Updates journal. Only the fields below are copied. `ownership` and `flags` can only be changed by the GM.
`flags` is merged into the existing flags, not replaced.

**Request body:** `name`, `content`, `pages`, `categories`, `folderId`, `isPinned`, `pinX`, `pinY`, `ownership`, `flags`.

**Response `200`:** Updated journal
**Response `400`:** `{ "error": "No valid fields provided for update." }` when no field is given, or `{ "error": "Pages must be an array" }`
**Response `403`:** `{ "error": "Access denied" }`, `{ "error": "Only the Gamemaster can change ownership." }` or `{ "error": "Only the Gamemaster can change flags." }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**WS Event:** `journal.updated`

---

### POST `/:id/pages`

Adds page. `type` defaults to `'text'`; any value outside the list above gets `400`.

**Request body:** `{ "name" (required), "content", "type", "src", "categoryId" }`

**Response `201`:** Created page (the page object, not the journal)
**Response `400`:** `{ "error": "Unsupported page type" }` or `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**WS Event:** `journal.updated`

---

### POST `/:id/pages/:pageId/push`

GM only. Shows the page live on the chosen players' screens. Only that page is sent (inside the
`journal` object), so players without access to the journal can still see it.

**Request body:** `{ "targetUserIds"?: string[] }`. Omitted or `null` means everyone at the table.

**Response `200`:** `{ "ok": true }`
**Response `403`:** `{ "error": "Only the GM can push a page to players" }`
**Response `404`:** `{ "error": "Journal entry not found" }` / `{ "error": "Page not found" }`
**WS Event:** `display.push` (filtered by `targetUserIds`; players outside the list get only a bare notice)

---

### PUT `/:id/pages/:pageId`

Updates page. Body fields copied: `name`, `content`, `categoryId`, `index`, `theme`, `themeVars`, `src`.

**Response `200`:** Updated page (the page object, not the journal)
**Response `404`:** `{ "error": "Page not found" }`
**WS Event:** `journal.updated`

---

### DELETE `/:id/pages/:pageId`

Removes page. Remaining pages are renumbered in `sort`. An unknown `pageId` is not reported as an error.

**Response `200`:** `{ "success": true }`
**WS Event:** `journal.updated`

---

### POST `/:id/categories`

Adds a page category. Requires GM or edit ownership on the journal.

**Request body:** `{ "name": "..." }`

**Response `201`:** Created category (`{ id, name, sort }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**WS Event:** `journal.updated`

---

### PUT `/:id/categories/:categoryId`

Renames/reorders a category.

**Request body:** `{ "name"?: "...", "sort"?: number }`

**Response `200`:** Updated category
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }` / `{ "error": "Category not found" }`
**WS Event:** `journal.updated`

---

### DELETE `/:id/categories/:categoryId`

Removes a category. Pages in that category fall back to uncategorized (`categoryId` cleared).

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**WS Event:** `journal.updated`

---

### DELETE `/:id`

Removes journal.

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `journal.deleted`
