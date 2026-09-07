# Eventos WebSocket

Catálogo completo de eventos Servidor→Cliente, entregues via **Socket.IO** — cada linha é um
nome de evento Socket.IO distinto (`socket.on('<evento>', ...)` do lado do cliente), não um
envelope `{type, data}`. Ver [overview.md](./overview.md) pro modelo de transporte e escopo
de sala.

## Convenção de nomenclatura

A nomenclatura **não é consistente** entre entidades — algumas são singular, outras plural,
outras com underscore, espelhando o nome de tabela ou a string escolhida à mão pelo autor
original. A tabela abaixo lista os nomes exatos na rede; não assuma que um padrão de uma
entidade vale pra outra. A maioria é gerada automaticamente pela camada genérica
`Document.create/update/delete()` (`Signal.broadcast(`${schema.tableName}.<ação>`, ...)`), e
é por isso que nomes de tabela plurais e com underscore (`actors`, `tiles`, `levels`,
`stages`, `macros`, `users`, `roll_tables`, `roll_table_entries`, `compendium_packs`) vazam
direto pro nome do evento; rotas que chamam `Signal.broadcast` manualmente costumam escolher
um nome singular.

## Eventos de Canvas / Cena

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `stages.created` | Stage completa | Stage criada |
| `stage.activated` | `{ stageId, id, levelId, name, bgUrl, backgroundColor, gridSize, gridColor, gridType, width, height, ambientPlaylistId, darknessLevel, weatherEffect }` | Stage ativada (`bgUrl`/`backgroundColor`/`levelId` vêm do level base) |
| `stages.updated` | Stage completa | Stage atualizada |
| `stages.deleted` | `{ id }` | Stage removida |
| `stage.darkness` | `{ stageId, darknessLevel, duration }` | Escuridão alterada |
| `levels.created` | Level completo | Level criado |
| `levels.updated` | Level completo | Level atualizado |
| `levels.deleted` | `{ id }` | Level removido |
| `levels.changed` | `{ stageId }` | Todos os levels de uma stage mudaram |
| `cast.created` | Cast member completo | Token criado |
| `cast.updated` | Cast member completo (com `_socketId` pra exclusão do remetente) | Token atualizado |
| `cast.deleted` | `{ id }` | Token removido |
| `token.moved` | `{ id, x, y, worldId, _socketId, movedAt }` | Token movido |
| `token.target` | `{ castId, targetedBy }` | Token marcado como alvo |
| `tiles.created` | Tile completo | Tile criado |
| `tiles.updated` | Tile completo | Tile atualizado |
| `tiles.deleted` | `{ id }` | Tile removido |
| `tile.triggered` | `{ action, tokenId }` | Mandado direto pra um socket alvo (`targetSocket.emit(...)`), não é broadcast de sala — ver [overview.md](./overview.md) |
| `light.created` | Light completa | Luz criada |
| `light.updated` | Light completa | Luz atualizada |
| `light.deleted` | `{ id, stageId }` | Luz removida |
| `drawing.created` | Drawing completo | Desenho criado |
| `drawing.updated` | Drawing completo | Desenho atualizado |
| `drawing.deleted` | `{ id }` | Desenho removido |
| `drawing.cleared` | `{ stageId }` | Desenhos limpos |
| `wall.created` | Wall completa | Parede criada |
| `wall.updated` | Wall completa | Parede atualizada |
| `wall.deleted` | `{ id }` | Parede removida |
| `door.state` | `{ wallId, door, doorState }` | Estado da porta alterado |
| `noise.created` | Noise completo | Som ambiente criado |
| `noise.updated` | Noise completo | Som ambiente atualizado |
| `noise.deleted` | `{ id }` | Som ambiente removido |
| `ping` | Payload original do ping | Rebroadcast pra sala do world (ping de latência/posição estilo Ctrl+click) |
| `pong` | `{ timestamp, ...dadosOriginais }` | Mandado de volta só pra quem enviou o `ping` |
| `canvas.ping` | `{ ...data, userColor }` | Marcador visual compartilhado (Ctrl+click) |

## Eventos de Dados do Mundo

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `actors.created` | Actor completo | Actor criado |
| `actors.updated` | Actor completo | Actor atualizado |
| `actors.deleted` | `{ id }` | Actor removido |
| `item.created` | Item completo | Item criado |
| `item.updated` | Item completo | Item atualizado |
| `item.deleted` | `{ id }` | Item removido |
| `journal.created` | Journal completo | Journal criado |
| `journal.updated` | Journal completo | Journal atualizado (também disparado pra CRUD de página e categoria — ver [journals.md](../api/journals.md)) |
| `journal.deleted` | `{ id }` | Journal removido |
| `folder.created` | Folder completa | Pasta criada |
| `folder.updated` | Folder completa | Pasta atualizada |
| `folder.deleted` | `{ id }` | Pasta removida |
| `deck.created` | Deck completo | Deck criado |
| `deck.updated` | Deck completo | Deck atualizado |
| `decks.deleted` | `{ id }` | Deck removido (plural — diferente de `deck.created`/`deck.updated`) |
| `playlist.created` | Playlist completa | Playlist criada |
| `playlist.updated` | Playlist completa | Playlist atualizada |
| `playlist.deleted` | `{ id }` | Playlist removida |
| `playlist.sound.created` | Sound completo | Som adicionado |
| `playlist.sound.updated` | Sound completo | Som atualizado |
| `playlist.sound.deleted` | `{ id, playlistId }` | Som removido |
| `macros.created` | Macro completo | Macro criada |
| `macros.updated` | Macro completo | Macro atualizada |
| `macros.deleted` | `{ id }` | Macro removida |
| `users.created` | User completo | Usuário criado |
| `users.updated` | User completo (também disparado por `/users/:id/flags`) | Usuário atualizado |
| `users.deleted` | `{ id }` | Usuário removido |

## Eventos de Sistema

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `init` | Estado completo do mundo | Sincronização inicial (após `user.identify`) — ver [overview.md](./overview.md) pra forma exata |
| `users.online` | `OnlineUser[]` | Lista de usuários online no world (também reenviado ao trocar de stage) |
| `worlds.created` | World completo | Mundo criado |
| `worlds.updated` | World completo | Mundo atualizado |
| `worlds.deleted` | `{ id }` | Mundo removido |
| `world.deactivated` | `{}` | Mundo desativado — o servidor também força a desconexão de todo socket da sala daquele mundo |
| `world.paused` | `{ worldId }` | Mundo pausado pelo GM |
| `world.resumed` | `{ worldId }` | Mundo retomado pelo GM |
| `time.updated` | `{ timeId, worldId, time, day, month, year }` | Horário do mundo atualizado |

## Eventos de Chat

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `chat.message` | `{ id, userId, userName, userColor, type: 'chat', content, speaker, createdAt, worldId }` | Mensagem de chat |
| `chat.roll` | `{ id, userId, userName, userColor, formula, roll, actorId, speaker, createdAt, worldId }` | Rolagem de dado |
| `chat.messageDeleted` | `{ id, worldId }` | Mensagem apagada via `DELETE /api/chat-messages/:id` |
| `chat.cleared` | `{ worldId }` | Histórico de chat inteiro limpo via `DELETE /api/chat-messages` |

## Eventos de Addon/Sistema

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `addon.installed` | `{ type, name, version }` | Addon instalado |
| `addon.uninstalled` | `{ type, name }` | Addon removido |
| `roll_tables.created` | Roll table completa | Tabela de rolagem criada |
| `roll_tables.updated` | Roll table completa | Tabela de rolagem atualizada |
| `roll_tables.deleted` | `{ id }` | Tabela de rolagem removida |
| `roll_table_entries.created` | Entry completa | Entrada de tabela criada |
| `roll_table_entries.updated` | Entry completa | Entrada de tabela atualizada |
| `roll_table_entries.deleted` | `{ id }` | Entrada de tabela removida |
| `roll-table.rolled` | `{ tableId, result, formula, total }` | Tabela de rolagem usada — repare no hífen, diferente dos eventos de CRUD com underscore acima |
| `compendium_packs.created` | Compendium pack completo | Pacote criado |
| `compendium_packs.updated` | Compendium pack completo | Pacote atualizado |
| `compendium_packs.deleted` | `{ id }` | Pacote removido |
| `compendium.entry.updated` | `{ packId, entry }` | Entrada de compendium atualizada |
| `template.created` | Template completo | Template de área criado |
| `template.updated` | Template completo | Template de área atualizado |
| `template.deleted` | `{ id }` | Template de área removido |

## Relay customizado para eventos de addon/sistema (`module.*`, `system.*`, `socket.*`)

Qualquer evento que um cliente emitir cujo nome comece com `module.`, `system.` ou `socket.`
é automaticamente relayado pra todo outro socket na sala do world de quem mandou — nenhum
código do servidor precisa registrar isso. É a via de escape que addons usam pros próprios
eventos de tempo real sem tocar em `server/index.ts`. Isso pula o caminho do envelope
`message` inteiro — emita o evento direto no socket (o `socket.emit(name, data)` interno do
`wsClient`, não `wsClient.send(name, data)`, já que `send()` sempre embrulha em `'message'`).

## Eventos Cliente→Servidor

Mandados embrulhados num único evento Socket.IO chamado `'message'`: `socket.emit('message',
{ type, data })`. `wsClient.send(type, data)` faz esse embrulho pra você.

| Tipo | Payload (`data`) | Descrição |
|------|-------------------|-----------|
| `user.identify` | `{ worldId }` | Identifica e inicia a sincronização; entra na sala `world:<id>` |
| `context.update` | `{ worldId, stageId? }` | Reescopo de salas: (re)entra em `world:<id>`, sai de toda sala `stage:*`, entra em `stage:<id>` se informado |
| `token.move` / `moveMember` | `{ id, x, y }` | Move token — dispara `cast.updated` e `token.moved` |
| `chat.message` | `{ content, speaker? }` | Envia mensagem |
| `chat.roll` | `{ formula, mode?, actorId?, speaker? }` | Rola dado |
| `stage.activate` | `{ stageId, worldId }` | Ativa stage (só GM) |
| `ping` | `{ timestamp? }` | Mede latência — servidor responde `pong` pro remetente e rebroadcasta `ping` pra sala do world |
| `canvas.ping` | `{ ...dados do marcador }` | Ping visual compartilhado (Ctrl+click) |
| `user.cursor` | `{ ...dados do cursor }` | Posição de cursor de alta frequência — relayado pra sala da stage, excluindo o remetente, nunca persistido |

## Notas

- **Documentos com campos embarcados (`ChildrenField`, ex: `items` no Actor) sempre chegam populados em `*.updated`** — `Document.update()` (core) popula esses campos antes de fazer o `Signal.broadcast`, então nunca vem com `items: undefined`/faltando por engano. Um array vazio no payload é um valor real (último filho removido), não "não populado" — quem escuta o evento e faz merge do estado local precisa tratar `undefined` e `[]` como coisas diferentes.
- `_socketId` num payload é usado pra exclusão do remetente (evitar eco) — alguns caminhos de código mais antigos chamam o mesmo campo de `_ws`.
- Eventos com Signal mas **sem relay WS nenhum** (sem `Signal.listen()` pra eles em `server/index.ts`, então `wsClient.on(...)` nunca vai disparar): `fog.*`, `zone.*`, `buff.*`, `campaign.*`, `bug-report.*`, `operation.progress`, `settings.*`, `module-settings.*`, `assets.*`.
- A maioria dos broadcasts tem **escopo de sala**, não são de verdade globais, apesar do helper do lado do servidor se chamar `broadcastToAll()` — ele resolve `worldId`/`stageId` a partir do payload e roteia via `broadcastToWorld`/`broadcastToStage`, só caindo pra um broadcast de verdade pra todo socket quando nenhum dos dois pode ser resolvido.
- `broadcastToWorldOwned()` existe pra documentos com `ownership` por linha (ex: actors) — ele itera os sockets ativos da sala e manda um payload redigido pra quem estiver abaixo do nível de permissão de Dono, em vez de um único `io.to(room).emit(...)`.
- Addons podem disparar eventos customizados via o relay `module.*`/`system.*`/`socket.*` acima, ou coordenar direto por um listener de `Signal` do lado do servidor.
