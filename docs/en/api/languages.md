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

> **Note (CODE ISSUE):** the controller reads `server/applications/locales.json`, with a fallback to `server/src/locales.json`. The dictionary file is `server/locales.json`, and neither path exists in the source tree or in `dist/`. Both endpoints currently return `500` for every request, so the `200` responses above are the intended behavior, not the current one. `GET /` uses the same path and fails the same way.
