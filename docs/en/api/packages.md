# Packages

## Endpoints

**Base:** `/api` (loose routes, no own prefix)
**Real router:** `server/applications/routes/package-routes.ts`, mounted in `server/index.ts`
**Auth:** reading requires `requireAuth`; writing (POST/PUT/DELETE/PATCH) requires
`requireAdminSession`.

> **Shadowed routes:** `server/index.ts` mounts the `worlds` router (`/api/worlds`) before this one.
> The client's world calls go to the `worlds` router, which documents them in [`worlds.md`](./worlds.md):
> `GET /api/worlds/:worldId/packages`, `POST /api/worlds/:worldId/packages` and `POST /api/worlds/:worldId/packages/gm`.
> Because of that order, `GET /worlds/:worldId/packages` below is never reached (see the note in its section). The `PUT /worlds/:worldId/packages/order` route is not shadowed: it is registered before `/:packageId`, so it is reachable.

---

### GET `/packages`

Lists all installed packages. `?type=<type>` returns packages of that type; `?compatible=true` returns only compatible packages; with neither, all packages.

**Response `200`:** `{ "success": true, "data": Package[] }`
**Response `500`:** `{ "success": false, "error": "Failed to get packages" }`

---

### GET `/packages/:id`

Fetches package by ID.

**Response `200`:** `{ "success": true, "data": Package }`
**Response `404`:** `{ "success": false, "error": "Package not found" }`

---

### POST `/packages`

Installs a package. Body is the package object (manifest). `name`, `type` and `version` are required.

**Response `201`:** `{ "success": true, "data": { "id", ...packageData } }`
**Response `400`:** `{ "success": false, "error": "Missing required fields: name, type, version" }`

---

### PUT `/packages/:id`

Updates a package. Body contains the fields to update.

**Response `200`:** `{ "success": true, "message": "Package updated successfully" }` (the package itself is not returned)

---

### DELETE `/packages/:id`

Removes a package.

**Response `200`:** `{ "success": true, "message": "Package deleted successfully" }`

---

### PATCH `/packages/:id/toggle`

Enables/disables a package.

**Request body:** `{ "enabled": boolean }`
**Response `200`:** `{ "success": true, "message": "..." }`
**Response `400`:** `enabled` is not boolean

---

### GET `/packages/:id/dependencies`

Lists package dependencies.

**Response `200`:** `{ "success": true, "data": Dependency[] }`

---

### GET `/packages/:id/validate`

Validates if package dependencies are met.

**Response `200`:** `{ "success": true, "data": ValidationResult }`

---

### GET `/worlds/:worldId/packages`

**Not reached from this router.** The `worlds` router handles `GET /api/worlds/:worldId/packages` first and returns the world's addon catalog with `enabled` state (see [`worlds.md`](./worlds.md)). The handler below is kept for reference only.

**Response `200`:** `{ "success": true, "data": WorldPackage[] }` (this shape is not what the client receives)

---

### POST `/worlds/:worldId/packages/:packageId`

Adds a package to a world. For `packageId` = `gm` this path is handled by the `worlds` router (`POST /api/worlds/:worldId/packages/gm`), not here. For any other id, this handler runs.

**Request body:** `{ "config"?: object }` (default `{}`)
**Response `201`:** `{ "success": true, "data": { "id", "worldId", "packageId", "config" } }`

---

### PUT `/worlds/:worldId/packages/:packageId`

Updates the config of a package installed in the world.

**Request body:** fields to update
**Response `200`:** `{ "success": true, "message": "World package updated successfully" }`

---

### DELETE `/worlds/:worldId/packages/:packageId`

Removes a package from the world.

**Response `200`:** `{ "success": true, "message": "World package removed successfully" }`

---

### PUT `/worlds/:worldId/packages/order`

Sets the load order of the world's packages. **Auth:** `requireAdminSession, requireWorldMatch`. The route is registered before `PUT /worlds/:worldId/packages/:packageId`, so `order` is not taken as a package id.

**Request body:** `{ "packageOrders": Array }`
**Response `200`:** `{ "success": true, "message": "World package order updated successfully" }`
**Response `400`:** `{ "success": false, "error": "packageOrders must be an array" }` when `packageOrders` is not an array
**Response `500`:** `{ "success": false, "error": "Failed to set world package order" }` on an unexpected failure

---

> The `/worlds/:worldId/*` routes in this router use `requireAuth` (reads) or `requireAdminSession` (writes), plus `requireWorldMatch`: a world token only reaches its own world, and admin sessions pass the check.

### GET `/worlds/:worldId/packages/manifest`

Returns the combined manifest of all packages in the world.

**Auth:** `requireAuth, requireWorldMatch`
**Response `200`:** `{ "success": true, "data": Manifest }`
