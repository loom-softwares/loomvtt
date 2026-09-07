# Languages

## Endpoints

**Base:** `/api/languages`
**Auth:** None

---

### GET `/`

Lists available language codes.

**Response `200`:** `["en", "pt-BR", ...]`

---

### GET `/:lang`

Returns translation dictionary for the language. Falls back to `en` if `:lang` isn't found
in the dictionary (not a 404).

**Response `200`:** `{ "key": "value", ... }`
**Response `500`:** `{ "error": "Language file not found or invalid" }`
