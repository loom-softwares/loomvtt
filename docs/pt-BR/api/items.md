# Items

Tipos válidos: `weapon`, `spell`, `armor`, `equipment`, `consumable`, `tool`, `treasure`, `other`

## Endpoints

**Base:** `/api/items`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista itens, do mais antigo para o mais novo (`createdAt` asc). `?worldId=`, `?limit=`, `?offset=`, `?populate=true`.

Usuários não-GM recebem só os itens que podem visualizar (`canView` sobre o ownership do item; itens embutidos são verificados pelo ownership do actor dono).

**Response `200`:** `ItemsDocument[]`

---

### GET `/:id`

Busca item por ID.

**Response `200`:** Item
**Response `404`:** `{ "error": "Item not found" }`
**Response `403`:** `{ "error": "Access denied" }` (não-GM sem acesso de visualização; um item embutido precisa de pelo menos Observer (2) no actor dono)

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
| `actorId` | `string` | — (opcional; anexa o item a esse actor e dispara um broadcast `actor.updated`) |

`type` também aceita qualquer `itemType` declarado no manifesto do ruleset do mundo; um valor
não reconhecido cai silenciosamente pra `'equipment'` (sem erro).

Dispara hook `onCreateItem`.

**Response `201`:** Item criado
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**Response `500`:** `{ "error": "Failed to create item" }`
**Eventos WS:** `item.created`; mais `actor.updated` (o actor com seus itens) quando `actorId` é informado.

---

### PUT `/:id`

Atualiza item. Usuários não-GM precisam de acesso de edição (`canEdit`; para itens embutidos, sobre o ownership do actor dono), senão `403`.

| Campo | Notas |
|-------|-------|
| `name` | Com trim. |
| `type` | Precisa ser um tipo nativo ou um `itemType` do ruleset; um valor inválido é ignorado e o tipo atual é mantido (diferente do `POST`, que cai para `'equipment'`). |
| `data`, `imgUrl`, `folderId`, `suppressed`, `flags` | Gravados como enviados. |

Só os campos enviados são alterados. Sem nenhum campo válido retorna `400` `{ "error": "No valid fields provided for update." }`. `404` se o item não existir.

Dispara `preUpdateItem(id, updates)` antes da gravação e `onUpdateItem(updated)` depois.

**Response `200`:** Item atualizado
**Eventos WS:** `item.updated`; mais `actor.updated` quando o item é embutido (`actorId` informado).

---

### DELETE `/:id`

Remove item. Usuários não-GM precisam de acesso de edição (`403` caso contrário). `?cascade=false` pula a remoção dos documentos filhos do item (cascade é ativo por padrão).

Dispara `preDeleteItem(id)` antes e `onDeleteItem(id)` depois da remoção.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Item not found" }`
**Eventos WS:** `item.deleted` (payload `{ id }`); mais `actor.updated` quando o item era embutido.
