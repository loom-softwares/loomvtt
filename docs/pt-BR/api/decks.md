# Decks (Baralhos)

## Endpoints

**Base:** `/api/decks`
**Auth:** `requireAuth, requireWorldMatch` nas rotas de leitura (`GET`); **todas as rotas
de escrita** (`POST`, `PUT`, `DELETE`, e as rotas de manipulação de cartas abaixo)
exigem também `requireGM`.

---

### GET `/world/:worldId`

Lista baralhos de um mundo, do mais antigo para o mais novo (`createdAt` asc).

---

### GET `/:id`

Busca baralho por ID. `404` se não existir.

---

### POST `/`

Cria baralho. O id é gerado pelo servidor (`deck-<uuid>`). Responde `201` com o baralho criado. `400` se `worldId` ou `name` faltar.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `worldId` | `string` | **sim** | — |
| `name` | `string` | **sim** | — |
| `type` | `string` | não | `'standard'` |
| `stackType` | `string` | não | `'deck'` |
| `ownerId` | `string` | não | `''` |
| `folderId` | `string` | não | `''` |
| `cards` | `array` | não | `[]` |
| `state` | `object` | não | `{}` |

**Evento WS:** `deck.created`

---

### PUT `/:id`

Atualiza baralho. Aceita `name`, `type`, `cards`, `state`, `folderId`, `stackType`, `ownerId` (só os campos enviados são alterados). `404` se o baralho não existir.

**Evento WS:** `deck.updated`

---

### DELETE `/:id`

Remove baralho. Responde `{ "success": true }`.

**Evento WS:** `deck.deleted` (sinal interno `decks.deleted`, repassado aos clientes com o nome `deck.deleted`; payload `{ id, worldId, stageId }`)

---

## Manipulação de cartas

Todas exigem `requireGM`.

### POST `/:id/draw`

Puxa carta(s) do topo de `:id` pra outra stack (hand/pile).

**Request body:** `{ "toId": "...", "number"?: 1 }`

**Response `200`:** `{ moved: Card[], from: Deck, to: Deck }`
**Response `400`:** `toId` ausente, ou nada pra puxar
**Response `404`:** baralho de origem ou destino não encontrado
**Eventos WS:** `deck.updated` (duas vezes — origem e destino)

---

### POST `/:id/deal`

Distribui cartas ciclicamente do topo de `:id` pra várias stacks.

**Request body:** `{ "toIds": ["...", "..."], "number"?: 1 }` (`number` = quantas rodadas)

**Response `200`:** `{ from: Deck, to: Deck[] }`
**Eventos WS:** `deck.updated` (uma vez por stack afetada)

---

### POST `/:id/pass`

Passa cartas específicas de `:id` pra outra stack.

**Request body:** `{ "toId": "...", "cardIds": ["...", "..."] }`

**Response `200`:** `{ moved: Card[], from: Deck, to: Deck }`
**Eventos WS:** `deck.updated` (duas vezes — origem e destino)

---

### POST `/:id/recall`

Traz de volta pro baralho `:id` toda carta espalhada por outras stacks do mesmo mundo
cujo `origin` seja ele.

**Response `200`:** `{ deck: Deck, touched: Deck[] }`
**Eventos WS:** `deck.updated` (uma vez por stack afetada + o próprio deck)
