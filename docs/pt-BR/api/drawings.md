# Drawings (Desenhos)

## Schema

| Campo | Tipo | Default |
|-------|------|---------|
| `id` | `string` | UUID |
| `stageId` | `string` | — |
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
| `textBold` | `boolean` | `false` |
| `textItalic` | `boolean` | `false` |
| `textShadow` | `boolean` | `false` |
| `textAlign` | `string` (`left`, `center`, `right`) | `'center'` |
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
schema), `fontSize` (32 — difere do default 16 do schema), `textBold`, `textItalic` e `textShadow` (false), `textAlign` (`'center'`; qualquer valor que não seja `left`/`right` vira `center`), `z` (0), `isHidden` (false),
`isLocked` (false), `levelId` ('').

**Response `201`:** Desenho criado
**Response `400`:** `{ "error": "..." }` (erro de validação da camada de documento)
**Response `500`:** `{ "error": "Failed to create drawing.", "details": "<mensagem>" }`
**Evento WS:** `drawing.created`

---

### PUT `/:id`

Atualiza desenho. Atualização parcial — só os campos enviados são alterados. Aceita os mesmos campos do `POST` acima, exceto `stageId` (um desenho não pode ser movido para outra stage por esta rota); `imgUrl` e `authorId` não são aceitos.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }` (erro da camada de documento, ex.: desenho não encontrado)
**Response `500`:** `{ "error": "Failed to update drawing." }`
**Evento WS:** `drawing.updated`

---

### DELETE `/:id`

Remove desenho.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }`
**Response `500`:** `{ "error": "Failed to delete drawing." }`
**Evento WS:** `drawing.deleted` (payload `{ id }`)

---

### DELETE `/stage/:stageId`

Limpa todos os desenhos de uma stage.

**Response `200`:** `{ "success": true, "count": N }`
**Response `500`:** `{ "error": "..." }` (erro da camada de documento) ou `{ "error": "Failed to delete drawings." }`
**Evento WS:** `drawing.cleared` (payload `{ stageId }`; nenhum evento por desenho é enviado)
