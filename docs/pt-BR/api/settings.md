# Settings (Configurações)

## Endpoints

**Base:** `/api/settings`
**Auth:** `requireAdminSession`

---

### GET `/`

Lista todas as settings (oculta `admin_password`).

---

### POST `/`

Cria/atualiza setting.

**Request body:** `{ "key" (obrigatório), "value" }`

---

### GET `/:key`

Busca setting por chave.

**Response `200`:** `{ key, value }`
