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

O route não valida `severity`, `category` nem `status`: qualquer string é gravada.

## Autenticação

Todas as rotas exigem `requireAuth` + `requireWorldMatch` (ver
`server/applications/api/bug-reports.ts:11`). As rotas do GitHub também exigem o GM (ver abaixo). `PUT` e `DELETE` também exigem quem reportou, um GM ou uma sessão admin (ver abaixo).

## Endpoints

### `GET /api/bug-reports?worldId=:worldId`

Lista todos os bug reports de um mundo, ordenados por `createdAt DESC`.

**Response `400`:** `{ "error": "worldId is required" }` se o query param estiver faltando

### `GET /api/bug-reports/:id`

Retorna um bug report especifico.

**Response `404`:** `{ "error": "Bug report not found" }`

### `GET /api/bug-reports/status/github`

Retorna `{ "configured": true }` ou `{ "configured": false }`: se a sincronização com GitHub Issues está configurada no servidor.

### `POST /api/bug-reports`

Cria um novo bug report (`201`, retorna o report).

**Validação e limites:**
- `title` e `worldId` são obrigatórios (`400`). `title` tem no máximo 200 caracteres e `description` no máximo 20.000 (`400`).
- Cada usuário pode criar no máximo 5 reports por hora (`429`: `{ "error": "Too many bug reports, please try again later." }`).
- `syncToGithub` só é considerado para o GM ou a sessão admin. Para os demais é ignorado e o report é criado só localmente.
- `reporterId` é o usuário logado (`"gm"` quando não há).

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

### `POST /api/bug-reports/:id/github`

Só GM (`requireGM`: `403` `{ "error": "Gamemaster permission required" }` caso contrário). Publica o report como issue no GitHub e grava `githubIssueNumber` e `githubIssueUrl` no `metadata`. Retorna o report atualizado (`200`). Se o report já foi publicado, retorna `{ "message": "Bug ja publicado no GitHub", "data": <report> }` e não cria nada. `404` quando o report não existe; `500` quando a chamada ao GitHub falha.

### `PUT /api/bug-reports/:id`

Atualiza um bug report. Campos opcionais: `title`, `description`, `severity`, `category`, `status`.

Só quem reportou (o `reporterId` do report), um GM ou uma sessão admin pode atualizar um report.

**Response `200`:** o report atualizado
**Response `403`:** `{ "error": "Only the reporter or a GM can change this report" }` para qualquer outro usuário
**Response `404`:** `{ "error": "Bug report not found" }` quando o id não existe; também retornado quando a própria atualização falha

### `DELETE /api/bug-reports/:id`

Remove um bug report. Mesma regra de permissão do PUT.

**Response `200`:** `{ "success": true }`
**Response `403`:** `{ "error": "Only the reporter or a GM can change this report" }` para qualquer outro usuário
**Response `404`:** `{ "error": "Bug report not found" }` quando o id não existe; também retornado quando a própria remoção falha

## Eventos internos

São chamadas `Signal.broadcast` do lado do servidor, **não relayadas pra clientes WebSocket**. A camada Document também emite `bug_reports.created|updated|deleted` (nome da tabela), que também não é relayado.

| Signal | Payload | Descricao |
|--------|---------|-----------|
| `bug-report.created` | Bug report completo | Bug report criado |
| `bug-report.updated` | Bug report completo | Bug report atualizado |
| `bug-report.deleted` | `{ id }` | Bug report removido |
