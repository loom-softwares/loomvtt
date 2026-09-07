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
| `door` | `number` | `0` | Tipo de porta |
| `doorState` | `number` | `0` | Estado da porta |

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

**Request body:** Campos do schema acima.

**Response `201`:** Wall criada
**Evento WS:** `wall.created`

---

### PUT `/:id`

Atualiza parede.

**Evento WS:** `wall.updated`

---

### PUT `/:id/state`

Atualiza apenas estado da porta.

**Request body:** `{ "doorState": 0 | 1 }`

**Evento WS:** `door.state`

---

### DELETE `/:id`

Remove parede.

**Response `200`:** `{ "success": true }`
**Evento WS:** `wall.deleted`
