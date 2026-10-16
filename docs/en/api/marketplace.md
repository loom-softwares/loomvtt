# Marketplace

## Endpoints

**Base:** `/api/marketplace`

---

### GET `/packages`

Lists available packages (addons + rulesets). No auth guard on this route.

**Query:** `?worldId=`. With `worldId`, an addon is `active` only if that world has an explicit enabled row in `world_packages`; without it, `active` comes from the manifest.

**Response `200`:** `{ "packages": [{ "type", "name", ...manifest, "active" }] }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/:type/:name/activate`

Activates package (writes `active: true` to its manifest). `type` `ruleset` selects a ruleset; any other value means addon. `requireAdminSession`

**Response `200`:** `{ "success": true, "type", "name", "active": true }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/:type/:name/deactivate`

Deactivates package (writes `active: false` to its manifest). Same `type` rule as activate. `requireAdminSession`

**Response `200`:** `{ "success": true, "type", "name", "active": false }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/install`

Installs package from URL. `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type": "addon|ruleset", "operationId"?, "expectedSha256"?, "entitlementVisa"? }`. `type` other than `ruleset` means addon. `operationId` defaults to `manifestUrl`.

**Response `200`:** the result of `installFromUrl` (`success` flag and details)
**Response `400`:** `{ "error": "manifestUrl is required" }`
**Response `500`:** `{ "error": "..." }`
**WS Event:** `addon.installed` with `{ type, name, version }` (only when the install succeeded). The install also emits `operation.progress` with `{ operationId, percent, phase, label }` during the install; see the note below.

---

### POST `/:type/:name/update`

Reinstalls the package from its latest release. `requireAdminSession`

**Request body (optional):** `{ "operationId"? }`

**Response `200`:** the result of `updatePackage` (`success`, `alreadyUpToDate`, ...)
**Response `500`:** `{ "error": "..." }`
**WS Event:** `addon.installed` with `{ type, name, version }` when the update succeeded and was not already up to date

---

### DELETE `/:type/:name`

Uninstalls package (addon or ruleset). `type` `ruleset` selects a ruleset; any other value means addon. `requireAdminSession`

**Response `200`:** the result of `uninstallPackage`
**Response `500`:** `{ "error": "..." }`
**WS Event:** `addon.uninstalled` (payload `{ type, name }`, only when the uninstall succeeded)

> **Note:** `operation.progress` is emitted with `Signal.broadcast` by the install and update routes. This page does not confirm the wire name clients receive for it: UNVERIFIED (no `Signal.listen` relay was found in `server/index.ts`).

---

### GET `/:type/:name/packs`

Lists the compendium packs declared in the package manifest (`compendiums`). Used by the
Compendiums tab of `ModuleManifestWindow`. `requireAdminSession`

**Response `200`:** one entry per declared compendium. A local pack whose path is invalid or has no `pack_meta` row has `name`/`packType`/`entryCount` set to `null` and an `error` field (`"invalid path"` or `"pack_meta not found"`).
```json
[
  { "file": "packs/items.sqlite", "type": "local", "name": "Items", "packType": "Item", "entryCount": 42 },
  { "file": null, "type": "remote", "apiUrl": "https://...", "name": null, "packType": null, "entryCount": null }
]
```
**Response `500`:** `{ "error": "..." }`

---

### PUT `/:type/:name/packs/rename`

Renames a local compendium pack (`.sqlite`) by modifying its metadata in the `pack_meta` table. `requireAdminSession`

**Request body:** `{ "file": "packs/items.sqlite", "name": "New Name" }`

`file` must be a literal entry of the manifest's `compendiums` list; any other path is rejected.

**Response `200`:** `{ "success": true, "file": "packs/items.sqlite", "name": "New Name" }`
**Response `400`:** `{ "error": "file is required." }`, `{ "error": "name is required." }` or `{ "error": "Invalid pack path." }`
**Response `404`:** `{ "error": "Pack not declared in this manifest." }` or `{ "error": "Pack file has no pack_meta row." }`
**Response `500`:** `{ "error": "..." }`

---

### GET `/:type/:name/update-check`

Checks for update. `requireAdminSession`

**Response `200`:** the result of `checkForUpdate`
**Response `500`:** `{ "error": "..." }`

---

### POST `/fetch-manifest`

Fetches remote manifest, the preview before installing. The manifest must pass the same Loom gate as the installer (`validateLoomManifest`). `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type"?: "addon|ruleset" }`

**Response `200`:** `{ "manifest": {...}, "warning": ... }`
**Response `400`:** `{ "error": "manifestUrl is required" }`, or the gate error when the manifest is not a Loom package
**Response `500`:** `{ "error": "..." }`

---

### GET `/catalog`

Searches the community catalog on Loom Hub (remote index via Supabase — does not host
download, only search). No auth.

**Query:** `?type=`, `?category=`, `?q=` (search by title/description)

Each row's `banner_url` is rewritten to the server proxy `/api/marketplace/catalog/banner/:id` (or `null`), so the browser never fetches remote images directly.

**Response `200`:** `{ "packages": [...] }`
**Response `502`:** `{ "error": "Não foi possível carregar o catálogo do Loom Hub." }` (the message is in Portuguese in the code)

---

### GET `/catalog/banner/:id`

Proxies the banner image of a catalog package. Only ids returned by the last successful `/catalog` call are served. No auth.

**Response `200`:** image bytes (`Cache-Control: public, max-age=1800`)
**Response `404`:** empty body when the id is unknown, the source is not an image, or it is over 5 MB

---

### GET `/site-feed`

Lists up to 12 published articles of the Loom site for the Setup Hub cards (read-only index on Supabase, cached for 30 minutes). No auth. Falls back to the last cache, or to an empty list, when the upstream fails.

**Response `200`:** `{ "siteUrl": "...", "articles": [{ slug, title, summary, category, createdAt, coverUrl, link }] }`

---

### GET `/site-feed/cover/:slug`

Proxies the cover image of an article. Only slugs from the last feed fetch are served. No auth.

**Response `200`:** image bytes (`Cache-Control: public, max-age=1800`)
**Response `404`:** empty body

---

### GET `/updates`

Checks for updates of all installed packages (addons + rulesets) at once —
used by the Setup Hub notification bell. **Auth:** `requireAdminSession`

**Response `200`:** `{ "updates": [{ type, name, title, hasUpdate: true, ... }] }` — already
filtered, only brings the ones that have an update available

---

### PUT `/:type/:name/manifest`

Edits installed package metadata directly on the `addon.json`/`ruleset.json` on disk
(used by the Setup Hub "Edit Addon" and "Configure System" via `ModuleManifestWindow`). **Auth:** `requireAdminSession`

**Request body (all optional):** `{ title?, version?, author?, repository?, description?, dependencies?: string[], conflicts?: string[], systems?: string[] }`

Only those eight fields are read. Other keys (`core`, `client`, `name`, `settings`, `compendiums`, `requiresApiKey`, ...) are ignored. `dependencies`, `conflicts` and `systems` must be arrays (non-string items are dropped), otherwise `400`.

**Response `400`:** `{ "error": "dependencies must be an array." }` (the same for `conflicts` and `systems`)
**Response `500`:** `{ "error": "..." }`

**UI Behavior (`ModuleManifestWindow`):**
- The **Compendiums** tab is only rendered if the manifest declares `compendiums` with at least 1 item.
- The **License** tab/field is only rendered if the manifest declares `"requiresApiKey": true` (commercial packages). For community/free packages, the interface remains clean without license fields.

**Response `200`:** `{ success, type, name, manifest }`

---

### GET `/:name/license`

Reads the redeemed license for a paid remote addon — **per server installation, not per
world** (see [Remote compendium sources](../guide/system-creation.md#remote-compendium-sources-security-model)).
**Auth:** `requireAdminSession`

**Response `200`:** `{ code, used }` — `code` comes back empty if no license was redeemed yet

---

### POST `/codes/generate`

Generates activation codes for a **local** package sold directly by Loom (Phase 1 of the
paid marketplace — sale is still manual, outside the app). **Auth:** `requireAdminSession`

**Request body:** `{ "packageName": "...", "quantity"?: number (1-100, default 1) }`

**Response `200`:** `{ "codes": ["LOOM-XXXX-XXXX-XXXX", ...] }` (the plaintext codes are returned only here; the database keeps an HMAC)
**Response `400`:** `{ "error": "packageName is required" }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/redeem`

Redeems a code/license. Behavior branches on whether `packageName` is present in the
body: **Auth:** `requireAdminSession`

- **With `packageName`** (remote addon, `requiresApiKey: true`): license is **per
  installation**, not per world — no `worldId` required. The key was never generated by
  us (it comes from the third-party seller), so there's nothing to validate here — it
  just stores whatever was pasted (`worldId: ''`, server-wide). If the key is invalid,
  the error surfaces on the first real remote request, not at this endpoint.
  **Request body:** `{ "code": "...", "packageName": "..." }`
  **Response `200`:** `{ success: true, packageName, remote: true }`
  **Response `404`:** addon not installed on this server
  **Response `400`:** addon doesn't declare `requiresApiKey`

- **Without `packageName`** (**local** addon sold by us, original per-world behavior):
  code must have been generated via `/codes/generate`, single use.
  **Request body:** `{ "code": "...", "worldId": "..." }`
  **Response `200`:** `{ success: true, packageName, worldId }`
  **Response `404`:** code not found / package not installed
  **Response `409`:** code already used
  **Response `400`:** `{ "error": "code is required" }` or `{ "error": "worldId is required" }`
  **Response `500`:** `{ "error": "..." }`

### GET `/entitlements`

Lists the package entitlements stored on this server (licenses synced from the Loom account). `requireAdminSession`

**Response `200`:** `{ "entitlements": [{ id, productId, packageName, packageType, tier, validUntil, status, isActive, expiresInDays, createdAt }] }`. `status` is `active` or `expired`, from the signed visa.
**Response `500`:** `{ "error": "..." }`

---

### POST `/entitlements/sync`

Pulls the entitlements of the Loom account now. `requireAdminSession`

**Response `200`:** the result of `syncAccountEntitlements`
**Response `500`:** `{ "error": "..." }`

---

### Admin session errors

Every route marked `requireAdminSession` (`server/applications/api/setup.ts`) answers `401` with `{ "error": "Admin session required" }` when there is no admin cookie, `401` with `{ "error": "Invalid or expired token" }` for a bad token, and `403` with `{ "error": "Admin access required" }` for a non-admin token.
