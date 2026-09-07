# Fontes (Self-hosted)

## Endpoints

**Base:** `/api/fonts`
**Auth:** Nenhuma (necessário no bootstrap, antes do login)

---

### GET `/`

Lista o catálogo de fontes disponíveis em `public/fonts/`.

Deriva família, peso e estilo do nome do arquivo `.woff2`. Arquivos com `[wght]` no nome são tratados como variáveis (ex: `Inter[wght]` → peso `100 900`). `public/fonts/fonts.json` permite override manual para nomes fora da convenção.

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

## Registro no Cliente

Feito no bootstrap via `FontFace` API com `display: 'swap'`. As variáveis CSS `--font-display`, `--font-body`, `--font-ui`, `--font-mono` são populadas a partir do catálogo.

## Configuração

`FontSettingsWindow` (`client/windows/font-settings-window.ts`) permite trocar a fonte de cada um dos 4 slots reescrevendo as variáveis CSS em tempo real.
