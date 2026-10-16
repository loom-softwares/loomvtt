# Cloudflare Tunnel

## Endpoints

**Base:** `/api/tunnel`
**Auth:** `requireAdminSession` (server scope, not world scope)

---

### POST `/start`

Starts the Cloudflare tunnel.

**Request body:**

| Field | Type | Required | Description |
|-------|------|-------------|-----------|
| `mode` | `string` | **yes** | `'quick'` (temporary) or `'named'` (fixed name) |
| `name` | `string` | no | Tunnel name (required if mode=`named`) |

A `quick` tunnel waits up to 15 seconds for cloudflared to print its `trycloudflare.com` URL. A `named` tunnel runs `cloudflared tunnel run <name>` and returns `url: null`, because the URL is the user's own domain. Starting while a tunnel is running stops the old one first.

**Response `200`:** Tunnel status (see `GET /status`)
**Response `400`:** `{ "error": "Invalid mode. Must be \"quick\" or \"named\"." }`
**Response `500`:** `{ "error": "..." }` when cloudflared is not installed, when `named` is used without a `name`, or when the quick URL does not appear in 15 seconds

---

### POST `/stop`

Stops the tunnel (SIGTERM to cloudflared) and saves `tunnelMode: "off"`.

**Response `200`:** Tunnel status (see `GET /status`)
**Response `500`:** `{ "error": "..." }`

---

### GET `/status`

Returns the current tunnel status.

**Response `200`:**
```json
{
  "running": true,
  "mode": "quick",
  "url": "https://my-tunnel.trycloudflare.com"
}
```

`mode` is `"off"` and `url` is `null` when no tunnel is running. `running` is `false` when the cloudflared process has exited.

---

### Errors on every route

`401` `{ "error": "Admin session required" }` (no admin cookie) or `{ "error": "Invalid or expired token" }`; `403` `{ "error": "Admin access required" }` (valid session without admin).

### WebSocket

None. The tunnel routes emit no events.

---

## Panel

Accessible via `AppConfigWindow` (Setup Hub → gear → Application Configuration → "External Access"). The `cloudflared-tunnel-window.ts` window manages the tunnel.

## Persistence

`tunnelMode` and `tunnelName` are saved in `loom.config.json`.

## URL in sharing points

- "Invite Links" Window — "Tunnel (Internet)" section
- World Login Screen — "External Link" field (only for an admin session, and only while a tunnel runs with a URL, i.e. quick mode)

The Invite Links endpoint (`GET /api/worlds/:worldId/invite-links`) also returns the tunnel state, so the GM window does not call these routes.
