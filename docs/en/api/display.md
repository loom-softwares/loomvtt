# API: Displays & Physical Table (`/api/display`)

Management of revocable read-only display links for OBS Browser Source, physical gaming tables (horizontal TVs and projectors), secondary monitors, and remote spectators.

---

## Endpoints

### `GET /api/display/links`

Lists all display links generated for the active world and discovers local network IP addresses.

- **Permission**: GM authenticated in the active world session (`requireAuth`, `requireWorldMatch`, `requireGM`).
- **Response `200`**:
  ```json
  {
    "links": [
      {
        "id": "uuid-v4",
        "worldId": "world-1",
        "token": "a1b2c3d4e5f6...",
        "name": "Living Room TV",
        "mode": "physical",
        "config": {
          "showGrid": false,
          "showTokens": "none",
          "rotation": 90,
          "transparentBg": false,
          "showChat": false
        },
        "expiresAt": null,
        "isRevoked": false,
        "isExpired": false,
        "createdAt": "2026-09-20T21:00:00.000Z",
        "updatedAt": "2026-09-20T21:00:00.000Z"
      }
    ],
    "localIps": ["192.168.1.15"]
  }
  ```

---

### `POST /api/display/links`

Generates a new display link with a secure 24-byte cryptographic token (`crypto.randomBytes(24)`).

- **Permission**: GM authenticated in the active world session. `400` if there is no active world session.
- **Defaults**: `name` → `"Display Link"`, `mode` → `"table"`, `config` → `{}`. `mode` is stored as sent (no validation). `expiresInSeconds` must be a positive number to set an expiry; otherwise `expiresAt` is `null` (no expiry).
- **Request Body**:
  ```json
  {
    "name": "TV Physical Table",
    "mode": "physical",
    "config": {
      "showGrid": false,
      "showTokens": "none",
      "rotation": 90,
      "transparentBg": false,
      "showChat": false
    },
    "expiresInSeconds": 28800
  }
  ```
- **Config Properties** (the server stores `config` as sent, as JSON; the values below are the intended options and are not validated):
  - `showGrid` (`boolean`): Toggles the canvas grid visibility (useful when using physical dry-erase/acrylic grids).
  - `showTokens` (`'all' | 'npcs_only' | 'none'`): Controls virtual token visibility (useful to set `'none'` when using physical plastic/metal miniatures on top of the TV screen).
  - `rotation` (`0 | 90 | 180 | 270`): Rotates the canvas for horizontal TVs laid flat on the table.
  - `transparentBg` (`boolean`): Enables alpha transparency for OBS Studio browser sources.
  - `showChat` (`boolean`): Displays a subtle floating chat/roll overlay.
- **Errors**: `500` with `{ "error": "<message>" }` if the save fails.
- > CODE ISSUE: `config` and `mode` are not validated in `server/applications/api/display.ts` (`POST /links`), so any value is accepted and stored.
- **Response `201`**:
  ```json
  {
    "success": true,
    "link": { ... },
    "localIps": ["192.168.1.15"]
  }
  ```

---

### `DELETE /api/display/links/:id`

Revokes a display link immediately.

- **Permission**: GM authenticated in the active world session.
- **Effect**:
  - Sets `isRevoked = true` in the world database and invalidates the display link cache for that id.
  - Emits real-time WebSocket broadcast (`display.revoked`, payload `{ linkId, token, worldId }`).
  - Connected displays using this token show the revocation overlay (`client/screens/game-hud/game-hud.ts`).
- **Response `200`**:
  ```json
  { "success": true, "message": "Link revogado com sucesso." }
  ```
- **Errors**: `404` with `{ "error": "Link de display não encontrado." }` if the id does not exist or belongs to another world.

---

### `GET /api/display/verify/:token`

Verifies a public display link token, establishes a view-only session cookie, and returns presentation settings.

- **Permission**: Public (no prior login required).
- **Effect**:
  - Checks if the token exists, is not revoked, and is not expired.
  - Issues a `WORLD_COOKIE` session cookie bound to an isolated virtual viewer session (`userId: display-${link.id}`, `isDisplay: true`, role 1, read-only) without inserting database user rows or polluting the login screen. It also deletes any legacy `Display Viewer` user row of that world.
- **Response `200`**:
  ```json
  {
    "valid": true,
    "linkId": "uuid-v4",
    "token": "a1b2c3d4e5f6...",
    "name": "Living Room TV",
    "mode": "physical",
    "config": {
      "showGrid": false,
      "showTokens": "none",
      "rotation": 90,
      "transparentBg": false,
      "showChat": false
    },
    "worldId": "world-1",
    "worldName": "Main Campaign",
    "activeStageId": "stage-1",
    "session": { "userId": "display-uuid-v4", "userName": "Living Room TV", "userRole": 1, "userColor": "#6366f1", "worldId": "world-1", "isDisplay": true, "kind": "display", "displayId": "uuid-v4" }
  }
  ```
- **Errors**:
  - `404` with `code: 'NOT_FOUND'` if the token is not found.
  - `404` with `code: 'WORLD_NOT_FOUND'` if the link's world no longer exists.
  - `403` with `code: 'REVOKED'` if revoked by the GM.
  - `403` with `code: 'EXPIRED'` if the expiration window has passed.
