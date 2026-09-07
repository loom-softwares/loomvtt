# Packages

## Endpoints

**Base:** `/api` (loose routes, no own prefix)
**Real router:** `server/applications/routes/package-routes.ts`, mounted in `server/index.ts`
**Auth:** reading requires `requireAuth`; writing (POST/PUT/DELETE/PATCH) requires
`requireAdminSession` — no write route of this router has a consumer in the client today.

---

### GET `/packages`

Lists all installed packages.

**Query:** `?type=`, `?compatible=`
**Response `200`:** `{ "success": true, "data": Package[] }`

---

### GET `/packages/:id`

Fetches package by ID.

**Response `200`:** `{ "success": true, "data": Package }`
**Response `404`:** `{ "success": false, "error": "..." }`

---

### POST `/packages`

Installs a package. Body is the entire package object (manifest).

**Response `201`:** `{ "success": true, "data": Package }`

---

### PUT `/packages/:id`

Updates a package. Body contains the fields to update.

**Response `200`:** `{ "success": true, "data": Package }`

---

### DELETE `/packages/:id`

Removes a package.

**Response `200`:** `{ "success": true }`

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

Lists packages installed in a world.

**Response `200`:** `{ "success": true, "data": WorldPackage[] }`

---

### POST `/worlds/:worldId/packages/:packageId`

Adds a package to a world.

**Request body:** `{ "config"?: object }` (default `{}`)
**Response `201`:** `{ "success": true, "data": { "id", "worldId", "packageId", "config" } }`

---

### PUT `/worlds/:worldId/packages/:packageId`

Updates the config of a package installed in the world.

**Request body:** fields to update
**Response `200`:** `{ "success": true, "message": "..." }`

---

### DELETE `/worlds/:worldId/packages/:packageId`

Removes a package from the world.

**Response `200`:** `{ "success": true, "message": "..." }`

---

### PUT `/worlds/:worldId/packages/order`

Sets the load order of the world's packages.

**Request body:** `{ "packageOrders": Array }`
**Response `200`:** `{ "success": true, "message": "..." }`
**Response `400`:** `packageOrders` is not an array

---

### GET `/worlds/:worldId/packages/manifest`

Returns the combined manifest of all packages in the world.

**Response `200`:** `{ "success": true, "data": Manifest }`
