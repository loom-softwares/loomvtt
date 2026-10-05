# Stages (Cenas)

## Visão geral

Uma Stage é um container de **Levels** (andares) — o fundo (`backgroundUrl`/`backgroundColor`)
e a elevação vivem nos levels, não mais na stage. Ver [`levels.md`](./levels.md).

> Na migration `031_levels_architecture`, o fundo das stages existentes foi movido para um
> level "Térreo" automático e as colunas legadas foram removidas.

## Endpoints

**Base:** `/api/stages`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em POST, PUT, DELETE, activate)

---

### GET `/`

Lista todas as stages.

**Response `200`:** `StagesDocument[]`

---

### GET `/active`

Retorna a stage ativa com tokens.

**Response `200`:**
```json
{
  "id": "stage-1",
  "name": "Dungeon",
  "isActive": true,
  "gridSize": 50,
  "gridColor": "#ffffff",
  "tokens": [
    { "id": "member-1", "name": "Aragorn", "x": 500, "y": 300, "colorHex": "#e74c3c", "kind": "adventurer" }
  ]
}
```

**Response `404`:** `{ "error": "No active stage found" }`

---

### GET `/:id`

Busca stage por ID.

**Response `200`:** Stage object
**Response `404`:** `{ "error": "Stage not found" }`

---

### POST `/`

Cria uma nova stage. `requireGM`

Cria automaticamente o level "Térreo" (elevação 0–20) carregando o fundo informado.

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `worldId` | `string` | — |
| `bgUrl` | `string` | `''` (vai para o level default) |
| `backgroundColor` | `string` | `'#0d0d0f'` (vai para o level default) |
| `gridSize` | `number` | `50` |
| `gridColor` | `string` | `'#ffffff'` |
| `navigationName` | `string` | — |
| `showInNavigation` | `boolean` | — |
| `darknessLevel` | `number` | — |
| `weatherEffect` | `string` | — |
| `gridDistance` | `number` | — |
| `gridUnit` | `string` | — |
| `gridStyle` | `string` | — |
| `gridOpacity` | `number` | — |
| `gridType` | `string` | — |
| `padding` | `number` | — |
| `offsetX` | `number` | — |
| `offsetY` | `number` | — |
| `ambientPlaylistId` | `string` | `''` (ID da playlist de áudio ambiente) |
| `sceneType` | `string` | `'tactical'` (`'tactical'`, `'map'`, `'theater'`) |
| `parentStageId` | `string` | `''` (ID da stage pai para agrupamento em mapa) |
| `folderId` | `string` | `''` |
| `width` | `number` | — |
| `height` | `number` | — |

**Response `201`:** Stage criada, incluindo o `levels` criado (`{ ...stage, levels: [level] }`)
**Response `400`:** `{ "error": "Name is required" }`

**Evento WS:** `stages.created` (+ `levels.created` do level default)

---

### PUT `/:id`

Atualiza stage. `requireGM`

> O fundo agora é configurado via `/api/levels` — campos de fundo não são mais aceitos aqui.

**Request body:** Demais campos do POST. Se incluir `darknessLevel`, dispara evento `stage.darkness`.

**Eventos WS:** `stages.updated`, `stage.darkness` (se darknessLevel mudou)

---

### DELETE `/:id`

Remove stage. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`

**Evento WS:** `stages.deleted`

---

### POST `/:id/activate`

Ativa uma stage (desativa as outras). `requireGM`

**Request body:** `{ "worldId": "..." }`

**Response `200`:** Stage ativada

**Evento WS:** `stage.activated` — o payload traz `levelId`, `bgUrl` e `backgroundColor`
do level base (menor `bottomElevation`) da stage.

---

### Sub-recursos

- [`/api/stages/:stageId/levels`](./levels.md) — Levels (andares)
- `/api/stages/:stageId/lights` — Luzes ambiente
- `/api/stages/:stageId/templates` — Templates de área

---

### GET `/:id/music-sync`

Em qual faixa da música da cena a mesa está e quando ela começou, para que um cliente que recarrega ou entra depois comece na mesma faixa, no mesmo ponto.

**Response `200`:** `{ "sync": { "key": "...", "trackId": "...", "startedAt": 1700000000000 } | null, "now": 1700000000500 }` — `startedAt` e `now` são o relógio do servidor. `sync` é `null` quando nada foi reportado para a música atual (acabou de começar, ou o servidor reiniciou).

---

### POST `/:id/music-track`

Um cliente informa a faixa que acabou de começar: `{ "key", "trackId", "prevTrackId" }`. O primeiro relato de uma música, e o primeiro que avança a partir da faixa guardada, definem a linha do tempo; o mesmo relato dos outros clientes não muda nada. A linha do tempo é descartada quando a música da cena muda.

**Response `200`:** `{ "sync": ..., "changed": true | false, "now": ... }`
