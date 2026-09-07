# Playlists

## Endpoints

**Base:** `/api/playlists`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists playlists. `?worldId=`

---

### GET `/:id`

Fetches playlist with `sounds[]`.

---

### POST `/`

Creates playlist.

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `worldId` | `string` | `'world-1'` |
| `description` | `string` | `''` |
| `imgUrl` | `string` | `''` |
| `mode` | `string` | `'sequential'` |
| `volume` | `number` | `0.5` |
| `loop` | `boolean` | `false` |
| `fadeDuration` | `number` | `2` |
| `folderId` | `string` | `''` |

**WS Event:** `playlist.created`

---

### PUT `/:id`

Updates playlist.

**WS Event:** `playlist.updated`

---

### DELETE `/:id`

Removes playlist + sounds.

**WS Event:** `playlist.deleted`

---

### GET `/:playlistId/sounds`

Lists playlist sounds.

---

### POST `/:playlistId/sounds`

Adds sound.

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** | — |
| `path` | `string` | **yes** | — |
| `volume` | `number` | no | `0.5` |
| `loop` | `boolean` | no | `false` |
| `fadeIn` | `number` | no | `0` |
| `fadeOut` | `number` | no | `0` |
| `sortOrder` | `number` | no | `0` |

**WS Event:** `playlist.sound.created`

---

### PUT `/:playlistId/sounds/:id`

Updates sound.

**WS Event:** `playlist.sound.updated`

---

### DELETE `/:playlistId/sounds/:id`

Removes sound.

**WS Event:** `playlist.sound.deleted`
