# Journals

Multi-page support. Each journal has a `pages` array.

## JournalPage

| Field | Type | Description |
|-------|------|-----------|
| `id` | `string` | UUID |
| `name` | `string` | Page name |
| `content` | `string` | HTML Content |
| `type` | `string` | `'text'`, `'image'`, `'pdf'` |
| `src` | `string` | URL (if image/pdf type) |
| `sort` | `number` | Order |

## Endpoints

**Base:** `/api/journals`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists journals. `?worldId=`. Non-GM users only see what they have access to.

**Response `200`:** `JournalsDocument[]`

---

### GET `/:id`

Fetches journal by ID.

**Response `200`:** Journal

---

### POST `/`

Creates journal with initial page.

**Request body:**

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `worldId` | `string` | `'world-1'` |
| `content` | `string` | `''` |
| `folderId` | `string` | `''` |
| `isPinned` | `boolean` | `false` |
| `pinX` | `number` | `0` |
| `pinY` | `number` | `0` |

**Response `201`:** Created journal
**WS Event:** `journal.created`

---

### PUT `/:id`

Updates journal.

**Response `200`:** Updated journal
**WS Event:** `journal.updated`

---

### POST `/:id/pages`

Adds page.

**Request body:** `{ "name" (required), "content", "type", "src" }`

**Response `201`:** Created page
**WS Event:** `journal.updated`

---

### PUT `/:id/pages/:pageId`

Updates page.

**Response `200`:** Updated page
**WS Event:** `journal.updated`

---

### DELETE `/:id/pages/:pageId`

Removes page.

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
