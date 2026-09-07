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

**Response `200`:** Tunnel status

---

### POST `/stop`

Stops the tunnel.

**Response `200`:** Tunnel status

---

### GET `/status`

Returns the current tunnel status.

**Response `200`:**
```json
{
  "active": true,
  "url": "https://my-tunnel.trycloudflare.com",
  "mode": "quick",
  "pid": 12345
}
```

---

## Panel

Accessible via `AppConfigWindow` (Setup Hub → gear → Application Configuration → "External Access"). The `cloudflared-tunnel-window.ts` window manages the tunnel.

## Persistence

`tunnelMode` and `tunnelName` are saved in `loom.config.json`.

## URL in sharing points

- "Invite Links" Window — "Tunnel (Internet)" section
- World Login Screen — "External Link" field (only visible to admin)
