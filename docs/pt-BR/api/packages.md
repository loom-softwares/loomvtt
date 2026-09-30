# Packages

## Endpoints

**Base:** `/api` (rotas soltas, sem prefixo próprio)
**Router real:** `server/applications/routes/package-routes.ts`, montado em `server/index.ts`
**Auth:** leitura exige `requireAuth`; escrita (POST/PUT/DELETE/PATCH) exige
`requireAdminSession` — nenhuma rota de escrita deste router tem consumidor no client hoje.

---

### GET `/packages`

Lista todos os packages instalados.

**Query:** `?type=`, `?compatible=`
**Response `200`:** `{ "success": true, "data": Package[] }`

---

### GET `/packages/:id`

Busca package por ID.

**Response `200`:** `{ "success": true, "data": Package }`
**Response `404`:** `{ "success": false, "error": "..." }`

---

### POST `/packages`

Instala um package. Body é o objeto do package inteiro (manifest).

**Response `201`:** `{ "success": true, "data": Package }`

---

### PUT `/packages/:id`

Atualiza um package. Body são os campos a atualizar.

**Response `200`:** `{ "success": true, "data": Package }`

---

### DELETE `/packages/:id`

Remove um package.

**Response `200`:** `{ "success": true }`

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

Lista packages instalados num mundo.

**Response `200`:** `{ "success": true, "data": WorldPackage[] }`

---

### POST `/worlds/:worldId/packages/:packageId`

Adiciona um package a um mundo.

**Request body:** `{ "config"?: object }` (default `{}`)
**Response `201`:** `{ "success": true, "data": { "id", "worldId", "packageId", "config" } }`

---

### PUT `/worlds/:worldId/packages/:packageId`

Atualiza a config de um package instalado no mundo.

**Request body:** campos a atualizar
**Response `200`:** `{ "success": true, "message": "..." }`

---

### DELETE `/worlds/:worldId/packages/:packageId`

Remove um package do mundo.

**Response `200`:** `{ "success": true, "message": "..." }`

---

### PUT `/worlds/:worldId/packages/order`

Define a ordem de carregamento dos packages do mundo.

**Request body:** `{ "packageOrders": Array }`
**Response `200`:** `{ "success": true, "message": "..." }`
**Response `400`:** `packageOrders` não é array

---

### GET `/worlds/:worldId/packages/manifest`

Retorna o manifest combinado de todos os packages do mundo.

**Response `200`:** `{ "success": true, "data": Manifest }`
