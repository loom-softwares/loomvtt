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

Defaults: `type` `'chat'`, `command` `''`, `imgUrl` `''`, `slot` `-1`. `worldId` não é validado
aqui além do `requireWorldMatch`.

Criar uma macro `type: 'script'` exige role >= 3 (Assistant GM/GM).

**Response `201`:** Macro criada (a linha)
**Response `400`:** `{ "error": "..." }` (erro do Document)
**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem criar macros do tipo script" }`
**Evento WS:** `macro.created` (payload: a linha criada, repassada a todos os clientes). A rota nunca chama `Signal.broadcast`; a camada de documento emite `macros.created` e `server/index.ts` repassa.

---

### PUT `/:id`

Atualiza macro. Editar uma macro tipo `script` também exige role >= 3; usuários não-GM só
podem editar macros que possuem. Só `name`, `type`, `command`, `imgUrl` e `slot` são copiados do body.

**Response `200`:** `{ "success": true }` (não a linha atualizada)
**Response `400`:** `{ "error": "..." }` (erro do Document)
**Response `403`:** `{ "error": "Apenas GM/Assistant GM podem editar macros do tipo script" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**Evento WS:** `macro.updated` (payload: a linha atualizada, repassada a todos os clientes)

---

### DELETE `/:id`

Remove macro. Usuários não-GM só podem remover macros que possuem.

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "..." }` (erro do Document)
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Macro not found" }`
**Evento WS:** `macro.deleted` (payload: `{ id, worldId, stageId }`, repassado a todos os clientes)
