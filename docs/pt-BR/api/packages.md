# Packages

## Endpoints

**Base:** `/api` (rotas soltas, sem prefixo próprio)
**Router real:** `server/applications/routes/package-routes.ts`, montado em `server/index.ts`
**Auth:** leitura exige `requireAuth`; escrita (POST/PUT/DELETE/PATCH) exige
`requireAdminSession`.

> **Rotas sombreadas:** `server/index.ts` monta o router `worlds` (`/api/worlds`) antes deste.
> As chamadas de mundo do client vão para o router `worlds`, documentado em [`worlds.md`](./worlds.md):
> `GET /api/worlds/:worldId/packages`, `POST /api/worlds/:worldId/packages` e `POST /api/worlds/:worldId/packages/gm`.
> Por causa dessa ordem, `GET /worlds/:worldId/packages` abaixo nunca é alcançado (veja a nota nessa seção). A rota `PUT /worlds/:worldId/packages/order` não é sombreada: ela é registrada antes de `/:packageId`, então é alcançável.

---

### GET `/packages`

Lista todos os packages instalados. `?type=<tipo>` retorna os packages desse tipo; `?compatible=true` retorna só os compatíveis; sem nenhum dos dois, todos.

**Response `200`:** `{ "success": true, "data": Package[] }`
**Response `500`:** `{ "success": false, "error": "Failed to get packages" }`

---

### GET `/packages/:id`

Busca package por ID.

**Response `200`:** `{ "success": true, "data": Package }`
**Response `404`:** `{ "success": false, "error": "Package not found" }`

---

### POST `/packages`

Instala um package. Body é o objeto do package (manifest). `name`, `type` e `version` são obrigatórios.

**Response `201`:** `{ "success": true, "data": { "id", ...packageData } }`
**Response `400`:** `{ "success": false, "error": "Missing required fields: name, type, version" }`

---

### PUT `/packages/:id`

Atualiza um package. Body são os campos a atualizar.

**Response `200`:** `{ "success": true, "message": "Package updated successfully" }` (o package em si não é retornado)

---

### DELETE `/packages/:id`

Remove um package.

**Response `200`:** `{ "success": true, "message": "Package deleted successfully" }`

---

### PATCH `/packages/:id/toggle`

Ativa/desativa um package.

**Request body:** `{ "enabled": boolean }`
**Response `200`:** `{ "success": true, "message": "..." }`
**Response `400`:** `enabled` não é boolean

---

### GET `/packages/:id/dependencies`

Lista dependências do package.

**Response `200`:** `{ "success": true, "data": Dependency[] }`

---

### GET `/packages/:id/validate`

Valida se as dependências do package estão satisfeitas.

**Response `200`:** `{ "success": true, "data": ValidationResult }`

---

### GET `/worlds/:worldId/packages`

**Não alcançada por este router.** O router `worlds` trata `GET /api/worlds/:worldId/packages` primeiro e retorna o catálogo de addons do mundo com o estado `enabled` (veja [`worlds.md`](./worlds.md)). O handler abaixo fica só como referência.

**Response `200`:** `{ "success": true, "data": WorldPackage[] }` (este formato não é o que o client recebe)

---

### POST `/worlds/:worldId/packages/:packageId`

Adiciona um package a um mundo. Para `packageId` = `gm`, este caminho é tratado pelo router `worlds` (`POST /api/worlds/:worldId/packages/gm`), não aqui. Para qualquer outro id, este handler é executado.

**Request body:** `{ "config"?: object }` (default `{}`)
**Response `201`:** `{ "success": true, "data": { "id", "worldId", "packageId", "config" } }`

---

### PUT `/worlds/:worldId/packages/:packageId`

Atualiza a config de um package instalado no mundo.

**Request body:** campos a atualizar
**Response `200`:** `{ "success": true, "message": "World package updated successfully" }`

---

### DELETE `/worlds/:worldId/packages/:packageId`

Remove um package do mundo.

**Response `200`:** `{ "success": true, "message": "World package removed successfully" }`

---

### PUT `/worlds/:worldId/packages/order`

Define a ordem de carregamento dos packages do mundo. **Auth:** `requireAdminSession, requireWorldMatch`. A rota é registrada antes de `PUT /worlds/:worldId/packages/:packageId`, então `order` não é tomado como id de package.

**Request body:** `{ "packageOrders": Array }`
**Response `200`:** `{ "success": true, "message": "World package order updated successfully" }`
**Response `400`:** `{ "success": false, "error": "packageOrders must be an array" }` quando `packageOrders` não é array
**Response `500`:** `{ "success": false, "error": "Failed to set world package order" }` em falha inesperada

---

> As rotas `/worlds/:worldId/*` deste router usam `requireAuth` (leitura) ou `requireAdminSession` (escrita), mais `requireWorldMatch`: um token de mundo só alcança o próprio mundo, e sessões admin passam pela checagem.

### GET `/worlds/:worldId/packages/manifest`

Retorna o manifest combinado de todos os packages do mundo.

**Auth:** `requireAuth, requireWorldMatch`
**Response `200`:** `{ "success": true, "data": Manifest }`
