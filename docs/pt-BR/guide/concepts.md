# Conceitos

> Toda API documentada aqui pode ser importada via
> `import { ... } from '/_loom/sdk/index.js'` em addons e sistemas.

## LoomDocument

Sistema ORM base para todas as entidades. Expõe CRUD automático com hooks, validação de schema, signals e controle de ownership.

```typescript
class LoomDocument {
  static schema: SchemaDefinition;
  static find(filter?): Promise<T[]>;  // filter aceita limit/offset para paginação
  static findById(id): Promise<T | null>;
  static findOne(filter): Promise<T | null>;
  static create(data, context?, opts?): Promise<{ data; error? }>;
  static update(id, data, context?): Promise<{ data; error? }>;
  static delete(id, context?): Promise<{ success; error? }>;
  static count(filter?): Promise<number>;
  static bulkUpdate(filter, updates): Promise<{ count: number; error?: string }>;
  static getFlag(scope, key, id);
  static setFlag(scope, key, value, id, context?);
  static unsetFlag(scope, key, id, context?);
}
```

Cada tabela tem seu próprio `LoomDocument` (ex: `ActorsDocument`, `ItemsDocument`, `CastsDocument`). O schema define campos, tipos e índices.

### ClientDocument Lifecycle

Para entidades que vivem no cliente (`Actor`, `Item`, etc.), o `ClientDocument` estabelece uma cadeia de preparação de dados com quatro estágios para evitar *loops* infinitos (onde um update engatilha um re-render que engatilha outro update). O ciclo completo (`prepareData()`) invoca:

1. `prepareBaseData()`: Valores base (atributos inatos), antes dos documentos embarcados.
2. `prepareEmbeddedDocuments()`: Processa itens, buffs e efeitos.
3. `prepareDerivedData()`: Calcula dados finais, aplicando buffs e derivados (ex: Armadura total). **Atenção:** Nunca chame `.update()` aqui.

Durante este ciclo, a flag `isPreparingData(this)` é verdadeira.

**Paginação:** `find()` aceita `limit` e `number` no filter:
```typescript
const page = await ActorsDocument.find({ worldId, limit: 50, offset: 0 });
```
Os valores são repassados como query string nos endpoints `GET /api/actors`, `GET /api/items`, `GET /api/cast`.

**SchemaDefinition:**

```typescript
{
  tableName: string;
  fields: Record<string, FieldType>;
  indexes?: { columns: string[]; unique?: boolean }[];
  primaryKey?: string; // default: 'id'
}
```

## Fields

```typescript
StringField({ required, minLength, maxLength, pattern, enum, default })
NumberField({ min, max, integer, default })
BooleanField({ default })
JSONField<T>({ default })
IdField({ default: randomUUID })
ForeignField({ ref, refKey })       // FK para outra tabela
ChildrenField({ ref, foreignKey })  // has-many (não persistido)
SchemaField<T>({ schema })          // objeto aninhado (JSON string)
```

## LoomHooks

Sistema de eventos client-side. Exposto como `Loom.LoomHooks` e como `window.Hooks` para compatibilidade.

```typescript
LoomHooks.on('actor.created', (actor) => {});
LoomHooks.off('actor.created', handler);
LoomHooks.callAll('actor.created', actorData);
LoomHooks.call('preUpdateActor', actor, changes, context);
```

> **Funcionamento:** O `LoomHooks` dispara hooks locais no cliente via `call()` (retornando `boolean` para permitir cancelamento em pré-hooks) e `callAll()`. No cliente, o `ClientDocument` dispara hooks de documento (`preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, etc.) e escuta eventos de Socket.IO relayados pelo servidor (`actors.created`, `actors.updated`, `actors.deleted`, `cast.created`, etc. — a nomenclatura não é consistente entre entidades, ver [websocket/events.md](../websocket/events.md)).

Os hooks client-side disponíveis incluem:

- Documentos: `preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, `actors.created`, `actors.updated`, `actors.deleted`
- Cast (Tokens): `cast.created`, `cast.updated`, `cast.deleted`, `token.target`
- Chat e Dados: `chat.message`, `chat.roll`, `preRoll`
- Janelas e Sistema: `renderWindow`, `closeWindow`, `render<Class>`, `close<Class>`, `init`, `setup`, `ready`

## Release / Versão do Motor

O ambiente expõe `game.release` com a assinatura de versão do LoomVTT:

```typescript
game.release = { generation: "1", build: 364 };
```

## Signals

Eventos server-side broadcast via Socket.IO (com escopo por sala — ver [websocket/overview.md](../websocket/overview.md)). Usa `EventEmitter` internamente.

```typescript
Signal.broadcast('cast.created', { data: actor });
Signal.listen('cast.created', (payload) => {});
Signal.deafen('cast.created', handler);
```

Automaticamente roteados para clientes Socket.IO quando um LoomDocument é criado/editado/deletado — mas só pra Signals que têm um `Signal.listen()` registrado em `server/index.ts`; nem toda Signal é relayada (ver [websocket/events.md](../websocket/events.md)). Addons também podem usar Signals no servidor sem relay nenhum pro cliente.

## Permissions / Ownership

Ownership é armazenado como JSON na coluna `ownership`:

```json
{ "userId": 3 }
```

Níveis: `0=none`, `1=limited`, `2=observer`, `3=owner`.

```typescript
isGM(req): boolean           // role >= 4
canView(ownership, defaultPerm, userId): boolean
canEdit(ownership, userId): boolean
buildOwnership(userId): string  // gera { userId: 3 }
```

## Wrappable

Sistema de interceptação de funções (alternativa ao libWrapper):

```typescript
const fn = Loom.wrap(minhaFuncao);
const unsub = fn.wrap((original, ...args) => {
  return original(...args);
});
```

## Diálogos

Funções para diálogos modais. Disponíveis no SDK como `showConfirm`, `showPrompt`, `showAlert`, `showToast`, `showSelectDialog`.

```typescript
import { showConfirm, showPrompt, showAlert, showToast, showSelectDialog } from '/_loom/sdk/index.js';
```

```typescript
showConfirm('Tem certeza?', 'Você deseja continuar?');           // Promise<boolean>
showPrompt('Nome do personagem:', 'Gandalf');                    // Promise<string | null>
showAlert('Operação concluída');                                 // Promise<void>
showToast('Mensagem', 'success');                                 // void (types: info|success|warning|error)

showSelectDialog('Escolher Ator', 'Selecione:', [
  { value: 'gandalf', label: 'Gandalf' },
  { value: 'frodo', label: 'Frodo' },
]);                                                // Promise<string | null>
```

> **Nota:** `showCreatePageDialog` existe internamente em `client/components/dialog.ts`
> mas **não** é exportado pelo SDK. Só está disponível no contexto do client interno
> (ex: usado por `journal-window.ts`).

## Keybinds

Sistema de atalhos de teclado. Addons podem registrar, sobrescrever e remover atalhos dinamicamente.

```typescript
import { keybinds } from '/_loom/sdk/index.js';
```

```typescript
interface KeybindAction {
  id: string;
  label: string;
  description: string;
  defaultKey: string;
  category?: string;
  onPress?: () => void;
}

keybinds.register({
  id: 'my-addon-action',
  label: 'Minha Ação',
  description: 'Faz algo especial',
  defaultKey: 'Ctrl+Shift+X',
  category: 'Meu Addon',
  onPress: () => console.log('ação disparada'),
});

keybinds.unregister('my-addon-action');
keybinds.setBinding('my-addon-action', 'Ctrl+Shift+Y');
keybinds.resetBinding('my-addon-action');
keybinds.resetAll();
```

Teclas suportadas: letras (`A-Z`), números (`0-9`), `F1`-`F24`, `Escape`, `Enter`, `Space`, `ArrowUp/Down/Left/Right`, `PageUp`, `PageDown`, `Delete`, `Tab`, `Shift+`, `Ctrl+`, `Ctrl+Shift+`.

Os atalhos core do LoomVTT incluem:

| Atalho                    | Ação               | Descrição                                  |
| ------------------------- | -------------------- | -------------------------------------------- |
| `T`                     | target-cast         | Marcar/desmarcar cast member como alvo             |
| `Delete`                | delete-selected      | Excluir selecionado                          |
| `Escape`                | cancel-or-close      | Cancelar ferramenta ou fechar janela do topo |
| `Ctrl+A`                | select-all           | Selecionar todos cast members visíveis            |
| `Shift+C`               | focus-chat           | Focar input do chat                          |
| `PageUp` / `PageDown` | zoom-in/zoom-out     | Zoom do canvas                               |
| `Ctrl+Arrow`            | pan-*                | Mover câmera                                |
| `Arrow`                 | move-*               | Mover cast member 1 célula                        |
| `Q` / `E`             | rotate-ccw/rotate-cw | Girar cast member 45°                             |
| `Space`                 | toggle-pause         | Pausar/retomar mundo (GM)                    |

## Templates

Handlebars para renderização de sheets:

```typescript
// renderTemplate/loadTemplates não são export do pacote SDK — são globais no
// facade window.Loom, exposto pelo client em runtime.
const html = await Loom.renderTemplate('path/to/template.hbs', { data });
```

> **Nota:** Templates são arquivos Handlebars puros, extensão `.hbs` — não existe
> extensão customizada nem reescrita de path.

## i18n

```typescript
// Também via window.Loom, não import — e a API é localize/format, não t/setLocale.
Loom.i18n.localize('actor.name', { name: 'Gandalf' });
Loom.i18n.registerLang('en-US', { actor: { name: '{name}' } });
```
