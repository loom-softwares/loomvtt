# Views de OBS (`/api/stream`)

Bootstrap das sessões somente-leitura usadas pelas views de captura do OBS Browser Source (`/?capture=canvas&setup=<código>` e `/?capture=chat&setup=<código>`). O OBS não consegue usar o formulário de login, então o GM gera códigos de uso único e cada Browser Source troca o seu código por um cookie de sessão no primeiro carregamento. Para os links revogáveis de mesa/espectador, ver [display.md](display.md).

## Endpoints

**Base:** `/api/stream`

---

### POST `/link`

Gera dois códigos de uso único, um por Browser Source (compartilhar um código queimaria ele na view que carregasse primeiro). **Auth:** `requireAuth, requireGM`. Os códigos ficam só na memória do servidor (com hash), então reiniciar o servidor invalida todo código ainda não trocado.

**Body:** nenhum.

**Resposta `200`:** `{ "canvasCode": "<string>", "chatCode": "<string>", "expiresInSeconds": 300 }`
**Resposta `400`:** `{ "error": "No active world session" }`

---

### POST `/exchange`

Queima um código e define o cookie de sessão somente-leitura (`loom_world_token`, 30 dias). **Auth:** nenhuma (pública de propósito). Limitada a 10 tentativas por minuto por cliente.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `code` | `string` | **sim** | Um `canvasCode` ou `chatCode` de `POST /link` |

**Resposta `200`:** `{ "ok": true }`
**Resposta `400`:** `{ "error": "Código inválido ou expirado." }` (desconhecido, já usado ou com mais de 5 minutos)
**Resposta `404`:** `{ "error": "Mundo não encontrado." }`
**Resposta `429`:** `{ "error": "Too many attempts, please try again later." }`

A sessão pertence a um usuário sintético (`stream-<aleatório>`, nome `Streamer`, role 1, `kind: "stream"`) sem linha em `users`. O servidor só deixa sessões somente-leitura fazerem requisições de leitura (`enforceViewOnlySession`).
