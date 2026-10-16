# Criação de Sistemas (Rulesets)

Sistemas (rulesets) definem as regras de jogo: tipos de actor/item, dados padrão, validação, sheets, rolls.

> ⚡ **Quer começar rápido?** Use o scaffold:
>
> ```bash
> npm run create:ruleset -- meu-sistema
> ```
>
> Isso gera a estrutura completa com exemplos comentados.
>
> ⚠️ **Dois pontos do scaffold atual que você precisa corrigir antes de rodar:**
> - O `client.js` gerado importa `Hooks` de `/_loom/sdk/index.js`, mas o SDK não exporta
>   `Hooks` (o nome correto é `LoomHooks`). Sem essa troca o módulo não carrega.
> - O `styles/system.css` e o `lang/en.json` gerados só são usados se estiverem declarados no
>   `ruleset.json` (campos `styles` e `languages`). O scaffold não os declara.

---

## Índice

1. [Estrutura de diretórios](#1-estrutura-de-diretórios)
2. [Manifest (ruleset.json)](#2-manifest-rulesetjson)
3. [Entry point (client.js)](#3-entry-point-clientjs)
4. [LoomSystem — a interface completa](#4-loomsystem--a-interface-completa)
5. [SheetSchema — fichas de actor e item](#5-sheetschema--fichas-de-actor-e-item)
6. [Dots field — pips na ficha](#6-dots-field--pips-na-ficha)
7. [dispatchRoll, preRoll e meta](#7-dispatchroll-preroll-e-meta)
8. [Cast vs Actor — entendendo a diferença](#8-cast-vs-actor--entendendo-a-diferença)
9. [LoomHooks disponíveis para sistemas](#9-hooks-disponíveis-para-sistemas)
10. [Keybinds — atalhos do sistema](#10-keybinds--atalhos-do-sistema)
11. [Wraps — interceptação de funções core](#11-wraps--interceptação-de-funções-core)
12. [Glossário de Conceitos](#12-glossário-de-conceitos)
13. [Troubleshooting](#13-troubleshooting)
14. [O que um ruleset NÃO pode fazer](#14-o-que-um-ruleset-não-pode-fazer)

---

## 1. Estrutura de diretórios

```
<DataRoot>/marketplace/rulesets/meu-sistema/
├── ruleset.json          ← manifesto (obrigatório)
├── client.js             ← entry point client-side (obrigatório)
├── sheets/               ← sheets customizadas (opcional; só carrega se o client.js importar)
│   ├── character.mjs
│   └── item.mjs
├── templates/            ← templates Handlebars (opcional), extensão `.hbs`
│   └── example.hbs
├── styles/               ← CSS do sistema (opcional; declarado em `styles` do manifesto)
│   └── system.css
└── lang/                 ← traduções (opcional; declarado em `languages` do manifesto)
    └── pt-BR.json
```

> **O loader só importa o `client`.** Ele carrega do disco, além do `client.js`, apenas o que
> o manifesto declara: os arquivos de `styles` (injetados no DOM) e os de `languages`
> (traduções, com fallback para `en`). Arquivos na pasta `styles/` ou `lang/` que não estão
> declarados são ignorados. A pasta `sheets/` não é carregada automaticamente: o `client.js`
> precisa importar cada arquivo (`import './sheets/character.mjs';`). A pasta `templates/` só
> é usada quando o seu código chama `Loom.renderTemplate('/marketplace/rulesets/<nome>/templates/x.hbs', dados)`
> ou referencia o arquivo em `PARTS` de uma sheet customizada. O caminho precisa bater exatamente
> com o arquivo: o engine não troca extensão, e um caminho errado devolve o HTML do dev server.

---

## 2. Manifest (ruleset.json)

```json
{
  "engine": "loom",
  "engineVersion": ">=0.1.0",
  "type": "ruleset",
  "name": "meu-sistema",
  "title": "Meu Sistema",
  "version": "0.1.0",
  "description": "Descrição do meu sistema",
  "author": "Seu Nome",
  "client": "client.js",
  "active": true,
  "styles": ["styles/system.css"],
  "languages": [
    { "lang": "pt-BR", "name": "Português (Brasil)", "path": "lang/pt-BR.json" }
  ],
  "actorTypes": ["character", "npc"],
  "itemTypes": ["weapon", "armor"]
}
```

| Campo            | Tipo         | Descrição                                |
| ---------------- | ------------ | ------------------------------------------ |
| `engine`       | `"loom"`   | Identifica o pacote como LoomVTT. **Obrigatório para instalar pelo marketplace** (`installer.ts:161`); a varredura de uma pasta copiada manualmente não checa |
| `type`         | `"ruleset"` | Se presente, precisa bater com o tipo escolhido na instalação (`installer.ts:182`). O loader decide o tipo pela pasta (`rulesets/`) |
| `name`         | `string`   | Identificador único (minúsculas, dígitos e hífen; o validador rejeita outros caracteres) |
| `title`        | `string`   | Nome de exibição                         |
| `version`      | `string`   | Semver                                     |
| `engineVersion`| `string`   | Versão do Loom para a qual o pacote foi feito (ex: `>=0.1.0`). Informativo: só gera aviso no log, não bloqueia |
| `description`, `author` | `string` | Metadados exibidos no Setup Hub |
| `client`       | `string`   | Entry point client-side (JS), importado com `import()` |
| `active`       | `boolean`  | Se ativo globalmente (default: true; só `false` desativa) |
| `styles`       | `string[]` | Arquivos CSS injetados no DOM (caminhos relativos à pasta do sistema) |
| `languages`    | `{lang, name?, path}[]` | Arquivos de tradução carregados para o idioma ativo; sem o idioma, usa `en` |
| `actorTypes`   | `string[]` | Tipos de actor válidos. **O servidor valida pelo manifesto** (`actors.ts:36`), não pelo `client.js` |
| `itemTypes`    | `string[]` | Tipos de item válidos. **O servidor valida pelo manifesto** (`items.ts:39-45`) |
| `dependencies` | `string[]` | Addons/sistemas que precisam estar ativos (o servidor pula o pacote se faltar algum) |
| `conflicts`    | `string[]` | Addons/sistemas que não podem estar ativos junto (o servidor pula o pacote) |

Campos `core` (ignorado em rulesets), `mount` e `signals` não têm efeito no motor: não os use.

---

## 3. Entry point (client.js)

O `client.js` é carregado via `import()` dinâmico no navegador. Use o SDK:

```javascript
import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'meu-sistema',
  title: 'Meu Sistema',
  version: '0.1.0',
  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor'],
  // ... see the full interface below
}));
```

> `actorTypes` e `itemTypes` precisam estar também no `ruleset.json`: é ali que o servidor os
> lê para validar criação de actors e items. Declarar só no `defineSystem` deixa o servidor sem
> os tipos.

---

## 4. LoomSystem — a interface completa

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];

  // Required
  getDefaultData(type: string): Record<string, any>;

  // Optional
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null; // no effect, see below
  getItemDefaultData?(itemType: string): Record<string, any>; // not consumed by the engine

  // Meta (no effect when set here, see below)
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}
```

> ⚠️ **Resumo do que o motor realmente consome** (verificado no código):
> - `getDefaultData`, `getSheetSchema` (ficha de actor), `prepareData` (cliente, ver adiante),
>   `styles` (string CSS injetada ao ativar o sistema), `validateData` e `rollInitiative` são
>   declarados, mas `validateData` e `rollInitiative` **não são invocados** pelo motor.
> - `getItemSheetSchema` **não tem efeito**: a ficha de item busca o schema em
>   `/api/systems/active/item-sheet`, e esse endpoint sempre responde `null` para rulesets, porque
>   o registro de sistemas do servidor fica vazio (`item-sheet-window.ts:80`,
>   `api/systems.ts:94`, `index.ts:1634-1637`). A ficha de item fica no layout genérico.
> - `getItemDefaultData` não é usado por ninguém.
> - `changelogUrl`, `wikiUrl` e `bugsUrl` **não aparecem na HUD**: o sidebar lê esses campos do
>   payload `init`, que vem do registro do servidor (vazio para rulesets) (`sidebar.ts:2557`,
>   `index.ts:1651-1653`). `licenseNotice`, por sua vez, é lido do próprio `ruleset.json`.

### `getDefaultData(type)`

Retorna o `systemData` inicial do actor/item quando criado. Quem aplica esse valor é o **cliente**
ao criar pela sidebar e pelo criador de item (`sidebar.ts:3915`, `item-create-window.ts:92`). O
servidor só o aplicaria se o registro do sistema estivesse preenchido, o que não acontece
(`actors.ts:449`):

```javascript
getDefaultData(type) {
  if (type === 'character') {
    return {
      hp: { value: 10, max: 10 },
      attributes: { str: 10, dex: 10, con: 10 },
      level: 1,
    };
  }
  return {};
}
```

### `validateData(type, data)` (opcional)

> ⚠️ **Declarado na interface, mas NÃO é invocado pelo motor** (verificado no client e no
> server — nenhum call site existe). Incluir este método não bloqueia nem altera saves.
> Faça a validação onde ela tem efeito real: na sua sheet (antes do `api.put`) ou na sua
> classe de documento. Assinatura (referência, caso um dia seja ligado):

```javascript
validateData(type, data) {
  const errors = [];
  if (data.hp?.value > data.hp?.max) errors.push('HP não pode exceder máximo');
  return { valid: errors.length === 0, errors };
}
```

### Classes Customizadas e `prepareDerivedData()`

Para derivar campos calculados (como atributos dependentes) que rodam antes de renderizar a ficha ou rolar dados, registre uma classe de documento customizada no CONFIG.

> ⚠️ **Não existe `LoomActor` no SDK.** Os exports de classes são `LoomDocumentSheet`,
> `LoomActorSheet` e `LoomItemSheet` (renderização via `LoomHandlebarsMixin(...)` +
> `static PARTS`) — nenhum deles é a classe de documento. A classe de documento é
> `CONFIG.Actor.documentClass` (alias do `window.Loom.config.Actor.documentClass` — os
> dois apontam pro mesmo objeto).

```javascript
class MeuActor extends CONFIG.Actor.documentClass {
  // Required for the generic sheet (ActorSheetWindow): the engine only runs the preparation
  // cycle when this class itself defines prepareData (document-sheet.ts:113-114).
  prepareData() {
    return super.prepareData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Example: compute strength modifier
    if (this.systemData.attributes) {
      this.systemData.derived = {
        ...(this.systemData.derived || {}),
        strMod: Math.floor((this.systemData.attributes.str || 10) / 2) - 5,
      };
    }
  }
}

// Register on CONFIG after defining the system (CONFIG = window.Loom.config)
CONFIG.Actor.documentClass = MeuActor;
```

Quatro detalhes que quebram silenciosamente se ignorados:

- **Prefira `this.systemData` a `this.system`.** `systemData` é o campo que é salvo no banco.
  `_runPrepareData` (`document-sheet.ts:83-89`) também cria um getter `system` no row da ficha,
  então `this.system` não vem `undefined` ali; mas ele é só um alias para `systemData`, e a
  documentação do SDK usa `systemData`.
- **Na ficha genérica, `prepareDerivedData()` sozinho não roda.** `_runPrepareData` só chama o
  ciclo de preparação quando a **sua própria classe** define `prepareData` no prototype
  (`document-sheet.ts:113-114`, `hasOwnProperty`). Se a classe só sobrescreve
  `prepareDerivedData`, a ficha genérica (`ActorSheetWindow`, o padrão para actors) nunca a
  chama. Solução: sobrescreva `prepareData()` e chame `super.prepareData()`, que por sua vez
  chama `prepareDerivedData()`. Uma sheet customizada que estende `LoomActorSheet`
  chama `prepareDerivedData()` diretamente (`actor-sheet.ts:87`).
- **Todo valor calculado vai em `systemData.derived`.** O LoomVTT não separa dado de origem
  de dado derivado como sistemas antigos faziam: se você escrever direto num campo real do `systemData`
  (ex: `sd.resources.vitae.max = 10 + stamina`), e a sheet salvar o `systemData` inteiro
  de volta, o valor vira dado persistido e **para de recalcular** quando a origem mudar
  (bug do "campo grudado"). Valores dentro de `derived` seguem a mesma regra — todo save
  que mandar o `systemData` inteiro precisa remover a chave `derived` antes do PUT
  (veja [SDK Globals — prepareData em fichas](../sdk/globals.md#preparedata-em-fichas-sheets--quando-roda-e-o-que-não-fazer)).
- **`this` não passou pelo construtor da sua classe.** Na ficha genérica, o motor troca
  temporariamente o prototype do **row cru da API** pelo da sua classe e chama `prepareData()`
  (`document-sheet.ts:138-151`). Os métodos da classe ficam acessíveis, mas campos que seriam
  criados no construtor não existem. Use `this.systemData` e não dependa de estado de instância.
  Nas coleções (`actors-collection.ts`) o objeto é criado com `new documentClass(row)`.

### Active Effects

O sistema nativo de Efeitos Ativos suporta modos como `upgrade`, `downgrade` e ordenação por `priority`. O SDK fornece a API `effects` para manipular esses dados programaticamente:

```javascript
import { effects } from '/_loom/sdk/index.js';

effects.forActor(actorId);      // GET /buffs/actor/:id — actor effects
effects.forItem(itemId);        // GET /buffs/item/:id — item effects
effects.create({                // POST /buffs — single object; actorId or itemId goes inside it
  name: 'Força Aumentada',
  actorId,
  changes: [{ key: 'attributes.str', mode: 'add', value: 2 }],
});
effects.update(id, { disabled: true }); // PUT /buffs/:id
effects.delete(id);                     // DELETE /buffs/:id
```

Os `mode` aceitos em `changes` são `add`, `multiply`, `override`, `upgrade` e `downgrade`
(`packages/sdk/src/index.ts:717-724`). O servidor aplica os efeitos ativos em `systemData`
antes de responder às rotas de actor (`effects.ts`, `prepareActor`).

> ⚠️ **Campos prefixados com `_` NÃO são automaticamente derivados.** Diferente de outros
> VTTs, o motor do LoomVTT não stripa campos que começam com `_` — tudo que estiver no
> `systemData` é persistido como está. Dado calculado que não deve ser salvo vai
> **sempre** em `systemData.derived` (ver seção acima), e o save precisa removê-lo com
> um `stripDerived()` antes do PUT.

### `rollInitiative(actor)` (opcional)

> ⚠️ **Declarado na interface, mas NÃO é invocado pelo motor** (verificado no client e no
> server — nenhum call site existe). Não espere que ele seja chamado automaticamente ao
> iniciar combate. Assinatura (referência, caso um dia seja ligado):

```javascript
rollInitiative(actor) {
  const mod = Math.floor(((actor.attributes?.dex || 10) / 2) - 5);
  return { formula: `1d20${mod >= 0 ? '+' : ''}${mod}`, total: 0 };
}
```

### `prepareData(actor)` da LoomSystem vs classe de documento

A `LoomSystem` também declara `prepareData?(actor)`, mas **atenção ao contexto de execução**:

- **`LoomSystem.prepareData(actor)` roda no CLIENTE**, ao abrir a ficha: no `_runPrepareData`
  da ficha genérica (`document-sheet.ts:96-104`) e no `loadDocument` de `LoomActorSheet`
  (`actor-sheet.ts:97-104`). **O valor retornado é descartado**: altere o objeto recebido,
  no lugar.
- **A chamada no servidor (`prepareActor()`, `server/applications/lib/actor-prepare.ts:9-11`)
  nunca acontece.** Ela usa o registro de sistemas do servidor, que fica vazio para rulesets
  (`system-registry.ts`, `index.ts:1634-1637`). Não conte com derivação no servidor nem com
  `prepareData` alterando a resposta da API.
- **`CONFIG.Actor.documentClass.prepareDerivedData()`** é o outro caminho, também no cliente
  (ver a seção acima sobre quando ele roda).

Como o resultado não persiste, qualquer valor calculado que vá para `systemData` precisa seguir
a regra de `systemData.derived`.

```javascript
// LoomSystem.prepareData (client-side): mutate the object in place. The return value is ignored.
prepareData(actor) {
  actor.systemData.derived = {
    ...(actor.systemData.derived || {}),
    total: /* calculated */ 0,
  };
}
```

---

## 5. SheetSchema — fichas de actor e item

Define quais campos aparecem na ficha e como são renderizados:

```javascript
getSheetSchema(actorType) {
  return {
    tabs: [
      {
        id: 'attributes',
        label: 'Atributos',
        fields: [
          { key: 'attributes.str', label: 'Força', type: 'number' },
          { key: 'level', label: 'Nível', type: 'number' },
        ],
      },
      {
        id: 'combat',
        label: 'Combate',
        fields: [
          { key: 'hp.value', label: 'HP', type: 'number' },
          { key: 'hp.max', label: 'HP Máx', type: 'number' },
        ],
      },
    ],
  };
}
```

### Tipos de field

| Type         | Descrição                    |
| ------------ | ------------------------------ |
| `text`     | Input de texto                 |
| `number`   | Input numérico (aceita `rollable` + `formula`, ver abaixo) |
| `textarea` | Área de texto                 |
| `boolean`  | Checkbox                       |
| `dots`     | Pips clicáveis (máx:`max`, padrão 5) |
| `select`   | Lista de opções: `options: [{ value, label }]` |
| `color`    | Seletor de cor                 |
| `image`    | Caminho de imagem, escolhido pelo file picker |
| `square-counter` | Quadrados clicáveis (`max` = total); cada clique cicla vazio → superficial → agravado |
| `actions`  | Botões de ações de item, com a fórmula de cada uma |

Um `type` fora desta lista (por exemplo, `dot` em vez de `dots`) não quebra: o campo vira texto
simples e o console mostra um erro (`sheet-schema.ts:72-74`). Procure esse erro quando um campo
"não faz nada".

`number` e `dots` podem ter `rollable: true` com uma `formula` (ex: `"1d10 + @attributes.forca"`):
o rótulo vira um botão que rola o dado (`sheet-schema.ts:57-61`, `packages/sdk/src/index.ts:131-148`).

---

## 6. Dots field — pips na ficha

O tipo `dots` renderiza pips clicáveis (útil para Storyteller / WoD / sistemas com pontos):

```javascript
{ key: 'willpower', label: 'Força de Vontade', type: 'dots', max: 10 }
{ key: 'attributes.might', label: 'Might', type: 'dots', max: 5 }
```

Clicar em um pip define o valor até ele. Clicar no pip que já está no valor atual reduz em um
(`handleDotsClick`, `sheet-schema.ts:184-195`). A mudança vai para um `input` oculto e **só é
salva em `systemData` quando a ficha é enviada (submit)**, não a cada clique.

---

## 7. dispatchRoll, preRoll e meta

### dispatchRoll

Envia uma rolagem para o chat. Esta é a versão exportada pelo SDK (`Loom.dispatchRoll` no
`window`). O worldId, o usuário e a cor são preenchidos sozinhos a partir da sessão ativa
(`main.ts:304-319`); o sistema passa só a fórmula:

```typescript
import { dispatchRoll } from '/_loom/sdk/index.js';

dispatchRoll({
  formula: string,                 // e.g. '1d20+5'
  actorId?: string,
  mode?: 'public' | 'gmroll' | 'blindroll' | 'selfroll',
  meta?: Record<string, any>,      // shown as badges on the roll card
});
```

> A função interna de `roll-dispatch.ts` exige `worldId`, `userId`, `userName` e `userColor`.
> Sistemas não devem usá-la: use a do SDK.

### Hook `preRoll`

Disparado antes de cada rolagem. Permite modificar a fórmula ou adicionar metadados
(`roll-dispatch.ts:128`):

```javascript
LoomHooks.on('preRoll', (ctx) => {
  // ctx: { originalFormula, formula, mode, actorId, meta }
  // originalFormula: what was typed, before custom dice were resolved
  ctx.meta = { ...ctx.meta, arma: 'Espada Longa' };
  // ctx.formula — you can change it before the roll is sent
});
```

Para assumir a rolagem inteira (dados próprios, card próprio), registre um listener de
`chatRollCommand`: se ele retornar `false`, nada é enviado ao servidor (`roll-dispatch.ts:126`).

Os metadados em `meta` aparecem como badges no card de rolagem (`roll-card.ts:79-85`).

---

## 8. Cast vs Actor — entendendo a diferença

| Conceito              | Descrição                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Actor**       | Entidade de dados (ficha). Contém`systemData` com atributos, HP, etc. Persiste no banco.                                                            |
| **Cast Member** | Representação visual de um Actor no canvas. Tem posição (x, y), rotação, efeitos visuais.                                                 |
| **isLinked**    | Se `true`, o Cast Member usa o `systemData` do Actor: alterar um altera o outro (PC). Se `false`, o Cast Member recebe uma **cópia** do `systemData` do Actor na criação (`api/cast.ts:131-143`) e depois fica isolado (NPC). Sem `actorId`, não há ficha. |

**Regra prática:** Actors têm `systemData` (regras). Cast Members têm posição/visuais. Um Actor pode ter zero ou mais Cast Members (ex: mesmo NPC em múltiplas cenas).

---

## 9. Eventos (LoomHooks) para sistemas

### Hooks de documento no cliente (actors e items)

A HUD dispara estes hooks no **cliente** quando o servidor envia um evento de actor ou item.
Escute-os com `LoomHooks.on()`. O nome é singular, e o payload é o documento:

| Hook | Payload | Disparo |
|------|---------|---------|
| `actor.created` | `document` | Actor criado (`sidebar.ts:1512`) |
| `actor.updated` | `document` | Actor atualizado (`sidebar.ts:1525`) |
| `actor.deleted` | `id` | Actor deletado (`sidebar.ts:1543`) |
| `item.created` | `document` | Item criado (`sidebar.ts:1555`, `game-hud.ts:2414`) |
| `item.updated` | `document` | Item atualizado (`sidebar.ts:1573`) |
| `item.deleted` | `id` | Item deletado (`sidebar.ts:1587`) |

Cada um também dispara um alias (`createActor`, `updateActor`, `deleteActor`, `createItem`,
`updateItem`, `deleteItem`) e `createDocument` / `updateDocument` / `deleteDocument` com o
tipo (`'actor'` ou `'item'`) como primeiro argumento.

> **Cast, journal, wall, tiles e light não disparam hooks no `LoomHooks`.** Os eventos
> `cast.*`, `journal.*`, `wall.*`, `light.*` e `tiles.*` chegam pelo WebSocket e são tratados
> internamente pela HUD (`game-hud.ts:2242-2390`). O SDK não expõe o cliente WebSocket, então
> um sistema não consegue ouvi-los. Use `Loom.user.targets` para alvos (`token.target`), e veja
> [`websocket/events.md`](../websocket/events.md) para o catálogo.

> **Nota:** Os hooks `preCreate{Name}` / `onCreate{Name}` que disparam no **servidor**
> (via `LoomHooks.call()` em `server/applications/data/document.ts`) **não** são
> relayados para o cliente. Para ouvir criação de actor/item no cliente, use `actor.created`
> e `item.created`.

> **Nota:** `actor.updated`/`item.updated` sempre chegam com os campos embarcados
> (`ChildrenField`, ex: `items` no Actor) já populados — o core popula antes de
> transmitir. Um array vazio no payload é um valor real (última criança foi
> removida), não "ainda não populado". Se sua sheet salva com `api.put(...)` fora
> do fluxo normal de formulário (ex: clique de dot que chama `api.put` direto em
> vez de deixar o form fazer `submit`), não precisa se preocupar em popular nada
> na mão — só não sobrescreva `this.document` com a resposta crua do próprio
> `api.put` se ela não tiver os campos embarcados; espere o evento
> `actor.updated` / `item.updated` chegar, que esse já vem completo.

### LoomHooks de sistema (client-side)

| Hook | Payload | Descrição |
|------|---------|-----------|
| `preRoll` | `{ originalFormula, formula, mode, actorId, meta }` | Antes de rolar dados (pode alterar `formula` e `meta`) |
| `chatRollCommand` | mesmo payload de `preRoll` | Chamado com `LoomHooks.call`: retornar `false` assume a rolagem |
| `chat.roll` | o objeto `roll` (não o evento inteiro) | Nova rolagem chegou ao chat |

> `chat.message` **não** é disparado no `LoomHooks`. Existe só como evento WebSocket interno.

### Uso

```javascript
import { LoomHooks } from '/_loom/sdk/index.js';

const onActorCreated = (actor) => {
  console.log('Actor criado:', actor.name);
};

LoomHooks.on('actor.created', onActorCreated);

// To remove: pass the SAME function back (LoomHooks.on returns void,
// not an unsubscribe handle, so passing its return value here removes nothing).
LoomHooks.off('actor.created', onActorCreated);
```

---

## 10. Keybinds — atalhos do sistema

Registre atalhos de teclado para ações do seu sistema:

```javascript
import { keybinds } from '/_loom/sdk/index.js';

keybinds.register({
  id: 'meu-sistema-ataque-especial',
  label: 'Ataque Especial',
  description: 'Rola um ataque especial do sistema',
  defaultKey: 'Ctrl+Shift+Z',
  category: 'Meu Sistema',
  onPress: () => {
    // trigger action
  },
});
```

Não há lista fechada de teclas. A combinação é montada a partir de `event.key` (ou `event.code`,
se a opção `loom_universal_keys` estiver ativa) com prefixos `Ctrl+` (também aceita `Meta`),
`Shift+` ou `Ctrl+Shift+`. Letras de um caractere viram maiúsculas (`z` vira `Z`), então escreva
`defaultKey` assim: `'Ctrl+Shift+Z'`. Não existe prefixo `Alt+`. Os atalhos são ignorados quando o
foco está em `input`, `textarea` ou elemento `contenteditable` (`game-hud.ts:3240-3273`).

Docs completas: [SDK Keybinds](../sdk/keybinds.md).

---

## 11. Wraps — interceptação de funções core

Sistema de wrapping (alternativa a bibliotecas de wrapping de terceiros):

```javascript
import { wrap } from '/_loom/sdk/index.js';

// Wrap your own function
const minhaFn = wrap((x) => x * 2);
minhaFn.wrap((original, x) => {
  console.log('interceptado');
  return original(x + 1);
});

// Wrap points exposed by the core
import { getWraps } from '/_loom/sdk/index.js';
const wraps = getWraps();
// wraps.resolveFOVOrigins — field-of-view computation
// wraps.renderRollCard — roll card rendering

if (wraps.renderRollCard) {
  wraps.renderRollCard.wrap((original, roll, esc) => {
    // Customize the roll card
    return original(roll, esc);
  });
}
```

---

## 12. Glossário de Conceitos

| LoomVTT            | Descrição                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| Stage              | Cena — um mapa ou ambiente de jogo                                    |
| Cast Member        | Representação visual de um Actor no canvas                    |
| Actor              | Entidade de dados com ficha                                           |
| Item               | Objeto, arma, armadura, etc. vinculado a um Actor                     |
| Journal            | Entrada de diário                                                      |
| Roll Table         | Tabela de rolagem                                                      |
| Playlist           | Playlist de áudio                                                      |
| Light              | Fonte de luz                                                           |
| Tile               | Tile decorativo ou de piso                                             |
| Drawing            | Desenho livre sobre o canvas                                           |
| Wall               | Parede para cálculos de visão                                          |
| Folder             | Organizador de documentos                                              |
| `LoomHooks.on()`   | Listener de eventos globais                                           |
| `api.get`          | Acesso a dados via REST                                               |
| `wrap()`           | Interceptação de funções core                                         |
| `getDefaultData()` + `getSheetSchema()` | Schema de actor/item em vez de template.json |

---

## 13. Troubleshooting

### "Meu sistema não aparece na lista"

1. O manifesto `ruleset.json` existe? → `ls <DataRoot>/marketplace/rulesets/meu-sistema/ruleset.json`
2. O nome tem espaços ou maiúsculas? → Use só `a-z`, `0-9`, `-`
3. O servidor foi reiniciado? → A lista de pacotes do cliente (`/api/marketplace/packages`) é lida do disco a cada
   carregamento, mas as dependências, conflitos e o registro do servidor são resolvidos no boot
   (`addons/loader.ts`). Se o sistema ainda não aparecer, reinicie o servidor.
4. O manifesto tem `"active": true`? → Default é true, mas verifique. Só `false` desativa.

### "A ficha não renderiza"

1. `getSheetSchema()` retorna null para o tipo? → Verifique o actorType
2. O entry point `client.js` está correto? → Veja se `SystemRegistry.register()` foi chamado
3. Erro no console do navegador? → Abra F12 e veja se há erro de import

### "O roll não sai"

1. O hook `preRoll` está lançando erro? → Erros em hooks são capturados e registrados com `console.error` (`hooks.ts`), sem interromper os outros listeners. Abra o console e procure `Error in hook preRoll`.
2. A conexão com o servidor caiu? → Procure erros do Socket.IO no console. O SDK não expõe o cliente WebSocket.
3. A fórmula é válida? → Teste no console: `await new Loom.Roll('1d20+5').evaluate()` (não existe `Roll` global; use `Loom.Roll`)

### Validador automático

Use o validador para checar seu sistema:

```bash
npm run validate:ruleset -- <caminho-do-sistema>
```

Ele verifica, como erro bloqueante: `name`, `title` e `version` no manifesto, nome com caracteres
inválidos, `dependencies` e `conflicts` como arrays, existência do entry point `client`, que o
`client.js` chame `SystemRegistry.register` (rulesets) e JSON válido em `lang/`. Como aviso
(não bloqueia): `client` ausente, imports do SDK desconhecidos (por exemplo, `Hooks`), `window.Loom.<x>`
não reconhecido, sheets com menos de 10 caracteres e CSS ou template vazios. Ele não checa
`engine`, `type` nem o conteúdo das sheets.

---

## 14. O que um ruleset NÃO pode fazer

| Proibição                   | Motivo                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| **Código server-side** | Rulesets rodam 100% no navegador. O servidor só persiste dados.                       |
| **`manifest.core`**   | Ignorado por segurança (loader bloqueia).                                             |
| **Licença sem atribuição** | Não é uma restrição do motor, mas dados derivados do SRD 5.1/5.2.1 devem seguir CC-BY-4.0 e incluir a atribuição oficial. |
| **Dependências npm**   | O client.js é importado no navegador sem bundler. Use import maps ou código vanilla. |

---

## Guias relacionados

- [Conceitos fundamentais](concepts.md) — LoomDocument, Fields, Signals, Permissions
- [SDK Keybinds](../sdk/keybinds.md) — Registro de atalhos
- [SDK Wrappable](../sdk/wrappable.md) — Interceptação de funções
- [SDK Dados](../sdk/dice.md) — Parser de rolagem, `cs>`, termos customizados `{kind:config}`
- [SDK Status Effects](../sdk/status-effects.md) — Registro de condições/status effects
- [SDK Tempo do mundo](../sdk/time.md) — Relógio do mundo e calendários
- [SDK Efeitos](../sdk/effects.md) — Aplicar, remover e listar efeitos, condições manuais e aprovações do GM (`Loom.effects`)
- [SDK API completa](../sdk/api.md) — Todos os exports do SDK
- [Exemplo completo](../examples/meu-primeiro-sistema.md) — Fantasia Simplificada
- [Sistema de demonstração](../../../examples/loom-demo-system/) — Demo jogável
