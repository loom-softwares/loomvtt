# LoomVTT Docs

Official LoomVTT documentation — REST API, client-side SDK, WebSocket, and third-party guides.

The LoomVTT SDK lives in `packages/sdk/` and is served at `/_loom/sdk/index.js`.

```javascript
import { LoomHooks, SystemRegistry, defineSystem, api, sheets } from '/_loom/sdk/index.js';
```

## Structure

```
docs/                     ← Markdown Documentation
packages/
  sdk/                    ← SDK Code (TypeScript → dist/)
    src/index.ts          ← Public API (types + runtime wrappers)
    dist/                 ← Build output (served at /_loom/sdk/)
```

| Folder | Content |
|-------|----------|
| `guide/` | Getting started, system/ruleset creation, concepts (LoomDocument, LoomHooks, Signals) |
| `api/` | REST Endpoints — cast, stages, actors, combat, walls, items, journals, etc |
| `sdk/` | SDK Reference (`/_loom/sdk/index.js`) |
| `websocket/` | Real-time communication events and protocol |
| `examples/` | Complete tutorials for third-party |
