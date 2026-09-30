# Items

Tipos válidos: `weapon`, `spell`, `armor`, `equipment`, `consumable`, `tool`, `treasure`, `other`

## Endpoints

**Base:** `/api/items`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista itens. `?worldId=`, `?populate=true`

**Response `200`:** `ItemsDocument[]`

---

### GET `/:id`

Busca item por ID.

**Response `200`:** Item
**Response `404`:** `{ "error": "Item not found" }`
**Response `403`:** `{ "error": "Access denied" }`

---

### POST `/`

Cria item.

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `worldId` | `string` | `'world-1'` |
| `type` | `string` | `'equipment'` |
| `data` | `object` | `{}` |
| `imgUrl` | `string` | `''` |
| `folderId` | `string` | `''` |
| `actorId` | `string` | — (opcional; anexa o item a esse actor e dispara `actors.updated`) |

`type` também aceita qualquer `itemType` declarado no manifesto do ruleset do mundo; um valor
não reconhecido cai silenciosamente pra `'equipment'` (sem erro).

Dispara hook `onCreateItem`.

**Response `201`:** Item criado
**Evento WS:** `item.created`

---

### PUT `/:id`

Atualiza item. Verifica ownership.

Dispara hooks `preUpdateItem`, `onUpdateItem`.

**Response `200`:** Item atualizado
**Evento WS:** `item.updated`

---

### DELETE `/:id`

Remove item. `?cascade=false` desliga cascade.

Dispara hooks `preDeleteItem`, `onDeleteItem`.

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `item.deleted`
