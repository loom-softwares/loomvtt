# Levels (Andares)

## Visão geral

Uma Stage é um container de múltiplos **levels** (andares). Cada level carrega o fundo
(`backgroundUrl`/`backgroundColor`) e a faixa de elevação (`bottomElevation`/`topElevation`).

> **Migração:** na migration `031_levels_architecture`, stages existentes ganharam um level
> "Térreo" automático com o fundo que antes vivia na própria stage, e as colunas legadas
> `backgroundUrl`/`backgroundColor` foram removidas de `stages`. Ao criar uma stage via
> `POST /api/stages`, o level "Térreo" é criado automaticamente.

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | `string` | auto | UUID gerado |
| `stageId` | `string` | **(obrigatório)** | Stage dona do level |
| `name` | `string` | `'Térreo'` | Nome do andar |
| `bottomElevation` | `number` | `0` | Elevação inferior |
| `topElevation` | `number` | `20` | Elevação superior |
| `backgroundUrl` | `string` | `''` | Imagem de fundo do andar |
| `backgroundColor` | `string` | `'#0d0d0f'` | Cor de fundo do andar |
| `flags` | `object` | `{}` | Flags arbitrárias |
| `createdAt` / `updatedAt` | `string` | ISO | Timestamps |

O schema também define campos de aparência que voltam nas respostas: `backgroundTint`
(`'#ffffff'`), `alphaThreshold` (`0.75`), `foregroundUrl`, `foregroundTint`, `fogExplorationUrl`,
`anchorX`/`anchorY` (`0.5`), `offsetX`/`offsetY` (`0`), `scaleX`/`scaleY` (`1`), `fitMode`
(`'fill'`) e `rotation` (`0`). As rotas PUT não aceitam esses campos (veja o PUT abaixo).

> **CODE ISSUE:** `levelsRouter.put` e `stageLevelsRouter.put` copiam apenas `name`, `bottomElevation`,
> `topElevation`, `backgroundUrl`, `backgroundColor` e `flags` (`LEVEL_FIELDS` em
> `server/applications/api/levels.ts`). Os campos de aparência acima só podem ser definidos por outros caminhos.

## Endpoints

**Base:** `/api/levels`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em POST, PUT, DELETE)

---

### GET `/`

Lista todos os levels. Use `?stageId=` para filtrar por stage.

**Query params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `stageId` | `string` | Filtra levels da stage informada |

**Response `200`:** `LevelsDocument[]`

---

### GET `/:id`

Busca level por ID.

**Response `200`:** Level object
**Response `404`:** `{ "error": "Level not found" }`

---

### POST `/`

Cria um level. `requireGM`

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **sim** | — |
| `name` | `string` | não | `'Térreo'` |
| `bottomElevation` | `number` | não | o `topElevation` do level mais alto da stage, ou `0` se não houver |
| `topElevation` | `number` | não | `bottomElevation + 20` |
| `backgroundUrl` | `string` | não | `''` |
| `backgroundColor` | `string` | não | `'#0d0d0f'` |
| `flags` | `object` | não | `{}` |

A faixa de elevação padrão empilha o novo level acima do mais alto da stage, então dois levels
nunca compartilham a mesma faixa.

**Response `201`:** Level criado
**Response `400`:** `{ "error": "stageId is required" }` (ou o erro do Document)

**Evento WS:** `level.created` (repassado a todos os clientes, veja [Eventos WebSocket](#eventos-websocket))

---

### PUT `/:id`

Atualiza um level. `requireGM`

**Request body:** Mesmos campos do POST (exceto `stageId`). Apenas `name`, `bottomElevation`,
`topElevation`, `backgroundUrl`, `backgroundColor` e `flags` são usados; os demais campos são ignorados.

**Response `200`:** Level atualizado
**Response `400`:** `{ "error": "No valid fields provided for update." }`
**Response `404`:** `{ "error": "Not found" }`
**Evento WS:** `level.updated`

---

### DELETE `/:id`

Remove um level. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "Not found" }`
**Evento WS:** `level.deleted`

---

## Eventos WebSocket

O Document layer emite `levels.created`, `levels.updated` e `levels.deleted` no servidor, e
`server/index.ts` os repassa aos clientes como `level.created`, `level.updated` e `level.deleted`
(payload: a linha do level). As rotas do sub-recurso de stage também emitem `levels.changed` com
`{ stageId }`, que o servidor repassa a todos os clientes como `levels.changed`.

## Sub-recurso de Stage

Também disponível aninhado na stage (padrão lights/templates):

**Base:** `/api/stages/:stageId/levels`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em POST, PUT e DELETE, `403` para os demais)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/stages/:stageId/levels` | Lista levels da stage (ordenados por `bottomElevation`) |
| POST | `/api/stages/:stageId/levels` | Só GM. Cria level na stage (mesmos defaults de `POST /api/levels`) |
| PUT | `/api/stages/:stageId/levels/:id` | Só GM. Atualiza level; emite `levels.changed` |
| DELETE | `/api/stages/:stageId/levels/:id` | Só GM. Remove level; emite `levels.changed` |

> **CODE ISSUE:** PUT e DELETE não verificam se o level pertence a `:stageId`, então o id da stage
> na URL não é garantido para um level já existente.
