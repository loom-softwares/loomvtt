# Fog Reveals (Névoa Revelada)

## Endpoints

**Base:** `/api/fog-reveals`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em `DELETE /stage/:stageId`)

---

### GET `/stage/:stageId/user/:userId`

Busca áreas exploradas de um andar (query `?levelId=`, máximo 64 caracteres, vazio para cena sem andares).

- O registro lido depende do `fogExplorationMode` da stage: no modo `shared` o registro do pool compartilhado (`userId: 'shared'`) é retornado para todos. Caso contrário, um GM pode ler qualquer `:userId`; um jogador sempre recebe o próprio registro, qualquer que seja o `:userId` no caminho.
- `404` `{ "error": "Stage not found" }` se a stage não existir.

**Response `200`:** Fog reveal record ou `{ "explored": [] }` se ainda não houver registro.

---

### POST `/`

Adiciona áreas exploradas de uma stage e andar. O registro é indexado por `stageId` + `levelId` + o dono: no modo `shared` o dono é `'shared'` para todos; caso contrário, é o próprio ID do usuário que fez a chamada. Os polígonos são mesclados com os já salvos (duplicatas são descartadas por uma assinatura dos pontos).

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `stageId` | `string` | **sim** | |
| `newPolygons` | `array` | não | Entrada preferida: os novos polígonos. Usada quando é um array não vazio. |
| `explored` | `array` | não (default `[]`) | Entrada alternativa quando `newPolygons` está vazio ou ausente. |
| `levelId` | `string` | não (default vazio) | O andar onde os polígonos foram explorados: cada andar guarda o seu registro. |
| `userId` | — | ignorado | Vem do token de auth em vez disso — um `userId` mandado pelo cliente permitiria um jogador sobrescrever a névoa de outro, então o valor do body nunca é usado. |

**Response `201`:** Registro criado (primeira revelação desse dono/stage/andar).
**Response `200`:** `{ "id", "stageId", "userId", "levelId", "newPolygons" }`, onde `newPolygons` é o delta recebido nesta requisição (o registro salvo não é retornado).
**Response `400`:** `{ "error": "stageId and authenticated user are required" }`, ou `{ "error": "Fog exploration is disabled on this stage" }` quando o modo da stage é `none`.
**Response `404`:** `{ "error": "Stage not found" }`.

**Evento WS:** `fog.updated` tanto na primeira revelação quanto nas seguintes, enviado para a sala da stage (`stage:<id>`). No modo `shared` todos da stage recebem; no modo individual só o dono e os GMs. O payload tem `newPolygons` (o delta) e `userId`.

---

### DELETE `/stage/:stageId/mine`

Limpa a exploração do próprio usuário numa stage (modo individual).

**Response `200`:** `{ "success": true }`
**Response `401`:** `{ "error": "Unauthorized" }` se não houver usuário autenticado.

**Evento WS:** `fog.reset`, enviado para a sala da stage; com `userId` no payload só esse usuário e os GMs recebem.

---

### DELETE `/stage/:stageId`

Limpa a exploração de todos os usuários numa stage. **Só GM** (`403` para os demais).

**Response `200`:** `{ "success": true }`

**Evento WS:** `fog.reset`, enviado para todos da sala da stage (sem `userId` no payload).
