# Media

Lets the GM show one image or video (character art, token art) to the whole table or to chosen players. The
client opens the received media in a read-only viewer window (`Loom.openMediaViewer`).

## Endpoints

**Base:** `/api/media`
**Auth:** `requireAuth, requireWorldMatch` (the push itself is GM only)

---

### POST `/push`

Shows a media file to players. Nothing is stored; the server only validates the path and broadcasts it.

**Request body:**
```json
{ "src": "/worlds/my-world/assets/tokens/hero-1a2b3c4d.Portrait.webp", "title": "Amaso Nomura", "targetUserIds": ["user-1", "user-2"] }
```

| Field | Type | Description |
|-------|------|-------------|
| `src` | `string` | Same-origin path to an image or video (`png`, `jpg`, `webp`, `gif`, `avif`, `svg`, `webm`, `mp4`, `m4v`, `ogv`, `mov`), optionally with `?v=<number>`. No `..`, no `//`, no query other than `v` |
| `title` | `string?` | Window title, cut to 200 characters |
| `targetUserIds` | `string[]?` | Players to show it to (up to 200). Omitted or `null` means everyone at the table |

**Response `200`:** `{ "ok": true }`
**Response `400`:** `{ "error": "Invalid media path" }` or `{ "error": "No active world" }`
**Response `403`:** `{ "error": "Only the GM can share media with players" }`
**WS Event:** `display.media` with `{ worldId, src, title, targetUserIds }`
