# Setup (Configuração)

## Endpoints

**Base:** `/api/setup`

---

### GET `/status`

Status da configuração do servidor.

**Response `200`:** `{ isSetup, hasWorlds, activeWorldId, defaultWorldId }`

---

### POST `/init`

Inicializa admin (só se não configurado).

**Request body:** `{ "password": "..." }` (min 8 chars)

---

### POST `/login`

Login admin. Rate limited (10/min).

**Request body:** `{ "password": "..." }`

**Response `200`:** `{ token, admin }` + cookie httpOnly

---

### POST `/logout`

Limpa sessão admin.

---

### GET `/verify`

Verifica sessão admin.

**Response `200`:** `{ valid, admin }`

---

### GET `/config`

Retorna config do servidor (`loom.config.json`). `requireAdminSession`

---

### POST `/config`

Salva config. `requireAdminSession`

**Campos:** `dataPath`, `port`, `language`, `dbClient`, `dbHost`, `dbPort`, `dbUser`,
`dbPassword`, `dbName`, `dbSsl`, `compressStatic`, `fullscreen`, `upnp`, `defaultWorldId`
— só os campos enviados são atualizados (merge parcial). Os `db*` só importam quando
`dbClient` não é `sqlite3`. `dbPassword` nunca aparece nos logs do servidor.

**Response `200`:** `{ "success": true, "message": "Configuration saved. Please restart the application for changes to take effect." }`
