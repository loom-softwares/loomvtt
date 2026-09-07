# window.Loom (legado)

> Prefira importar do SDK (`/_loom/sdk/index.js`) em vez de usar `window.Loom`.
> O SDK oferece os mesmos métodos com tipos completos.

API global exposta para addons e sistemas no lado do cliente.

```typescript
(window as any).Loom = {
  LoomHooks,
  windowManager,
  api,
  showToast,
  showConfirm,
  showPrompt,
  showAlert,
  sheets: sheetCatalog,
  systems: systemRegistry,
  dice: diceRegistry,
  keybinds: keybindManager,
  applications: {
    ux: {
      TextEditor: {
        enrichHTML,
        truncateText,
        previewHTML,
        createBylines,
        _uploadImage,
      }
    }
  },
  renderTemplate,
  loadTemplates,
  debounce,
  throttle,
  DragDrop,
  fields,
  rolls: {
    resolveFormula,
    resolveActionFormulas,
    sumPaths,
    getActiveModifiers,
    collectItemModifiers,
  },
  wrap: createWrappable,
  wraps: {
    get resolveFOVOrigins() { ... },
    renderRollCard: renderRollCardWrap,
    renderMessage: renderMessageWrap,
    renderMacroIcon: renderMacroIconWrap,
  },
  BaseWindow,
  LoomDocumentSheet,
  LoomHandlebarsMixin,
  statusEffects: statusEffectRegistry,
  transitions: transitionEffectRegistry,
  get three() { return import('three'); },
  get cannon() { return import('cannon-es'); },
};
```

## Propriedades

| Propriedade                    | Tipo                                             | Descrição                                                            |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `LoomHooks`                  | `HooksRegistry`                                | Sistema de eventos (on/off/callAll)                                    |
| `config`                     | `object`                                       | Espelhado como `window.CONFIG` — ver `config.md`                       |
| `windowManager`              | `WindowManager`                                | Gerenciador de janelas (open/focus/close/closeTopmost/get/getAll)      |
| `LoomFormData`               | `class LoomFormData`                           | Serializa `[name]` de um formulário em objeto estruturado (delimitador `:` para aninhamento) |
| `LoomSidebarTab`             | `class LoomSidebarTab`                         | Base de painel de sidebar customizável — ver `sidebar-tabs.md`          |
| `applications.sidebar.tabs`  | `{ ActorDirectory, ChatLog, CompendiumDirectory, Settings }` | Subclasses prontas de `LoomSidebarTab`, uma por painel — ver `sidebar-tabs.md` |
| `api`                        | `{ get, post, put, delete }`                   | Cliente REST                                                           |
| `showToast`                  | `(msg, type?) => void`                         | Notificação toast                                                    |
| `showConfirm`                | `(title, msg) => Promise<boolean>`             | Diálogo de confirmação                                              |
| `showPrompt`                 | `(message, default?) => Promise<string\|null>`  | Diálogo de input                                                      |
| `showAlert`                  | `(message) => Promise<void>`                   | Diálogo de alerta                                                     |
| `sheets`                     | `SheetCatalog`                                 | Catálogo de fichas                                                    |
| `systems`                    | `SystemRegistry`                               | Registro de sistemas de RPG                                            |
| `applications.ux.TextEditor` | `TextEditor`                                   | Utilitários de texto e enrichment HTML (ex:`@Embed`, `[[/roll]]`) |
| `debounce`                   | `(fn, delay) => fn`                            | Limita a execução de uma função no tempo                           |
| `throttle`                   | `(fn, delay) => fn`                            | Limita a frequência de execução de uma função                     |
| `DragDrop`                   | `class LoomDragDrop`                           | Utilitário para gerenciar operações de drag-and-drop nativas        |
| `fields`                     | `Object`                                       | Data fields API (StringField, NumberField, etc)                        |
| `dice`                       | `DiceRegistry`                                 | Registro de expressões de dados (visual/face — ver`dice.md`)       |
| `keybinds`                   | `KeybindRegistry`                              | Registro de atalhos de teclado                                         |
| `renderTemplate`             | `(path, data) => Promise<string>`              | Compila um template Handlebars (`.hbs`)                               |
| `loadTemplates`              | `(paths[]) => Promise<void>`                   | Pré-carrega partials de template                                      |
| `rolls.resolveFormula`       | `(formula, actorData) => string`               | Substitui`@ref` por valor numérico                                  |
| `rolls.sumPaths`             | `(paths[], actorData) => number`               | Soma vários campos do actor (montagem de pool)                        |
| `rolls.getActiveModifiers`   | `(modifiers, selectors[], context) => number`  | Soma bônus de item ativos por selector (ver`dice.md`)               |
| `rolls.collectItemModifiers` | `(items[]) => ItemModifier[]`                  | Coleta`systemData.bonuses` dos itens do actor                        |
| `wrap`                       | `(fn) => Wrappable`                            | Cria ponto de wrapping                                                 |
| `wraps.resolveFOVOrigins`    | `function`                                     | Wrap point do Canvas FOV                                               |
| `wraps.renderRollCard`       | `function`                                     | Wrap point do card de roll no chat (ver`wrappable.md`)               |
| `wraps.renderMessage`        | `function`                                     | Wrap point do HTML de qualquer mensagem de chat                        |
| `wraps.renderMacroIcon`      | `function`                                     | Wrap point do ícone de cada slot da hotbar de macros                  |
| `BaseWindow`                 | `class`                                        | Classe base de janela — addon estende pra criar sheet própria        |
| `LoomDocumentSheet`          | `class`                                        | Base de ficha com data-binding automático                             |
| `LoomHandlebarsMixin`        | `function`                                     | Mixin`(Base) => class` — render por `static PARTS`/`TABS`       |
| `statusEffects`              | `StatusEffectRegistry`                         | Registro de condições (ver`status-effects.md`)                     |
| `transitions`                 | `TransitionEffectRegistry`                     | Registro de efeitos de transição de cena (ver `transitions.md`)   |
| `three`                      | `Promise<typeof import('three')>` (getter)     | Carrega Three.js sob demanda — só baixa o chunk se um addon acessar  |
| `cannon`                     | `Promise<typeof import('cannon-es')>` (getter) | Carrega cannon-es sob demanda, mesma lógica                           |
| `user`                       | `{ id, name, color, role, isGM, targets }` (getter) | Sessão do usuário atual + `targets` (getter próprio): cast members atualmente mirados por ele — ver exemplo abaixo |

## Exemplo de uso em addon

```js
// Registrar hook
Loom.LoomHooks.on('actor.created', (actor) => {
  console.log('Actor criado:', actor.name);
});

// Criar janela
await Loom.windowManager.open('my-window', MyWindowClass, { data: {} });

// Chamar API
const data = await Loom.api.get('/cast');

// Wrap de função
const wrapped = Loom.wrap(minhaFuncao);
wrapped.wrap((original, ...args) => {
  console.log('interceptado');
  return original(...args);
});

// Registrar uma condição customizada
Loom.statusEffects.register({ id: 'frenzy', label: 'Frenzy', color: 0xaa0000 });

// Carregar Three.js/cannon-es só quando precisar (ex: addon de dado 3D)
const THREE = await Loom.three;
const CANNON = await Loom.cannon;

// Ler quem o usuário atual está mirando (ex: pré-preencher dificuldade de
// rolagem com base no NPC alvo). targets é derivado de `targetedBy` no cast
// member — não precisa buscar nada, já vem populado.
const alvo = Loom.user.targets[0];
if (alvo) {
  console.log('Mirando:', alvo.name, 'dificuldade:', alvo.systemData?.difficulty);
}

// Reagir em tempo real quando o alvo muda (dispara pra QUALQUER jogador que
// marcar/desmarcar alvo, não só pra você — filtre por targetedBy se for o caso)
Loom.LoomHooks.on('targetToken', ({ castId, targetedBy }) => {
  console.log('Cast', castId, 'agora é mirado por', targetedBy);
});
```
