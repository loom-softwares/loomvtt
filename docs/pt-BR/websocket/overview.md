# WebSocket — Visão Geral

Conexão de tempo real entre cliente e servidor pra sincronização de estado do mundo,
construída sobre **Socket.IO** (`socket.io` no servidor / `socket.io-client` no cliente) — não
é um servidor `WebSocket` cru. O pacote `ws` do npm ainda é dependência, mas não é usado
nessa conexão.

**Endpoint:** handshake Socket.IO no path `/ws` (transportes `websocket` e `polling`
habilitados — o Socket.IO negocia o transporte sozinho, isso não é um `Upgrade` HTTP puro).

**Auth:** dois middlewares `io.use()` rodam antes do `connection` disparar:
1. Checagem de licença.
2. JWT extraído do cookie `loom_world_token` (`socket.handshake.headers.cookie`) e
   verificado. Se ausente/inválido, o middleware chama `next(new Error(...))` — o Socket.IO
   transforma isso num evento `connect_error` no cliente (não existe uma resposta HTTP 401
   literal, já que o handshake pode terminar via polling antes de fazer upgrade).

## Salas (rooms)

Broadcasts têm escopo por salas do Socket.IO, não são mandados pra todo socket:

| Sala | Entrada via | Propósito |
|------|-----------|---------|
| `world:<worldId>` | `user.identify` ou `context.update` | Todo mundo num world |
| `stage:<stageId>` | `context.update` | Todo mundo vendo aquela stage no momento |

`context.update` também sai de toda sala `stage:*` em que o socket estava antes de entrar na
nova, então um cliente nunca fica em mais de uma sala de stage ao mesmo tempo. Ver
[`server/applications/ws/channels.ts`](../../../server/applications/ws/channels.ts) pros
helpers de nomenclatura de sala e funções de broadcast.

Apesar do nome, o helper `broadcastToAll()` do servidor **geralmente não** é um broadcast de
verdade pra todo socket: ele resolve `worldId` (ou `stageId`, ou `castId`) a partir do
payload e roteia via `broadcastToWorld()`/`broadcastToStage()`, só caindo pra um
`io.emit(...)` de verdade pra todo socket conectado quando nenhum desses pode ser resolvido.
Existe também um helper separado `broadcastToWorldOwned()` pra documentos com `ownership`
por linha (ex: actors): em vez de um único `io.to(room).emit(...)`, ele itera os sockets
ativos da sala e manda um payload redigido pra quem estiver abaixo do nível de permissão de
Dono — ver `redactActorForLimited`.

## Formato de mensagem

**Cliente → Servidor** é embrulhado num único evento Socket.IO chamado `'message'`:

```typescript
socket.emit('message', { type: string, data: unknown });
```

`wsClient.send(type, data)` faz esse embrulho pra você — ver
[`sdk/ws-client.md`](../sdk/ws-client.md). O handler `socket.on('message', ...)` do servidor
faz switch em `type` pra despachar.

**Servidor → Cliente** é o oposto: cada evento é emitido com o **nome próprio dele**
(`socket.emit('cast.created', data)`, `io.to(room).emit('chat.message', data)`, etc.), nunca
embrulhado num envelope `{type, data}`. O `wsClient` do cliente usa `socket.onAny()` pra
capturar todo evento recebido e redespachar pros handlers registrados por nome — ver
[`events.md`](./events.md) pro catálogo completo.

Existe também um passthrough cru: qualquer evento emitido pelo cliente cujo nome comece com
`module.`, `system.` ou `socket.` é relayado como está pra sala do world de quem mandou,
pulando o envelope `message` inteiro — a via de escape que addons usam pros próprios eventos
de tempo real sem tocar em `server/index.ts` (ver
[`events.md`](./events.md#relay-customizado-para-eventos-de-addonsistema-module-system-socket)).

## Ciclo de vida da conexão

```
[Cliente]                               [Servidor]
   |                                        |
   |--- handshake Socket.IO (cookie JWT) -->|  io.use() checagem licença + JWT
   |<-- 'connect' --------------------------|  (ou 'connect_error' se falhar auth)
   |                                        |
   |--- emit('message', {type:'user.identify', data:{worldId}}) -->|  entra sala world:<id>, consulta DB
   |<-- emit('init', {...estado completo do mundo}) -----------------|
   |<-- emit('users.online', [...]) ---------------------------------|  (pra sala do world inteira)
   |                                        |
   |--- emit('message', {type:'context.update', ...}) ------------->|  sai stage:* antigas, entra stage:<id>
   |--- emit('message', {type:'token.move', ...}) ------------------>|  grava DB + Signal cast.updated/token.moved
   |--- emit('message', {type:'chat.message', ...}) ----------------->|  grava DB + broadcast pra sala do world
   |--- emit('message', {type:'stage.activate', ...}) --------------->|  só GM, Signal stage.activated
   |                                        |
   |<-- emit('cast.updated', {...}) --------------------------------|  (de Signals, com escopo de sala)
   |<-- emit('tiles.created'/'updated'/'deleted', {...}) -----------|  (de Signals, com escopo de sala)
   |<-- emit('actors.updated', {...}) -------------------------------|  (de Signals, com escopo de sala)
   |<-- emit('chat.message', {...}) ---------------------------------|  (de outros clientes na sala)
```

## Reconexão automática

Tratada inteiramente pelo próprio cliente Socket.IO (`ws-client.ts` só configura): até 5
tentativas com backoff exponencial (1s, 2s, 4s, 8s, limitado a 16s). Uma desconexão iniciada
pelo servidor (`reason === 'io server disconnect'`, ex: depois de `world.deactivated` fechar
a sala à força) **não** dispara tentativa de reconexão do cliente.

## user.identify

Enviado logo após conectar pra começar a sincronização:

```json
{
  "type": "user.identify",
  "data": { "worldId": "world-uuid" }
}
```

O servidor extrai `userId`/`userName`/`userRole` do JWT — os campos de identidade que o
cliente manda são só informativos, nunca confiados. Isso entra na sala `world:<worldId>` e
dispara o payload `init` mais um broadcast `users.online` pro resto daquela sala.

## init

Resposta imediata a `user.identify` com o estado completo do mundo (como evento `init` puro,
não `{type: 'init', data: {...}}`):

```json
{
  "system": { "id": "...", "title": "...", "version": "...", "changelogUrl": "...", "wikiUrl": "...", "bugsUrl": "..." },
  "modules": [{ "name": "...", "version": "..." }],
  "rulesets": [{ "name": "...", "version": "..." }],
  "permissions": { "compendiumEdit": [], "viewStages": [] },
  "isPaused": false,
  "cast": [...],
  "stages": [...],
  "actors": [...],
  "tiles": [...],
  "items": [...],
  "journals": [...],
  "folders": [...],
  "playlists": [...],
  "lights": [...],
  "drawings": [...],
  "levels": [...],
  "rollTables": [...],
  "combat": null,
  "chatHistory": [...],
  "onlineUsers": [...]
}
```

`cast` é mandado sem filtro, cruzando todas as stages do world — o cliente filtra pela stage
ativa na hora de renderizar (ver `handleInit`/tratamento de `stage.activated` em
`game-hud.ts`), já que broadcasts de `stage.activated` não trazem lista de cast própria.

## users.online

Enviado sempre que um usuário conecta, desconecta, ou troca de stage (`context.update`):

```json
{
  "type": "users.online",
  "data": [
    { "clientId": "...", "worldId": "...", "userId": "...", "userName": "Rob", "userColor": "#e74c3c", "userRole": 4 }
  ]
}
```

## Lado do cliente

```typescript
import { wsClient } from '../core/ws-client.js';

await wsClient.connect();
wsClient.identify(worldId, userId, userName, userColor, userRole);

const unsub = wsClient.on('cast.created', (data) => {
  console.log('Token:', data);
});

wsClient.send('chat.message', { content: 'Olá!' });
```

**`wsClient.on(...)` nunca é automático por tipo de entidade.** Ter uma entrada em
`docs/pt-BR/api/*.md` dizendo `WS Event: deck.updated` não significa que algo já está
escutando esse evento — cada tela/lista que precisa se manter sincronizada tem que registrar
o próprio `wsClient.on('deck.updated', ...)` e atualizar o estado local manualmente. Um
exemplo real: a sidebar (`client/screens/game-hud/sidebar.ts`) tinha listeners pra
`actors.*`/`item.*` mas não pra `deck.*` — renomear um deck salvava certo no banco, mas a
lista da sidebar nunca sabia que precisava atualizar porque nada estava escutando. Ao
adicionar uma nova aba/lista na sidebar, sempre registre os três eventos (`created`/
`updated`/`deleted`) da entidade correspondente — e confira [`events.md`](./events.md) pro
nome exato na rede, já que nem sempre é o singular do nome da entidade.
