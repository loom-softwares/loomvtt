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

**Supported types:** `cone`, `circle`, `rectangle`, `ray`

**Response `201`:** Template created
**WS Event:** `template.created`

---

### PUT `/:stageId/templates/:id`

Updates a template.

**Response `200`:** Template updated
**WS Event:** `template.updated`

---

### DELETE `/:stageId/templates/:id`

Removes a template.

**Response `200`:** `{ "success": true, "id": "..." }`
**WS Event:** `template.deleted`
