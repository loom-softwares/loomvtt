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
| `tintColor` | `string` | não | `''` |
| `opacity` | `number` | não | `1` |
| `locked` | `boolean` | não | `false` |
| `videoLoop` | `boolean` | não | `true` |
| `videoAutoplay` | `boolean` | não | `true` |
| `videoVolume` | `number` | não | `1` |
| `anchorX` | `number` | não | `0.5` |
| `anchorY` | `number` | não | `0.5` |
| `floors` | `array` | não | `[]` |
| `triggers` | `array` | não | `[]` |
| `conditions` | `array` | não | `[]` |
| `actions` | `array` | não | `[]` |

**Response `201`:** Tile criado
**Evento WS:** `tiles.created`

---

### PUT `/:id`

Atualiza tile.

**Response `200`:** Tile atualizado
**Evento WS:** `tiles.updated`

---

### DELETE `/:id`

Remove tile.

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `tiles.deleted`

---

## Active Tile Triggers

Motor de triggers executado no client (`client/canvas/tile-trigger-engine.ts` + `tile-trigger-integration.ts`), plugado via `CanvasManager`.

### Eventos Suportados

| Evento | Disparo |
|--------|---------|
| `token-enter` | Token entra na área do tile |
| `token-exit` | Token sai da área do tile |
| `token-move-inside` | Token se move dentro da área |
| `click` | Clique no tile (GM) |

### Condições

| Condição | Parâmetros | Descrição |
|----------|------------|-----------|
| `user-role-gte` | `role: 4` | Só dispara se o role do usuário for >= o valor |

### Ações

| Ação | Parâmetros | Descrição |
|------|------------|-----------|
| `teleport` | `{ stageId, x, y }` | Teleporta token para coordenada absoluta |
| `toggle-visibility` | `{}` | Alterna visibilidade do tile |
| `play-sound` | `{ src, volume }` | Toca som |
| `show-dialog` | `{ title, message, image? }` | Mostra diálogo |
| `pause-game` | `{}` | Pausa o jogo |
| `toggle-lock` | `{}` | Alterna lock do tile |

### Configuração via UI

A aba "Active Tiles" em `TileConfigWindow` permite configurar triggers/conditions/actions visualmente sem editar JSON.
