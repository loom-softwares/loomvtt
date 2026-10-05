# Media (Mídia)

Permite ao mestre mostrar uma imagem ou vídeo (arte do personagem, arte do token) para a mesa toda ou para jogadores escolhidos.
O cliente abre a mídia recebida numa janela de visualização somente leitura (`Loom.openMediaViewer`).

## Endpoints

**Base:** `/api/media`
**Auth:** `requireAuth, requireWorldMatch` (o envio em si é só do mestre)

---

### POST `/push`

Mostra um arquivo de mídia aos jogadores. Nada é guardado; o servidor só valida o caminho e transmite.

**Request body:**
```json
{ "src": "/worlds/my-world/assets/tokens/hero-1a2b3c4d.Portrait.webp", "title": "Amaso Nomura", "targetUserIds": ["user-1", "user-2"] }
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `src` | `string` | Caminho de mesma origem para uma imagem ou vídeo (`png`, `jpg`, `webp`, `gif`, `avif`, `svg`, `webm`, `mp4`, `m4v`, `ogv`, `mov`), opcionalmente com `?v=<número>`. Sem `..`, sem `//`, sem query além de `v` |
| `title` | `string?` | Título da janela, cortado em 200 caracteres |
| `targetUserIds` | `string[]?` | Jogadores que recebem (até 200). Omitido ou `null` significa todos da mesa |

**Response `200`:** `{ "ok": true }`
**Response `400`:** `{ "error": "Invalid media path" }` ou `{ "error": "No active world" }`
**Response `403`:** `{ "error": "Only the GM can share media with players" }`
**WS Event:** `display.media` com `{ worldId, src, title, targetUserIds }`
