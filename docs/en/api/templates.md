# Templates (Measured Templates)

## Endpoints

**Base:** `/api/stages/:stageId/templates`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:stageId/templates`

Lists measured templates of a stage.

**Response `200`:** `TemplatesDocument[]`

---

### POST `/:stageId/templates`

Creates a measured template.

**Request body:**

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `type` | `string` | no | `'cone'` |
| `x` | `number` | no | `0` |
| `y` | `number` | no | `0` |
| `rotation` | `number` | no | `0` |
| `radius` | `number` | no | `100` |
| `width` | `number` | no | `100` |
| `height` | `number` | no | `100` |
| `angle` | `number` | no | `90` |
| `distance` | `number` | no | `100` |
| `fillColor` | `string` | no | `'#6366f1'` |
| `strokeColor` | `string` | no | `'#6366f1'` |
| `opacity` | `number` | no | `0.3` |
| `locked` | `boolean` | no | `false` |
| `hidden` | `boolean` | no | `false` |
| `flags` | `string` | no | `'{}'` |

**Type:** the server stores `type` as sent and does not validate it. The renderer draws `cone`, `rect`, `circle` and `ray`; the client only saves `cone` and `rect` templates (`canvas-manager.ts`, the `onTemplateCreate` call). Note that the value is `rect`, not `rectangle`.

**Response `201`:** Template created
**Response `400`:** `{ "error": "..." }` (validation error from the document layer)
**Response `500`:** `{ "error": "Failed to create template" }`
**WS Event:** `template.created` (sent to all connected sockets)

---

### PUT `/:stageId/templates/:id`

Updates a template. Partial update: only the fields sent are changed. Accepts the same fields as the POST body (`type`, `x`, `y`, `rotation`, `radius`, `width`, `height`, `angle`, `distance`, `fillColor`, `strokeColor`, `opacity`, `locked`, `hidden`, `flags`); `locked` and `hidden` are coerced to boolean.

**Response `200`:** Template updated
**Response `404`:** `{ "error": "..." }` (template not found)
**Response `500`:** `{ "error": "Failed to update template" }`
**WS Event:** `template.updated` (sent to all connected sockets)

---

### DELETE `/:stageId/templates/:id`

Removes a template.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "..." }` (template not found)
**Response `500`:** `{ "error": "Failed to delete template" }`
**WS Event:** `template.deleted` (payload `{ id, stageId }`, sent to all connected sockets)
