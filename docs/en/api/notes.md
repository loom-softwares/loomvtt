# Notes (Map Notes)

## Endpoints

**Base:** `/api/notes`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lists notes of a stage.

---

### POST `/`

Creates note.

| Field | Type | Required |
|-------|------|-------------|
| `stageId` | `string` | **yes** |
| `journalId` | `string` | no |
| `levelId` | `string` | no |
| `x` | `number` | no |
| `y` | `number` | no |
| `visibleToPlayers` | `boolean` | no |

**WS Event:** `note.created`

---

### PUT `/:id`

Updates note.

**WS Event:** `note.updated`

---

### DELETE `/:id`

Removes note.

**WS Event:** `note.deleted`
