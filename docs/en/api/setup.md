# Setup

## Endpoints

**Base:** `/api/setup`

---

### GET `/status`

Server setup status. No auth. Responds with `Cache-Control: no-store`.

**Response `200`:** `{ isSetup, needsDataPathSelection, dataPathRestartRequired, dataPathRestartInProgress, hasWorlds, activeWorldId, defaultWorldId, loomSiteUrl }`

---

### POST `/data-path`

First-run data folder choice, made before the admin password exists. Rate limited (10/min).

**Request body:** `{ "dataPath": "..." }` (empty string = the default folder)

**Response `200`:** `{ "success": true, "restartRequired": boolean }`. When `restartRequired` is `true` the server restarts.
**Response `400`:** `{ "error": "..." }` when `dataPath` is not a valid string.
**Response `403`:** a custom folder can only be chosen from the server computer itself (loopback request).
**Response `409`:** setup is already complete.

---

### POST `/init`

Initializes admin (only if not configured). Rate limited (10/min).

**Request body:** `{ "password": "..." }` (min 8 chars)

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "Setup already completed" }` or `{ "error": "Password must be at least 8 characters" }`
**Response `409`:** the data folder has not been chosen yet (see `POST /data-path`).

---

### POST `/login`

Admin login. Rate limited (10/min).

**Request body:** `{ "password": "..." }`

**Response `200`:** `{ "admin": true }` and sets the httpOnly admin cookie. The JWT is not returned in the body; the session lives only in the cookie (valid 24h).
**Response `400`:** setup not completed, or no password sent.
**Response `401`:** `{ "error": "Incorrect password" }`

---

### POST `/logout`

Clears the admin session cookie. Returns `{ "success": true }`.

---

### GET `/verify`

Verifies admin session. No auth required; never changes cookies.

**Response `200`:** `{ valid, admin }`. When the session is not valid, `reason` is `admin_session_replaced` if a newer admin login replaced it; otherwise it is absent.

---

### GET `/config`

Returns server config (`loom.config.json`). `requireAdminSession`

**Response `200`:** `{ dataPath, port, language, dbClient, dbHost, dbPort, dbUser, dbPasswordConfigured, dbName, dbSsl, compressStatic, fullscreen, upnp, defaultWorldId }`. The database password is never returned; only `dbPasswordConfigured` says whether one is set.

---

### POST `/config`

Saves config. `requireAdminSession`

**Fields:** `dataPath`, `port`, `language`, `dbClient`, `dbHost`, `dbPort`, `dbUser`,
`dbPassword`, `dbName`, `dbSsl`, `compressStatic`, `fullscreen`, `upnp`, `defaultWorldId`
— only the fields sent are updated (partial merge). The `db*` fields only matter when
`dbClient` is not `sqlite3`. `dbPassword` never appears in the server logs.

**Response `200`:** `{ "success": true, "restartRequired": boolean, "message": "..." }`. `message` is `"Configuration saved."` when nothing needs a restart. When the data root or config path changes, `restartRequired` is `true` and the message is `"Data root saved; restart confirmation required."`. The change takes effect only after `POST /restart`.

---

### POST `/restart`

Restarts the server after the admin confirms a saved data-root change. `requireAdminSession`

**Response `200`:** `{ "success": true }`
**Response `409`:** `{ "error": "..." }` when no data-root change is waiting for a restart.
