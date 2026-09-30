# Macros

## Endpoints

**Base:** `/api/macros`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista macros. `?worldId=`

---

### POST `/`

Cria macro.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `worldId` | `string` | Mundo |
| `name` | `string` | Nome |
| `type` | `string` | Tipo (`script` requer role >= 3) |
| `command` | `string` | Comando/código |
| `imgUrl` | `string` | URL da imagem |
| `slot` | `number` | Slot na hotbar |

Criar uma macro `type: 'script'` exige role >= 3 (Assistant GM/GM).

**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem criar macros do tipo script" }`
**Evento WS:** `macros.created` (auto-broadcast pela camada de documento — a rota em si nunca chama `Signal.broadcast`)

---

### PUT `/:id`

Atualiza macro. Editar uma macro tipo `script` também exige role >= 3; usuários não-GM só
podem editar macros que possuem.

**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem editar macros do tipo script" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**Evento WS:** `macros.updated` (auto-broadcast)

---

### DELETE `/:id`

Remove macro. Usuários não-GM só podem remover macros que possuem.

**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**Evento WS:** `macros.deleted` (auto-broadcast)
