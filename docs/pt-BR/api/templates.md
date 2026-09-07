# Templates (Área)

## Endpoints

**Base:** `/api/stages/:stageId/templates`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:stageId/templates`

Lista templates de área de uma stage.

**Response `200`:** `TemplatesDocument[]`

---

### POST `/:stageId/templates`

Cria um template de área.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `type` | `string` | não | `'cone'` |
| `x` | `number` | não | `0` |
| `y` | `number` | não | `0` |
| `rotation` | `number` | não | `0` |
| `radius` | `number` | não | `100` |
| `width` | `number` | não | `100` |
| `height` | `number` | não | `100` |
| `angle` | `number` | não | `90` |
| `distance` | `number` | não | `100` |
| `fillColor` | `string` | não | `'#6366f1'` |
| `strokeColor` | `string` | não | `'#6366f1'` |
| `opacity` | `number` | não | `0.3` |
| `locked` | `boolean` | não | `false` |
| `hidden` | `boolean` | não | `false` |
| `flags` | `string` | não | `'{}'` |

**Tipos suportados:** `cone`, `circle`, `rectangle`, `ray`

**Response `201`:** Template criado
**Evento WS:** `template.created`

---

### PUT `/:stageId/templates/:id`

Atualiza um template.

**Response `200`:** Template atualizado
**Evento WS:** `template.updated`

---

### DELETE `/:stageId/templates/:id`

Remove um template.

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `template.deleted`
