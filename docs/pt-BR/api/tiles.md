# Tiles

Ative tiles (objetos do cenário).

## Endpoints

**Base:** `/api/tiles`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista tiles. `?stageId=` para filtrar.

Os campos JSON (`floors`, `triggers`, `conditions`, `actions`, `occlusion`) são parseados automaticamente.

**Response `200`:** `TilesDocument[]`

---

### GET `/:id`

Busca tile por ID.

**Response `200`:** Tile (parseado)
**Response `404`:** `{ "error": "Tile not found" }`

---

### POST `/`

Cria tile.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **sim** | — |
| `name` | `string` | **sim** | — |
| `x` | `number` | não | `0` |
| `y` | `number` | não | `0` |
| `width` | `number` | não | `100` |
| `height` | `number` | não | `100` |
| `imgUrl` | `string` | não | `''` |
| `isActive` | `boolean` | não | `true` |
| `rotation` | `number` | não | `0` |
| `tintColor` | `string` | não | `'#ffffff'` |
| `opacity` | `number` | não | `1` |
| `locked` | `boolean` | não | `false` |
| `videoLoop` | `boolean` | não | `true` |
| `videoAutoplay` | `boolean` | não | `true` |
| `videoVolume` | `number` | não | `0` |
| `anchorX` | `number` | não | `0.5` |
| `anchorY` | `number` | não | `0.5` |
| `elevation` | `number` | não | `0` |
| `levelId` | `string` | não | `''` |
| `floors` | `array` | não | `[]` |
| `triggers` | `array` | não | `[]` |
| `conditions` | `array` | não | `[]` |
| `actions` | `array` | não | `[]` |

`name` é removido de espaços nas pontas. Os campos JSON (`floors`, `triggers`, `conditions`, `actions`) são aceitos como arrays ou como strings JSON. O POST não lê `hidden`, `isOverhead`, `isRoof` nem `occlusion`; defina-os com PUT.

**Response `201`:** Tile criado
**Response `400`:** `{ "error": "Fields \"stageId\" and \"name\" are required." }` (ou o erro da camada de documentos)
**Response `500`:** `{ "error": "Failed to create tile" }`
**Evento WS:** `tile.created` (nome no fio; enviado só aos clientes da stage)

---

### PUT `/:id`

Atualiza tile. Atualização parcial: só os campos enviados são alterados. Aceita os campos do POST (exceto `stageId`) mais `hidden`, `isOverhead`, `isRoof` e `occlusion` (`{ mode, radius, alpha }`, padrão `{ "mode": "fade", "radius": 100, "alpha": 0 }`). `name` é removido de espaços nas pontas.

**Response `200`:** Tile atualizado
**Response `400`:** `{ "error": "..." }` (erro da camada de documentos)
**Response `404`:** `{ "error": "Tile not found" }`
**Response `500`:** `{ "error": "Failed to update tile" }`
**Evento WS:** `tile.updated` (nome no fio; enviado só aos clientes da stage)

---

### DELETE `/:id`

Remove tile.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `400`:** `{ "error": "..." }` (erro da camada de documentos)
**Response `404`:** `{ "error": "Tile not found" }`
**Response `500`:** `{ "error": "Failed to delete tile" }`
**Evento WS:** `tile.deleted` (nome no fio; enviado só aos clientes da stage)

---

## Active Tile Triggers

Motor de triggers executado no client (`client/canvas/tile-trigger-engine.ts` + `tile-trigger-integration.ts`), plugado via `CanvasManager`.

### Eventos Suportados

| Evento | Disparo |
|--------|---------|
| `token-enter` | Token entra na área do tile |
| `token-exit` | Token sai da área do tile |
| `token-move-inside` | Token se move dentro da área |
| `click` | Clique no tile (disparado pelo handler de clique do tile no canvas) |

### Condições

| Condição | Parâmetros | Descrição |
|----------|------------|-----------|
| `user-role-gte` | `value: <role>` | Só dispara se o role do usuário for >= o valor (o GM sempre passa) |
| `flag-equals` | `value: { flag, expectedValue }` | Só dispara se o campo `flag` do token for igual a `expectedValue` |

### Ações

Os campos de configuração abaixo são os que o motor lê (`client/canvas/tile-trigger-engine.ts`). As ações de efeito local (as que o motor transmite) aceitam um `recipient` opcional (`trigger`, `gm`, `all`, `trigger+gm`) que limita quem as executa.

| Ação | Campos de config | Descrição |
|------|------------|-----------|
| `teleport` | `targetX`, `targetY`, `targetTokenId?`, `stageId?` | Move o token para uma coordenada; com `stageId`, move para outra stage |
| `toggle-visibility` | `targetTokenId?`, `visible?` | Oculta ou mostra um token (`visible` ausente = alterna) |
| `play-sound` | `soundUrl`, `volume` | Toca um som |
| `show-dialog` | `journalId?`, `pageId?`, `title?`, `content?`, `imageUrl?` | Mostra um diálogo |
| `pause-game` | `duration?` | Pausa o jogo |
| `toggle-lock` | `targetTileId?`, `locked?` | Trava ou destrava um tile |
| `activate-tile` | `targetTileId?`, `active?` | Ativa ou desativa outro tile (`PUT /api/tiles/:id` com `isActive`) |
| `show-notification` | `message`, `type?`, `duration?` | Mostra uma notificação |
| `chat-message` | `content`, `speaker?` | Envia uma mensagem no chat |
| `run-animation` | `payload` | Executa uma animação visual |
| `floating-text` | `text`, `color?` | Mostra texto flutuante sobre o tile |

### Configuração via UI

A aba "Active Tiles" em `TileConfigWindow` permite configurar triggers/conditions/actions visualmente sem editar JSON.
