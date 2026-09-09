# Addon Settings

## Endpoints

**Base:** `/api/module-settings`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:worldId/:moduleId`

Lists all settings for an addon in a world, as a key-value object.

**Response `200`:** `{ "data": { "key1": value1, ... }, "error": null }`

---

### PUT `/:worldId/:moduleId/:key`

Creates or updates (upsert) a specific setting.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `value` | `any` | **yes** | - |
| `scope` | `string` | no | `'world'` (`'world'` or `'client'`) |

**Response `200`:** setting updated (if it existed) - `{ "data": {...}, "error": null }`
**Response `201`:** setting created (if it didn't exist)
**Response `400`:** `value` missing, or `scope` outside `'world'`/`'client'`

---

### DELETE `/:worldId/:moduleId/:key`

Removes a specific setting.

**Response `200`:** `{ "data": { "deleted": true }, "error": null }`
**Response `404`:** `{ "data": null, "error": "Setting not found" }`
