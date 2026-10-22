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
> - `call` está disponível em `window.Loom.LoomHooks` (e em `window.Hooks`), mas o objeto `LoomHooks` exportado pelo import do SDK só tem `on`, `once`, `off` e `callAll`.
> - `callAll(name, ...args)` executa todos os callbacks registrados, tratando chamadas assíncronas e capturando erros individualmente sem interromper os demais listeners.
> - `call(name, ...args)` executa os listeners em sequência (não aguarda promises) e retorna `false` caso algum callback síncrono retorne `false`. Só `chatRollCommand` usa esse retorno. Os hooks `preUpdate*` / `preDelete*` do cliente ignoram o retorno, então retornar `false` ali não cancela o update (ver a nota CODE ISSUE abaixo).
> - No cliente, `ClientDocument` dispara hooks de documento locais via `LoomHooks.call()`: `preUpdate<Doc>`, `update<Doc>`, `preDelete<Doc>`, `delete<Doc>` (por exemplo `preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`).
> - O servidor repassa seus sinais `actors.*` ao cliente com os nomes no singular usados nos exemplos (`actor.created`, `actor.updated`, `actor.deleted`, ver `server/index.ts`). Itens já são emitidos como `item.created` / `item.updated` / `item.deleted`. A sidebar e o HUD então disparam o mesmo nome mais os aliases `create…`, `update…`, `delete…` e as formas `createDocument` / `updateDocument` / `deleteDocument` (ver a lista abaixo). Eventos de Janelas (`renderWindow`, `closeWindow`, `renderActorSheet`, etc.) também são disparados aqui.
>
> Outros hooks que o cliente dispara: `init`, `setup` e `ready` (boot do HUD); `combatStart`, `combatTurn`, `combatRound` e `combatEnd`; `updateWorldTime`, `timeScaleChanged` e `timePausedChanged` (ver `time.md`); `stage.updated`, `updateScene`; `preRoll` e `chatRollCommand` (um listener que retorna `false` assume a rolagem); `chat.roll`; `combatantLabel` e `combatInitiative`; `window.<evento>` para `render`, `close`, `position`, `minimize` e `maximize`; `getWindowOptionsMenuItems`; `render<Classe>` e `close<Classe>`. `dice3dRollItems` (`callAll("dice3dRollItems", roll, claimed)`, disparado antes de uma rolagem ser lançada nos dados 3D: um sistema dono dos dados empurra itens `{ denomination?, faces?, value }` em `claimed` e eles substituem os dados padrão; a rolagem também pode trazê-los em `roll.meta.dice3d`).
>
> `targetToken` é disparado do evento Socket.IO `token.target` (marcar/desmarcar alvo). Payload: `{ castId, targetedBy }`. Para consultar os alvos do usuário atual, use `Loom.user.targets` — ver `window-loom.md`.
>
> **Contratos dos hooks de combate:**
> - `combatStart`, `combatTurn`, `combatRound` e `combatEnd` disparam só em clients de GM. O servidor retransmite os eventos
>   `combat.*` sem filtro de dono, então jogadores não recebem nenhum evento de combate. Um painel de jogador precisa consultar
>   `GET /api/combat/:worldId` periodicamente.
> - `combatantLabel` é síncrono, via `LoomHooks.call('combatantLabel', ctx)` com `ctx = { combat, combatant, label }`.
>   Um listener escreve `ctx.label`. Um listener que retorna `false` interrompe a cadeia.
> - `combatInitiative` roda via `callAll` com `ctx = { castIds, initiatives, health, rolls, pending }`. Escreva os totais em
>   `ctx.initiatives[castId]`. Trabalho assíncrono vai para `ctx.pending`: a UI espera por ele antes do POST. Uma promise
>   rejeitada aborta o início inteiro, e a UI só mostra um toast. Ele roda só pelo botão "Iniciar combate (iniciativa DES)", para os
>   tokens selecionados, não por `POST /start`, `POST /combatant` nem pela ficha de encontro.
> - `combatantLabelsChanged` é escutado pela sidebar, que re-renderiza ao recebê-lo, mas nenhum código do motor o emite. Um
>   sistema que preenche badges de forma assíncrona precisa emiti-lo por conta própria, por exemplo com
>   `LoomHooks.callAll('combatantLabelsChanged')`.

## Exemplo

```typescript
// Registrar listener
const handler = (actor) => console.log('Actor:', actor.name);
// Eventos WS (client-side) — nomes: actor.created, actor.updated, actor.deleted
LoomHooks.on('actor.created', handler);

// Listener de pré-hook (recebe o documento, as alterações e o contexto).
// O retorno é ignorado: retornar false NÃO cancela o update.
LoomHooks.on('preUpdateActor', (actor, changes, context) => {
  if (changes.system?.hp?.value < 0) {
    console.warn('HP não pode ser negativo');
  }
});

// Remover
LoomHooks.off('actor.created', handler);

// Disparar
LoomHooks.callAll('actor.created', actorData);
```

Erros em hooks são capturados e logados via `console.error`, sem quebrar a execução dos outros hooks.

> **CODE ISSUE:** `ClientDocument.update()` e `delete()` (`client/core/client-document.ts`) chamam `LoomHooks.call('preUpdate…')` e `LoomHooks.call('preDelete…')` sem verificar o resultado, então um `false` retornado não interrompe a requisição. Os hooks `preUpdate*` do servidor têm o mesmo limite (`server/applications/utils/hooks.ts`: `call` retorna `void`).
