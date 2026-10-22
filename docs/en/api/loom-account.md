# Loom Account (`/api/loom-account`)

Link between this installation and the central Loom account (the marketplace site). The link is per installation, not per world. The token and refresh token are stored encrypted in `loom.config.json` (never a password).

## Endpoints

**Base:** `/api/loom-account`

---

### GET `/status`

Link state. **Auth:** `requireAuth, requireGM` (any GM of any world on this installation).

**Response `200`:**
- not linked: `{ "connected": false }`
- linked: `{ "connected": true, "accountId", "role": "comprador" | "editora" | "admin", "displayName", "avatarUrl", "stale": boolean }`. `stale` is `true` when the link was last verified more than 7 days ago. It does not disconnect the account.

---

### POST `/connect-google`

Links the account from the OAuth popup. **Auth:** `requireAdmin` (Setup Hub admin cookie): `401` without a valid token, `403` `{ "error": "Admin access required" }` for a non-admin token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exchangeCode` | `string` | **yes** | Single-use code returned by the site popup. The server confirms it with the site; the client never supplies the account id or token |
| `refreshToken` | `string` | no | Optional refresh token |

**Response `200`:** `{ "ok": true }`
**Response `400`:** `{ "error": "exchangeCode e obrigatorio" }`, or the refusal reason given by the site (`{ "error": "<reason>" }`)
**Response `500`:** `{ "error": "Falha ao conectar" }`

---

### POST `/disconnect`

Removes the link. **Auth:** `requireAdmin`. **Response `200`:** `{ "ok": true }`
