# Chat Messages

## Endpoints

**Base:** `/api/chat-messages`
**Auth:** `requireAuth, requireWorldMatch`

---

### PUT `/:id/flags`

Merge-patch de flags em uma mensagem de chat.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `scope` | `string` | **sim** | Escopo da flag (ex: `'my-addon'`) |
| `key` | `string` | **sim** | Nome da flag |
| `value` | `any` | **sim** | Valor a ser definido |

**Response `200`:** `{ "flags": { ... } }`

---

### DELETE `/:id`

Remove uma mensagem. Dono da mensagem ou GM.

**Query:** `?worldId=` (obrigatório se a sessão for de admin sem worldId no token)

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `403`:** mensagem de outro mundo, ou não é dono nem GM
**Response `404`:** mensagem não encontrada
**Evento WS:** `chat.messageDeleted`

---

### DELETE `/`

Limpa o histórico de chat do mundo inteiro. GM only.

**Query:** `?worldId=` (obrigatório)

**Response `200`:** `{ "success": true, "count": number }`
**Response `403`:** `{ "error": "Only the GM can clear the whole chat" }`
**Evento WS:** `chat.cleared`

---

## Schema

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador único |
| `worldId` | `string` | Mundo |
| `userId` | `string` | Remetente |
| `userName` | `string` | Nome do remetente |
| `userColor` | `string` | Cor do remetente |
| `type` | `string` | Tipo (`chat`, `roll`, etc.) |
| `content` | `string` | Conteúdo da mensagem |
| `rollData` | `object` | Dados de rolagem (se type=roll) |
| `flags` | `object` | Flags arbitrárias (scope → key → value) |
| `speaker` | `object` | Dados do speaker |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

## Criação de mensagem

Não existe endpoint REST de criação (`POST`). A criação é 100% via WebSocket:

```typescript
wsClient.send('chat.message', {
  worldId,
  userId,
  content,
  speaker, // opcional
});
```

O servidor insere a linha e faz `broadcastToWorld('chat.message', worldId, {...})`.

No client, `ChatMessage.create(data)` (`client/main.ts`) encapsula esse envio — fire-and-forget, não espera round-trip antes de resolver.
