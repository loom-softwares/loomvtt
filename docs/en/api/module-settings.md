# Addon Settings

## Endpoints

**Base:** `/api/module-settings`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on PUT and DELETE)

---

### GET `/:worldId/:moduleId`

Lists all settings for an addon in a world, as a key-value object. Values of `secret`-scope
settings are not returned: each one appears as `{ "configured": true }`.

**Response `200`:** `{ "data": { "key1": value1, "key2": { "configured": true }, ... }, "error": null }`
**Response `500`:** `{ "data": null, "error": "..." }`

---

### PUT `/:worldId/:moduleId/:key`

Creates or updates (upsert) a specific setting. `requireGM`.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `value` | `any` | **yes** | - |
| `scope` | `string` | no | `'world'` (`'world'`, `'secret'` or `'client'`) |

`value` can be any JSON value: it is stored in a JSON column, so a string comes back as a string, a number as a number,
and so on. The whole request body is limited to 1 MB by the global JSON parser. A larger body gets `413` before the route runs.

**Response `200`:** setting updated (if it existed) - `{ "data": {...}, "error": null }`
**Response `201`:** setting created (if it didn't exist) - `{ "data": {...}, "error": null }`
**Response `400`:** `{ "data": null, "error": "Value is required" }` when `value` is missing, or `{ "data": null, "error": "Scope must be \"world\", \"secret\", or \"client\"" }` for any other `scope`
**Response `500`:** `{ "data": null, "error": "..." }` on a database error

---

### DELETE `/:worldId/:moduleId/:key`

Removes a specific setting. `requireGM`.

**Response `200`:** `{ "data": { "deleted": true }, "error": null }`
**Response `404`:** `{ "data": null, "error": "Setting not found" }`
**Response `500`:** `{ "data": null, "error": "..." }` on a database error
