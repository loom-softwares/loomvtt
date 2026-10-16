# Actors

## Endpoints

**Base:** `/api/actors`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista actors. Filtra por `?worldId=`. Usuários não-GM veem só o que têm permissão.

**Query:**
- `?worldId=`: filtrar por mundo
- `?populate=true`: incluir filhos embutidos
- `?limit=`, `?offset=`: paginação

**Response `200`:** `ActorsDocument[]` (com `systemData` processado via `prepareData` e `withActiveEffects`)

Toda rota de actor devolve `systemData` com os efeitos ativos já aplicados. Nenhuma delas devolve os valores base crus; só `GET /api/cast/:id` devolve a linha crua do token.

---

### GET `/:id`

Busca actor por ID.

**Response `200`:** Actor (com populated e prepareData). Quem tem acesso Limitado (nível de propriedade 1) recebe a versão redigida: só os campos de `systemData` que o ruleset lista em `limitedFields`. Como em toda rota de actor, o `systemData` aqui já tem os efeitos ativos aplicados.
**Response `404`:** `{ "error": "Actor not found" }`
**Response `403`:** `{ "error": "Access denied" }`

---

### POST `/`

Cria actor. Exige a permissão do mundo `createActor` (o Mestre sempre passa; outros papéis só se estiverem listados nas permissões do mundo).

O mundo é tirado da sessão logada (`req.auth.worldId`); um `worldId` enviado no corpo não é usado.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `type` | `string` | não | Primeiro `actorType` declarado pelo ruleset ativo do mundo, ou `'character'` se nenhum |
| `avatarUrl` | `string` | não | `''` |
| `systemData` | `object` | não | `getDefaultData(type)` do sistema ativo |
| `folderId` | `string` | não | `''` |

`type` precisa ser `'character'`/`'npc'` ou um dos `actorTypes` declarados no manifesto do
ruleset do mundo (`ruleset.json`).

**Response `201`:** Actor criado (com prepareData)
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }` ou `{ "error": "Invalid actor type \"...\" for this world." }`
**Response `403`:** `{ "error": "Permission \"createActor\" required." }`, ou sem sessão no mundo
**Evento WS:** `actor.created` (Signal `actors.created`)

---

### PUT `/:id`

Atualiza actor.

**Request body:**

| Campo | Tipo | Restrição |
|-------|------|-----------|
| `name` | `string` | — |
| `type` | `string` | `'character'`/`'npc'` ou um `actorType` declarado pelo ruleset do mundo |
| `avatarUrl` | `string` | — |
| `systemData` | `object` | — (mesclado em profundidade, veja abaixo) |
| `folderId` | `string` | — |
| `ownership` | `object` | **só GM** pode mudar |
| `flags` | `object` | — |

Usuários que não são GM só atualizam um actor que podem editar (nível de propriedade 3); caso contrário a resposta é 403.

**`systemData` é mesclado em profundidade** ao valor guardado, não substituído. Objetos simples mesclam chave por chave, arrays e escalares substituem o valor antigo, e uma chave escrita como `"-=chave"` apaga essa chave. Um `systemData` parcial é, portanto, uma escrita parcial segura.

**Response `200`:** Actor atualizado. O corpo é a linha do actor com `systemData` já com os efeitos aplicados. Gravar esse objeto de volta como dado base guarda os efeitos ativos nos valores base, então envie só os campos que você muda.
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`, ou `{ "error": "No valid fields provided for update." }` quando o corpo não tem nenhum campo conhecido
**Response `403`:** `{ "error": "Only the Gamemaster can change ownership." }`, ou `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Actor not found" }`

**Evento WS:** `actor.updated` (Signal `actors.updated`)

---

### DELETE `/:id`

Remove actor. Exige o GM ou acesso de edição (nível de propriedade 3) ao actor.

**Query:** `?cascade=false` — desliga cascade delete de filhos

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Actor not found" }`
**Evento WS:** `actor.deleted` (Signal `actors.deleted`)

---

### GET `/:actorId/items`

Lista itens do actor.

**Response `200`:** `ItemsDocument[]`. Quem tem acesso Limitado (nível de propriedade 1) recebe `[]`.
**Response `403`:** `{ "error": "Access denied" }` quando o usuário não tem acesso ao actor
**Response `404`:** `{ "error": "Actor not found" }`

---

### POST `/:actorId/items`

Cria item vinculado ao actor.

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `type` | `string` | `'equipment'` |
| `data` | `object` | `{}` |
| `imgUrl` | `string` | `''` |

**Response `201`:** Item criado
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }` (exige o GM ou acesso de edição ao actor)
**Response `404`:** `{ "error": "Actor not found" }` (também quando o actor é de outro mundo)
**Evento WS:** `actor.updated` (o actor inteiro, com seus itens)

---

### PUT `/:actorId/items/:itemId`

Atualiza item do actor.

**Request body:** qualquer um de `name`, `type`, `data`, `imgUrl`, `suppressed`

**Response `200`:** Item atualizado
**Response `404`:** `{ "error": "Item not found or does not belong to this actor" }`
**Evento WS:** `actor.updated` (o actor inteiro, com seus itens)

Não existe `GET /:actorId/items/:itemId`, então uma ficha não consegue carregar um item embutido por essa rota. Para carregar um item embutido pelo id, use a rota do mundo `GET /api/items/:id`. A mesma rota com `PUT` salva o item, e quando o item tem `actorId` a mudança também é propagada para o actor.

---

### DELETE `/:actorId/items/:itemId`

Remove item do actor.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Item not found or does not belong to this actor" }`
**Evento WS:** `actor.updated` (o actor inteiro, com seus itens)

---

### POST `/import-package`

Cria um personagem a partir de um pacote `loom-character-backup` (um slot do Loom Connect ou um `.json` salvo). Quem importa é o dono. Permitido ao Mestre e aos papéis listados na permissão `importCharacter` do mundo (jogadores por padrão). Quando quem importa não é o Mestre, o personagem fica aguardando aprovação e ninguém mais o vê.

**Request body:** `{ "package": { "format": "loom-character-backup", "version": 1, "character": { ... } } }`

**Response `201`:** `{ "id": "...", "name": "...", "pending": false }` (`pending: true` quando quem importa não é o Mestre)
**Response `400`:** não é um pacote de personagem do Loom, o personagem não tem nome, ou tem mais de 1000 itens / 500 efeitos
**Response `403`:** sem login no mundo, ou o Mestre não liberou a importação para este papel
**Response `409`:** o mundo não tem sistema de RPG configurado, ou `{ "code": "SYSTEM_MISMATCH" }` quando o pacote é de outro sistema
**Evento WS:** `actor.updated` (Signal `actor.updated`, enviado para o novo actor)

---

### POST `/:id/approve-import`

Só o Mestre. Aceita um personagem importado por um jogador; ele passa a ser visível conforme a propriedade.

**Response `200`:** `{ "id": "...", "status": "approved" }`
**Response `400`:** o personagem não está aguardando aprovação
**Response `403`:** `{ "error": "Só o Mestre pode aprovar um personagem importado." }` quando quem chama não é o Mestre
**Response `404`:** o personagem não existe no mundo logado

---

### POST `/:id/export-package`

Monta o mesmo pacote para salvar em um arquivo `.json`. Exige conta local dona do personagem, atribuída a ele ou com permissão de editar (o Mestre exporta qualquer um).

**Response `200`:** `{ "package": { ... }, "displayName": "...", "systemVersion": "..." }`
**Response `403`:** sem conta local no mundo, conta banida ou aguardando aprovação, ou o personagem não é do usuário
**Response `404`:** o personagem não existe no mundo
**Response `409`:** o mundo não tem sistema de RPG, ou a versão dele não pode ser identificada

---

### POST `/:id/backup-package`

O mesmo pacote, usado por "Exportar para o Loom Connect" (o navegador envia ao site com o token do Loom Connect).

**Request body:** `{ "exchangeCode": "..." }` — o código de troca do Loom Connect. É obrigatório (`400` quando falta). O servidor troca o código no site do Loom (`/api/oauth/exchange`).

**Response `200`:** mesmo formato de `export-package`.
**Response `400`:** `{ "error": "Reautentique sua conta Loom Connect para salvar o backup." }` quando falta `exchangeCode`
**Response `401`:** a sessão do Loom Connect expirou, ou a sessão local mudou
**Response `403`:** a conta não está vinculada ao Loom Connect, ou a conta do Loom Connect não é a vinculada a este usuário do mundo; também quando o personagem não é do usuário
