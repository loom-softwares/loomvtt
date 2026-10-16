# Setup (Configuração)

## Endpoints

**Base:** `/api/setup`

---

### GET `/status`

Status da configuração do servidor. Sem autenticação. Responde com `Cache-Control: no-store`.

**Response `200`:** `{ isSetup, needsDataPathSelection, dataPathRestartRequired, dataPathRestartInProgress, hasWorlds, activeWorldId, defaultWorldId, loomSiteUrl }`

---

### POST `/data-path`

Escolha da pasta de dados na primeira execução, feita antes de existir a senha do admin. Rate limited (10/min).

**Request body:** `{ "dataPath": "..." }` (string vazia = pasta padrão)

**Response `200`:** `{ "success": true, "restartRequired": boolean }`. Quando `restartRequired` é `true`, o servidor reinicia.
**Response `400`:** `{ "error": "..." }` quando `dataPath` não é uma string válida.
**Response `403`:** pasta personalizada só pode ser escolhida no próprio computador do servidor (requisição de loopback).
**Response `409`:** a configuração inicial já foi concluída.

---

### POST `/init`

Inicializa admin (só se não configurado). Rate limited (10/min).

**Request body:** `{ "password": "..." }` (min 8 chars)

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "Setup already completed" }` ou `{ "error": "Password must be at least 8 characters" }`
**Response `409`:** a pasta de dados ainda não foi escolhida (veja `POST /data-path`).

---

### POST `/login`

Login admin. Rate limited (10/min).

**Request body:** `{ "password": "..." }`

**Response `200`:** `{ "admin": true }` e define o cookie httpOnly de admin. O JWT não é devolvido no corpo; a sessão fica só no cookie (válida por 24h).
**Response `400`:** configuração não concluída, ou senha não enviada.
**Response `401`:** `{ "error": "Incorrect password" }`

---

### POST `/logout`

Limpa o cookie de sessão admin. Retorna `{ "success": true }`.

---

### GET `/verify`

Verifica sessão admin. Não exige autenticação e nunca altera cookies.

**Response `200`:** `{ valid, admin }`. Quando a sessão não é válida, `reason` é `admin_session_replaced` se um login admin mais novo a substituiu; caso contrário, o campo não aparece.

---

### GET `/config`

Retorna config do servidor (`loom.config.json`). `requireAdminSession`

**Response `200`:** `{ dataPath, port, language, dbClient, dbHost, dbPort, dbUser, dbPasswordConfigured, dbName, dbSsl, compressStatic, fullscreen, upnp, defaultWorldId }`. A senha do banco nunca é devolvida; só `dbPasswordConfigured` indica se há uma definida.

---

### POST `/config`

Salva config. `requireAdminSession`

**Campos:** `dataPath`, `port`, `language`, `dbClient`, `dbHost`, `dbPort`, `dbUser`,
`dbPassword`, `dbName`, `dbSsl`, `compressStatic`, `fullscreen`, `upnp`, `defaultWorldId`
— só os campos enviados são atualizados (merge parcial). Os `db*` só importam quando
`dbClient` não é `sqlite3`. `dbPassword` nunca aparece nos logs do servidor.

**Response `200`:** `{ "success": true, "restartRequired": boolean, "message": "..." }`. `message` é `"Configuration saved."` quando nada precisa de reinício. Quando a raiz de dados ou o caminho do config muda, `restartRequired` é `true` e a mensagem é `"Data root saved; restart confirmation required."`. A mudança só vale após `POST /restart`.

---

### POST `/restart`

Reinicia o servidor depois que o admin confirma uma mudança salva da raiz de dados. `requireAdminSession`

**Response `200`:** `{ "success": true }`
**Response `409`:** `{ "error": "..." }` quando não há mudança de raiz de dados aguardando reinício.
