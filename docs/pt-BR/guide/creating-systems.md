# Criação de Sistemas (Rulesets)

Sistemas (rulesets) definem as regras de jogo: tipos de actor/item, dados padrão, validação, sheets, rolls.

> ⚡ **Quer começar rápido?** Use o scaffold:
>
> ```bash
> npm run create:ruleset -- meu-sistema
> ```
>
> Isso gera a estrutura completa com exemplos comentados.

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
├── sheets/               ← sheets customizadas (opcional)
│   ├── character.mjs
│   └── item.mjs
├── templates/            ← templates Handlebars (opcional), extensão `.hbs`
│   └── example.hbs
├── styles/               ← CSS do sistema (opcional)
│   └── system.css
└── lang/                 ← traduções (opcional)
    └── pt-BR.json
```

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
  "active": true
}
```

| Campo            | Tipo         | Descrição                                |
| ---------------- | ------------ | ------------------------------------------ |
| `engine`       | `"loom"`   | **Obrigatório**. Define que o pacote é para LoomVTT |
| `type`         | `"ruleset"` | **Obrigatório**. Define que é um sistema    |
| `name`         | `string`   | Identificador único (minúsculas, hífen) |
| `title`        | `string`   | Nome de exibição                         |
| `version`      | `string`   | Semver                                     |
| `client`       | `string`   | Entry point client-side (JS)               |
| `active`       | `boolean`  | Se ativo globalmente (default: true)       |
| `dependencies` | `string[]` | Addons/sistemas necessários               |
| `conflicts`    | `string[]` | Addons/sistemas incompatíveis             |

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
  // ... veja a interface completa abaixo
}));
```

---

## 4. LoomSystem — a interface completa

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];

  // Obrigatórios
  getDefaultData(type: string): Record<string, any>;

  // Opcionais
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  getItemDefaultData?(itemType: string): Record<string, any>;

  // Meta
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}
```

### `getDefaultData(type)`

Retorna o `systemData` inicial do actor/item quando criado:

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
  prepareDerivedData() {
    super.prepareDerivedData();

    // Exemplo: calcular modificador de força
    if (this.systemData.attributes) {
      this.systemData.derived = {
        ...(this.systemData.derived || {}),
        strMod: Math.floor((this.systemData.attributes.str || 10) / 2) - 5,
      };
    }
  }
}

// Registre no CONFIG após definir o sistema (CONFIG = window.Loom.config)
CONFIG.Actor.documentClass = MeuActor;
```

Três detalhes que quebram silenciosamente se ignorados:

- **Use `this.systemData`, não `this.system`.** O getter `this.system` existe apenas na
  instância `LiveActor` (quando o ator vem da coleção). Na renderização da ficha, o motor
  empresta o prototype da sua classe para o **row cru da API** (`document-sheet.ts` →
  `_runPrepareData`), que só tem `systemData` — `this.system` retorna `undefined` nesse
  contexto.
- **Todo valor calculado vai em `systemData.derived`.** O LoomVTT não separa dado de origem
  de dado derivado como sistemas antigos faziam: se você escrever direto num campo real do `systemData`
  (ex: `sd.resources.vitae.max = 10 + stamina`), e a sheet salvar o `systemData` inteiro
  de volta, o valor vira dado persistido e **para de recalcular** quando a origem mudar
  (bug do "campo grudado"). Valores dentro de `derived` seguem a mesma regra — todo save
  que mandar o `systemData` inteiro precisa remover a chave `derived` antes do PUT
  (veja [SDK Globals — prepareData em fichas](../sdk/globals.md#preparedata-em-fichas-sheets-quando-roda-e-o-que-não-fazer)).
- **`this` não é uma instância da sua classe.** O motor chama `prepareDerivedData()` com
  `.call(row)` em cima do objeto do documento. Você pode ler/escrever campos de `this`
  (que são os campos do documento), mas **não** chamar outros métodos da sua classe que
  dependam de estado de instância ou construtor.

### Active Effects

O sistema nativo de Efeitos Ativos suporta modos como `upgrade`, `downgrade` e ordenação por `priority`. O SDK fornece a API `effects` para manipular esses dados programaticamente:

```javascript
import { effects } from '/_loom/sdk/index.js';

effects.forActor(actorId);     // Retorna efeitos ativos no ator
effects.create(parentId, data); // Cria um novo efeito
```

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

- **`LoomSystem.prepareData(row)` roda no SERVIDOR**, chamado por `prepareActor()`
  (`server/applications/lib/actor-prepare.ts`) a cada GET/PUT de actor. Você recebe o
  `row` cru e retorna o objeto "preparado". É útil para derivar/enriquecer a resposta
  antes de chegar ao client.
- **`CONFIG.Actor.documentClass.prepareDerivedData()` roda no CLIENTE**, quando a ficha
  abre (`document-sheet.ts` → `_runPrepareData`). É onde fica a derivação que a sheet
  precisa (totais, máximos, rótulos).

Não confunda os dois: o primeiro é server-side e retorna dados (não muta nem persiste),
o segundo é client-side e roda em cima do documento da ficha.

```javascript
// LoomSystem (server-side): enriquece a resposta da API
prepareData(row) {
  return {
    ...row,
    systemData: { ...row.systemData, total: /* calculado */ },
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
| `number`   | Input numérico                |
| `textarea` | Área de texto                 |
| `boolean`  | Checkbox                       |
| `dots`     | Pips clicáveis (máx:`max`) |

---

## 6. Dots field — pips na ficha

O tipo `dots` renderiza pips clicáveis (útil para Storyteller / WoD / sistemas com pontos):

```javascript
{ key: 'willpower', label: 'Força de Vontade', type: 'dots', max: 10 }
{ key: 'attributes.might', label: 'Might', type: 'dots', max: 5 }
```

O valor numérico é armazenado em `systemData` — cada clique incrementa/decrementa.

---

## 7. dispatchRoll, preRoll e meta

### dispatchRoll

Função que envia um roll para o chat. Usada internamente pelo HUD:

```typescript
dispatchRoll({
  worldId: string,
  userId: string,
  userName: string,
  userColor: string,
  formula: string,
  mode?: 'public' | 'gmroll' | 'blindroll' | 'selfroll',
  actorId?: string,
});
```

### Hook `preRoll`

Disparado antes de cada rolagem. Permite modificar a fórmula ou adicionar metadados:

```javascript
LoomHooks.on('preRoll', (ctx) => {
  // ctx: { formula, mode, actorId, meta }
  ctx.meta = { ...ctx.meta, arma: 'Espada Longa' };
  // ctx.formula — você pode modificar antes do envio
});
```

Os metadados em `meta` aparecem como badges no card de rolagem.

---

## 8. Cast vs Actor — entendendo a diferença

| Conceito              | Descrição                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Actor**       | Entidade de dados (ficha). Contém`systemData` com atributos, HP, etc. Persiste no banco.                                                            |
| **Cast Member** | Representação visual de um Actor no canvas. Tem posição (x, y), rotação, efeitos visuais.                                                 |
| **isLinked**    | Se`true`, o Cast Member está vinculado a um Actor (muda dados ↔ muda ficha). Se `false`, é um cast member solto (só posição, sem ficha vinculada). |

**Regra prática:** Actors têm `systemData` (regras). Cast Members têm posição/visuais. Um Actor pode ter zero ou mais Cast Members (ex: mesmo NPC em múltiplas cenas).

---

## 9. Eventos (LoomHooks) para sistemas

### LoomHooks client-side (eventos via WebSocket/Socket.IO)

Estes hooks disparam no **cliente** quando documentos são criados/atualizados/deletados
via WebSocket/Socket.IO (Signals relayados do servidor). Escute-os com `LoomHooks.on()`:

| Hook | Payload | Disparo |
|------|---------|---------|
| `actors.created` | `document` | Actor criado |
| `actors.updated` | `document` | Actor atualizado |
| `actors.deleted` | `id` | Actor deletado |
| `cast.created` | `document` | Cast member criado |
| `cast.updated` | `document` | Cast member atualizado |
| `cast.deleted` | `id` | Cast member deletado |
| `item.created` | `document` | Item criado |
| `item.updated` | `document` | Item atualizado |
| `item.deleted` | `id` | Item deletado |
| `journal.created` | `document` | Journal criado |
| `wall.created` | `document` | Parede criada |
| `tiles.created` | `document` | Tile criado |
| `light.created` | `document` | Luz criada |

> **Nota:** a nomenclatura não é consistente entre entidades (singular, plural, com
> underscore) — os nomes acima são os reais na rede; ver
> [`websocket/events.md`](../websocket/events.md) pro catálogo completo.

> **Nota:** Os hooks `preCreate{Name}` / `onCreate{Name}` que disparam no **servidor**
> (via `LoomHooks.call()` em `server/applications/data/document.ts`) **não** são
> relayados para o cliente. Use os eventos WS/Socket.IO acima (ex: `actors.created`) para
> ouvir mudanças de documentos no cliente.

> **Nota:** `actor.updated`/`item.updated` sempre chegam com os campos embarcados
> (`ChildrenField`, ex: `items` no Actor) já populados — o core popula antes de
> transmitir. Um array vazio no payload é um valor real (última criança foi
> removida), não "ainda não populado". Se sua sheet salva com `api.put(...)` fora
> do fluxo normal de formulário (ex: clique de dot que chama `api.put` direto em
> vez de deixar o form fazer `submit`), não precisa se preocupar em popular nada
> na mão — só não sobrescreva `this.document` com a resposta crua do próprio
> `api.put` se ela não tiver os campos embarcados; espere o evento
> `{documentName}.updated` chegar, que esse já vem completo.

### LoomHooks de sistema (client-side)

| Hook | Payload | Descrição |
|------|---------|-----------|
| `preRoll` | `{ formula, mode, actorId, meta }` | Antes de rolar dados |
| `chat.message` | mensagem | Nova mensagem de chat |
| `chat.roll` | resultado | Nova rolagem no chat |

### Uso

```javascript
import { LoomHooks } from '/_loom/sdk/index.js';

const onActorCreated = (actor) => {
  console.log('Actor criado:', actor.name);
};

LoomHooks.on('actor.created', onActorCreated);

// Para remover: passe a MESMA função de volta (LoomHooks.on retorna void,
// não um "unsubscribe" — passar o retorno dele aqui remove nada).
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
    // dispara ação
  },
});
```

Teclas suportadas: `A-Z`, `0-9`, `F1`-`F24`, `Escape`, `Space`, `ArrowUp/Down/Left/Right`, `PageUp`, `PageDown`, `Delete`, com modificadores `Ctrl+`, `Shift+`, `Ctrl+Shift+`.

Docs completas: [SDK Keybinds](../sdk/keybinds.md).

---

## 11. Wraps — interceptação de funções core

Sistema de wrapping (alternativa a bibliotecas de wrapping de terceiros):

```javascript
import { wrap } from '/_loom/sdk/index.js';

// Envolver função própria
const minhaFn = wrap((x) => x * 2);
minhaFn.wrap((original, x) => {
  console.log('interceptado');
  return original(x + 1);
});

// Wrap points expostos pelo core
import { getWraps } from '/_loom/sdk/index.js';
const wraps = getWraps();
// wraps.resolveFOVOrigins — cálculo de campo de visão
// wraps.renderRollCard — renderização de card de rolagem

if (wraps.renderRollCard) {
  wraps.renderRollCard.wrap((original, roll, esc) => {
    // Personalize o card de rolagem
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
3. O servidor foi reiniciado? → O loader escaneia apenas no boot
4. O manifesto tem `"active": true`? → Default é true, mas verifique

### "A ficha não renderiza"

1. `getSheetSchema()` retorna null para o tipo? → Verifique o actorType
2. O entry point `client.js` está correto? → Veja se `SystemRegistry.register()` foi chamado
3. Erro no console do navegador? → Abra F12 e veja se há erro de import

### "O roll não sai"

1. O hook `preRoll` está lançando erro? → Erros em hooks são silenciosos, verifique o console
2. O WebSocket (Socket.IO) está conectado? → Veja se `wsClient` está autenticado
3. A fórmula é válida? → Teste no console: `new Loom.Roll('1d20+5').evaluate()` (não existe `Roll` global — use `Loom.Roll`)

### Validador automático

Use o validador para checar seu sistema:

```bash
npm run validate:ruleset -- <caminho-do-sistema>
```

Ele verifica: campos do manifest, entry point existe, imports do SDK, sheets não vazias, JSON de lang válido.

---

## 14. O que um ruleset NÃO pode fazer

| Proibição                   | Motivo                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| **Código server-side** | Rulesets rodam 100% no navegador. O servidor só persiste dados.                       |
| **`manifest.core`**   | Ignorado por segurança (loader bloqueia).                                             |
| **Código**             | Licença proíbe. Dados SRD (Open Game License) são ok.                               |
| **Dependências npm**   | O client.js é importado no navegador sem bundler. Use import maps ou código vanilla. |

---

## Guias relacionados

- [Conceitos fundamentais](concepts.md) — LoomDocument, Fields, Signals, Permissions
- [SDK Keybinds](../sdk/keybinds.md) — Registro de atalhos
- [SDK Wrappable](../sdk/wrappable.md) — Interceptação de funções
- [SDK Dados](../sdk/dice.md) — Parser de rolagem, `cs>`, termos customizados `{kind:config}`
- [SDK Status Effects](../sdk/status-effects.md) — Registro de condições/status effects
- [SDK API completa](../sdk/api.md) — Todos os exports do SDK
- [Exemplo completo](../examples/meu-primeiro-sistema.md) — Fantasia Simplificada
- [Sistema de demonstração](../../examples/loom-demo-system/) — Demo jogável
