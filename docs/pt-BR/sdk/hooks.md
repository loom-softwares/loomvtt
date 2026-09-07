# LoomHooks (`hooks.ts`)

Sistema de eventos global do LoomVTT. Exposto em `window.Loom.LoomHooks` e aliado globalmente como `window.Hooks` para compatibilidade.

```typescript
import { LoomHooks } from '/_loom/sdk/index.js';
```

## API

```typescript
LoomHooks.on(hookName: string, callback: (...args) => void): void
LoomHooks.once(hookName: string, callback: (...args) => void): void
LoomHooks.off(hookName: string, callback: (...args) => void): void
LoomHooks.callAll(hookName: string, ...args: any[]): void
LoomHooks.call(hookName: string, ...args: any[]): boolean
```

> **Nota:** `LoomHooks` é o sistema de eventos client-side.
> - `callAll(name, ...args)` executa todos os callbacks registrados, tratando chamadas assíncronas e capturando erros individualmente sem interromper os demais listeners.
> - `call(name, ...args)` executa os listeners em sequência e retorna `false` caso algum callback retorne explicitamente `false` (permitindo a interrupção de ciclo em pré-hooks como `preUpdateActor`).
> - No cliente, `ClientDocument` dispara hooks de documento locais via `LoomHooks.call()` (`preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, `createActor`, etc.).
> - Além disso, o cliente escuta eventos Socket.IO relayados do servidor (ex: `actors.created`, `actors.updated`, `actors.deleted` — a nomenclatura não é consistente entre entidades, ver [`websocket/events.md`](../websocket/events.md)) e eventos de Janelas (`renderWindow`, `closeWindow`, `renderActorSheet`, etc.).
>
> `targetToken` é disparado do evento Socket.IO `token.target` (marcar/desmarcar alvo). Payload: `{ castId, targetedBy }`. Para consultar os alvos do usuário atual, use `Loom.user.targets` — ver `window-loom.md`.

## Exemplo

```typescript
// Registrar listener
const handler = (actor) => console.log('Actor:', actor.name);
// Eventos WS (client-side) — nomes: actor.created, actor.updated, actor.deleted
LoomHooks.on('actor.created', handler);

// Listener com interrupção condicional em pré-hook
LoomHooks.on('preUpdateActor', (actor, changes, context) => {
  if (changes.system?.hp?.value < 0) {
    console.warn('HP não pode ser negativo');
    return false; // Interrompe o update
  }
});

// Remover
LoomHooks.off('actor.created', handler);

// Disparar
LoomHooks.callAll('actor.created', actorData);
```

Erros em hooks são capturados e logados via `console.error`, sem quebrar a execução dos outros hooks.
