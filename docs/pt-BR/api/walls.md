# Walls (Paredes)

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | `string` | UUID | |
| `stageId` | `string` | — | Stage |
| `x1` | `number` | — | Ponto inicial X |
| `y1` | `number` | — | Ponto inicial Y |
| `x2` | `number` | — | Ponto final X |
| `y2` | `number` | — | Ponto final Y |
| `sight` | `boolean` | `true` | Bloqueia visão |
| `light` | `boolean` | `true` | Bloqueia luz |
| `movement` | `boolean` | `true` | Bloqueia movimento |
| `sound` | `boolean` | `true` | Bloqueia som |
| `levelId` | `string` | — | ID do Andar (nível) |
| `direction` | `number` | `0` | Direção |
| `wallType` | `string` | `'normal'` | Tipo de parede (`normal`, etc.) |
| `door` | `number` | `0` | Tipo de porta: `0` nenhuma, `1` porta, `2` porta secreta, `3` janela (abre e fecha como porta, ícone de janela) |
| `doorState` | `number` | `0` | Estado da porta |
| `doorDistance` | `number` | `0` | Quão perto um token do próprio jogador precisa estar para abrir a porta, em quadrados da grade (`0` = sem limite; o Mestre é isento) |
| `doorSoundOpen` | `string` | `''` | Som tocado quando a porta abre |
| `doorSoundClose` | `string` | `''` | Som tocado quando a porta fecha |

## Endpoints

**Base:** `/api/walls`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista paredes de uma stage.

**Response `200`:** `WallsDocument[]`

---

### POST `/stage/:stageId`

Cria parede.

**Request body:** Campos do schema acima. Os campos não enviados recebem os valores padrão; a rota não valida as coordenadas.

**Response `201`:** Wall criada
**Response `400`:** `{ "error": "..." }` (erro da camada de documentos)
**Evento WS:** `wall.created`

---

### PUT `/:id`

Atualiza parede. Atualização parcial: só os campos enviados são alterados. Aceita `x1`, `y1`, `x2`, `y2`, `sight`, `light`, `movement`, `sound`, `direction`, `wallType`, `door`, `doorState`, `levelId`, `doorDistance` (limitado a `>= 0`), `doorSoundOpen` e `doorSoundClose` (ambos guardados como strings).

**Response `200`:** Wall atualizada (a linha da wall)
**Response `404`:** `{ "error": "..." }` (wall não encontrada)
**Evento WS:** `wall.updated`

---

### PUT `/:id/state`

Atualiza apenas estado da porta.

**Request body:** `{ "doorState": 0 | 1 }`

**Response `200`:** Wall (a linha da wall)
**Response `404`:** `{ "error": "..." }` (wall não encontrada)
**Evento WS:** `door.state`, payload `{ wallId, door, doorState, worldId }`, restrito ao mundo de quem enviou

---

### POST `/bulk-delete`

Remove muitas walls em uma requisição e envia um único evento. **Auth:** `requireAuth, requireWorldMatch, requireGM`.

**Request body:** `{ "ids": string[] }` (ids repetidos são removidos; no máximo `20000` ids por requisição)

Só walls que pertencem a stages do mundo de quem chama são removidas; os demais ids são ignorados.

**Response `200`:** `{ "success": true, "deleted": ["..."] }` (os ids realmente removidos)
**Response `400`:** `{ "error": "No wall ids given." }` ou `{ "error": "At most 20000 walls per request." }`
**Response `403`:** `{ "error": "A world session is required." }`
**Response `500`:** `{ "error": "Failed to delete walls." }`
**Evento WS:** `wall.bulkDeleted`, payload `{ ids }`, enviado só quando ao menos uma wall foi removida

---

### DELETE `/:id`

Remove parede.

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "..." }` (erro da camada de documentos)
**Evento WS:** `wall.deleted`, payload `{ id }`
