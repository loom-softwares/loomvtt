# Playlists

## Endpoints

**Base:** `/api/playlists`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista playlists. `?worldId=`

---

### GET `/:id`

Busca playlist com `sounds[]`.

---

### POST `/`

Cria playlist.

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `worldId` | `string` | `'world-1'` |
| `description` | `string` | `''` |
| `imgUrl` | `string` | `''` |
| `mode` | `string` | `'sequential'` |
| `volume` | `number` | `0.5` |
| `loop` | `boolean` | `false` |
| `fadeDuration` | `number` | `2` |
| `folderId` | `string` | `''` |

**Evento WS:** `playlist.created`

---

### PUT `/:id`

Atualiza playlist.

**Evento WS:** `playlist.updated`

---

### DELETE `/:id`

Remove playlist + sons.

**Evento WS:** `playlist.deleted`

---

### GET `/:playlistId/sounds`

Lista sons da playlist.

---

### POST `/:playlistId/sounds`

Adiciona som.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `path` | `string` | **sim** | — |
| `volume` | `number` | não | `0.5` |
| `loop` | `boolean` | não | `false` |
| `fadeIn` | `number` | não | `0` |
| `fadeOut` | `number` | não | `0` |
| `sortOrder` | `number` | não | `0` |

**Evento WS:** `playlist.sound.created`

---

### PUT `/:playlistId/sounds/:id`

Atualiza som.

**Evento WS:** `playlist.sound.updated`

---

### DELETE `/:playlistId/sounds/:id`

Remove som.

**Evento WS:** `playlist.sound.deleted`
