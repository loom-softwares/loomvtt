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

The route does not validate `severity`, `category` or `status`: any string is stored.

## Authentication

All routes require `requireAuth` + `requireWorldMatch` (see
`server/applications/api/bug-reports.ts:11`). The GitHub routes also require the GM (see below). `PUT` and `DELETE` also require the reporter, a GM or an admin session (see below).

## Endpoints

### `GET /api/bug-reports?worldId=:worldId`

Lists all bug reports for a world, ordered by `createdAt DESC`.

**Response `400`:** `{ "error": "worldId is required" }` if the query param is missing

### `GET /api/bug-reports/:id`

Returns a specific bug report.

**Response `404`:** `{ "error": "Bug report not found" }`

### `GET /api/bug-reports/status/github`

Returns `{ "configured": true }` or `{ "configured": false }`: whether the GitHub Issues sync is set up on the server.

### `POST /api/bug-reports`

Creates a new bug report (`201`, returns the report).

**Validation and limits:**
- `title` and `worldId` are required (`400`). `title` is at most 200 characters and `description` at most 20,000 (`400`).
- Each user can create at most 5 reports per hour (`429`: `{ "error": "Too many bug reports, please try again later." }`).
- `syncToGithub` is honored only for the GM or the admin session. For anyone else it is ignored and the report is still created locally.
- `reporterId` is the signed-in user (`"gm"` when there is none).

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

### `POST /api/bug-reports/:id/github`

GM only (`requireGM`: `403` `{ "error": "Gamemaster permission required" }` otherwise). Publishes the report as a GitHub issue and stores `githubIssueNumber` and `githubIssueUrl` in its `metadata`. Returns the updated report (`200`). If the report was already published, it returns `{ "message": "Bug ja publicado no GitHub", "data": <report> }` and creates nothing. `404` when the report does not exist; `500` when the GitHub call fails.

### `PUT /api/bug-reports/:id`

Updates a bug report. Optional fields: `title`, `description`, `severity`, `category`, `status`.

Only the reporter (the report's `reporterId`), a GM or an admin session can update a report.

**Response `200`:** the updated report
**Response `403`:** `{ "error": "Only the reporter or a GM can change this report" }` for any other user
**Response `404`:** `{ "error": "Bug report not found" }` when the id is unknown; also returned when the update itself fails

### `DELETE /api/bug-reports/:id`

Removes a bug report. Same permission rule as PUT.

**Response `200`:** `{ "success": true }`
**Response `403`:** `{ "error": "Only the reporter or a GM can change this report" }` for any other user
**Response `404`:** `{ "error": "Bug report not found" }` when the id is unknown; also returned when the delete itself fails

## Internal Events

These are server-side `Signal.broadcast` calls, **not relayed to WebSocket clients**. The Document layer also emits `bug_reports.created|updated|deleted` (the table name), which is not relayed either.

| Signal | Payload | Description |
|--------|---------|-----------|
| `bug-report.created` | Full bug report | Bug report created |
| `bug-report.updated` | Full bug report | Bug report updated |
| `bug-report.deleted` | `{ id }` | Bug report removed |