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

Lista todos os mundos. Quando um mundo não tem `backgroundUrl` nem `coverUrl`, a resposta preenche `backgroundUrl` com a arte do ruleset.

**Response `200`:** `World[]` (`adminPassword` nunca é devolvido; `dataPath` e `permissions` só com sessão de admin)

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

O `id` é derivado do nome (`'Night Campaign'` → `night-campaign`, com `-1`, `-2`… em caso de colisão). Ele
também é o nome da pasta em `worlds/`. A rota cria a pasta de assets do mundo, inicializa o banco do mundo,
salva o manifest, cria um usuário GM padrão (`name: 'Gamemaster'`, `role: 4`) e uma cena padrão
(`'Cena Inicial'`) com um andar (`'Térreo'`) definido como andar inicial da cena.

**Response `201`:** `World` criado
**Response `400`:** `{ "error": "name is required" }`
**Evento WS:** `world.created` (nome no fio, enviado a todos os sockets conectados)

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
**Response `400`:** `{ "error": "Cannot change the ruleset (system) of an existing world." }`
**Evento WS:** `world.updated` (nome no fio, enviado a todos os sockets conectados). Com `resetPasswords: true`, também `user.updated` com payload `{ worldId }` (sem id de usuário)

---

### DELETE `/:id`

Remove um mundo, seu diretório em disco (`worlds/:id/`, incluindo `world.sqlite`) e os
registros relacionados (`world_packages`, `users`). **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true }`
**Eventos WS:** `world.deleted` e `user.deleted` (nomes no fio, enviados a todos os sockets conectados; payloads `{ worldId }`)

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

Retorna o relógio do mundo: o horário atual do mundo, a velocidade do relógio, se ele está pausado e o id do calendário. Não exige sessão.

O relógio roda sozinho no servidor enquanto o mundo não estiver pausado (ver `PUT` abaixo), então `worldTime` é o valor no momento da requisição.

**Response `200`:** `{ "worldId": string, "worldTime": number, "timeScale": number, "paused": boolean, "serverNow": number, "calendarId": string }`

| Campo | Descrição |
|-------|-----------|
| `worldTime` | Segundos do mundo (inteiro com sinal; negativo significa antes da época do calendário). |
| `timeScale` | Segundos do mundo por segundo real. Padrão `1`. |
| `paused` | `true` enquanto o mundo estiver pausado (o relógio não roda). |
| `serverNow` | Horário real do servidor (ms desde a época) em que o snapshot foi tirado. |
| `calendarId` | Id do calendário que o mundo usa. Padrão `gregorian`. |

**Response `404`:** `{ "error": "World not found" }`

---

### PUT `/:id/time`

Altera o relógio do mundo. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body:** pelo menos um de:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `advance` | `number` | Segundos a somar ao horário atual. Tem prioridade sobre `worldTime` quando os dois são enviados. |
| `worldTime` | `number` | Define o horário diretamente. |
| `timeScale` | `number` | Velocidade do relógio em segundos do mundo por segundo real. Maior que 0 e no máximo 100000. |
| `calendarId` | `string` | Calendário que o mundo usa. Não vazio, com no máximo 64 caracteres, sem espaços nas pontas. |

**Response `200`:** o mesmo corpo do `GET`.
**Response `400`:** `{ "error": "Must provide advance, worldTime, timeScale or calendarId" }` (nenhum deles foi enviado); `{ "error": "advance and worldTime must be finite numbers" }`; `{ "error": "timeScale must be a number greater than 0 and at most 100000" }`; `{ "error": "calendarId must be a non-empty string of at most 64 characters" }`
**Response `404`:** `{ "error": "World not found" }`
**Evento WS:** `time.updated`, payload `{ worldId, worldTime, timeScale, paused, serverNow, calendarId }`. O servidor também envia a cada cerca de 30 segundos enquanto o relógio roda, e ao pausar e ao retomar (esses sem `calendarId`), para que os clientes corrijam a deriva.

---

### PUT `/:id/basic-info`

GM (sessão de jogo) edita informações superficiais do mundo — nunca aceita
`system`/`dataPath`/`adminPassword` (exclusivos da rota admin `PUT /:id`). **Auth:**
`requireAuth, requireWorldMatch, requireGM`

**Request body:** `name`, `backgroundUrl`, `theme`, `nextSession`, `description`, `effectsRequireGmApproval`
(qualquer subconjunto)

`effectsRequireGmApproval` é um booleano (o servidor guarda o valor como `true` ou `false`; o padrão é `false`). Quando é `true`, o efeito de item de um jogador espera um Assistant GM ou GM aprovar, em vez de ser aplicado na hora. Efeitos de tile nunca são bloqueados. Ver [Effects: Aprovação do GM](effects.md#aprovação-do-gm).

**Response `200`:** `World` atualizado
**Response `404`:** mundo não existe
**Evento WS:** `world.updated`

---

### GET `/:worldId/invite-links`

Retorna os endereços que os jogadores usam para entrar no mundo. **Auth:** uma sessão de mundo de GM (`requireGM`
com um token de mundo deste mundo; `401` sem token; `403` para não-GM ou token de outro mundo),
ou uma sessão de admin.

Para descobrir o endereço de Internet quando nenhum túnel está ativo, o servidor consulta
`https://api.ipify.org` pelo IPv4 público da máquina (só o próprio endereço da máquina é enviado; em cache por 10 minutos).

**Response `200`:**
```json
{
  "localLink": "http://192.168.0.10:3000",
  "tunnel": { "running": false, "mode": "off", "url": null },
  "publicLink": "",
  "port": 3000
}
```

`publicLink` é `http://<ip-publico>:<porta>` quando nenhum túnel está ativo e um endereço público utilizável
foi encontrado; só funciona se a porta estiver aberta no roteador. `tunnel` é o estado do túnel Cloudflare
(veja [tunnel.md](tunnel.md)).

---

## Ciclo de vida do mundo

### POST `/:id/launch`

Ativa o mundo (desativa os demais), sem criar sessão de GM. O mundo começa pausado
(`isPaused: true`), então o relógio começa parado até ser retomado. **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "..." }`
**Response `404`:** `{ "error": "World not found" }`
**Evento WS:** `world.updated`

---

### POST `/:id/activate`

Ativa o mundo pra login de jogadores (sem criar sessão de GM). Fecha antes o mundo previamente ativo, e o
mundo começa pausado, então o relógio começa parado até ser retomado. **Auth:** `requireAdminSession`

**Response `200`:** `{ "success": true, "worldId": "...", "name": "..." }`
**Response `404`:** `{ "error": "World not found" }`
**Evento WS:** `world.updated`; quando outro mundo estava ativo, também `world.deactivated`, que desconecta todos os clientes

---

### POST `/:id/launch-gm`

Ativa o mundo e já retorna uma sessão de GM pronta (cria o usuário GM se não existir). Também fecha o mundo
previamente ativo, inicia pausado (então o relógio começa parado até ser retomado) e cria o usuário `Gamemaster` se o mundo não tiver um usuário `role: 4`.
**Auth:** `requireAdminSession`

**Response `200`:** `{ "token": "...", "session": { worldId, worldName, userId, userName,
userColor, userRole } }` — também seta o cookie `loom_world_token`
**Response `400`:** `{ "error": "Este mundo não tem um sistema de RPG ativo. Configure um sistema antes de entrar." }` (mundo sem `system` definido, ou ainda `'generic'`)
**Response `404`:** `{ "error": "World not found" }`
**Evento WS:** `world.updated`; `world.deactivated` (desconecta todos os clientes) quando outro mundo estava ativo

---

### POST `/:id/pause`

GM pausa o mundo (bloqueia interação de jogadores). **Auth:** `requireAuth, requireWorldMatch, requireGM`

Pausar também para o relógio do mundo (ver `PUT /:id/time`); o horário é salvo.

**Response `200`:** `{ "isPaused": true }`
**Evento WS:** `world.paused`

---

### POST `/:id/resume`

GM retoma o mundo. **Auth:** `requireAuth, requireWorldMatch, requireGM`

Retomar também reinicia o relógio do mundo a partir do horário em que parou.

**Response `200`:** `{ "isPaused": false }`
**Evento WS:** `world.resumed`

---

### POST `/deactivate`

Desativa o mundo ativo pra todo mundo (diferente de `session/logout`, que só desloga
quem chamou). Limpa o cookie de mundo de quem chamou. **Auth:** `requireAuth, requireWorldMatch, requireGM`
(sessão de jogo de GM, não a sessão de admin)

**Response `200`:** `{ "success": true }`
**Evento WS:** `world.deactivated`, que desconecta todos os clientes conectados

---

## Usuários do mundo

### GET `/:worldId/users`

Lista usuários do mundo. Sem sessão nenhuma, o campo `role` é omitido (evita que um
anônimo identifique quem é o GM antes de tentar `join`). `password`, `siteAccountId` e
`loomConnectAccountId` nunca são devolvidos. Os usuários de sistema `Display Viewer` e `Streamer` são
filtrados. Usuários com `pendingApproval` ou `banned` ficam ocultos de quem não é GM (ou admin).

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
**Response `400`:** `{ "error": "name is required" }` · `{ "error": "role must be an integer between 0 and 4" }`
**Evento WS:** `user.created` (nome no fio; o Signal é `users.created`)

---

### PUT `/:worldId/users/:id`

Atualiza um usuário. **Auth:** `requireAuth, requireWorldMatch` (a própria rota não exige GM).
Um usuário pode editar o próprio perfil; um GM (role >= 4) ou admin pode editar os outros. Editar outro
usuário é recusado se ele for um Gamemaster e quem chama não estiver em sessão de admin. Só um GM pode
mudar `role` ou atribuir `actorId` a outra pessoa. Veja também `PUT /api/users/:id` em [users.md](users.md),
que tem as mesmas regras de role.

**Request body:** `name`, `role`, `password` (se enviado e diferente de `'••••'`, é
re-hasheado; trocá-lo incrementa `sessionVersion`), `color`, `avatarUrl`, `pronouns`, `actorId`

**Response `200`:** usuário atualizado (sem `password`)
**Response `400`:** `{ "error": "role must be an integer between 0 and 4" }`
**Response `403`:** `{ "error": "Only a Gamemaster or the user themselves can update this profile" }` · `{ "error": "Only a Setup Hub administrator can change a Gamemaster account" }` · `{ "error": "Only a Gamemaster can change user roles" }` · `{ "error": "Only a Gamemaster can assign a character" }` · erros de moderação (veja [users.md](users.md), "Rotas de usuário por mundo")
**Response `404`:** `{ "error": "User not found" }` (não está neste mundo)
**Evento WS:** `user.updated` (nome no fio, enviado a todos os sockets conectados)

---

### DELETE `/:worldId/users/:id`

Remove um usuário. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Response `200`:** `{ "success": true }`

---

## Packages do mundo

### GET `/:worldId/packages`

Catálogo completo de addons + estado habilitado/desabilitado pra este mundo. **Auth:** `requireAuth` (jogador, GM, admin e as sessões somente-leitura de exibição/transmissão, que podem chamar qualquer GET).

**Response `200`:** `[{ id, name, version, description, author, repository, enabled }]` (`repository` é o link do manifest, devolvido só quando começa com `https://`, senão `""`)

---

### POST `/:worldId/packages`

Define quais addons ficam habilitados no mundo (admin). **Auth:** `requireAdminSession`

**Request body:** `{ "enabledModules"?: string[], "config"?: object }`

**Response `200`:** `{ "success": true, "enabledModules": [...], "worldId": "..." }`
**Response `404`:** mundo não existe
**Evento WS:** `world.updated`, payload `{ worldId, packageConfig }`

---

### POST `/:worldId/packages/gm`

Mesma coisa que a rota acima, mas chamada pelo GM de dentro da sessão de jogo em vez do
Setup Hub. **Auth:** `requireAuth, requireWorldMatch, requireGM`

**Request body / Response:** idênticos a `POST /:worldId/packages`

---

---

### POST `/:worldId/connect-account`

Vincula o usuário local logado a uma identidade verificada do Loom Connect. O navegador pega um token de acesso no popup do site e envia aqui; o servidor confirma com o site. Uma recusa do site nunca é respondida com `401`, para que o vínculo recusado não recarregue a página (o cliente trata `401` como sessão expirada). **Auth:** `requireAuth, requireWorldMatch` (sessão de usuário local deste mundo; sessões de admin são recusadas).

**Request body:** `{ "exchangeCode": "..." }` (obrigatório)

**Response `200`:** `{ "linked": true, "accountName": "...", "avatarUrl": "" }`
**Response `400`:** o site recusou o código (a mensagem diz o motivo) · `{ "error": "exchangeCode é obrigatório." }`
**Response `401`:** a conta local deste mundo não existe mais
**Response `403`:** sem login com uma conta local deste mundo, usuário banido ou aguardando aprovação, ou conta sem papel de jogador
**Response `409`:** a conta Loom Connect (ou a conta Loom) já está vinculada a outro usuário do mundo
**Response `502`:** o site não pôde ser alcançado ou devolveu uma resposta inválida

---

### DELETE `/:worldId/connect-account`

Remove o vínculo do Loom Connect do usuário local logado.

**Response `403`:** sem login com uma conta local deste mundo

## Sessão de jogo

### POST `/:worldId/join`

Autentica um usuário no mundo e retorna uma sessão de jogo. Rate-limited (10
tentativas/min por IP).

**Request body:** `{ "userId": "...", "password"?: "..." }`

**Response `200`:** `{ "token": "...", "session": { userId, userName, userColor,
userRole, worldId } }` — seta o cookie `loom_world_token`
**Response `400`:** mundo sem sistema de RPG ativo
**Response `401`:** `{ "error": "Incorrect password" }`; usuário GM/Assistant GM (`role >= 3`) sem senha (`"GM/Assistant GM requires a password"`); ou conta vinculada ao Google (`authProvider: loom_site`) sem senha local
**Response `403`:** `{ "error": "Usuário aguardando aprovação do Mestre." }` (aguardando aprovação) · `{ "error": "Esta conta foi banida deste mundo." }` (banido)
**Response `404`:** mundo ou usuário não encontrado
**Response `409`:** a conta já está em uso em outra sessão (`ACCOUNT_IN_USE_MESSAGE`)

---

### POST `/:worldId/oauth-join`

Autentica (ou solicita acesso para) um jogador que entrou com Google. **Rate-limited** (mesmo limitador do `join`).

**Request body:** `{ "exchangeCode": "..." }` (código de uso único; o servidor o troca com o site do Loom)

Na primeira vez, o servidor cria o usuário do mundo (ou o enfileira com `pendingApproval`).

**Response `200`:** `{ "pending": false, "token": "...", "session": { userId, userName, userColor, userRole, worldId } }`, seta o cookie `loom_world_token`
**Response `202`:** `{ "pending": true, "message": "..." }` (acesso solicitado, aguardando aprovação do GM)
**Response `400`:** `{ "error": "exchangeCode é obrigatório." }` · mundo sem sistema de RPG
**Response `403`:** usuário banido · conta de Gamemaster (`role === 4`), que deve usar o login local
**Response `404`:** mundo não encontrado
**Response `409`:** a conta já está em uso em outra sessão
**Response `500`:** `{ "error": "Falha ao autenticar com Google." }`
**Evento WS:** `user.created` quando um novo usuário pendente é criado

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

`valid` é `false` quando não há token de mundo, o token é inválido, o mundo não está ativo ou a sessão ficou ociosa por tempo demais. Uma verificação válida renova o cronômetro de ociosidade.
