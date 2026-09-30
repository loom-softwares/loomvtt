# Bug Reports

Internal bug reporting system. Accessible via the "Bug Tracker" button in the GM Management panel.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-----------|
| `id` | `string` | UUID | Unique identifier |
| `worldId` | `string` | — | World (**required**) |
| `title` | `string` | — | Title (**required**) |
| `description` | `string` | `''` | Detailed description |
| `severity` | `string` | `'medium'` | Severity (`low`, `medium`, `high`, `critical`) |
| `category` | `string` | `'other'` | Category (`ui`, `mechanics`, `performance`, `network`, `other`) |
| `status` | `string` | `'open'` | Status (`open`, `in-progress`, `resolved`, `closed`) |
| `reporterId` | `string` | — | ID of the reporting user |
| `metadata` | `object` | `{}` | Extra metadata |
| `createdAt` | `string` | — | Creation timestamp |
| `updatedAt` | `string` | — | Update timestamp |

## Authentication

All routes require `requireAuth` + `requireWorldMatch` (see
`server/applications/api/bug-reports.ts:6,9`).

## Endpoints

### `GET /api/bug-reports?worldId=:worldId`

Lists all bug reports for a world, ordered by `createdAt DESC`.

**Response `400`:** `{ "error": "worldId is required" }` if the query param is missing

### `GET /api/bug-reports/:id`

Returns a specific bug report.

### `POST /api/bug-reports`

Creates a new bug report.

**Body:**

```json
{
  "worldId": "world-1",
  "title": "Save button not working",
  "description": "When clicking save...",
  "severity": "high",
  "category": "ui"
}
```

### `PUT /api/bug-reports/:id`

Updates a bug report. Optional fields: `title`, `description`, `severity`, `category`, `status`.

### `DELETE /api/bug-reports/:id`

Removes a bug report.

## Internal Events

These are server-side `Signal.broadcast` calls, **not relayed to WebSocket clients**.

| Signal | Payload | Description |
|--------|---------|-----------|
| `bug-report.created` | Full bug report | Bug report created |
| `bug-report.updated` | Full bug report | Bug report updated |
| `bug-report.deleted` | `{ id }` | Bug report removed |