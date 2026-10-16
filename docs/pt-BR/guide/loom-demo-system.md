# Loom Demo System: guia do desenvolvedor

Um ruleset completo e pequeno para o LoomVTT. O GM monta as regras no próprio editor de regras do sistema (atributos, perícias, recursos, categorias de itens, dados, cartão de chat, combate, layout da ficha), e o código é curto o bastante para ser lido de ponta a ponta. Esta página percorre o sistema arquivo por arquivo.

Os caminhos são relativos à pasta do ruleset (`loom-demo-system`). Comportamentos marcados **(not verified in a browser)** foram lidos no código e ainda não foram executados em um navegador.

## Status

- A validação no navegador (uma execução planejada em um servidor de desenvolvimento local com uma conta de teste) **ainda não foi executada**. Nada desta página, incluindo o layout, as abas e o bloco de efeitos, foi executado em um navegador.
- `npm test` passa: 663 testes em 64 suítes, 0 falhas (executado em 2026-10-13).
- Todo o resto vem da leitura deste repositório e do código do motor que ele chama. Cada afirmação cita seu arquivo.
- Pendências: `styles/system.css` continua listado em `ruleset.json`, mas seus seletores são do sistema anterior (nenhum começa com `ldm-`). Veja a seção 10.

## 1. O que é e o que o GM pode configurar

Id do ruleset `loom-demo-system`, versão em `ruleset.json`. Três tipos de ator (`hero`, `villain`, `beast`) compartilham uma mesma classe de ficha. Os tipos de item na ficha são `gear`, `ability` e `spell`; os tipos legados `weapon`, `armor`, `potion` e `scroll` continuam registrados e usam a mesma ficha de item.

Tudo o que o GM pode alterar fica em uma única configuração JSON (seção 4):

| Peça | Caminho na configuração | Limites (`lib/config.mjs`, `LIMITS` e `LAYOUT_LIMITS`) |
|---|---|---|
| Sistema de dados | `dice.mode` = `d20` ou `pool`; `dice.d20.*`; `dice.pool.*` | lados e faces 2..100; `maxDice` do pool 1..50 |
| Atributos | `attributes[]`: key, label, min, max, default, group | no máximo 12; limites dentro de +/-999; texto de grupo de até 40 caracteres |
| Perícias | `skills[]`: key, label, attr, max, default, group | no máximo 40; max 0..100; texto de grupo de até 40 caracteres |
| Recursos | `resources[]`: key, label, max, color, showInCombat | no máximo 8; max 1..999 |
| Categorias de itens | `itemCategories[]`: key, label | no máximo 24 |
| Tipos de item | `abilityKinds` (rótulos de habilidade e magia) | no máximo 8 |
| Cartão de chat | `card`: style, showFormula, showDice, accent, header, rótulos | cabeçalho de 80 caracteres |
| Iniciativa de combate | `combat.initiative`: mode, attr, bonus | bônus +/-99 |
| Layout da ficha | `layout`: density, skillGrouping, tabs (ator), itemTabs (item) | no máximo 8 abas por ficha; 12 blocos por aba; 1 a 4 colunas por aba |

Dados: `d20` é uma única checagem, `1dN` mais modificadores, com limiares de crítico e falha. `pool` é um conjunto de dados contado em sucessos (`Nd6cs>=5`), com regra de falha opcional.

Percurso:

1. O GM pressiona **Shift+R** (atalho em `main.mjs`) ou abre o editor de regras pelo menu de configurações do sistema. Seções: Dados, Atributos, Perícias, Recursos, Categorias de itens, Tipos de item, Layout, Cartão de chat, Combate, Importar e exportar. Predefinições (`d20Classic`, `d6Pool`) e Redefinir também estão lá. O botão Salvar fica desativado enquanto houver erros de validação (`windows/rule-editor.mjs`).
2. A ficha do ator é organizada em abas e blocos tirados de `layout` (seção 5). Seus blocos são recursos (com passos +/-), atributos, perícias, itens agrupados por tipo, notas e um bloco de Efeitos (seção 8). Os botões de atributo e perícia rolam. Os botões de habilidade e magia podem gastar um recurso e podem rolar e causar dano. Um item usado a partir da ficha também pode copiar seus efeitos para o personagem.
3. Cada rolagem vira um cartão de chat desenhado por este sistema (`cards/roll-card.mjs`).
4. **Shift+B** abre o painel de combate para qualquer usuário (`combat/tracker-window.mjs`). O botão Iniciar combate do próprio motor chama o manipulador de iniciativa deste sistema.

(not verified in a browser): os atalhos, o editor, o layout do cartão, as abas da ficha e o bloco de efeitos.

## 2. Mapa de arquivos

| Caminho | Função |
|---|---|
| `LICENSE` | Licença MIT. |
| `README.md` | Este percurso. |
| `ruleset.json` | Manifesto estático que o servidor e o carregador leem: nome, versão, entrada `client`, `styles`, `languages`, `actorTypes`, `itemTypes`. |
| `package.json` | Scripts `test`, `check`, `lang` (sem dependências). |
| `main.mjs` | Entrada do cliente. Chama `defineSystem`, executa todos os registros e registra os atalhos. Apenas fiação (menos de 200 linhas, verificado por um teste). |
| `assets/BG.jpg` | Imagem de fundo e de capa citada no manifesto. |
| `lib/helpers.mjs` | Auxiliares puros: `esc`, `slug`, `clamp`, `uid`, `deepClone`, `isPlainObject`. Sem acesso ao motor. |
| `lib/config.mjs` | A configuração do mundo: padrões, predefinições, `validateConfig`, `parseConfig`, `serializeConfig`, a configuração, `loadConfig`, `saveConfig`, `actorValue`, `defaultActorData`, e os auxiliares de layout `resolveLayout`, `resolveItemLayout`, `groupedList`, `skillSections`, `blockLabelKey` (com `LAYOUT_BLOCKS` e `ITEM_LAYOUT_BLOCKS`). |
| `lib/layout-view.mjs` | Padrão compartilhado de abas e grade: `renderTabs`, `renderGrid`, `renderBlock`, `handleTabEvent`, `attachTabs`, `clampColumns`. Puro, exceto `attachTabs`. Usado pela ficha do ator, pela ficha de item e pelo editor de regras. |
| `lib/effects-view.mjs` | Bloco de efeitos: renderização e normalização puras, `planItemEffectsApplication` (o plano de cópia do item para o ator), a camada do motor (`loadEffects`, `applyItemEffects`, `attachEffects`). Usado pelas fichas de ator e de item. |
| `lib/dice.mjs` | Lógica de dados: `buildCheck` (fórmula e meta), `buildExtra` (checagem da fórmula de dano), `interpret` (ler uma rolagem), `describe`, `rollCheck` (o único ponto que chama `window.Loom.dispatchRoll`). |
| `windows/rule-editor.mjs` | A janela do editor do GM (`RuleEditorWindow`), seu estado puro e auxiliares de renderização (incluindo a seção Layout), `openRuleEditor`, `registerRuleEditorMenu`. |
| `sheets/sandbox-sheet.mjs` | Ficha do ator (`registerActorSheet`): renderizador puro que monta as abas e os blocos, patches mínimos de escrita, regra de elenco, métodos de rolagem, uso de item e cópia de efeitos de item. |
| `sheets/item-sheet.mjs` | Classe da ficha de item (`DemoItemSheet`) e `registerItemSheet`. Associa as abas de item e os ouvintes de efeitos. |
| `sheets/item-view.mjs` | Modelo puro do item: normalização, contexto e HTML escapado da ficha de item, incluindo as abas. |
| `templates/item-sheet.hbs` | Casca da ficha de item: apenas `{{{body}}}`, o HTML escapado de `item-view.mjs`. |
| `cards/roll-card.mjs` | Cartão de chat: `renderCard` (puro), o cache de configuração, `registerRollCard` (o wrap de `renderRollCard`). |
| `combat/index.mjs` | `registerCombat()`: executa os três registros de combate, cada um protegido. |
| `combat/initiative.mjs` | Manipulador `combatInitiative`: calcula os totais dos tokens selecionados. |
| `combat/labels.mjs` | Distintivos `combatantLabel`, o cache de recursos compartilhado e o varredor com limite de taxa. |
| `combat/tracker-window.mjs` | Painel de combate visível para os jogadores: consultas periódicas, marcador de turno, controles do GM. |
| `styles/system.css` | Folha de estilo legada do sistema anterior. Continua no manifesto; veja a seção 10. |
| `styles/sandbox-layout.css` | Estilos compartilhados de abas, grade e blocos, e as variáveis de tema `--ldm-*` (seção 5). As classes começam com `ldm-tab`, `ldm-grid`, `ldm-block`, `ldm-density-`. |
| `styles/sandbox-effects.css` | Estilos do bloco de efeitos. Todas as classes começam com `ldm-fx-`. |
| `styles/sandbox-sheet.css`, `-item.css`, `-card.css`, `-editor.css`, `-combat.css` | Uma folha de estilo por módulo, com todas as classes prefixadas (`ldm-sheet-`, `ldm-item-`, `ldm-card-`, `ldm-editor-`, `ldm-combat-`). |
| `i18n/<módulo>.en.json`, `i18n/<módulo>.pt-BR.json` | Fragmentos de tradução, um par por módulo (`card`, `combat`, `config`, `editor`, `effects`, `item`, `layout`, `main`, `sheet`). As chaves têm a forma `sandbox.<módulo>.<nome>`. |
| `lang/en.json`, `lang/pt-BR.json` | Gerados a partir dos fragmentos por `scripts/merge-lang.mjs`. O motor carrega esses dois arquivos (`languages` no manifesto). Não edite à mão. |
| `scripts/merge-lang.mjs` | Junta os fragmentos nos dois arquivos de idioma. |
| `tests/*.test.mjs` | Doze arquivos de teste para `node --test`: card, combat, config, dice, editor, effects-view, helpers, item, layout-view, manifest, sheet, verify-package. |
| `.agents/` | Orientações e skills para assistentes de IA que trabalham neste repositório. O motor não as carrega. |
| `.github/workflows/release.yml` | Gera o pacote ao criar uma tag de versão. |
| `CHANGELOG.md` | Histórico de alterações. |

## 3. Como o motor carrega o sistema

Campos do manifesto que o carregador lê (`client/core/addon-client-loader.ts`):

| Campo | Usado para |
|---|---|
| `name` | Nome da pasta em `/marketplace/rulesets/`. |
| `active` | `false` pula o sistema. |
| `client` | Módulo de entrada, importado como indicado. Esta demo usa `main.mjs`. Os exemplos do guia dizem `client.js`, mas o valor é só um caminho. |
| `styles` | Cada arquivo é buscado e injetado. Arquivos que não estão listados não são carregados, mesmo que existam. |
| `languages` | O idioma ativo é carregado; `en` é o reserva. |
| `actorTypes`, `itemTypes` | Declarados para as rotas do servidor (veja `docs/en/guide/system-creation.md`). |
| `backgroundUrl`, `coverUrl` | Arte da tela de configuração (conforme o guia; not verified in a browser). |

Ordem de carregamento: o motor define `window.Loom` antes de importar o módulo `client` do ruleset, então os módulos de `lib/` e das fichas podem ler `window.Loom` enquanto executam (cabeçalho de `main.mjs`). O import do SDK é `/_loom/sdk/index.js`; este sistema usa `SystemRegistry`, `defineSystem`, `keybinds` e `showToast`.

`main.mjs` faz cinco coisas:

```js
SystemRegistry.register(defineSystem({
  id: SYSTEM_ID, title: 'Loom Demo System', version: VERSION,
  actorTypes: ACTOR_TYPES, itemTypes: ITEM_TYPES,
  getDefaultData(type) { /* defaultActorData(getConfigSync(), type) */ },
}));

attempt('config setting', registerConfigSetting);
attempt('actor sheet', registerActorSheet);
attempt('item sheet', registerItemSheet);
attempt('roll card', () => registerRollCard().ok);
attempt('combat', registerCombat);
attempt('rule editor menu', registerRuleEditorMenu);
attempt('keybinds', registerKeybinds);

loadConfig({ fresh: true }).catch(() => {}); // aquece o cache síncrono
```

- `attempt(nome, fn)` registra um aviso e segue em frente, assim uma falha de registro nunca interrompe os outros.
- Nada se registra ao ser importado. Cada módulo exporta uma função e `main.mjs` a chama.
- `getDefaultData` preenche novos atores com a última configuração conhecida (síncrono, nunca espera).

## 4. O modelo de configuração

**Armazenamento.** Uma configuração do mundo: módulo `loom-demo-system`, chave `ruleConfig` (`CONFIG_MODULE`, `CONFIG_KEY` em `lib/config.mjs`). O valor é texto JSON, então o servidor guarda uma string. Dois identificadores existem de propósito: o módulo de configuração é `loom-demo-system`, enquanto o marcador `meta.system` nas rolagens é `loom-demo` (`CARD_SYSTEM_ID` em `cards/roll-card.mjs`, `SYSTEM_ID` em `lib/dice.mjs`).

**Formato** (o nível superior de `defaultConfig()`, resumido):

```js
{
  version: 1,
  name: 'My System',
  dice: { mode: 'd20',
    d20: { sides: 20, critMin: 20, fumbleMax: 1, targetLabel: 'DC' },
    pool: { faces: 6, successMin: 5, maxDice: 20, glitchOnOnes: false } },
  attributes: [{ key: 'might', label: 'Might', min: 0, max: 10, default: 2, group: '' }],
  skills: [{ key: 'melee', label: 'Melee', attr: 'might', max: 10, default: 0, group: '' }],
  resources: [{ key: 'hp', label: 'Health', max: 20, color: '#c0392b', showInCombat: true }],
  itemCategories: [{ key: 'weapon', label: 'Weapon' }],
  abilityKinds: { ability: 'Ability', spell: 'Spell' },
  card: { style: 'detailed', showFormula: true, showDice: true, accent: '#7c5cff',
    header: '{actor}: {label}', successLabel: 'successes', critLabel: 'Critical', fumbleLabel: 'Fumble' },
  combat: { initiative: { mode: 'attribute', attr: 'grace', bonus: 0 } },
  layout: { density: 'comfortable', skillGrouping: 'attribute',
    tabs: [{ key: 'main', label: 'Main', columns: 2, blocks: ['resources', 'attributes', 'skills'] }, /* ... */],
    itemTabs: [{ key: 'details', label: 'Details', columns: 2, blocks: ['details', 'uses'] }, /* ... */] },
}
```

**Validação.** `validateConfig(input)` devolve `{ ok, config, errors }`:

- `config` é sempre uma configuração v1 válida e saneada. Chaves desconhecidas são descartadas.
- `errors` lista cada valor que foi alterado, definido por padrão ou descartado, em inglês (o editor mostra como estão).
- As chaves devem casar com `^[a-z][a-z0-9_]{0,23}$`. Uma chave com caracteres inválidos é convertida em slug, e isso conta como erro.
- As listas são lidas até 200 entradas; chaves duplicadas são descartadas.
- `parseConfig(text)` faz o mesmo para texto JSON importado (no máximo 200.000 caracteres).

**Salvamento.** O editor chama `saveConfig(cfg)`, que:

1. chama `validateConfig` e recusa se `errors` não estiver vazio (nada é gravado);
2. recusa cedo quando `user.isGM === false` (o servidor também impõe isso);
3. chama `loom.settings.set(...)`, que envia `PUT /api/module-settings/:worldId/loom-demo-system/ruleConfig`. Essa rota exige GM (`server/applications/api/module-settings.ts`);
4. chama todos os ouvintes de `onConfigSaved` (o cache do cartão de chat usa isso).

**Por que as fichas releem ao abrir.** Não existe sincronização ao vivo entre clientes, e o motor não envia evento de configuração aos sistemas. Cada ficha chama `loadConfig({ fresh: true })` em `loadDocument()`. O editor mostra um aviso de "configuração alterada em outro lugar" quando uma releitura encontra dados diferentes. Caminhos de renderização que não podem esperar usam `getConfigSync()`, que devolve a última configuração que este módulo carregou ou salvou. O cartão de chat atualiza sua cópia em segundo plano, no máximo a cada 2 segundos, e nunca bloqueia uma renderização.

**Edição.** O editor trabalha sobre um rascunho (`draftFromConfig`, `configFromDraft`), mostra a validação ao vivo e oferece Importar JSON e Exportar JSON (`parseConfig`, `serializeConfig`). Remover um atributo não apaga dados: os valores guardados continuam, só deixam de ser mostrados.

**Configuração de layout (validação).** `sanitizeLayout` em `lib/config.mjs` verifica a seção `layout`:

- `density` é `comfortable` ou `compact`; `skillGrouping` é `attribute`, `group` ou `none`. Qualquer outro valor é informado e substituído pelo padrão.
- `tabs` (ficha do ator) e `itemTabs` (ficha de item) são verificados da mesma forma. Cada aba precisa de uma `key` em slug única (`duplicate key ... dropped`), um `label` de até 40 caracteres, `columns` limitado a 1..4 (padrão 2) e uma lista `blocks`.
- Cada lista permite no máximo 8 abas e no máximo 12 blocos por aba. Entradas extras são informadas e descartadas.
- O nome de um bloco deve estar em `LAYOUT_BLOCKS` (ator: `resources`, `attributes`, `skills`, `items:gear`, `items:ability`, `items:spell`, `items:other`, `notes`, `effects`) ou em `ITEM_LAYOUT_BLOCKS` (item: `details`, `uses`, `roll`, `cost`, `description`, `effects`). Nomes desconhecidos são descartados.
- Um bloco só pode aparecer uma vez dentro de uma mesma lista. Uma repetição é informada e descartada.
- Se uma lista não tiver nenhuma aba válida, usam-se os padrões dessa lista.

**Layout: o que as fichas realmente mostram.** `resolveLayout` (ator) e `resolveItemLayout` (item) devolvem as abas que as fichas renderizam, e sempre recolocam o que faltar:

- Um bloco que nenhuma aba lista é anexado à **primeira** aba, na ordem canônica. Nada se perde.
- **Efeitos é sempre mostrado.** É um bloco como os outros, então é anexado à primeira aba quando nenhuma aba o lista, e pode ser movido para qualquer aba no editor (dica `sandbox.editor.effectsAlways`).
- Padrões: as abas do ator são Principal (recursos, atributos, perícias), Poderes (itens de habilidade e magia), Equipamento (itens de equipamento, outros itens e notas) e Efeitos. As abas de item são Detalhes (detalhes, usos), Regras (rolagem, custo), Efeitos e Descrição.
- `skillSections(cfg)` agrupa o bloco de perícias conforme `skillGrouping`: `attribute` gera uma seção por atributo da perícia (com o rótulo do atributo como título), `group` gera uma seção por texto `group` da perícia, e `none` gera uma única seção sem título.
- `groupedList(list)` agrupa atributos e perícias pelo texto opcional `group`, na ordem da primeira aparição. Itens sem grupo vão para um cabeçalho sem título. O campo `group` de um atributo agrupa o bloco de atributos; o campo `group` de uma perícia agrupa as perícias apenas quando `skillGrouping` é `group`.

## 5. Layout, abas e tema

A ficha do ator, a ficha de item e o editor de regras montam suas abas e grades por meio de um único módulo, `lib/layout-view.mjs`, e de uma única folha de estilo, `styles/sandbox-layout.css`. Assim, todas as janelas do sistema usam as mesmas abas e o mesmo comportamento de teclado. As seções próprias do editor de regras (Dados, Atributos, Perícias e assim por diante) também são abas desse módulo.

**Peças de marcação** (`lib/layout-view.mjs`):

| Função | Saída |
|---|---|
| `renderTabs({ idPrefix, tabs, activeKey, labelOf, panels, ariaLabel })` | Uma barra de abas e um painel por aba. Com uma única aba, devolve só o painel. |
| `renderGrid(blocksHtml, columns)` | Uma grade responsiva com o número de colunas definido em linha (`--ldm-cols`). |
| `renderBlock({ key, title, body })` | Um cartão de bloco. O título só aparece quando não está vazio. `body` precisa já vir escapado por quem chama. |
| `handleTabEvent(event, state)` | Um clique seleciona a aba. ArrowLeft e ArrowRight andam entre as abas (dando a volta), Home e End vão para os extremos. |
| `attachTabs(root, callbacks)` | Associa um ouvinte de clique e um ouvinte de tecla à raiz da janela. É o único código de DOM do módulo. |

Todo rótulo, chave e título é escapado pelo módulo. Quem chama escapa o conteúdo de `panels` e `body`.

**Nomes de classe estáveis** (API pública, definida em `styles/sandbox-layout.css`):

| Classe | Usada para |
|---|---|
| `.ldm-tabs` | O conjunto de abas (contêiner). |
| `.ldm-tablist` | A barra de abas (`role="tablist"`); rola para o lado quando transborda. |
| `.ldm-tab` | Um botão de aba (`role="tab"`). A ativa tem `aria-selected="true"`. |
| `.ldm-tabpanel` | Um painel (`role="tabpanel"`). Painéis ocultos usam o atributo `hidden`. |
| `.ldm-grid-host` | Uma grade que não está dentro de `.ldm-tabs` (uma única aba). |
| `.ldm-grid` | A grade responsiva de blocos. |
| `.ldm-block`, `.ldm-block-title`, `.ldm-block-body` | Cartão de bloco, cabeçalho (h3) e conteúdo. |
| `.ldm-density-compact`, `.ldm-density-comfortable` | Espaçamento e margem menores ou maiores. |

**Densidade.** `layout.density` é aplicado como classe na raiz da ficha do ator (`ldm-density-<valor>`, `sheets/sandbox-sheet.mjs`). A ficha de item não tem classe de densidade, então a densidade altera apenas a ficha do ator.

**Tema.** Todo componente lê variáveis `--ldm-*`. Defina-as em qualquer ancestral (a raiz de uma ficha, a raiz de uma janela ou `:root`) e toda barra de abas, grade e bloco dentro dele as usará. Cada uso traz o próprio valor reserva, então os padrões valem só quando nada estiver definido:

| Variável | Usada para | Reserva |
|---|---|---|
| `--ldm-accent` | Marcador da aba ativa e anel de foco | `--color-accent`, `#7c5cff` |
| `--ldm-gap` | Espaço entre células da grade e painéis | `0.75rem` |
| `--ldm-pad` | Margem interna de um cartão de bloco | `0.75rem` |
| `--ldm-radius` | Arredondamento de abas e blocos | `6px` |
| `--ldm-surface` | Fundo do bloco e da aba ativa | `rgba(255,255,255,0.04)` |
| `--ldm-border` | Bordas de blocos e da barra de abas | `rgba(255,255,255,0.12)` |
| `--ldm-text` | Cor do texto | herdada |
| `--ldm-muted` | Cor das abas inativas | `--color-text-muted`, `rgba(255,255,255,0.6)` |

`--ldm-cols` não é uma variável de tema: a marcação o define em linha em cada grade ou painel, então ele é por elemento de propósito.

Exemplo, um tema para uma ficha (not verified in a browser):

```css
/* Todo .ldm-tabs, .ldm-grid e .ldm-block dentro deste elemento recebe o novo destaque e arredondamento. */
.my-game-theme {
  --ldm-accent: #c0392b;
  --ldm-radius: 2px;
}
```

O bloco de efeitos também lê essas variáveis (mais `--ldm-danger`), então a mesma regra o customiza (seção 8).

## 6. Uma rolagem, de ponta a ponta

Acompanhe uma checagem de atributo. Clicar em uma perícia segue o mesmo caminho.

```
botão attr-roll                      sheets/sandbox-sheet.mjs  _ldmRollAttr
  -> rollCheck(cfg, opts)            lib/dice.mjs              buildCheck -> { formula, meta }
  -> window.Loom.dispatchRoll        client/main.ts            (retorna void)
  -> roll-dispatch.ts                client/screens/game-hud/  hooks chatRollCommand e preRoll,
                                                               depois wsClient.send('chat.roll')
  -> handler 'chat.roll' do servidor server/index.ts           roll() de server/applications/dice/roller.ts;
                                                               grava a linha do chat, transmite chat.roll
  -> cartão da mensagem no chat      client/screens/game-hud/  renderRollCardWrap(msg.roll, esc)
  -> wrap deste sistema              cards/roll-card.mjs       registerRollCard -> renderCard
```

**As fórmulas.** `buildCheck(cfg, { attrValue, skillValue, bonus, advantage })` as monta. `N` é atributo + perícia + bônus, limitado a +/-1000.

| Modo | Normal | Vantagem | Desvantagem |
|---|---|---|---|
| d20 | `1d20+5` | `2d20kh1+5` | `2d20kl1+5` |
| pool | `5d6cs>=5` | `6d6cs>=5` | `4d6cs>=5` |

No modo pool, `n` é `N` limitado a `1..maxDice`; vantagem adiciona um dado e desvantagem remove um, ainda limitado. O servidor entende `cs>=N` e conta os dados que atingem o valor (`SuccessPool` em `server/applications/dice/roll-parts.ts`).

**O meta.** `buildCheck` define `meta = { system: 'loom-demo', kind: 'check', mode, sides, critMin, fumbleMax }` (ou `faces`, `successMin`, `glitchOnOnes` no modo pool). `rollCheck` acrescenta `label` e `actorName`. O servidor anexa `meta` ao resultado como `roll.meta`.

**O resultado no servidor.** `roll()` devolve `{ formula, terms, total, mode, meta }`. Um termo de dado tem `kind: 'dice'`, `rolls[]`, `dropped[]`, `subtotal` e `successes` quando `cs` é usado. No modo pool, `total` é igual ao número de sucessos.

**Como ler** (`interpret(cfg, roll)` em `lib/dice.mjs`):

- d20: o valor natural é o dado mantido. Crítico quando é pelo menos `critMin`; falha quando é no máximo `fumbleMax`. O modificador exibido é `total - natural`.
- pool: os sucessos são a soma de `successes` do termo `cs`. Um dado é acerto quando é pelo menos `successMin`. Falha de regra (glitch) é marcada quando `glitchOnOnes` está ativo e mais da metade dos dados ativos mostra 1 (`ones * 2 > active`).

Crítico e falha são decididos pelo cartão, a partir do dado natural. O servidor não conhece esses conceitos.

**Dano.** Um item com `roll.damage` envia uma segunda rolagem, validada antes por `buildExtra`. Aceita apenas `NdF`, literais inteiros, `+`, `-` e parênteses, até 100 caracteres e 100 dados. O cartão a mostra com `meta.kind = 'damage'`, que não tem acerto nem erro.

**O que a ficha fica sabendo.** `dispatchRoll` não devolve nada e o resultado da rolagem não volta a quem chamou. `rollCheck` devolve `{ ok: true }` assim que a chamada foi feita, não quando a rolagem é conhecida. Os resultados aparecem apenas no cartão de chat. (verified in code)

**Não tratado pela demo.** A sintaxe de dados personalizados `{kind:config}` do cliente e os dados de letras (`1dv`) são recursos do motor. A demo nunca os envia.

## 7. Fichas, itens e escritas

**Por que fichas próprias.** As fichas genéricas do motor, de ator e de item, substituem o documento por uma busca direta depois que `prepareData` já executou, então os dados derivados do sistema se perdem. O esquema de itens também nunca chega ao cliente. Por isso, este sistema traz classes próprias que estendem `LoomHandlebarsMixin(LoomActorSheet)` e `LoomItemSheet`, e as registra com `sheets.catalog(docType, typeName, Class)`. `'*'` é o reserva. (`demo-research-E-sheets.md`, `client/core/sheet-catalog.ts`)

**Renderização.** `renderSheet(ctx)` é uma função pura que devolve HTML escapado: as abas (seção 5), os blocos de cada aba e o bloco de Efeitos. A classe define `PARTS = {}` e escreve o HTML em `compile()`, então nenhuma parte do Handlebars é necessária para a ficha do ator. A ficha de item usa um template de casca (`templates/item-sheet.hbs`).

**Escritas, passo a passo.**

1. Um valor digitado dispara um ouvinte `input` na raiz da ficha (delegação de eventos). `changeFromField` o transforma em uma alteração.
2. `_ldmQueue` chama `buildPatch(view, cfg, change)`, que devolve o patch mínimo para aquele único caminho (por exemplo `{ systemData: { attrs: { might: 3 } } }`). O patch é mesclado em profundidade ao patch pendente.
3. A digitação espera 300 ms; botões enviam na hora. `_ldmFlush` serializa as escritas.
4. `_ldmWrite` envia um `PUT /api/actors/:id` (ou `/api/cast/:id`) com `{ systemData: patch }`, depois um `PUT /api/items/:id` com `{ data }` para cada item alterado.

**Por que patches mínimos.** As respostas do ator trazem `systemData` com os efeitos ativos já aplicados, então gravar o objeto inteiro armazenaria os efeitos como valores base. `sheets/sandbox-sheet.mjs` documenta o limite: as rotas de ator não devolvem os valores base brutos, então um +/- em um atributo que um efeito modifica grava o valor efetivo mais ou menos um como base.

**Rotas de item.** Os itens são editados na rota do mundo `/api/items/:id`, que é o que `apiRoute` usa por padrão na ficha de item. A rota embutida `/api/actors/:id/items/:itemId` não tem GET por id, então abrir um item embutido por ela retorna 404 (`docs/en/api/actors.md`, veja o registro de lacunas do motor).

**A regra de elenco.** `resolveWriteTarget(actorId, castId, cast)` decide para onde vai um patch:

| Caso | Destino |
|---|---|
| Sem contexto de elenco (barra lateral, clique em token) | ator |
| Elenco vinculado (`isLinked: true`, um PJ) | ator |
| Elenco não vinculado (`isLinked: false`, um NPC) | `PUT /api/cast/:id` |
| Elenco não pôde ser carregado, ou pertence a outro ator | recusado |

O motor abre a ficha do ator a partir de um token apenas com `{ actorId, worldId }` (`client/screens/game-hud/game-hud.ts`, por volta da linha 3161), então hoje toda escrita vai para o ator. O caminho de NPC só funciona quando um `castId` é passado.

**Uso de item.** `_ldmUseItem` envia as edições pendentes e depois `planUse(item, sys, cfg)` verifica o custo e os usos. Recusa (com um aviso) em caso de recurso desconhecido ou insuficiente, ou de zero usos. Caso contrário, grava o novo valor do recurso e os usos, depois rola a checagem e, se válida, o dano. Nada é gravado se o plano for recusado. Depois de um uso que deu certo, os efeitos do item são copiados para o ator (seção 8).

**Botão Usar.** Um item mostra Usar quando seu tipo é `ability`, `spell`, `potion` ou `scroll` (`EFFECT_USE_TYPES` em `sheets/sandbox-sheet.mjs`), ou quando tem rolagem, custo ou usos. Um item `gear` sem nenhum desses não tem botão Usar.

**Limitação de efeitos.** A ficha pode mostrar valores com efeitos aplicados, mas não os valores base, pelo motivo acima. A rota de NPC do elenco retorna linhas brutas, então o caminho de NPC não tem essa lacuna.

## 8. Efeitos

Um efeito é um conjunto nomeado de alterações nos valores de um ator, com duração opcional. O bloco de Efeitos os lista na ficha do ator e na ficha de item. O código está em `lib/effects-view.mjs` (renderização, formulário do editor e a camada do motor) e em `styles/sandbox-effects.css`.

**O que um efeito contém** (`normalizeEffect`):

| Campo | Regra |
|---|---|
| `name` | De 1 a 60 caracteres. |
| `icon` | Opcional; limitado a 512 caracteres. |
| `origin` | Texto opcional, até 80 caracteres. |
| `duration` | `-1` é permanente. Caso contrário, até 9999 (`-1..9999`). |
| `disabled` | Um interruptor; um efeito desativado não se aplica a nada. |
| `changes` | Até 20 alterações por efeito. |

Cada alteração tem `key`, `mode` e `value`. As chaves são caminhos com pontos, sem prefixo, e devem casar com `^[A-Za-z_][A-Za-z0-9_.]{0,63}$`. Os segmentos proibidos `__proto__`, `constructor` e `prototype` são recusados. Valores de texto são limitados a 80 caracteres.

**Modos** (os modos reais do motor, `server/applications/lib/effects.ts`). O motor aplica as alterações em ordem crescente de `priority` (a menor primeiro):

| Modo | Efeito no valor |
|---|---|
| `add` | Soma o valor à base. |
| `multiply` | Multiplica a base pelo valor. |
| `override` | Define o valor (a forma de fixar um máximo). |
| `upgrade` | Só se aplica quando o valor é maior que a base. |
| `downgrade` | Só se aplica quando o valor é menor que a base. |

Uma base ausente ou que não é número conta como 0 para `add`, `multiply`, `upgrade` e `downgrade`. O máximo de um recurso é `null` até o GM definir um, então `add` sobre um máximo dá apenas o bônus. Use `override` para um máximo.

**Os caminhos de chave resolvem contra o systemData do ator.** O motor aplica cada alteração a uma cópia do `systemData` do ator, então `attrs.might` é `systemData.attrs.might`, `skills.melee` é `systemData.skills.melee` e `res.hp.value` é `systemData.res.hp.value`. Uma chave sem prefixo (por exemplo `might`) grava uma nova chave de nível superior que nenhuma ficha mostra. O placeholder do editor é `attrs.might`. (cabeçalho do arquivo `lib/effects-view.mjs`, pontos 2 e 2b)

**O motor aplica apenas efeitos de ator.** Efeitos que pertencem a um item (um `itemId` e nenhum ator) nunca são aplicados pelo motor, seja o item equipado ou usado. Por isso, este sistema os copia por conta própria. Os efeitos de item ficam guardados no próprio item e aparecem na ficha de item; a dica do bloco de item diz isso (`sandbox.effects.itemHint`).

**A cópia ao usar.** Quando um item de tipo `ability`, `spell`, `potion` ou `scroll` é usado e o uso dá certo, `_ldmApplyUseEffects` em `sheets/sandbox-sheet.mjs` chama `applyItemEffects`:

- um efeito de ator é criado para cada efeito de item habilitado que tenha alterações, com origem `item:<itemId>`;
- a chave de deduplicação é a origem mais o nome base: uma cópia existente com o mesmo nome e origem é atualizada (duração, alterações, ícone e nome são renovados), não duplicada. Uma cópia que o GM desativou continua desativada;
- efeitos de item desativados, efeitos sem alterações e qualquer coisa além de 20 efeitos são pulados e contados;
- um item usado em um elenco não vinculado (NPC) não é copiado, porque os efeitos de ator não chegariam a esse elenco;
- itens `gear` nunca copiam seus efeitos, porque não são usados.

Um aviso-resumo informa quantos efeitos foram criados ou atualizados, e o bloco de Efeitos é recarregado. O planejamento é puro (`planItemEffectsApplication`) e é testado sem o motor.

**Permissões.** O motor só permite escrever em um efeito para o GM ou para o dono do ator (a rota de buffs, citada no cabeçalho de `lib/effects-view.mjs`). A ficha mostra os controles de adicionar, editar e excluir apenas quando é editável. Um efeito sem ator resolvível é exclusivo do GM.

**Sincronização ao vivo.** O motor não retransmite eventos de efeito aos clientes, então o bloco recarrega sua lista após cada alteração (`reload` em `attachEffects`).

**Durações.** As mudanças de rodada de combate reduzem a duração de todo efeito habilitado no mundo e excluem o efeito quando chega a 0. Esse é o comportamento do motor (`server/applications/api/combat.ts`), então não se limita aos combatentes de um único combate. Nada mais expira um efeito. (not verified in a browser)

## 9. Combate

Arquivos: `combat/index.mjs` registra três coisas, cada uma protegida:

- `initiative.mjs` instala o manipulador `combatInitiative`.
- `labels.mjs` instala o distintivo `combatantLabel` e guarda o cache compartilhado.
- `tracker-window.mjs` monta o painel e `openCombatPanel()`.

**Por que um painel e distintivos.** O combate é uma linha `combats` com um array `combatants`. Os eventos de combate do motor (`combat.started`, `combat.next`, `combat.updated`, `combat.ended`) são repassados apenas a sockets que passam na verificação de dono com a permissão padrão 0, o que na prática significa sockets de GM (`server/index.ts`, por volta das linhas 1334-1345; `server/applications/ws/channels.ts`). Os jogadores não recebem atualizações de combate ao vivo, então o painel faz consultas periódicas. O rastreador não tem colunas nem botões extras, então o sistema adiciona um distintivo de texto por linha.

**Iniciativa (`combatInitiative`).** O botão Iniciar combate chama o gancho para os tokens selecionados com `ctx = { castIds, initiatives, health, rolls, pending }`. O manipulador empurra uma tarefa assíncrona para `ctx.pending`, e a interface espera por ela. Para cada token ele escreve um total em `ctx.initiatives`. O servidor usa o total, limitado a -20..100. A interface sempre adia o d20 e ignora a fórmula para esses tokens, então o sistema calcula o total por conta própria (`computeInitiative`):

| Modo | Total |
|---|---|
| `roll` (configuração d20) | `1d{sides}` + atributo + bônus |
| `roll` (configuração pool) | sucessos de um pool dimensionado pelo atributo + bônus (pelo menos 1 dado) |
| `attribute` | atributo + bônus |
| `fixed` | bônus |

O sistema publica no chat um resumo dos totais com o remetente "Combate". (not verified in a browser)

**Distintivos.** O ouvinte `combatantLabel` escreve `ctx.label` de forma síncrona a partir do cache. O varredor preenche o cache em segundo plano, depois o sistema emite `combatantLabelsChanged` por conta própria, porque o motor nunca emite esse evento e a barra lateral só redesenha com ele (`combat/labels.mjs`, `client/screens/game-hud/sidebar.ts`).

**Painel.** `openCombatPanel()` mostra a rodada, o marcador de turno, a ordem e as barras de recurso de cada combatente. O marcador segue o `currentTurn` do servidor sobre a ordem guardada em `combatants`, e não a ordenação de iniciativa do cliente. O GM também recebe botões +/- nos recursos e os botões Anterior, Próximo e Encerrar (rotas POST em `/api/combat/:worldId`). Os jogadores veem barras somente leitura.

**Orçamento de requisições.** Cada constante abaixo está no arquivo indicado.

| O quê | Limite | Onde |
|---|---|---|
| Linha do combate | a cada 3 s com o painel aberto e visível; recua para 30 s após erros; sem requisições sobrepostas | `tracker-window.mjs` `POLL_BASE_MS`, `POLL_MAX_MS` |
| Leituras de combatentes (elenco e ator) | cada combatente no máximo a cada 9 s; no máximo 12 por passagem; no máximo 4 em voo | `labels.mjs` `RECORD_CADENCE_MS`, `REFRESH_CAP`, `REQUEST_CONCURRENCY` |
| HTTP 429 | pausa as consultas; `Retry-After` não é acessível por `api.get`, então usa-se 30 s | `labels.mjs` `RATE_LIMIT_DEFAULT_MS` |
| Configuração do painel | atualizada no máximo a cada 30 s | `tracker-window.mjs` `CONFIG_REFRESH_MS` |
| Configuração do cartão de chat | atualizada no máximo a cada 2 s, sem bloquear | `cards/roll-card.mjs` `refreshMs` |

## 10. Limites do motor que a demo contorna

Cada linha é um limite do motor que este sistema contorna, com o código que faz isso. Os arquivos de evidência estão em `.planning/reviews/` do repositório do motor.

| Limite do motor | Contorno neste sistema | Onde |
|---|---|---|
| Fichas genéricas descartam `prepareData` e o esquema de itens | Classes de ficha próprias registradas por tipo | `sheets/sandbox-sheet.mjs`, `sheets/item-sheet.mjs` |
| Respostas do ator trazem `systemData` com efeitos aplicados; reescrevê-lo grava os efeitos | Patches mínimos por caminho, mesclados no cliente | `buildPatch`, `mergePatch` em `sheets/sandbox-sheet.mjs` |
| Sem GET por id para itens embutidos | A ficha de item usa a rota de item do mundo | `sheets/item-sheet.mjs` (`apiRoute`) |
| `dispatchRoll` retorna `void`; a ficha não consegue ler o resultado | Resultados mostrados só no cartão; `rollCheck` informa o envio, não a rolagem | `lib/dice.mjs` `rollCheck` |
| O sufixo `c` em `cs>N` é lido e ignorado (um máximo natural não conta duas vezes) | O crítico é calculado no cartão a partir do dado natural | `lib/dice.mjs` `interpret`; `server/applications/dice/roll-formula.ts` (o `c?` é consumido) |
| Os documentos omitem `cs>=N`, que o analisador aceita | O módulo de dados usa `cs>=` | `lib/dice.mjs` `buildCheck` |
| `settings.get` retorna padrões até as configurações do mundo carregarem; `whenReady` não existe nos tipos do SDK | Configuração lida por `window.Loom.settings.whenReady` e uma leitura nova da API; `getConfigSync` pode devolver padrões antes da primeira carga, então `main.mjs` aquece o cache na inicialização | `lib/config.mjs` `loadConfig`, `getConfigSync` |
| `Loom.world` é definido depois que o HUD abre, não na inicialização | A leitura da configuração verifica e recorre ao cache | `lib/config.mjs` `fetchStoredValue` |
| Jogadores não recebem eventos de combate | O painel de combate consulta `GET /api/combat/:worldId` | `combat/tracker-window.mjs` |
| A interface sempre adia a iniciativa e ignora a fórmula | Totais calculados no gancho `combatInitiative` | `combat/initiative.mjs` |
| `combatantLabelsChanged` é ouvido, mas nunca emitido | O sistema o emite depois de mudar o texto dos distintivos | `combat/labels.mjs` |
| Sem colunas ou botões extras no rastreador do motor | Um distintivo de texto por linha, mais o painel próprio do sistema | `combat/labels.mjs`, `combat/tracker-window.mjs` |
| Sem sincronização ao vivo entre clientes | Releitura ao abrir; aviso de "alterado em outro lugar" no editor | `sheets/sandbox-sheet.mjs` `loadDocument`, `windows/rule-editor.mjs` |
| O motor não passa um `castId` ao abrir a ficha de um token | Regra de elenco implementada, mas usada apenas quando um `castId` é dado | `resolveWriteTarget` em `sheets/sandbox-sheet.mjs` |
| O motor nunca aplica um efeito que pertence a um item (só efeitos de ator são aplicados) | O sistema copia os efeitos de item habilitados para o ator quando o item é usado | `applyItemEffects`, `planItemEffectsApplication` em `lib/effects-view.mjs`; `_ldmApplyUseEffects` em `sheets/sandbox-sheet.mjs` |
| Chaves de efeito resolvem contra o systemData do ator, então uma chave sem prefixo grava um valor que nenhuma ficha mostra | O placeholder do editor e os exemplos usam chaves `attrs.`, `skills.` e `res.` | `lib/effects-view.mjs` (placeholder e cabeçalho do arquivo) |
| O motor não repassa eventos de buffs (efeitos) aos clientes | O bloco de Efeitos recarrega sua lista após cada alteração | `reload` em `lib/effects-view.mjs` |
| Mudanças de rodada de combate reduzem todo efeito do mundo, não só dos combatentes | Nenhum na demo; os efeitos não são limitados a um combate | `lib/effects-view.mjs` cabeçalho; `server/applications/api/combat.ts` |

**Resto legado.** `styles/system.css` (cerca de 2.000 linhas) continua na lista `styles` do manifesto. Nenhum dos seletores dele começa com `ldm-`, e a interface reconstruída usa apenas os arquivos `sandbox-*.css`, incluindo `sandbox-layout.css` e `sandbox-effects.css`. Remover do manifesto é uma tarefa futura; este percurso não altera isso.

## 11. Estenda: adicione um campo

Exemplo prático: um interruptor `card.showModifier` que oculta o valor "Mod" nos cartões d20. Os passos tocam os mesmos pontos que `card.showDice` já toca. Use `grep` em `showDice` para vê-los todos.

**Passo 1: esquema e validação** (`lib/config.mjs`). Adicione a chave em `sanitizeCard`, ao lado de `showDice`. `boolOf` informa um valor não booleano e usa o padrão.

```js
// sanitizeCard(card, errors)
showDice: boolOf(card.showDice, true, 'card.showDice', errors),
showModifier: boolOf(card.showModifier, true, 'card.showModifier', errors), // novo
```

Adicione também `showModifier: true` ao bloco `card` de `defaultConfig()`. Sem isso, a chave continua saneada, mas a configuração padrão não a mostraria.

**Passo 2: o cartão** (`cards/roll-card.mjs`). Leia o sinalizador em `cardView` e condicione a linha de modificador existente:

```js
// cardView(cfg, t): adicione ao objeto retornado
showModifier: card.showModifier !== false,

// renderCard: a linha existente é  if (wantsDice && !isPool && view.natural !== undefined) {
if (card.showModifier && wantsDice && !isPool && view.natural !== undefined) {
```

**Passo 3: o editor** (`windows/rule-editor.mjs`, `cardSection`). Adicione uma caixa de seleção ao lado da linha existente de `showDice`:

```js
${checkField('card.showModifier', T('sandbox.editor.showModifier', 'Show modifier'), card.showModifier === true)}
```

O rascunho do editor é uma cópia da configuração, então a nova chave faz o percurso de ida e volta por `configFromDraft` e `saveConfig` sem mais código.

**Passo 4: textos** (`i18n/editor.en.json`, `i18n/editor.pt-BR.json`). Adicione `"sandbox.editor.showModifier"` aos dois fragmentos e depois execute `npm run lang`. Um teste do manifesto falha quando uma chave `sandbox.*` usada no código não está em `lang/en.json`, e quando os arquivos de idioma diferem dos fragmentos.

**Passo 5: a ficha.** Nenhuma mudança. A ficha nunca lê `card`.

**Passo 6: testes.** Adicione um caso de padrão e um de valor inválido em `tests/config.test.mjs`. Em `tests/card.test.mjs`, os acessórios listam cada chave do cartão (`d20Cfg` e `poolCfg`), então adicione `showModifier: true` ali. Depois copie o teste `showDice false` e verifique que o `span` `ldm-card-mod` está ausente quando `showModifier` é false.

**Passo 7: execute.**

```
npm test
npm run check
```

## 12. Testes, arquivos de idioma e verificações

| Comando | O que faz |
|---|---|
| `npm test` | `node --test`: 663 testes em 64 suítes, distribuídos em doze arquivos de `tests/`. Apenas módulos puros; não precisa de navegador nem do motor. |
| `npm run check` | `npm test`, depois `node --check main.mjs`. |
| `npm run lang` | `node scripts/merge-lang.mjs`: junta cada `i18n/*.en.json` em `lang/en.json` e cada `*.pt-BR.json` em `lang/pt-BR.json`. É idempotente e não grava nada quando uma chave tem dois textos diferentes; nesse caso falha e não grava nada. Execute após qualquer mudança em um fragmento. (Não executado durante este percurso, porque grava arquivos.) |

Os testes do manifesto verificam que cada folha de estilo em `styles` existe e que cada chave `sandbox.*` usada no código está em `lang/en.json`. Também verificam que nenhum nome de outro produto aparece nos arquivos distribuídos, que `main.mjs` fica abaixo de 200 linhas e que o código nunca importa `Hooks` do SDK (a exportação é `LoomHooks`).

## 13. Notas de segurança

- **Toda string que chega ao HTML é escapada.** `esc()` (`lib/helpers.mjs`) é aplicado a todo valor interpolado em `renderSheet`, `renderItem`, `renderCard`, `renderEditor` e no painel de combate. A marcação de abas e blocos (`lib/layout-view.mjs`) e o bloco de efeitos (`lib/effects-view.mjs`) escapam seus próprios rótulos e textos. Não há HTML bruto vindo da configuração, do meta de rolagem, de nomes de atores ou de itens.
- **O texto de configuração não é confiável.** Qualquer conta de GM ou JSON importado pode escrevê-lo. `validateConfig` remove caracteres de controle, limita tamanhos, converte chaves em slug, valida cores (`#rrggbb`) e permite apenas os marcadores `{actor}`, `{label}` e `{result}` no cabeçalho do cartão. O cartão escapa a string final uma vez. Chaves de layout e nomes de blocos são verificados contra listas fixas, e as chaves das abas são convertidas em slug.
- **O meta de rolagem não é confiável.** Um cliente envia `meta` com `dispatchRoll`. O cartão lê apenas os campos que espera, corta cada um em um tamanho fixo e o escapa. `meta.kind` apenas troca o layout do cartão.
- **Fórmulas de dano são verificadas antes de chegar ao servidor.** `buildExtra` aceita apenas a gramática do servidor e os limites de `DICE_LIMITS`.
- **Chaves de efeito são verificadas.** Uma chave de alteração deve casar com o padrão de caminho com pontos e não pode usar `__proto__`, `constructor` ou `prototype` como segmento (`lib/effects-view.mjs`).
- **Escritas são mínimas e restritas.** As fichas enviam apenas os caminhos alterados. Salvar a configuração exige GM no servidor. Escrever efeitos exige GM ou dono no servidor. O caminho de elenco de NPC recusa quando o elenco não pode ser verificado, então nunca grava no registro errado.
- **Imagens são verificadas.** URLs de retrato e de imagem passam por `safeImageUrl` (`sheets/sandbox-sheet.mjs`, `sheets/item-view.mjs`) antes de serem usadas. Ícones de efeito passam por `isSafeIcon` (`lib/effects-view.mjs`).
- **Cores e rótulos do painel de combate** passam por `safeColor` e `cleanText`; os números de recurso são limitados a 0..999.
- **Texto simples no chat** (o resumo de iniciativa) depende de o renderizador do chat escapar o conteúdo simples. (not verified in a browser)

## Lançamento

O fluxo em `.github/workflows/release.yml` roda ao criar uma tag de versão, como `v1.2.3`. Ele gera o pacote e grava a versão da tag no manifesto. `tests/manifest.test.mjs` verifica que `ruleset.json` tem uma `version` semver e que o ponto de entrada é `main.mjs`. Observação: `ruleset.json` diz `0.2.0` e `package.json` diz `0.1.0` hoje; os dois não estão sincronizados.
