# Settings (Configurações)

## Endpoints

**Base:** `/api/settings`
**Auth:** `requireAdminSession`

---

### GET `/`

Lista todas as settings (oculta `admin_password` apenas nesta lista). A senha do admin fica
gravada em `loom.config.json` pelas rotas de Setup, não nesta tabela.

---

### POST `/`

Cria/atualiza setting.

**Request body:** `{ "key" (obrigatório), "value" }`

**Response `200`:** `{ key, value }`
**Response `400`:** `{ "error": "key is required" }`

---

### GET `/:key`

Busca setting por chave. Esta rota não aplica o filtro de `admin_password` que `GET /` usa.

**Response `200`:** `{ key, value }`
**Response `404`:** `{ "error": "Setting not found" }`
