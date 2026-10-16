# Journals (Diários)

Multi-page support. Cada journal tem um array de `pages`.

## JournalPage

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | UUID |
| `name` | `string` | Nome da página |
| `content` | `string` | HTML sanitizado (`text`) ou fonte Markdown (`markdown`) |
| `type` | `string` | `'text'`, `'markdown'`, `'image'`, `'pdf'`, `'video'`, `'audio'` ou `'index'` |
| `src` | `string` | Arquivo local ou URL HTTP(S), usado por imagem, PDF, áudio e vídeo |
| `categoryId` | `string?` | Categoria da página; ausente para páginas sem categoria |
| `index` | `object?` | Dados de uma página `index`: título, subtítulo, descrição e cards com destino de página |
| `theme` | `string?` | Tema específico da página; substitui o tema padrão do diário |
| `themeVars` | `object?` | Valores das variáveis de cor do tema específico |
| `sort` | `number` | Ordem |

### Conteúdo e aparência

- `text` usa o editor rico e aceita HTML sanitizado.
- `markdown` guarda Markdown e o cliente o renderiza com GFM; não envie HTML não confiável.
- `image`, `pdf`, `video` e `audio` usam `src`. Para vídeo e áudio, use arquivo local ou URL HTTP(S); links reconhecidos do YouTube e Vimeo podem ser exibidos pelo cliente.
- `index` é uma página de navegação. Cada card aponta para uma página pelo seu ID.
- O tema padrão fica em `flags.theme` e os valores de cor em `flags.themeVars`. O cliente inclui `newspaper`, `parchment`, `gazette`, `letter` e `dossier`; uma página pode definir `theme` e `themeVars` próprios.

## Endpoints

**Base:** `/api/journals`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista journals. `?worldId=`. Usuários não-GM veem só o que têm acesso.

**Response `200`:** `JournalsDocument[]`

---

### GET `/:id`

Busca journal por ID.

**Response `200`:** Journal

---

### POST `/`

Cria journal com página inicial.

**Request body:**

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `worldId` | `string` | `'world-1'` |
| `content` | `string` | `''` |
| `pages` | `JournalPage[]` | Uma página inicial de texto quando omitido |
| `categories` | `JournalCategory[]` | `[]` |
| `flags` | `object` | `{}`; use `theme` e `themeVars` para o tema padrão |
| `folderId` | `string` | `''` |
| `isPinned` | `boolean` | `false` |
| `pinX` | `number` | `0` |
| `pinY` | `number` | `0` |

**Response `201`:** Journal criado
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**Evento WS:** `journal.created`

---

### PUT `/:id`

Atualiza journal. Só os campos abaixo são copiados. `ownership` e `flags` só podem ser alterados pelo GM.
`flags` é mesclado aos flags existentes, não substituído.

**Request body:** `name`, `content`, `pages`, `categories`, `folderId`, `isPinned`, `pinX`, `pinY`, `ownership`, `flags`.

**Response `200`:** Journal atualizado
**Response `400`:** `{ "error": "No valid fields provided for update." }` quando nenhum campo é enviado, ou `{ "error": "Pages must be an array" }`
**Response `403`:** `{ "error": "Access denied" }`, `{ "error": "Only the Gamemaster can change ownership." }` ou `{ "error": "Only the Gamemaster can change flags." }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**Evento WS:** `journal.updated`

---

### POST `/:id/pages`

Adiciona página.

**Request body:** `{ "name" (obrigatório), "content", "type", "src", "categoryId" }`

`type` tem default `'text'`; qualquer valor fora da lista acima recebe `400`.

**Response `201`:** Página criada (o objeto da página, não o journal)
**Response `400`:** `{ "error": "Unsupported page type" }` ou `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**Evento WS:** `journal.updated`

---

### POST `/:id/pages/:pageId/push`

Exige GM. Abre a página nos clientes-alvo em tempo real.

**Request body:** `{ "targetUserIds"?: string[] }`. Omitir ou enviar `null` envia para todos os jogadores da mesa.

**Response `200`:** `{ "ok": true }`
**Evento WS:** `display.push`

---

### PUT `/:id/pages/:pageId`

Atualiza página.

Campos copiados do body: `name`, `content`, `categoryId`, `index`, `theme`, `themeVars`, `src`.

**Response `200`:** Página atualizada (o objeto da página, não o journal)
**Response `404`:** `{ "error": "Page not found" }`
**Evento WS:** `journal.updated`

---

### DELETE `/:id/pages/:pageId`

Remove página. As páginas restantes são renumeradas em `sort`. Um `pageId` desconhecido não é tratado como erro.

**Response `200`:** `{ "success": true }`
**Evento WS:** `journal.updated`

---

### POST `/:id/categories`

Adiciona uma categoria de página. Exige GM ou permissão de edição no journal.

**Request body:** `{ "name": "..." }`

**Response `201`:** Categoria criada (`{ id, name, sort }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**Evento WS:** `journal.updated`

---

### PUT `/:id/categories/:categoryId`

Renomeia/reordena uma categoria.

**Request body:** `{ "name"?: "...", "sort"?: number }`

**Response `200`:** Categoria atualizada
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }` / `{ "error": "Category not found" }`
**Evento WS:** `journal.updated`

---

### DELETE `/:id/categories/:categoryId`

Remove uma categoria. Páginas naquela categoria voltam a ficar sem categoria (`categoryId` limpo).

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Journal entry not found" }`
**Evento WS:** `journal.updated`

---

### DELETE `/:id`

Remove journal.

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `journal.deleted`
