# Drawings (Desenhos)

## Schema

| Campo | Tipo | Default |
|-------|------|---------|
| `type` | `string` | `'rectangle'` |
| `x` | `number` | `0` |
| `y` | `number` | `0` |
| `width` | `number` | `100` |
| `height` | `number` | `100` |
| `levelId` | `string` | `''` |
| `rotation` | `number` | `0` |
| `z` | `number` | `0` |
| `fillColor` | `string` | `'#000000'` |
| `fillOpacity` | `number` | `0.3` |
| `strokeColor` | `string` | `'#ffffff'` |
| `strokeWidth` | `number` | `1` |
| `text` | `string` | `''` |
| `fontFamily` | `string` | `'Arial'` |
| `fontSize` | `number` | `16` |
| `points` | `array` | `[]` |
| `imgUrl` | `string` | `''` |
| `isHidden` | `boolean` | `false` |
| `isLocked` | `boolean` | `false` |
| `authorId` | `string` | `''` |
| `createdAt` / `updatedAt` | `string` | — |

> `imgUrl` e `authorId` são colunas do schema que os handlers `POST`/`PUT /:id` não
> definem — ficam sempre no default (nenhuma UI escreve neles ainda).

## Endpoints

**Base:** `/api/drawings`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista desenhos de uma stage (ordenado por z, createdAt).

**Response `200`:** `DrawingsDocument[]`

---

### GET `/:id`

Busca desenho por ID.

**Response `200`:** Objeto do desenho
**Response `404`:** `{ "error": "Drawing not found." }`

---

### POST `/`

Cria desenho.

**Request body:** `stageId`, `type` (default `'rectangle'`), `x`, `y`, `width` (100), `height`
(100), `rotation` (0), `points` ([]), `fillColor` (`'#ffffff'` — repare: esse default da rota
difere do default `'#000000'` do próprio schema), `fillOpacity` (0.5 — difere do default
0.3 do schema), `strokeColor` (`'#000000'` — difere do default `'#ffffff'` do schema),
`strokeWidth` (1), `text` (''), `fontFamily` (`'Signika'` — difere do default `'Arial'` do
schema), `fontSize` (32 — difere do default 16 do schema), `z` (0), `isHidden` (false),
`isLocked` (false), `levelId` ('').

**Response `201`:** Desenho criado
**Response `400`:** `{ "error": "..." }` (erro de validação da camada de documento)
**Evento WS:** `drawing.created`

---

### PUT `/:id`

Atualiza desenho. Atualização parcial — aceita o mesmo conjunto de campos do `POST` acima.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }`
**Evento WS:** `drawing.updated`

---

### DELETE `/:id`

Remove desenho.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }`
**Evento WS:** `drawing.deleted`

---

### DELETE `/stage/:stageId`

Limpa todos os desenhos de uma stage.

**Response `200`:** `{ "success": true, "count": N }`
**Evento WS:** `drawing.cleared`
