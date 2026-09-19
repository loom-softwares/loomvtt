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

- `text` usa o editor rico; `markdown` é renderizado com GFM.
- `image`, `pdf`, `video` e `audio` usam `src`; vídeos e áudios aceitam arquivo local ou URL HTTP(S).
- `index` cria cards de navegação entre páginas.
- O tema padrão fica em `flags.theme` e `flags.themeVars`; páginas podem sobrescrevê-lo.

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
**Evento WS:** `journal.created`

---

### PUT `/:id`

Atualiza journal.

**Response `200`:** Journal atualizado
**Evento WS:** `journal.updated`

---

### POST `/:id/pages`

Adiciona página.

**Request body:** `{ "name" (obrigatório), "content", "type", "src", "categoryId" }`

**Response `201`:** Página criada
**Evento WS:** `journal.updated`

---

### POST `/:id/pages/:pageId/push`

Exige GM. Abre a página nos clientes-alvo em tempo real.

**Request body:** `{ "targetUserIds"?: string[] }`. Omitir ou enviar `null` envia para todos os jogadores.

**Response `200`:** `{ "ok": true }`
**Evento WS:** `display.push`

---

### PUT `/:id/pages/:pageId`

Atualiza página.

**Response `200`:** Página atualizada
**Evento WS:** `journal.updated`

---

### DELETE `/:id/pages/:pageId`

Remove página.

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
