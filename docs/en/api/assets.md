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
- Who: any signed-in session of the world (players included)
- Validation: magic bytes (rejects a file whose content doesn't match its declared type — e.g. SVG, HTML, exe renamed to `.png`)
- Allowed types: `png, jpg, jpeg, webp, gif, mp3, ogg, wav, mp4, webm, mov, pdf` — decided by the extension before anything is written; scripts, executables and markup are refused

**Query:**
- `?worldId=`: used only when the session has no world of its own. A valid id saves under `/worlds/<worldId>/assets/`; otherwise the file goes to `/uploads/`
- `?dir=`: overrides destination. The admin session (Setup Hub) can write anywhere in the data folder; other sessions only inside `uploads/` or their own `worlds/<worldId>/...`. A `dir` they are not allowed to use is ignored and the default folder is used
- `?overwrite=1`: a file with the same name replaces the existing one. Without it, the new file gets a number suffix (`name (1).png`)

**Response `200`:** `{ success: true, path, name, size }` — `path` is the web path (e.g. `/worlds/<id>/assets/file.png`), `name` is the original file name
**Response `400`:** `{ "error": "No file provided." }` / `{ "error": "File content does not match its declared type." }` / `{ "error": "SVG, HTML, and executable files are not allowed." }` / `{ "error": "Only images, audio, video and PDF assets are allowed." }` / Multer error message (e.g. size limit exceeded)

---

### GET `/list`

Lists files and subdirectories.

**Query:** `?dir=` (default `'uploads/'`) — path traversal is blocked. Non-admin sessions may
only list `uploads/` or their own `worlds/<worldId>/...`; admin sessions can browse freely.

**Response `200`:** `{ directories: string[], files: { name, path, type, size }[] }` — `type` is
`image`/`audio`/`video`/`pdf`/`unknown` based on extension. Directory names end with `/`. A folder that does not exist returns `{ directories: [], files: [] }`. A world session does not see the files at the root of a world folder (`worlds/<id>/`), only its subfolders
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
**Response `400`:** `{ "error": "Nome de pasta obrigatório." }` (no name) / `{ "error": "Nome de pasta inválido." }` (the name is empty after sanitizing) / `{ "error": "Esta pasta já existe." }`
**Response `403`:** `{ "error": "Access denied." }` — also when the parent folder is outside the permitted locations for the session
**Response `500`:** `{ "error": "Failed to create folder." }`
