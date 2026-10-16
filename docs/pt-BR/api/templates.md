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

**Tipo:** o servidor guarda `type` como enviado e não valida o valor. O renderizador desenha `cone`, `rect`, `circle` e `ray`; o cliente só salva templates `cone` e `rect` (`canvas-manager.ts`, a chamada `onTemplateCreate`). Observe que o valor é `rect`, não `rectangle`.

**Response `201`:** Template criado
**Response `400`:** `{ "error": "..." }` (erro de validação da camada de documentos)
**Response `500`:** `{ "error": "Failed to create template" }`
**Evento WS:** `template.created` (enviado a todos os sockets conectados)

---

### PUT `/:stageId/templates/:id`

Atualiza um template. Atualização parcial: só os campos enviados são alterados. Aceita os mesmos campos do body do POST (`type`, `x`, `y`, `rotation`, `radius`, `width`, `height`, `angle`, `distance`, `fillColor`, `strokeColor`, `opacity`, `locked`, `hidden`, `flags`); `locked` e `hidden` são convertidos para boolean.

**Response `200`:** Template atualizado
**Response `404`:** `{ "error": "..." }` (template não encontrado)
**Response `500`:** `{ "error": "Failed to update template" }`
**Evento WS:** `template.updated` (enviado a todos os sockets conectados)

---

### DELETE `/:stageId/templates/:id`

Remove um template.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "..." }` (template não encontrado)
**Response `500`:** `{ "error": "Failed to delete template" }`
**Evento WS:** `template.deleted` (payload `{ id, stageId }`, enviado a todos os sockets conectados)
