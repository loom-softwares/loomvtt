# Folders (Pastas)

## Endpoints

**Base:** `/api/folders`
**Auth:** `requireAuth, requireWorldMatch`

Tipos válidos: `actor`, `item`, `scene`, `journal`, `roll-table`, `macro`

---

### GET `/`

Lista pastas. `?worldId=`, `?type=` para filtrar.

**Response `200`:** `FoldersDocument[]`

---

### GET `/:id`

Busca pasta por ID.

---

### POST `/`

Cria pasta.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `type` | `string` | **sim** | — |
| `worldId` | `string` | não | `'world-1'` |
| `parent` | `string` | não | `''` |
| `sorting` | `string` | não | `'m'` |
| `color` | `string` | não | `''` |

Valida parent existe e type coincide.

**Evento WS:** `folder.created`

---

### PUT `/:id`

Atualiza pasta. Previne referência circular.

**Evento WS:** `folder.updated`

---

### DELETE `/:id`

Remove pasta. Reparenta filhas, desvincula documentos.

**Evento WS:** `folder.deleted`
