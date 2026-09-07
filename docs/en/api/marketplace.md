# Marketplace

## Endpoints

**Base:** `/api/marketplace`

---

### GET `/packages`

Lists available packages (addons + rulesets).

**Response `200`:** `{ "packages": [...] }`

---

### POST `/:type/:name/activate`

Activates package. `requireAdminSession`

---

### POST `/:type/:name/deactivate`

Deactivates package. `requireAdminSession`

---

### POST `/install`

Installs package from URL. `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type": "addon|ruleset" }`

**WS Event:** `addon.installed`

---

### DELETE `/:type/:name`

Uninstalls package. `requireAdminSession`

**WS Event:** `addon.uninstalled`

---

### GET `/:type/:name/update-check`

Checks for update. `requireAdminSession`

---

### POST `/fetch-manifest`

Fetches remote manifest. `requireAdminSession`

**Request body:** `{ "manifestUrl": "..." }`

---

### GET `/catalog`

Searches the community catalog on Loom Hub (remote index via Supabase — does not host
download, only search). No auth.

**Query:** `?type=`, `?category=`, `?q=` (search by title/description)

**Response `200`:** `{ "packages": [...] }`
**Response `502`:** `{ "error": "Could not load the Loom Hub catalog." }`

---

### GET `/updates`

Checks for updates of all installed packages (addons + rulesets) at once —
used by the Setup Hub notification bell. **Auth:** `requireAdminSession`

**Response `200`:** `{ "updates": [{ type, name, title, hasUpdate: true, ... }] }` — already
filtered, only brings the ones that have an update available
