# Systems (Rulesets)

## Endpoints

**Base:** `/api/systems`
**Auth:** None

---

### GET `/`

Lists the installed rulesets (from the addon manifests on disk, loaded and of type `ruleset`).

**Response `200`:** `[{ id, title, version, backgroundUrl, author, repository, description }]`
**Response `500`:** `{ "error": "Failed to retrieve systems." }`

---

### GET `/active`

Active system with default data. Reads the active world (`isActive`) and makes its system the active one.

**Response `200`:** `{ id, title, version, actorTypes, itemTypes, defaultData: { character, npc } }`
**Response `404`:** `{ "error": "No active system registered." }`

---

### GET `/active/sheet`

Active system's sheet schema. `?type=character` (default `character`)

**Response `200`:** `{ tabs: [{ id, label, icon?, fields }] }`, or `null` when the system has no sheet for that type.

---

### GET `/active/item-sheet`

Active system's item sheet schema. `?type=equipment` (default `equipment`). Same response as `GET /active/sheet`, with `null` when the system defines none.

---

## Server self-update (`/api/system`)

> Different base from the routes above — similar name, separate router
> (`server/applications/api/system.ts`), mounted at `/api/system` (singular), not
> `/api/systems`.

**Auth:** `requireAdminSession` on both routes.

### GET `/api/system/update-check`

Compares local version (`package.json`) against the latest release on GitHub.

**Query:** `?channel=stable|preview` (default `stable`)

**Response `200`:** `{ currentVersion, latestVersion, hasUpdate, changelog, publishedAt, channel }`.
When GitHub answers with an error status (for example 404 when no release exists), it still responds `200` with `hasUpdate: false`, `error` (a message in Portuguese) and `noRelease` (`true` on 404).
When the request itself throws (for example no network), it responds `500` with `{ "error": "..." }` (see the code issue in the report).

---

### GET `/api/system/update-status`

Progress of a Node-edition update running in the background. Polled by the updates screen. `requireAdminSession`. Responds `no-store`.

---

### POST `/api/system/update`

`requireAdminSession`. Body: `{ "channel": "stable" | "preview", "force"?: boolean }`. What it does depends on how the app is installed:

- **Electron build** (`LOOM_ELECTRON_UPDATER=1`): hands the update to the Electron updater and returns its result.
- **Node edition** (`isNodeEdition(root)` is true): downloads the latest release and starts a background update. Returns `{ "success": true, "started": true, "log": "Atualização iniciada." }`. `{ "success": false, "log": "Uma atualização já está em andamento." }` when one is already running.
- **Other installs without `.git`**: does nothing and returns `{ "success": false, "log": "..." }` pointing to the releases page.
- **Source checkout** (has `.git`): checks that `git` is available, then runs `git pull && npm install && npm run build` in the application directory.

**Response `200`:** `{ "success": boolean, "log": "..." }` (combined stdout/stderr, even on failure). Failures from the GitHub lookup also come back as `200` with `success: false`.
