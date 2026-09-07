# LoomVTT Docs

Documentação oficial do LoomVTT — API REST, SDK client-side, WebSocket, e guias para third-party.

O SDK do LoomVTT vive em `packages/sdk/` e é servido em `/_loom/sdk/index.js`.

```javascript
import { LoomHooks, SystemRegistry, defineSystem, api, sheets } from '/_loom/sdk/index.js';
```

## Estrutura

```
docs/                     ← Documentação em Markdown
packages/
  sdk/                    ← Código do SDK (TypeScript → dist/)
    src/index.ts          ← API pública (tipos + runtime wrappers)
    dist/                 ← Build output (servido em /_loom/sdk/)
```

| Pasta | Conteúdo |
|-------|----------|
| `guide/` | Primeiros passos, criação de sistemas/rulesets, conceitos (LoomDocument, LoomHooks, Signals) |
| `api/` | Endpoints REST — cast, stages, actors, combat, walls, items, journals, etc |
| `sdk/` | Referência do SDK (`/_loom/sdk/index.js`) |
| `websocket/` | Eventos e protocolo de comunicação em tempo real |
| `examples/` | Tutoriais completos para third-party |
