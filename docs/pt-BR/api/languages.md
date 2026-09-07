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
