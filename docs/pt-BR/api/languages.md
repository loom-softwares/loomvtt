# Languages (Idiomas)

## Endpoints

**Base:** `/api/languages`
**Auth:** Nenhum

---

### GET `/`

Lista códigos de idioma disponíveis.

**Response `200`:** `["en", "pt-BR", ...]`

---

### GET `/:lang`

Retorna dicionário de tradução para o idioma. Cai pro `en` se `:lang` não for encontrado no
dicionário (não é 404).

**Response `200`:** `{ "key": "valor", ... }`
**Response `500`:** `{ "error": "Language file not found or invalid" }`

> **Nota (CODE ISSUE):** o controller lê `server/applications/locales.json`, com fallback para `server/src/locales.json`. O arquivo de dicionário fica em `server/locales.json`, e nenhum dos dois caminhos existe no código-fonte nem em `dist/`. Por isso os dois endpoints retornam `500` em todas as requisições atualmente. As respostas `200` acima são o comportamento previsto, não o atual. `GET /` usa o mesmo caminho e falha da mesma forma.
