# Assets (Files)

Upload and file management.

## Endpoints

**Base:** `/api/assets`
**Auth:** `requireAuth, requireWorldMatch`

---

### POST `/upload`

File upload. Multipart form-data with field `file`.

- Limit: **100MB**
- Validation: magic bytes (rejects a file whose content doesn't match its declared type — e.g. SVG, HTML, exe renamed to `.png`)
- Allowed types: `jpeg, jpg, png, webp, gif, mp3, ogg, wav, mp4, webm, mov`

**Query:**
- `?worldId=`: if present and valid, saves under `/worlds/<worldId>/assets/`; otherwise `/uploads/`
- `?dir=`: overrides destination — **admin session only** (Setup Hub), ignored for regular auth

**Response `200`:** `{ success: true, path, name, size }`
**Response `400`:** `{ "error": "No file provided." }` / `{ "error": "File content does not match its declared type." }` / Multer error message (e.g. size limit exceeded)

---

### GET `/list`

Lists files and subdirectories.

**Query:** `?dir=` (default `'uploads/'`) — path traversal is blocked. Non-admin sessions may
only list `uploads/` or their own `worlds/<worldId>/...`; admin sessions can browse freely.

**Response `200`:** `{ directories: string[], files: { name, path, type, size }[] }` — `type` is
`image`/`audio`/`video`/`unknown` based on extension
**Response `403`:** `{ "error": "Access denied." }`
**Response `500`:** `{ "error": "Failed to list assets." }`
