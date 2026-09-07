# Criação de Sistemas (Rulesets)

Sistemas (rulesets) definem as regras de jogo: tipos de actor/item, dados padrão, validação, sheets.

## Estrutura

```
<DataRoot>/marketplace/rulesets/meu-sistema/
├── ruleset.json    ← manifesto
├── client.js       ← entry point client-side (o único entry point de código que existe)
└── templates/      ← templates de ficha, extensão `.hbs`
```

> **Rulesets NÃO têm `core.js`.** Diferente de addons/módulos, sistemas de RPG rodam
> **100% client-side** — mesmo que você declare `"core": "core.js"` no manifesto, o
> `AddonLoader` (`server/applications/addons/loader.ts`) detecta que é um `ruleset` e
> ignora esse campo de propósito, só logando um aviso. Isso é um bloqueio de segurança
> deliberado, não uma limitação a ser contornada: um `core.js` rodaria no mesmo processo
> Node do servidor, sem sandbox, com acesso total a `process.env`/banco/filesystem —
> sistema de terceiro não deve ter esse alcance. (`core.js` só existe de verdade pra
> **addons**, que são conteúdo de primeira/segunda mão, não sistemas plugáveis quaisquer.)
>
> Consequência prática: qualquer coisa que o **servidor** precise saber sobre o seu
> sistema (ex: quais tipos de item são válidos, ver `itemTypes` abaixo) tem que estar
> declarada em **JSON estático no `ruleset.json`**, nunca em lógica de `client.js` —
> o servidor nunca executa esse arquivo.

> **Extensão de template é `.hbs`.** O motor de render (`renderTemplate()`) não reescreve
> extensão nenhuma — o arquivo no disco precisa bater exatamente com o path declarado em
> `template:` (ou `PARTS`). Um path errado bate no fallback HTML do SPA do dev server, e o
> render falha com `"[renderTemplate] ... devolveu HTML (provável fallback do dev server, não
> o template real)"`.

## Manifest (`ruleset.json`)

```json
{
  "name": "meu-sistema",
  "title": "Meu Sistema",
  "version": "1.0.0",
  "engine": "loom",
  "type": "ruleset",
  "engineVersion": ">=0.1.0",
  "author": "Seu Nome",
  "repository": "https://github.com/usuario/meu-sistema",
  "description": "Um sistema completo para LoomVTT.",
  "manifest": "https://github.com/usuario/meu-sistema/releases/latest/download/ruleset.json",
  "download": "https://github.com/usuario/meu-sistema/releases/latest/download/meu-sistema.zip",
  "backgroundUrl": "https://meusite.com/fundo.jpg",
  "coverUrl": "https://meusite.com/capa.jpg",
  "active": true,
  "client": "client.js",
  "styles": ["styles/meu-sistema.css"],
  "signals": ["meu-sinal-customizado"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "dependencies": [],
  "conflicts": [],
  "compendiums": [
    "compendiums/classes.json"
  ]
}
```

| Campo            | Tipo             | Descrição                                 |
| ---------------- | ---------------- | ------------------------------------------- |
| `name`         | `string`       | Identificador único (apenas letras, num, `_`, `-`) |
| `title`        | `string`       | Nome de exibição                          |
| `version`      | `string`       | Semver                                      |
| `engine`       | `"loom"`       | **Obrigatório**. Define que o pacote é para LoomVTT |
| `type`         | `"ruleset"`    | **Obrigatório**. Define que é um sistema    |
| `engineVersion`| `string`       | Faixa de versão exigida (ex: `>=0.1.0`)     |
| `author`       | `string`       | Nome do autor                              |
| `repository`   | `string`       | URL do repositório/código-fonte            |
| `description`  | `string`       | Descrição do pacote                       |
| `manifest`     | `string`       | URL remota deste `ruleset.json` para auto-update |
| `download`     | `string`       | URL do `.zip` para download na instalação |
| `backgroundUrl`| `string`       | URL para imagem de fundo no Setup Hub      |
| `coverUrl`     | `string`       | URL para imagem de capa (se aplicável)      |
| `active`       | `boolean`      | Se ativado globalmente (default: true)      |
| `client`       | `string`       | Entry point client-side (`.js`)           |
| `core`         | `string`       | **NÃO UTILIZADO**. (Sistemas rodam apenas no client) |
| `styles`       | `string[]`     | Array de paths para arquivos CSS          |
| `compendiums`  | `string[]`     | Array de paths para compêndios JSON       |
| `languages`    | `Array`        | Array de definições de idioma (`lang`, `name`, `path`) |
| `signals`      | `string[]`     | Nomes de Signals que este sistema escuta      |
| `dependencies` | `string[]`     | Addons/sistemas que devem estar ativos      |
| `conflicts`    | `string[]`     | Addons/sistemas que NÃO podem estar ativos |

- `itemTypes`: Array opcional com os tipos de item extras que este sistema usa (ex:
  `["force-power", "talent", "class", "species"]`). **Necessário mesmo já declarando
  `itemTypes` em `defineSystem({...})` no `client.js`** — rulesets nunca executam código no
  servidor (ver `server/applications/addons/loader.ts`, é bloqueio de segurança, não bug),
  então a validação de tipo em `POST/PUT /api/items` só enxerga o que estiver aqui, neste
  JSON estático. Tipos fora da lista nativa (`weapon, spell, armor, equipment, consumable,
  tool, treasure, other`) e fora deste array são silenciosamente rebaixados pra `equipment`.
- `compendiums`: Array opcional contendo caminhos (relativos à pasta do ruleset) de arquivos JSON representando pacotes de compêndio pré-prontos do sistema. Eles serão importados automaticamente e de forma idempotente quando um mundo for ativado/lançado com esse sistema ativo. (Formato do JSON: `{ "name": "...", "type": "Item", "entries": [...] }`).
- `languages`: Array opcional com pacotes de idioma do sistema. O VTT carrega o JSON e faz o registro automático (usando *deep merge*) para popular o objeto `Loom.i18n`.
- `styles`: Array opcional com os caminhos (relativos à pasta do ruleset) dos arquivos `.css`
  a injetar. **Ter os arquivos na pasta `styles/` não é suficiente** — só o que estiver
  listado aqui vira `<link rel="stylesheet">` de verdade (`injectPackageStyles()` em
  [`addon-client-loader.ts`](../../client/core/addon-client-loader.ts) só injeta o que está
  neste array). Esquecer de declarar aqui é o motivo mais comum de "a ficha renderiza mas
  sem nenhum estilo aplicado".

## Registro do Sistema

> **Garantia de ordem de carregamento:** `client.js` só é importado (via `import()` dinâmico,
> em [`addon-client-loader.ts`](../../client/core/addon-client-loader.ts)) depois que
> `window.Loom` já está 100% inicializado — o boot do app (`main.ts`) termina bem antes da
> tela de jogo (que é quem dispara o carregamento de sistemas/addons) sequer montar. Ou seja:
> **não é preciso** checar `if (window.Loom?.sheets)` nem esperar/fazer polling antes de usar
> `window.Loom.*` no topo do `client.js`, incluindo em `class X extends window.Loom.LoomActorSheet`.
> Se algum dia isso deixar de ser garantido, esta nota será atualizada — até lá, trate como
> contrato estável do motor.

No `client.js`, o sistema se registra via `SystemRegistry`:

```javascript
import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'meu-sistema',
  title: 'Meu Sistema',
  version: '1.0.0',

  // Tipos de actor e item que este sistema define
  actorTypes: ['character', 'npc', 'monster'],
  itemTypes: ['weapon', 'armor', 'spell', 'feature'],

  // Dados padrão para cada tipo
  getDefaultData(type) {
    if (type === 'character') {
      return {
        hp: { value: 10, max: 10 },
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      };
    }
    return {};
  },

  // Validação de dados
  validateData(type, data) {
    const errors = [];
    if (data.hp?.value > data.hp?.max) errors.push('HP não pode exceder máximo');
    return { valid: errors.length === 0, errors };
  },

  // ⚠️ Rolagem de iniciativa — DECLARADO MAS NÃO INVOCADO
  // Veja a seção "LoomSystem interface" abaixo para detalhes.
  rollInitiative(actor) {
    return { formula: '1d20', total: Math.floor(Math.random() * 20) + 1 };
  },

  // Schema de ficha de actor
  getSheetSchema(actorType) {
    return {
      tabs: [{
        id: 'main',
        label: 'Principal',
        fields: [
          { key: 'hp.value', label: 'HP', type: 'number' },
          { key: 'hp.max', label: 'HP Máx', type: 'number' },
        ],
      }],
    };
  },

  // Schema de ficha de item
  getItemSheetSchema(itemType) {
    return { tabs: [{ id: 'main', label: 'Geral', fields: [] }] };
  },
}));
```

### LoomSystem interface

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  /**
   * ⚠️ **Declarado na interface, mas NÃO é invocado pelo motor** (verificado no client e no
   * server — nenhum call site existe). Não espere que ele seja chamado automaticamente ao
   * iniciar combate. Para customizar iniciativa, use `Loom.settings.get(systemId, 'initiativeFormula')`.
   */
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}
```

## Ativação

1. Faça upload do sistema para `<DataRoot>/marketplace/rulesets/meu-sistema/`
2. No Setup Hub > Sistemas, ative o sistema (ou `POST /api/marketplace/install`)
3. No mundo, defina `world.system = 'meu-sistema'`
4. Ao conectar, o servidor carrega o sistema e o client importa `client.js`

## Fichas personalizadas (opcional)

Se `getSheetSchema` não for suficiente, você pode estender classes de sheet:

```javascript
const { sheets } = window.Loom;

class MeuActorSheet extends sheets.get('actor', '*') {
  // IMPORTANTE: o `windowManager` guarda cada janela aberta numa chave própria
  // (o primeiro argumento de `windowManager.open(id, SheetClass, props)`) — em
  // todo o motor essa chave é sempre `actor-sheet-<id>` (ou `item-sheet-<id>`
  // pra fichas de item). O `id` que você passa pro `super()` aqui embaixo
  // PRECISA bater com essa mesma chave, senão o botão de fechar (e qualquer
  // outra chamada de `windowManager.close(this.options.id)`) falha em
  // silêncio — sem erro no console, só não fecha nada, porque a chave
  // procurada não existe no registro interno do manager.
  constructor(props) {
    super({ id: props.id || `actor-sheet-${props.actorId}`, actorId: props.actorId });
  }

  // Personalize a ficha
}
sheets.catalog('actor', 'character', MeuActorSheet);
```
