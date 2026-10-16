# Efeitos (`Loom.effects`)

`Loom.effects` é o lado de addon do sistema de efeitos. Ele aplica templates de item e de tile, remove e lista os efeitos aplicados de um cast ou de um actor, liga e desliga condições manuais e responde às requisições de jogadores que aguardam aprovação do GM. Cada chamada envia uma requisição para as rotas descritas em [API de Efeitos](../api/effects.md), e o servidor verifica as permissões ali.

```js
const result = await Loom.effects.apply({ templateId, targetCastId });
if (result.status === 'applied') console.log(result.effect.name);
```

## Membros

| Membro | Tipo | Quem pode chamar | Documentado em |
|--------|------|------------------|----------------|
| `apply(input)` | ação de template | Assistant GM, ou um jogador para os seus itens e tiles | [Templates](#templates) |
| `clear(input)` | ação de template | Assistant GM, ou um jogador para os efeitos de tile que possui | [Templates](#templates) |
| `list(input)` | leitura | Qualquer usuário logado do mundo | [Templates](#templates) |
| `condition(input)` | condição manual | Assistant GM | [Condições manuais](#condições-manuais) |
| `pendingRequests()` | aprovação | Assistant GM | [Requisições de aprovação](#requisições-de-aprovação) |
| `approve(requestId)` | aprovação | Assistant GM | [Requisições de aprovação](#requisições-de-aprovação) |
| `deny(requestId)` | aprovação | Assistant GM | [Requisições de aprovação](#requisições-de-aprovação) |
| `forActor(actorId)` | CRUD bruto | Qualquer usuário logado do mundo | [CRUD bruto](#crud-bruto) |
| `forItem(itemId)` | CRUD bruto | Qualquer usuário logado do mundo | [CRUD bruto](#crud-bruto) |
| `create(data)` | CRUD bruto | Assistant GM | [CRUD bruto](#crud-bruto) |
| `update(id, updates)` | CRUD bruto | Assistant GM | [CRUD bruto](#crud-bruto) |
| `delete(id)` | CRUD bruto | Assistant GM | [CRUD bruto](#crud-bruto) |
| `openConfig(buffId)` | janela avançada | Assistant GM | [Janela avançada](#janela-avançada) |

Os primeiros sete membros nunca lançam exceção. Uma requisição com falha resolve para um objeto de resultado cujo campo `ok` é `false`, ou cujo campo `status` é `'error'`. Os membros de CRUD bruto se comportam de forma diferente e são descritos em [CRUD bruto](#crud-bruto).

## Alvos

A maioria das chamadas recebe o alvo em `targetCastId` ou `targetActorId`. Um cast vinculado (um personagem de jogador) recebe os seus efeitos no actor, então o efeito acompanha o personagem entre stages. Um cast não vinculado (um NPC) guarda os efeitos em si mesmo. Quando os dois campos são enviados, `targetCastId` é usado. A exceção é `list`, que recebe `castId` ou `actorId`.

## Templates

### `apply(input)`

Copia um template para um alvo.

- **Entrada:** `{ templateId, targetCastId? , targetActorId? }`.
- **Retorna:** um `EffectApplyResult`, `{ status, effect?, requestId?, blockedBy?, error? }`.

| `status` | Quando acontece | Campos preenchidos |
|----------|-----------------|--------------------|
| `'applied'` | O efeito foi aplicado. | `effect`, a cópia aplicada |
| `'pending'` | O efeito de item de um jogador aguarda aprovação do GM. Um toast avisa o jogador. | `requestId` |
| `'blocked'` | O mesmo efeito (ou condição) já está ativo no alvo. | `blockedBy`, o id do efeito que bloqueia, e `error` |
| `'error'` | Qualquer outro caso: o servidor recusou a requisição (por exemplo `403`, `404`, `400`, `429` ou `500`), nenhum GM está conectado para aprovar o efeito de um jogador, ou a rede falhou. | `error`, a mensagem do servidor, `HTTP <status>`, ou `'network'` |

### `clear(input)`

Remove os efeitos aplicados de um alvo que combinam com um filtro. Templates nunca são removidos.

- **Entrada:** `{ targetCastId? , targetActorId? , filter }`. O `filter` aceita as chaves `all`, `origin`, `sourceType`, `sourceId`, `conditionId`, `tag` e `templateId`. Toda chave informada precisa combinar. `all: true` combina com todo efeito aplicado sozinho. Ver [Filtro de remoção](../api/effects.md#filtro-de-remoção).
- **Retorna:** `{ ok, removed, error? }`. `removed` é o array dos ids removidos, e fica vazio quando nada combinou ou a requisição falhou.

Um jogador só pode remover os efeitos de tile de um alvo que possui. O filtro precisa então ter `sourceType: 'tile'` e informar `sourceId` (o id do tile) ou `templateId`. Qualquer outra requisição de um jogador retorna `{ ok: false, removed: [], error: 'Assistant GM permission required' }`. Ver [Remoção de tile pelo jogador](../api/effects.md#remoção-de-tile-pelo-jogador).

```js
const cleared = await Loom.effects.clear({
  targetActorId: actor.id,
  filter: { sourceType: 'tile', sourceId: tile.id },
});
console.log(cleared.removed);
```

### `list(input)`

Lista os efeitos aplicados de um cast ou de um actor. Templates nunca são listados.

- **Entrada:** `{ castId? }` ou `{ actorId? }`. Os nomes das chaves aqui são `castId` e `actorId`, não os nomes `target…` usados pelas outras chamadas.
- **Retorna:** `{ ok, effects, error? }`. `effects` é um array de efeitos aplicados. Um cast vinculado retorna os efeitos do seu actor.

Quando nenhuma das duas chaves é informada, a chamada não envia requisição. Ela retorna `{ ok: false, effects: [], error: 'castId or actorId is required' }`.

## Condições manuais

### `condition(input)`

Liga ou desliga uma condição em um cast ou actor, sem template. A condição também aparece como status marker nos casts do alvo (ver [Status markers](../api/effects.md#status-markers)).

- **Entrada:** `{ conditionId, on, targetCastId? , targetActorId? , name? , icon? }`. `on` é `true` ou `false`. `name` e `icon` só valem quando `on` é `true`, e `name` tem como padrão `conditionId`.
- **Retorna:** `{ ok, effect?, removed, blockedBy?, error? }`.

| Caso | Resultado |
|------|-----------|
| `on: true`, criado | `{ ok: true, effect, removed: [] }` |
| `on: false` | `{ ok: true, removed }`. `removed` pode estar vazio. O marker é removido em qualquer caso, inclusive um marker definido à mão. |
| A condição já está ativa no alvo | `{ ok: false, removed: [], blockedBy, error }` |
| Qualquer outra falha | `{ ok: false, removed: [], error }` |

```js
await Loom.effects.condition({ targetCastId: cast.id, conditionId: 'prone', on: true });
await Loom.effects.condition({ targetCastId: cast.id, conditionId: 'prone', on: false });
```

## Requisições de aprovação

Quando o mundo tem aprovação do GM ligada, o efeito de item de um jogador fica em espera até um Assistant GM responder (ver [Aprovação do GM](../api/effects.md#aprovação-do-gm)). Estes membros permitem que um sistema mostre e responda essas requisições.

### `pendingRequests()`

Lista as requisições em espera no mundo de quem chama, da mais antiga para a mais nova.

- **Retorna:** `{ ok, requests, error? }`. Cada requisição é `{ id, worldId, userId, templateId, target, createdAt }`. `target` é `{ castId? , actorId? }`, com o alvo que o jogador enviou, e `createdAt` é a hora do servidor em milissegundos.

### `approve(requestId)`

Aplica um efeito de jogador em espera. O servidor verifica tudo de novo, como o jogador estaria agora. A requisição é removida qualquer que seja o resultado, então só pode ser respondida uma vez.

- **Retorna:** `{ ok, effect?, error? }`. `error` é a mensagem do servidor, por exemplo `'Effect request not found'` quando a requisição expirou ou já foi respondida.

### `deny(requestId)`

Descarta um efeito de jogador em espera e avisa o jogador.

- **Retorna:** `{ ok, error? }`.

```js
const { ok, requests } = await Loom.effects.pendingRequests();
for (const request of ok ? requests : []) {
  await Loom.effects.approve(request.id);
}
```

## Janela avançada

### `openConfig(buffId)`

Abre a janela avançada de um efeito. A janela edita todos os campos do registro: o nome, o ícone, a descrição, a condição, a duração e a sua unidade, o momento de expiração (somente para turnos), as tags, as flags de remoção e transferência, a lista de alterações e o visual que um token desenha, com uma prévia ao vivo desse visual. O botão **Avançado** de cada linha de efeito nas fichas de actor e de item abre a mesma janela.

Um visual é a aparência que um token desenha para um efeito. O tipo é `aura`, `tint`, `glow`, `icon` ou `particles`. Um visual `particles` desenha pequenas formas que sobem, caem ou cintilam ao redor do token. O estilo é um de `smoke`, `embers`, `bubbles`, `sparkles`, `hearts`, `drops` ou `zzz`, e o padrão é `smoke`. `color` é `#rrggbb`, `intensity` é de 0 a 1 e define a opacidade máxima das partículas, `speed` é de 0 a 3 (0 é o mais lento, não parado), e `size` é de 0,5 a 3 e escala as partículas e a área onde se espalham. O visual inteiro tem no máximo 200 caracteres de JSON. Com efeitos reduzidos, um token mantém apenas os visuais `icon`, então as partículas não são desenhadas.

```js
await Loom.effects.openConfig(effect.id);
```

- **Entrada:** `buffId`, o id de um template de efeito ou de uma cópia aplicada.
- **Retorna:** uma promise que resolve quando a janela abre, ou quando a recusa é mostrada. Ela não lança exceção.

Somente um Assistente de GM (role 3) ou acima pode abrir a janela. Qualquer outro papel recebe o toast de erro padrão e nenhuma janela. O servidor aplica a mesma regra em [PUT /api/buffs/:id](../api/buffs.md#put-id).

Salvar envia somente os campos que mudaram. A janela valida os valores antes, com os mesmos limites do servidor, e aponta o campo errado. Um erro do servidor é mostrado assim que chega, e a janela continua aberta para que nada digitado se perca.

Cada linha de alteração tem uma chave de atributo (um caminho com pontos, como `system.attributes.hp`), um modo (`add`, `multiply`, `override`, `upgrade` ou `downgrade`), um valor e uma prioridade. As alterações são aplicadas por prioridade, da menor para a maior. Os modos `add`, `multiply`, `upgrade` e `downgrade` exigem um número.

## Exemplo: uma spell que aplica um efeito

Este passo a passo acompanha uma spell, desde o template até o fim do efeito. Os mesmos passos valem para qualquer item (uma poção, um amuleto) ou tile.

### Passo 1: crie o template uma vez

O template é a cópia-mestra do efeito. Crie-o uma vez, por exemplo quando um GM monta a spell ou quando o sistema a importa. Um template pertence ao item da spell, então tem um `itemId` e nenhum `actorId` ou `castId`.

```js
const template = await Loom.effects.create({
  itemId: spell.id,
  name: 'Poison Cloud',
  icon: 'fa-solid fa-skull-crossbones',
  description: 'Poisoned for 3 turns.',
  durationUnit: 'turns',
  duration: 3,
  expireOn: 'turn-end',
  conditionId: 'poisoned',
  tags: ['magic', 'poison'],
  removeOnCombatEnd: true,
  changes: [{ key: 'attack', mode: 'add', value: -2 }],
  visual: { kind: 'particles', style: 'smoke', color: '#3fae3f', intensity: 0.8, speed: 1, size: 1 },
});
```

O mundo vem da sessão, porque a chamada envia um `itemId`. O servidor valida os outros campos assim:

- `durationUnit` é um de `permanent`, `rounds`, `turns`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` ou `years`. Um efeito `permanent` grava `duration` como `-1`.
- `visual` é validado: `kind` é `aura`, `tint`, `glow`, `icon` ou `particles`; `style` é um dos estilos de partícula; `color` é `#rrggbb`; `intensity` vai de 0 a 1; `speed` de 0 a 3; `size` de 0,5 a 3.
- Cada cópia aplicada copia o visual do template. Quando o template não tem visual, o token desenha o preset do seu `conditionId`.
- Com efeitos reduzidos, as partículas não são desenhadas.

O mesmo template pode ser montado à mão, pela lista de efeitos da ficha do item. O botão **Advanced** dessa linha abre a janela avançada (`openConfig`), que edita todos os campos, inclusive o visual, com uma prévia ao vivo.

### Passo 2: aplique a um alvo

```js
const result = await Loom.effects.apply({ templateId: template.id, targetCastId: target.id });

switch (result.status) {
  case 'applied':
    console.log('Efeito ativo:', result.effect.name);
    break;
  case 'pending':
    // A aprovação do GM está ligada: o GM vê um diálogo, e o jogador recebe um toast.
    console.log('Aguardando aprovação do GM:', result.requestId);
    break;
  case 'blocked':
    console.warn('Já ativo neste alvo:', result.blockedBy);
    break;
  case 'error':
    console.error(result.error);
    break;
}
```

O alvo é o cast escolhido pelo jogador. O servidor resolve um cast vinculado (um personagem de jogador) para o seu actor, então o efeito é compartilhado por todos os tokens daquele personagem. Um cast de NPC não vinculado guarda o próprio efeito.

Quem chama precisa ser Assistente de GM, ou ter direito de edição sobre o actor que possui o item da spell.

### Passo 3: como o efeito termina

O efeito expira sozinho:

- Turnos contam no limite de turno do alvo indicado por `expireOn`.
- Rodadas contam quando a rodada muda.
- Unidades de tempo (`seconds` a `years`) contam pelo tempo do mundo. Um mundo pausado pausa essas contagens.
- `removeOnCombatEnd: true` remove o efeito quando o combate termina.

Um GM pode removê-lo antes, por template ou por condição. O filtro precisa de pelo menos um critério:

```js
await Loom.effects.clear({ targetCastId: target.id, filter: { templateId: template.id } });
await Loom.effects.clear({ targetCastId: target.id, filter: { conditionId: 'poisoned' } });
```

### Passo 4: leia e acompanhe as mudanças

`Loom.effects.list({ castId })` retorna os efeitos aplicados de um alvo. Um cast vinculado retorna os efeitos do seu actor.

As atualizações ao vivo chegam como os Signals `buff.created`, `buff.updated` e `buff.deleted`. Ver [Signals](../api/effects.md#signals).

Não há seletor de alvo embutido nem botão de cast. O código do sistema decide o alvo e chama `apply`.

## CRUD bruto

Estes membros chamam as rotas `/api/buffs`. Eles trabalham sobre os registros de efeito gravados e ignoram as regras de template: um `create` bruto não verifica Sem empilhamento e não copia um template. O servidor só valida os valores dos campos. Prefira `apply`, `clear` e `condition` para a jogabilidade.

| Membro | Requisição | Retorna |
|--------|------------|---------|
| `forActor(actorId)` | `GET /api/buffs/actor/:actorId` | `Promise<EffectData[]>` |
| `forItem(itemId)` | `GET /api/buffs/item/:itemId` | `Promise<EffectData[]>` |
| `create(data)` | `POST /api/buffs` | `Promise<EffectData>`. `data` precisa de `name` e de um entre `actorId`, `itemId` ou `tileId`. Também precisa de `worldId`, a menos que tenha `itemId`; o mundo da sessão é usado quando `worldId` é omitido. |
| `update(id, updates)` | `PUT /api/buffs/:id` | `Promise<EffectData>`. Só os campos informados mudam. |
| `delete(id)` | `DELETE /api/buffs/:id` | `Promise<{ success: boolean }>` |

`EffectData` é o formato declarado em `client/core/effects-api.ts`: `id`, `worldId`, `actorId`, `itemId`, `name`, `icon`, `origin`, `duration`, `disabled` e `changes`. O servidor devolve mais campos, como `castId`, `durationUnit` e `sourceType`.

Diferente dos outros membros, estas chamadas **lançam exceção** quando a requisição falha. O erro é um `ApiError` com um número `status` e uma `message`. Envolva-as em `try`/`catch`:

```js
try {
  await Loom.effects.update(effect.id, { disabled: true });
} catch (err) {
  console.warn(err.status, err.message);
}
```

Um `delete` em um efeito aplicado também remove a condição dos status markers do cast, como faz `clear`. Ver [Status markers](../api/effects.md#status-markers).
