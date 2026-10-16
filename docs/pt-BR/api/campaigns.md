# Campaigns (Campanhas)

## Endpoints

**Base:** `/api/campaigns`
**Auth:** `requireAuth, requireWorldMatch`. O `GET` é aberto a todo usuário logado; `POST`, `PUT` e `DELETE` exigem GM (`requireGM`, 403 caso contrário).

---

### GET `/`

Lista campanhas, ordenadas por `createdAt` ascendente. As campanhas não pertencem a um mundo: a lista é a mesma em todos os mundos, e qualquer sessão logada vê todas.

**Response `200`:** `CampaignsDocument[]`

---

### GET `/:id`

Busca campanha por ID.

**Response `200`:** `CampaignsDocument`
**Response `404`:** `{ "error": "Campaign not found" }`

---

### POST `/`

Cria campanha. O id é gerado pelo servidor (`camp-<uuid>`). Sem verificação de permissão além da sessão.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `description` | `string` | não | `''` |
| `manifest` | `object` | não | `{}` |

**Response `201`:** a campanha criada
**Response `400`:** `{ "error": "name is required" }`

**Eventos internos:** Signal `campaign.created`, e o genérico `campaigns.created` da camada Document (server-side, **não relayados** para WebSocket — veja [websocket/events.md](../websocket/events.md))

---

### PUT `/:id`

Atualiza campanha. Body: qualquer um de `name`, `description`, `manifest`.

**Response `200`:** a campanha atualizada
**Response `404`:** retornado pra qualquer erro da atualização (não só "não encontrado")

**Eventos internos:** Signal `campaign.updated`, e o genérico `campaigns.updated` (server-side, **não relayados** para WebSocket — veja [websocket/events.md](../websocket/events.md))

---

### DELETE `/:id`

Remove campanha.

**Response `200`:** `{ "success": true }`
**Response `404`:** retornado pra qualquer erro da remoção

**Eventos internos:** Signal `campaign.deleted`, e o genérico `campaigns.deleted` (server-side, **não relayados** para WebSocket — veja [websocket/events.md](../websocket/events.md))
