# Worlds (Mundos)

## Endpoints

**Base:** `/api/worlds`
**Auth:** varia por rota — a maioria exige `requireAuth, requireWorldMatch` ou
`requireAdminSession` (sessão do Setup Hub) ou `requireAuth, requireGM` (sessão de jogo
com role de GM). Rotas de listagem/seleção de mundo (`GET /`, `GET /:id`, `GET
/:worldId/users`, `GET /:worldId/online-users`) respondem **sem sessão nenhuma** —
são consumidas pela tela de login antes de qualquer autenticação existir.

`dataPath` e `permissions` só aparecem na resposta se quem chamou tiver sessão de admin
(`toClientWorld`, `server/applications/api/worlds.ts:58`). `adminPassword` nunca é
devolvido.

---

## Mundo (CRUD básico)

### GET `/`

Lista todos os mundos.

**Response `200`:** `World[]` (campos sensíveis omitidos sem sessão de admin)

---

### GET `/:id`

Busca um mundo por ID.

**Response `200`:** `World`
**Response `404`:** `{ "error": "World not found" }`

---

### POST `/`

Cria um novo mundo. **Auth:** `requireAdminSession`

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `system` | `string` | `'generic'` |
| `description` | `string` | `''` |
| `coverUrl` | `string` | `''` |
| `language` | `string` | `'en'` |
| `adminPassword` | `string` | `''` (hasheada com bcrypt) |

Cria também a pasta de assets do mundo, inicializa o banco do mundo, salva o manifest e
cria um usuário GM padrão (`role: 4`).

**Response `201`:** `World` criado

---

### PUT `/:id`

Atualiza um mundo. **Auth:** `requireAdminSession`

**Request body:** `name`, `system` (não pode mudar se já setado), `description`,
`coverUrl`, `language`, `adminPassword`, `dataPath`, `backgroundUrl`, `theme`,
`nextSession`, `safeMode`, `resetPasswords` (boolean — se `true`, zera a senha de todos
os usuários do mundo)

**Response `200`:** `World` atualizado (com `dataPath`/`permissions`, já que exige sessão
de admin)
**Response `404`:** mundo não existe
**Response `400`:** tentativa de trocar o `system` de um mundo que já tem um definido

---

### DELETE `/:id`

Remove um mundo, seu diretório em disco (`worlds/:id/`, incluindo `world.sqlite`) e os
registros relacionados (`world_packages`, `users`). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**Eventos WS:** `worlds.deleted`, `users.deleted`

---

## Mundo — campos avançados

### GET `/:id/migration-status`

Verifica se o schema do banco do mundo precisa de migração. **Auth:** `requireAdminSession`

**Response `200`:** `{ "needsMigration": boolean }`

---

### POST `/:id/backup`

Cria um dump JSON completo do banco do mundo e salva no diretório de backups do servidor.
**Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`

---

### PUT `/:id/permissions`

GM (sessão de jogo) ajusta os limiares de permissão do mundo. **Auth:** `requireAuth,
requireGM`

**Request body:** `{ "permissions": object }`

**Response `200`:** `{ "permissions": object }`
**Response `400`:** `permissions` ausente ou não é objeto

---

### GET `/:id/time`

Retorna o horário atual do mundo (relógio interno de jogo).

**Response `200`:** `{ "worldTime": number }`

---

### PUT `/:id/time`

Atualiza o horário do mundo. **Auth:** `requireAuth, requireGM`

**Request body:** `{ "advance": number }` (soma ao horário atual) **ou** `{ "worldTime":
number }` (define direto)

**Response `200`:** `{ "worldTime": number }`
**Response `400`:** nenhum dos dois campos informado
**Evento WS:** `time.updated`

---

### PUT `/:id/basic-info`

GM (sessão de jogo) edita informações superficiais do mundo — nunca aceita
`system`/`dataPath`/`adminPassword` (exclusivos da rota admin `PUT /:id`). **Auth:**
`requireAuth, requireGM`

**Request body:** `name`, `backgroundUrl`, `theme`, `nextSession`, `description`
(qualquer subconjunto)

**Response `200`:** `World` atualizado
**Response `404`:** mundo não existe

---

### GET `/:worldId/invite-links`

Retorna o endereço LAN pra jogadores entrarem no mundo. **Auth:** `requireAuth,
requireGM`

**Response `200`:** `{ "localLink": "http://<ip-da-lan>:<porta>" }`

---

## Ciclo de vida do mundo

### POST `/:id/launch`

Ativa o mundo (desativa os demais), sem criar sessão de GM. **Auth:**
`requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "..." }`
**Evento WS:** `worlds.updated`

---

### POST `/:id/activate`

Ativa o mundo pra login de jogadores (sem criar sessão de GM). **Auth:**
`requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "...", "name": "..." }`
**Evento WS:** `worlds.updated`

---

### POST `/:id/launch-gm`

Ativa o mundo e já retorna uma sessão de GM pronta (cria o usuário GM se não existir).
**Auth:** `requireAdminSession`

**Response `200`:** `{ "token": "...", "session": { worldId, worldName, userId, userName,
userColor, userRole } }` — também seta o cookie `loom_world_token`
**Response `400`:** mundo sem `system` definido (ou ainda `'generic'`)
**Response `404`:** mundo não existe

---

### POST `/:id/pause`

GM pausa o mundo (bloqueia interação de jogadores). **Auth:** `requireAuth, requireGM`

**Response `200`:** `{ "isPaused": true }`
**Evento WS:** `world.paused`

---

### POST `/:id/resume`

GM retoma o mundo. **Auth:** `requireAuth, requireGM`

**Response `200`:** `{ "isPaused": false }`
**Evento WS:** `world.resumed`

---

### POST `/deactivate`

Desativa o mundo ativo pra todo mundo (diferente de `session/logout`, que só desloga
quem chamou). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**Evento WS:** `world.deactivated`

---

## Usuários do mundo

### GET `/:worldId/users`

Lista usuários do mundo. Sem sessão nenhuma, o campo `role` é omitido (evita que um
anônimo identifique quem é o GM antes de tentar `join`). `password` nunca é devolvido.

**Response `200`:** `User[]`

---

### GET `/:worldId/online-users`

IDs dos usuários conectados via WebSocket agora (usado pra apagar quem já está online na
tela de seleção de usuário).

**Response `200`:** `string[]` (userIds)

---

### POST `/:worldId/users`

Cria um usuário no mundo. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `role` | `number` | `1` |
| `password` | `string` | `''` (hasheada) |
| `color` | `string` | `'#4f46e5'` |
| `avatarUrl` | `string` | `''` |

**Response `201`:** usuário criado (sem `password`)

---

### PUT `/:worldId/users/:id`

Atualiza um usuário. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** `name`, `role`, `password` (se enviado e diferente de `'••••'`, é
re-hasheado), `color`, `avatarUrl`, `pronouns`, `actorId`

**Response `200`:** usuário atualizado (sem `password`)
**Evento WS:** `user.updated`

---

### DELETE `/:worldId/users/:id`

Remove um usuário. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`

---

## Packages do mundo

### GET `/:worldId/packages`

Catálogo completo de addons + estado habilitado/desabilitado pra este mundo.

**Response `200`:** `[{ id, name, version, description, enabled }]`

---

### POST `/:worldId/packages`

Define quais addons ficam habilitados no mundo (admin). **Auth:** `requireAdminSession`

**Request body:** `{ "enabledModules"?: string[], "config"?: object }`

**Response `200`:** `{ "success": true, "enabledModules": [...], "worldId": "..." }`
**Response `404`:** mundo não existe
**Evento WS:** `worlds.updated`

---

### POST `/:worldId/packages/gm`

Mesma coisa que a rota acima, mas chamada pelo GM de dentro da sessão de jogo em vez do
Setup Hub. **Auth:** `requireAuth, requireGM`

**Request body / Response:** idênticos a `POST /:worldId/packages`

---

## Sessão de jogo

### POST `/:worldId/join`

Autentica um usuário no mundo e retorna uma sessão de jogo. Rate-limited (10
tentativas/min por IP).

**Request body:** `{ "userId": "...", "password"?: "..." }`

**Response `200`:** `{ "token": "...", "session": { userId, userName, userColor,
userRole, worldId } }` — seta o cookie `loom_world_token`
**Response `400`:** mundo sem sistema de RPG ativo
**Response `401`:** senha incorreta, ou usuário GM/Assistant GM (`role >= 3`) tentando
entrar sem senha
**Response `404`:** mundo ou usuário não encontrado

---

### POST `/session/logout`

Desloga o usuário atual do jogo (o mundo continua ativo pra todo mundo — diferente de
`POST /deactivate`).

**Response `200`:** `{ "success": true }`

---

### GET `/session/verify`

Retoma uma sessão de jogo já ativa (ex: depois de um F5). Independente da sessão de
admin — cookie próprio (`loom_world_token`), então um jogador/GM em jogo nunca cai na
tela de login de admin ao recarregar.

**Response `200`:** `{ "valid": true, "session": { userId, userName, userColor,
userRole, worldId } }` **ou** `{ "valid": false }`
