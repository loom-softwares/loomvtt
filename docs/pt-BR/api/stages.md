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

Lista todas as stages, da mais antiga para a mais nova. Cada item é a stage mais `levels` (ordenados por `bottomElevation`), `thumbUrl` e `bgUrl` (o mesmo valor; o fundo do level inicial, ou do primeiro level).

**Response `200`:** `[{ ...stage, levels, thumbUrl, bgUrl }]`

---

### GET `/active`

Retorna a stage ativa com tokens, `levels`, `thumbUrl` e `bgUrl`.

**Response `200`:**
```json
{
  "id": "stage-1",
  "name": "Dungeon",
  "isActive": true,
  "gridSize": 50,
  "gridColor": "#ffffff",
  "levels": [],
  "thumbUrl": "",
  "bgUrl": "",
  "tokens": [
    { "id": "member-1", "name": "Aragorn", "x": 500, "y": 300, "colorHex": "#e74c3c", "kind": "adventurer" }
  ]
}
```

**Response `404`:** `{ "error": "No active stage found" }`

---

### GET `/:id`

Busca stage por ID, com `levels`, `thumbUrl` e `bgUrl` como em `GET /`.

**Response `200`:** Stage object
**Response `404`:** `{ "error": "Stage not found" }`

---

### POST `/`

Cria uma nova stage. `requireGM`

Cria automaticamente o level padrão, chamado `Térreo` (elevação 0–20), carregando o fundo informado.

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
| `folderId`, `sceneType`, `parentStageId` | — | Ignorados pelo POST; veja a nota abaixo da tabela |
| `width` | `number` | — |
| `height` | `number` | — |

`sceneType`, `parentStageId` e `folderId` não são lidos pelo POST; defina-os com `PUT /:id`. As stages também recebem os defaults do schema para os campos não listados aqui (por exemplo `transitionType` = `'fade'`).

**Response `201`:** Stage criada, incluindo o `levels` criado (`{ ...stage, levels: [level], thumbUrl, bgUrl }`)
**Response `400`:** `{ "error": "Name is required" }`

**Eventos WS:** `stage.created` (repassado do Signal `stages.created`) e `level.created` do level default (repassado de `levels.created`)

---

### PUT `/:id`

Atualiza stage. `requireGM`

> O fundo agora é configurado via `/api/levels` — campos de fundo não são mais aceitos aqui.

**Request body:** `name`, `gridSize`, `gridColor`, `navigationName`, `showInNavigation`, `darknessLevel`, `weatherEffect`, `gridDistance`, `gridUnit`, `gridStyle`, `gridOpacity`, `gridType`, `padding`, `offsetX`, `offsetY`, `ambientPlaylistId`, `ambientSoundId`, `ambientStartSoundId`, `width`, `height`, `flags`, `folderId`, `thumbnailUrl`, `transitionType`, `transitionDuration`, `sceneType`, `parentStageId`, `journalId`, `journalPageId`, `tokenVision`, `fogExplorationMode`, `fogExploredColor`, `fogUnexploredColor`, `fogImage`, `globalLight`, `globalLightThreshold`. Só os campos enviados são alterados. `worldId` não é aceito aqui.

**Response `200`:** a stage atualizada, com `levels`, `thumbUrl` e `bgUrl`.
**Response `400`:** `{ "error": "No valid fields provided for update." }` quando nenhum campo aceito é enviado.
**Response `404`:** `{ "error": "Not found" }` quando a stage não existe.

Se `darknessLevel` for enviado, também dispara `stage.darkness` (`{ stageId, darknessLevel, duration: 1000 }`).

**Eventos WS:** `stage.updated` (repassado do Signal `stages.updated`), `stage.darkness` (quando `darknessLevel` é enviado)

---

### PUT `/:id/music`

Altera apenas a música da cena (`ambientPlaylistId`, `ambientSoundId`, `ambientStartSoundId`). Exige a permissão `controlPlaylist` (não só GM): um jogador cujo papel a tenha pode mudar o que a mesa ouve. Os campos do corpo são opcionais, mas pelo menos um deve ser enviado, senão `400`. Retorna a stage atualizada e limpa a linha do tempo da música quando a música realmente mudou.

**Evento WS:** `stage.updated`

---

### DELETE `/:id`

Remove stage. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Stage not found" }`

**Evento WS:** `stage.deleted` (repassado do Signal `stages.deleted`)

---

### POST `/:id/activate`

Ativa uma stage (desativa as outras). `requireGM`

**Request body:** `{ "worldId": "..." }` (opcional; limita quais stages ativas são desativadas àquele mundo)

**Response `200`:** a stage ativada (o objeto de stage simples, não o payload de ativação)
**Response `404`:** `{ "error": "..." }` quando a stage não existe.

Cada stage cuja flag `isActive` muda também emite `stages.updated` (WS `stage.updated`).

**Evento WS:** `stage.activated` — o payload é o payload de ativação de `GET /:id/activation`. Seus `levelId`, `bgUrl` e `backgroundColor` vêm do level definido em `flags.initialLevel`, ou então do level base (menor `bottomElevation`).

---

### GET `/:id/activation`

O que um cliente precisa para carregar esta stage. Os clientes usam após uma reconexão para alcançar uma cena ativada enquanto o socket estava fora. Retorna o mesmo payload do evento `stage.activated`: `stageId`, `levels`, `levelId`, `bgUrl`, `backgroundColor`, configurações de grade, `ambientPlaylistId`, `darknessLevel`, configurações de névoa/visão/iluminação e mais.

**Response `200`:** payload de ativação
**Response `404`:** `{ "error": "Stage not found" }` quando a stage não existe ou pertence a outro mundo (admins excluídos).

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
