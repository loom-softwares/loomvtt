# Guia — Criando um Sistema de RPG (Ruleset) pro LoomVTT

> Base de conhecimento pra terceiros criarem sistemas próprios.
> Fonte: código real do LoomVTT nesta data — `client/applications/systems/system-registry.ts`, `client/applications/api/marketplace.ts`, `src/core/addon-client-loader.ts`.

## 1. O que é um "sistema" (ruleset) no Loom

Um **ruleset** é um pacote instalável, fora da árvore de código-fonte do Loom — vive em `Data/marketplace/rulesets/<nome>/` (pasta de dados do usuário, não no repo). Diferente de um **addon** (que adiciona features gerais), um ruleset define as regras de um jogo específico: quais campos um Ator/Item têm, como a ficha é montada, como funciona a iniciativa.

Só existe **UM** sistema ativo por mundo (`world.system`).

## 2. Estrutura de pasta

```
Data/marketplace/rulesets/meu-sistema/
├── ruleset.json        ← manifest (obrigatório)
└── client.js           ← entry point client-side (nome livre, referenciado no manifest)
```

### `ruleset.json`

```json
{
  "title": "Free5e",
  "version": "1.0.0",
  "description": "Sistema baseado no SRD 5.1 (CC-BY-4.0)",
  "author": "Seu Nome",
  "client": "client.js",
  "active": true
}
```

Campos lidos hoje pelo backend (`marketplace.ts`): `title`, `version`, `description`, `author`, `client` (caminho do entry point), `active`. `name`/id do sistema é o **nome da pasta** (`dirent.name`), não um campo dentro do JSON.

## 3. Registro do sistema (client.js)

O entry point é importado dinamicamente no boot (`loadClientAddons()` em `src/core/addon-client-loader.ts`) via `import(url)` — roda como módulo ES normal. Dentro dele, registre o sistema no singleton global (exposto porque o ruleset não consegue importar por caminho relativo, já que fica fora da árvore de source):

```js
const SystemRegistry = globalThis.__loomSystemRegistry;

SystemRegistry.register({
  id: 'meu-sistema',           // deve bater com o nome da pasta / world.system
  title: 'Free5e',
  version: '1.0.0',
  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'spell', 'equipment'],

  getDefaultData(type) {
    if (type === 'character') return { hp: { value: 10, max: 10 }, level: 1, abilities: {} };
    return {};
  },

  validateData(type, data) {
    return { valid: true }; // opcional
  },

  prepareData(actor) {
    // opcional — deriva campos calculados (modificadores, HP máximo, etc)
    return actor;
  },

  rollInitiative(actor) {
    return { formula: '1d20+2', total: 15 }; // opcional
  },

  getSheetSchema(actorType) {
    // opcional — layout da ficha do ator (ver seção 4)
  },

  getItemSheetSchema(itemType) {
    // opcional — layout da ficha do item
  },

  changelogUrl: 'https://github.com/voce/meu-sistema/releases',
  wikiUrl: 'https://github.com/voce/meu-sistema/wiki',
  bugsUrl: 'https://github.com/voce/meu-sistema/issues',
});
```

A interface completa (`LoomSystem`) está em `client/applications/systems/system-registry.ts` — só `id`, `title`, `version`, `actorTypes`, `itemTypes`, `getDefaultData` são obrigatórios. O resto é opcional; sem `getSheetSchema`, o ator recebe a ficha genérica (nome + retrato só).

## 4. Sheet Schema (formato atual, simples)

```ts
interface SheetField {
  key: string;                                    // caminho dentro de systemData, ex: "hp.value"
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean';
}
interface SheetTab {
  id: string;
  label: string;
  fields: SheetField[];
}
interface SheetSchema {
  tabs: SheetTab[];
}
```

Exemplo:

```js
getSheetSchema(actorType) {
  if (actorType !== 'character') return null;
  return {
    tabs: [
      {
        id: 'main',
        label: 'Principal',
        fields: [
          { key: 'level', label: 'Nível', type: 'number' },
          { key: 'hp.value', label: 'HP Atual', type: 'number' },
          { key: 'hp.max', label: 'HP Máximo', type: 'number' },
        ],
      },
    ],
  };
}
```

O renderizador genérico (`src/components/sheet-schema.ts`) monta o HTML sozinho a partir disso — **isso é uma limitação atual**: não dá pra ter layout customizado tipo `dnd5e` (grid complexo, imagens inline, tabelas). É suficiente pra sistemas simples/SRD. Uma API de template Handlebars real por sistema é um item futuro (ver nota da seção 6).

## 5. Onde os dados do ator vivem

`systemData` (Actor) / `data` (Item) são campos **JSON livres** — o sistema não precisa (e não pode hoje) declarar schema tipado no banco. Tudo que `getDefaultData`/`getSheetSchema` referenciam fica dentro desse blob JSON. Isso significa: **sistemas não tocam em migrations nem em `Document`/`fields.ts`** — só trabalham na camada client via `SystemRegistry`.

## 6. Ativação

- `world.system` = nome da pasta do ruleset (ex: `"meu-sistema"`).
- No boot, `SystemRegistry.setActive(world.system)` é chamado a partir do payload de init (ver `client/index.ts`, campo `system` do evento WS `init`).
- Módulos ativos por mundo são separados (`world_packages`) — rulesets NÃO têm toggle por mundo, é 1 sistema fixo por mundo via `world.system`.

## 7. Licenciamento — regra geral

- **Pode**: implementar mecânicas/regras de jogo do zero (regras não são copyright-áveis, só o texto específico é).
- **Pode**: usar conteúdo sob licença aberta explícita (SRD 5.1 = CC-BY-4.0 pro D&D; Dark Pack Agreement da Paradox pro World of Darkness — mecânica livre, sem lore/texto licenciado, sem venda).
- **Não pode**: copiar/portar código de sistemas existentes (`dnd5e.mjs`, `wod5e`, etc) — isso é copyright/licença de quem escreveu aquele código especificamente, GPL ou não. Use como referência de "como as regras funcionam", nunca como fonte de código.
- Sempre credite a fonte da licença aberta usada (ex: "Baseado no SRD 5.1, © Wizards of the Coast, CC-BY-4.0").

## 8. Limitações conhecidas hoje (não é bug, é escopo atual)

- Sheet schema é tabs+fields simples, sem template customizado por sistema.
- Sem `Document` instanciado com `.update()`/hooks reativos — client chama API REST direto e re-renderiza manual.
- Sem `EmbeddedCollection` automática — itens de um ator são buscados via endpoint separado (`GET /actors/:id/items`).
- Sem hierarquia de `DiceTerm`/`Roll` — rolagem é função simples.

Esses pontos são candidatos a evoluir (ver discussão de arquitetura P0/P1 em conversa anterior — não documentado em arquivo ainda), mas **não bloqueiam** criar um sistema funcional hoje — só limitam o quão sofisticada a ficha/rolagem pode ficar.
