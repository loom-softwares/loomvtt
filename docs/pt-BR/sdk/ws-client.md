# Cliente WebSocket (`ws-client.ts`)

Cliente de tempo real, construído sobre **Socket.IO** (`socket.io-client`) — não é um
`WebSocket` cru. A API pública do wrapper é propositalmente agnóstica de transporte
(`connect`/`send`/`on`/`off`), então quem chama nunca toca `socket.io-client` direto.

```typescript
import { wsClient } from '../core/ws-client.js';
```

## API

```typescript
wsClient.connect(): Promise<void>
wsClient.disconnect(): void
wsClient.send(type: string, data: unknown): void
wsClient.on(type: string, handler: (data: any) => void): () => void
wsClient.off(type: string, handler: (data: any) => void): void
wsClient.identify(worldId, userId, userName, userColor, userRole): void
wsClient.updateContext(worldId: string, stageId?: string): void
wsClient.session: { worldId, userId, userName, userColor, userRole } | null
```

## Conexão

```typescript
await wsClient.connect();
```

Conecta o Socket.IO na mesma origem, path `/ws` (transportes `websocket` e `polling`
habilitados — o Socket.IO negocia, não é um upgrade de WS cru). A reconexão automática é
feita pelo próprio Socket.IO: até 5 tentativas com backoff exponencial (1s, 2s, 4s, 8s,
limitado a 16s). Uma desconexão iniciada pelo servidor (`reason === 'io server disconnect'`)
**não** dispara reconexão.

## Enviando eventos

```typescript
wsClient.send('chat.message', { content: 'Olá!' });
```

`send()` não emite o nome do evento direto no socket — ele embrulha tudo num único evento
Socket.IO chamado `'message'`: `socket.emit('message', { type, data })`. O handler `message`
do servidor desembrulha `type`/`data` e despacha internamente.

## Recebendo eventos

O servidor, por outro lado, emite cada evento com o **nome próprio dele** (`cast.created`,
`chat.message`, `init`, etc.) em vez de embrulhar num envelope genérico. O cliente usa
`socket.onAny()` pra capturar todo evento recebido e redespachar pros handlers registrados
sob aquele nome:

```typescript
const unsubscribe = wsClient.on('cast.created', (data) => {
  console.log('Token criado:', data);
});

// Cancelar
unsubscribe();
// ou
wsClient.off('cast.created', handler);
```

**`wsClient.on(...)` nunca é automático por tipo de entidade.** Uma entrada em
`docs/pt-BR/api/*.md` dizendo `WS Event: deck.updated` não significa que algo já está
escutando esse evento — cada tela/lista que precisa se manter sincronizada tem que registrar
o próprio `wsClient.on('deck.updated', ...)` e atualizar o estado local manualmente.

## Identificação

```typescript
wsClient.identify('world-1', 'user-1', 'Rob', '#e74c3c', 4);
```

Envia um evento `user.identify`. O servidor deriva `userId`/`userName`/`userRole` reais do
cookie JWT — os campos de identidade no payload são só informativos, não confiáveis. Isso
entra o cliente na sala Socket.IO `world:<worldId>`. Depois de identificar, o servidor manda
o estado completo do mundo via o evento `init`.

## Contexto de sala (escopo de stage)

```typescript
wsClient.updateContext(worldId, stageId);
```

Envia `context.update`. Além da sala `world:<worldId>` (entrada em `identify()`), isso também
(re)entra o cliente numa sala com escopo de stage — chame no login e sempre que o jogador
trocar de stage/cena, ou broadcasts com escopo de stage (ex: fog reveals, se um dia forem
relayados) serão perdidos.

## Sessão

```typescript
wsClient.session // { worldId, userId, userName, userColor, userRole } | null
```
