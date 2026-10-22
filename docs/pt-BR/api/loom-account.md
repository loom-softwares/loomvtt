# Conta Loom (`/api/loom-account`)

Vínculo entre esta instalação e a conta Loom central (o site do marketplace). O vínculo é por instalação, não por mundo. O token e o refresh token ficam criptografados em `loom.config.json` (nunca uma senha).

## Endpoints

**Base:** `/api/loom-account`

---

### GET `/status`

Estado do vínculo. **Auth:** `requireAuth, requireGM` (qualquer GM de qualquer mundo desta instalação).

**Resposta `200`:**
- sem vínculo: `{ "connected": false }`
- com vínculo: `{ "connected": true, "accountId", "role": "comprador" | "editora" | "admin", "displayName", "avatarUrl", "stale": boolean }`. `stale` é `true` quando o vínculo foi verificado pela última vez há mais de 7 dias. Não desconecta a conta.

---

### POST `/connect-google`

Vincula a conta a partir do popup OAuth. **Auth:** `requireAdmin` (cookie de admin do Setup Hub): `401` sem token válido, `403` `{ "error": "Admin access required" }` para token que não é de admin.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `exchangeCode` | `string` | **sim** | Código de uso único devolvido pelo popup do site. O servidor o confirma com o site; o cliente nunca envia o id da conta nem o token |
| `refreshToken` | `string` | não | Refresh token opcional |

**Resposta `200`:** `{ "ok": true }`
**Resposta `400`:** `{ "error": "exchangeCode e obrigatorio" }`, ou o motivo da recusa dado pelo site (`{ "error": "<motivo>" }`)
**Resposta `500`:** `{ "error": "Falha ao conectar" }`

---

### POST `/disconnect`

Remove o vínculo. **Auth:** `requireAdmin`. **Resposta `200`:** `{ "ok": true }`
