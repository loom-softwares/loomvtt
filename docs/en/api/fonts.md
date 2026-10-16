# Fonts (Self-hosted)

## Endpoints

**Base:** `/api/fonts`
**Auth:** None (needed at bootstrap, before login)

---

### GET `/`

Lists the catalog of available fonts in `public/fonts/`.

Derives family, weight and style from the `.woff2` file name. Files with `[wght]` in the name are treated as variable (e.g., `Inter[wght]` → weight `100 900`). `public/fonts/fonts.json` allows manual override for names outside the convention (the key is the file name). Entries with the same family, weight and style are listed only once. If `public/fonts/` does not exist, the response is `[]`. On error: `500` with `{ "error": "<message>" }`.

**Response `200`:**
```json
[
  {
    "family": "Inter",
    "url": "/fonts/Inter[wght].woff2",
    "weight": "100 900",
    "style": "normal",
    "source": "core"
  }
]
```

---

## Client Registration

Done at bootstrap (`client/main.ts` → `loadFontsFromCatalog()`) via `FontFace` API with `display: 'swap'`. Only the first catalog entry of each family is registered. The CSS variables `--font-display`, `--font-body`, `--font-ui`, `--font-mono` are not filled from the catalog: they keep their defaults and the font settings window changes them (see below).

## Configuration

`FontSettingsWindow` (`client/windows/font-settings-window.ts`) allows changing the font for each of the 4 slots by rewriting the CSS variables in real time.
