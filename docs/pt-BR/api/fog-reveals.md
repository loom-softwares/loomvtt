# Fog Reveals (Névoa Revelada)

## Endpoints

**Base:** `/api/fog-reveals`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em `DELETE /stage/:stageId`)

---

### GET `/stage/:stageId/user/:userId`

Busca áreas exploradas de um usuário numa stage.

**Response `200`:** Fog reveal record ou `{ "explored": [] }`

---

### POST `/`

Cria ou atualiza as áreas exploradas do usuário autenticado numa stage (upsert, com chave
`stageId` + o ID do próprio usuário que fez a chamada).

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `stageId` | `string` | **sim** | |
| `explored` | `array` | não (default `[]`) | |
| `userId` | — | ignorado | Vem do token de auth em vez disso — um `userId` mandado pelo cliente permitiria um jogador sobrescrever a névoa de outro, então o valor do body nunca é usado. |

**Response `201`:** Registro criado (primeira revelação desse usuário/stage)
**Response `200`:** Registro atualizado (usuário/stage já existia)
**Response `400`:** `{ "error": "stageId and authenticated user are required" }`
**Evento interno:** Signal `fog.created` (primeira vez) ou `fog.updated` (demais vezes) — server-side, **não relayado** para WebSocket (veja [websocket/events.md](../websocket/events.md))

---

### DELETE `/stage/:stageId`

Limpa a exploração de todos os usuários numa stage. **Só GM.**

**Evento interno:** Signal `fog.reset` (server-side, **não relayado** para WebSocket — veja [websocket/events.md](../websocket/events.md))
