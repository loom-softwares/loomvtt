# Systems (Rulesets)

## Endpoints

**Base:** `/api/systems`
**Auth:** None

---

### GET `/`

Lists registered systems.

**Response `200`:** `[{ id, title, version, backgroundUrl, author, repository }]`

---

### GET `/active`

Active system with default data.

**Response `200`:** `{ id, title, version, actorTypes, itemTypes, defaultData }`

---

### GET `/active/sheet`

Active system's sheet schema. `?type=character`

**Response `200`:** `{ tabs: [{ id, label, fields }] }`

---

### GET `/active/item-sheet`

Active system's item schema. `?type=equipment`

---

## Server self-update (`/api/system`)

> Different base from the routes above — similar name, separate router
> (`server/applications/api/system.ts`), mounted at `/api/system` (singular), not
> `/api/systems`.

**Auth:** `requireAdminSession` on both routes.

### GET `/api/system/update-check`

Compares local version (`package.json`) against the latest release on GitHub.

**Query:** `?channel=stable|preview` (default `stable`)

**Response `200`:** `{ currentVersion, latestVersion, hasUpdate, changelog, publishedAt, channel, error? }`
— on network/GitHub error, still responds `200` with `hasUpdate: false` and `error` populated
(never leaves the screen stuck on a "?").

---

### POST `/api/system/update`

Runs `git pull && npm install && npm run build` in the application directory.

**Response `200`:** `{ "success": boolean, "log": "..." }` (combined stdout/stderr,
even on failure)
