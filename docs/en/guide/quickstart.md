# Quickstart

Quick guide to getting started with LoomVTT.

## Starting the server

```bash
npm install
npm run dev
```

The server starts at `http://localhost:3000` and the Vite client at `http://localhost:5173`.

## Initial setup

1. Go to `http://localhost:5173`
2. Create the admin password
3. Configure the server (port, language, data path)
4. Create a world
5. Add users

## Using the SDK

LoomVTT provides an SDK at `/_loom/sdk/index.js` for addons and systems:

```javascript
import { LoomHooks, SystemRegistry, defineSystem, api } from '/_loom/sdk/index.js';
```

TypeScript: install `@loomvtt/sdk` locally or copy `packages/sdk/dist/index.d.ts`.

## Creating a basic system

See [system-creation.md](system-creation.md).
