# Fonts (Self-hosted)

## Endpoints

**Base:** `/api/fonts`
**Auth:** None (needed at bootstrap, before login)

---

### GET `/`

Lists the catalog of available fonts in `public/fonts/`.

Derives family, weight and style from the `.woff2` file name. Files with `[wght]` in the name are treated as variable (e.g., `Inter[wght]` → weight `100 900`). `public/fonts/fonts.json` allows manual override for names outside the convention.

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

Done at bootstrap via `FontFace` API with `display: 'swap'`. The CSS variables `--font-display`, `--font-body`, `--font-ui`, `--font-mono` are populated from the catalog.

## Configuration

`FontSettingsWindow` (`client/windows/font-settings-window.ts`) allows changing the font for each of the 4 slots by rewriting the CSS variables in real time.
