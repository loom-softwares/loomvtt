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

---

### GET `/:id`

Busca actor por ID.

**Response `200`:** Actor (com populated e prepareData)
**Response `404`:** `{ "error": "Actor not found" }`
**Response `403`:** `{ "error": "Access denied" }`

---

### POST `/`

Cria actor.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `worldId` | `string` | não | `'world-1'` |
| `type` | `string` | não | Primeiro `actorType` declarado pelo ruleset ativo do mundo, ou `'character'` se nenhum |
| `avatarUrl` | `string` | não | `''` |
| `systemData` | `object` | não | `getDefaultData(type)` do sistema ativo |
| `folderId` | `string` | não | `''` |

`type` precisa ser `'character'`/`'npc'` ou um dos `actorTypes` declarados no manifesto do
ruleset do mundo (`ruleset.json`).

**Response `201`:** Actor criado (com prepareData)
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`
**Evento WS:** `actors.created`

---

### PUT `/:id`

Atualiza actor.

**Request body:**

| Campo | Tipo | Restrição |
|-------|------|-----------|
| `name` | `string` | — |
| `type` | `string` | `'character'`/`'npc'` ou um `actorType` declarado pelo ruleset do mundo |
| `avatarUrl` | `string` | — |
| `systemData` | `object` | — |
| `folderId` | `string` | — |
| `ownership` | `object` | **só GM** pode mudar |

**Response `200`:** Actor atualizado
**Response `400`:** `{ "error": "Invalid actor type \"...\" for this world." }`
**Response `403`:** `{ "error": "Only the Gamemaster can change ownership." }`

**Evento WS:** `actors.updated`

---

### DELETE `/:id`

Remove actor.

**Query:** `?cascade=false` — desliga cascade delete de filhos

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `actors.deleted`

---

### GET `/:actorId/items`

Lista itens do actor.

**Response `200`:** `ItemsDocument[]`

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

---

### PUT `/:actorId/items/:itemId`

Atualiza item do actor.

**Request body:** qualquer um de `name`, `type`, `data`, `imgUrl`, `suppressed`

**Response `200`:** Item atualizado

---

### DELETE `/:actorId/items/:itemId`

Remove item do actor.

**Response `200`:** `{ "success": true, "id": "..." }`

---

### POST `/import-package`

Cria um personagem a partir de um pacote `loom-character-backup` (um slot do Loom Connect ou um `.json` salvo). Quem importa é o dono. Permitido ao Mestre e aos papéis listados na permissão `importCharacter` do mundo (jogadores por padrão). Quando quem importa não é o Mestre, o personagem fica aguardando aprovação e ninguém mais o vê.

**Request body:** `{ "package": { "format": "loom-character-backup", "version": 1, "character": { ... } } }`

**Response `403`:** sem login no mundo, ou o Mestre não liberou a importação para este papel
**Response `400`:** não é um pacote de personagem do Loom, ou o personagem não tem nome

---

### POST `/:id/approve-import`

Só o Mestre. Aceita um personagem importado por um jogador; ele passa a ser visível conforme a propriedade.

**Response `400`:** o personagem não está aguardando aprovação

---

### POST `/:id/export-package`

Monta o mesmo pacote para salvar em um arquivo `.json`. Exige conta local dona do personagem, atribuída a ele ou com permissão de editar (o Mestre exporta qualquer um).

---

### POST `/:id/backup-package`

O mesmo pacote, usado por "Exportar para o Loom Connect" (o navegador envia ao site com o token do Loom Connect).
