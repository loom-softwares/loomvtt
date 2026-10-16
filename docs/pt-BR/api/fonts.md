# Fontes (Self-hosted)

## Endpoints

**Base:** `/api/fonts`
**Auth:** Nenhuma (necessário no bootstrap, antes do login)

---

### GET `/`

Lista o catálogo de fontes disponíveis em `public/fonts/`.

Deriva família, peso e estilo do nome do arquivo `.woff2`. Arquivos com `[wght]` no nome são tratados como variáveis (ex: `Inter[wght]` → peso `100 900`). `public/fonts/fonts.json` permite override manual para nomes fora da convenção (a chave é o nome do arquivo). Entradas com a mesma família, peso e estilo aparecem uma única vez. Se `public/fonts/` não existir, a resposta é `[]`. Em erro: `500` com `{ "error": "<mensagem>" }`.

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

Feito no bootstrap (`client/main.ts` → `loadFontsFromCatalog()`) via `FontFace` API com `display: 'swap'`. Só a primeira entrada do catálogo de cada família é registrada. As variáveis CSS `--font-display`, `--font-body`, `--font-ui`, `--font-mono` não são preenchidas a partir do catálogo: mantêm os valores padrão e a janela de configuração de fontes as altera (ver abaixo).

## Configuração

`FontSettingsWindow` (`client/windows/font-settings-window.ts`) permite trocar a fonte de cada um dos 4 slots reescrevendo as variáveis CSS em tempo real.
