# OBS Stream Views (`/api/stream`)

Bootstrap of the view-only sessions used by the OBS Browser Source capture views (`/?capture=canvas&setup=<code>` and `/?capture=chat&setup=<code>`). OBS cannot use the login form, so a GM generates one-time codes and each Browser Source exchanges its code for a session cookie on the first load. For the revocable links of the table/spectator display, see [display.md](display.md).

## Endpoints

**Base:** `/api/stream`

---

### POST `/link`

Generates two one-time setup codes, one per Browser Source (sharing one code would burn it on whichever view loads first). **Auth:** `requireAuth, requireGM`. Codes live in server memory only (hashed), so a server restart invalidates every code not yet exchanged.

**Request body:** none.

**Response `200`:** `{ "canvasCode": "<string>", "chatCode": "<string>", "expiresInSeconds": 300 }`
**Response `400`:** `{ "error": "No active world session" }`

---

### POST `/exchange`

Burns a code and sets the view-only session cookie (`loom_world_token`, 30 days). **Auth:** none (public on purpose). Limited to 10 attempts per minute per client.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | **yes** | A `canvasCode` or `chatCode` from `POST /link` |

**Response `200`:** `{ "ok": true }`
**Response `400`:** `{ "error": "Código inválido ou expirado." }` (unknown, already used, or older than 5 minutes)
**Response `404`:** `{ "error": "Mundo não encontrado." }`
**Response `429`:** `{ "error": "Too many attempts, please try again later." }`

The session belongs to a synthetic user (`stream-<random>`, name `Streamer`, role 1, `kind: "stream"`) with no row in `users`. The server only lets view-only sessions make read requests (`enforceViewOnlySession`).
