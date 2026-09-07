# Campaigns (Campanhas)

## Endpoints

**Base:** `/api/campaigns`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista campanhas.

---

### GET `/:id`

Busca campanha por ID.

---

### POST `/`

Cria campanha.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `name` | `string` | **sim** |
| `description` | `string` | não |
| `manifest` | `object` | não |

**Evento interno:** Signal `campaign.created` (server-side, **não relayado** para WebSocket — veja [websocket/events.md](../websocket/events.md))

---

### PUT `/:id`

Atualiza campanha.

**Evento interno:** Signal `campaign.updated` (server-side, **não relayado** para WebSocket — veja [websocket/events.md](../websocket/events.md))

---

### DELETE `/:id`

Remove campanha.

**Evento interno:** Signal `campaign.deleted` (server-side, **não relayado** para WebSocket — veja [websocket/events.md](../websocket/events.md))
