# Settings (Server-wide)

Global key-value settings store, unrelated to per-world `module-settings`. Used by the Setup
Hub.

## Endpoints

**Base:** `/api/settings`
**Auth:** `requireAdminSession` on every route (Setup Hub session, not a regular player/GM login)

---

### GET `/`

Lists every setting as a flat `{ key: value }` map. The `admin_password` key is filtered out
of this list only. The admin password itself is stored in `loom.config.json` by the Setup
routes, not in this table.

**Response `200`:** `{ [key]: value }`

---

### GET `/:key`

Fetches a single setting. This route does not apply the `admin_password` filter that `GET /`
uses.

**Response `200`:** `{ key, value }`
**Response `404`:** `{ "error": "Setting not found" }`

---

### POST `/`

Creates or updates (upsert) a setting.

**Request body:** `{ "key": "...", "value": any }`

**Response `200`:** `{ key, value }`
**Response `400`:** `{ "error": "key is required" }`
