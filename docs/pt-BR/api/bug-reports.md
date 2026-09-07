# Bug Reports

Sistema de reporte de bugs interno. Acessivel via botao "Bug Tracker" no painel de Gestao do GM.

## Schema

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `id` | `string` | UUID | Identificador unico |
| `worldId` | `string` | — | Mundo (**obrigatorio**) |
| `title` | `string` | — | Titulo (**obrigatorio**) |
| `description` | `string` | `''` | Descricao detalhada |
| `severity` | `string` | `'medium'` | Severidade (`low`, `medium`, `high`, `critical`) |
| `category` | `string` | `'other'` | Categoria (`ui`, `mechanics`, `performance`, `network`, `other`) |
| `status` | `string` | `'open'` | Status (`open`, `in-progress`, `resolved`, `closed`) |
| `reporterId` | `string` | — | ID do usuario que reportou |
| `metadata` | `object` | `{}` | Metadados extras |
| `createdAt` | `string` | — | Timestamp de criacao |
| `updatedAt` | `string` | — | Timestamp de atualizacao |

## Autenticação

Todas as rotas exigem `requireAuth` + `requireWorldMatch` (ver
`server/applications/api/bug-reports.ts:6,9`).

## Endpoints

### `GET /api/bug-reports?worldId=:worldId`

Lista todos os bug reports de um mundo, ordenados por `createdAt DESC`.

**Response `400`:** `{ "error": "worldId is required" }` se o query param estiver faltando

### `GET /api/bug-reports/:id`

Retorna um bug report especifico.

### `POST /api/bug-reports`

Cria um novo bug report.

**Body:**

```json
{
  "worldId": "world-1",
  "title": "Botao de save nao funciona",
  "description": "Ao clicar em salvar...",
  "severity": "high",
  "category": "ui"
}
```

### `PUT /api/bug-reports/:id`

Atualiza um bug report. Campos opcionais: `title`, `description`, `severity`, `category`, `status`.

### `DELETE /api/bug-reports/:id`

Remove um bug report.

## Eventos internos

São chamadas `Signal.broadcast` do lado do servidor, **não relayadas pra clientes WebSocket**.

| Signal | Payload | Descricao |
|--------|---------|-----------|
| `bug-report.created` | Bug report completo | Bug report criado |
| `bug-report.updated` | Bug report completo | Bug report atualizado |
| `bug-report.deleted` | `{ id }` | Bug report removido |
