# Chat Messages

## Endpoints

**Base:** `/api/chat-messages`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Histórico recente de chat do mundo, da mais antiga para a mais nova. Usado na reconexão para recuperar mensagens perdidas.

**Query:** `?worldId=` (obrigatório se a sessão for de admin sem worldId no token), `?limit=` (default `50`, limitado a `1`–`100`)

**Response `200`:** lista de mensagens (os mesmos campos do Schema abaixo), passadas por `projectChatHistory` conforme o papel de quem vê
**Response `400`:** `{ "error": "worldId is required" }`
**Response `500`:** `{ "error": "..." }`

---

### PUT `/:id/roll`

Substitui o `roll` de uma mensagem já postada (usado por mecânicas que editam o cartão no lugar). Dono da mensagem ou GM.

**Query:** `?worldId=` (mesma regra acima)

**Request body:** `{ "roll": { ... } }` (obrigatório)

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "worldId is required" }` / `{ "error": "roll is required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Message not found" }`
**Evento WS:** `chat.messageUpdated` (payload: `{ id, worldId, roll, userId }`)

---

### PUT `/:id/flags`

Merge-patch de flags em uma mensagem de chat.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `scope` | `string` | **sim** | Escopo da flag (ex: `'my-addon'`) |
| `key` | `string` | **sim** | Nome da flag |
| `value` | `any` | não (não validado) | Valor a ser definido |

**Response `200`:** `{ "flags": { ... } }`
**Response `400`:** `{ "error": "worldId is required" }` / `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }`
**Response `404`:** `{ "error": "Message not found" }`
**Nota:** não há verificação de dono nem de GM: qualquer usuário logado do mundo pode alterar as flags de qualquer mensagem. Nenhum evento WS é enviado.

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

Não existe endpoint REST de criação (`POST`). A criação é 100% via WebSocket. O client envia um evento `message` com `{ type: 'chat.message', data }`:

```typescript
wsClient.send('chat.message', {
  content,
  speaker, // opcional
  flags,   // opcional
});
```

O servidor pega o `worldId` e o remetente (`userId`, `userName`, `userColor`) do token do socket, não do payload, e limita a taxa de envio por remetente. Ele insere a linha e faz broadcast de `chat.message` para o mundo com `{ id, userId, userName, userColor, type, content, speaker, flags, createdAt, worldId }`. Rolagens de dados usam o tipo de mensagem separado `chat.roll`.

No client, `ChatMessage.create(data)` (`client/main.ts`) encapsula esse envio — fire-and-forget, não espera round-trip antes de resolver.
