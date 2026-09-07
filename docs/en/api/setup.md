# Setup

## Endpoints

**Base:** `/api/setup`

---

### GET `/status`

Server setup status.

**Response `200`:** `{ isSetup, hasWorlds, activeWorldId, defaultWorldId }`

---

### POST `/init`

Initializes admin (only if not configured).

**Request body:** `{ "password": "..." }` (min 8 chars)

---

### POST `/login`

Admin login. Rate limited (10/min).

**Request body:** `{ "password": "..." }`

**Response `200`:** `{ token, admin }` + httpOnly cookie

---

### POST `/logout`

Clears admin session.

---

### GET `/verify`

Verifies admin session.

**Response `200`:** `{ valid, admin }`

---

### GET `/config`

Returns server config (`loom.config.json`). `requireAdminSession`

---

### POST `/config`

Saves config. `requireAdminSession`

**Fields:** `dataPath`, `port`, `language`, `dbClient`, `dbHost`, `dbPort`, `dbUser`,
`dbPassword`, `dbName`, `dbSsl`, `compressStatic`, `fullscreen`, `upnp`, `defaultWorldId`
— only the fields sent are updated (partial merge). The `db*` fields only matter when
`dbClient` is not `sqlite3`. `dbPassword` never appears in the server logs.

**Response `200`:** `{ "success": true, "message": "Configuration saved. Please restart the application for changes to take effect." }`
