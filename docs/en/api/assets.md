# Assets (Files)

Upload and file management.

## Endpoints

**Base:** `/api/assets`
**Auth:** `requireAuth, requireWorldMatch`

**Reading files:** `/uploads`, `/thumb` and `/worlds/<worldId>/assets` are served only to a signed-in session of that world (player, GM, display, stream or admin). The login screen's pictures (world cover, background, user avatars) stay public. Set `LOOM_OPEN_ASSETS=1` to turn the gate off.

---

### POST `/upload`

File upload. Multipart form-data with field `file`.

- Limit: **100MB**
- Validation: magic bytes (rejects a file whose content doesn't match its declared type — e.g. SVG, HTML, exe renamed to `.png`)
- Allowed types: `png, jpg, jpeg, webp, gif, mp3, ogg, wav, mp4, webm, mov, pdf` — decided by the extension before anything is written; scripts, executables and markup are refused

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

---

### POST `/mkdir`

Creates a new subdirectory within the permitted assets location.

**Request body (JSON):**
- `name`: New folder name (required, invalid filename characters are sanitized)
- `dir`: Parent folder path where the new folder will be created (e.g. `uploads` or `worlds/<worldId>/assets/subfolder`)
- `worldId`: (optional) World ID for scope validation when not present in token

**Response `200`:** `{ success: true, name: "New Folder", path: "/uploads/New Folder" }`
**Response `400`:** `{ "error": "Folder name is required." }` / `{ "error": "This folder already exists." }`
**Response `403`:** `{ "error": "Access denied." }`
