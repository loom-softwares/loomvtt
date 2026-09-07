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
| `bottomElevation` | `number` | não | `0` |
| `topElevation` | `number` | não | `20` |
| `backgroundUrl` | `string` | não | `''` |
| `backgroundColor` | `string` | não | `'#0d0d0f'` |
| `flags` | `object` | não | `{}` |

**Response `201`:** Level criado
**Response `400`:** `{ "error": "stageId is required" }`

**Evento WS:** `levels.created`

---

### PUT `/:id`

Atualiza um level. `requireGM`

**Request body:** Mesmos campos do POST (exceto `stageId`).

**Response `200`:** Level atualizado
**Evento WS:** `levels.updated`

---

### DELETE `/:id`

Remove um level. `requireGM`

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `levels.deleted`

---

## Sub-recurso de Stage

Também disponível aninhado na stage (padrão lights/templates):

**Base:** `/api/stages/:stageId/levels`
**Auth:** `requireAuth, requireWorldMatch`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/stages/:stageId/levels` | Lista levels da stage |
| POST | `/api/stages/:stageId/levels` | Cria level na stage |
| PUT | `/api/stages/:stageId/levels/:id` | Atualiza level |
| DELETE | `/api/stages/:stageId/levels/:id` | Remove level |
