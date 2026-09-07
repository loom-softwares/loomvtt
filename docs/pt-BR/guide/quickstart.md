# Quickstart

Guia rápido para começar com o LoomVTT.

## Subindo o servidor

```bash
npm install
npm run dev
```

O servidor inicia em `http://localhost:3000` e o cliente Vite em `http://localhost:5173`.

## Setup inicial

1. Acesse `http://localhost:5173`
2. Crie a senha de admin
3. Configure o servidor (porta, idioma, data path)
4. Crie um mundo
5. Adicione usuários

## Usando o SDK

O LoomVTT fornece um SDK em `/_loom/sdk/index.js` para addons e sistemas:

```javascript
import { LoomHooks, SystemRegistry, defineSystem, api } from '/_loom/sdk/index.js';
```

TypeScript: instale `@loomvtt/sdk` localmente ou copie `packages/sdk/dist/index.d.ts`.

## Criando um sistema básico

Veja [system-creation.md](system-creation.md).
