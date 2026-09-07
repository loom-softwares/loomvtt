# Sheet Catalog (`sheet-catalog.ts`)

Catálogo de fichas (Actor/Item sheets). Addons registram suas fichas personalizadas aqui.

```typescript
import { sheets } from '/_loom/sdk/index.js';
```

## API

```typescript
sheets.catalog(docType: string, typeName: string, SheetClass): void
sheets.get(docType: string, typeName?: string): SheetConstructor | undefined
```

## Exemplo

```typescript
import { MyActorSheet } from './sheets/my-actor-sheet.js';

// Registrar ficha personalizada
sheets.catalog('actor', 'character', MyActorSheet);

// Recuperar
const Sheet = sheets.get('actor', 'character');
// Se typeName não for encontrado, fallback pra '*'
```

## LoomDocumentSheet

Todas as fichas estendem `LoomDocumentSheet`:

```typescript
abstract class LoomDocumentSheet<DocType> extends BaseWindow {
  protected abstract get documentName(): string; // ex: 'actor'
  protected abstract get apiRoute(): string;      // ex: '/actors'
  protected get dataKey(): string; // default: 'systemData' se documentName === 'actor', senão 'data'
}
```

- `dataKey` tem um valor padrão (não precisa sobrescrever, a menos que seu documento
  guarde o payload do sistema numa chave diferente) — `'systemData'` pra actor,
  `'data'` pra qualquer outro `documentName`.
- **Fluxo de fetch:** ao montar, `loadDocument()` lê `this.options.documentId`; se
  vazio, não busca nada (ficha abre em branco). Se presente, faz
  `GET {apiRoute}/{documentId}` e guarda o resultado em `this.document`, já passado
  pelo `prepareData()` do `documentClass` registrado (ver `globals.md#prepareData`).
- **`documentId` não é o prop que quem abre a ficha passa** — é um campo interno que
  o `super()` da SUA classe precisa preencher a partir do prop que você escolher
  (a convenção nativa é `actorId`/`itemId`, mas é você quem decide no seu construtor):
  ```typescript
  constructor(props: { itemId: string }) {
    super({ id: `item-sheet-${props.itemId}`, documentId: props.itemId, title: '...' });
  }
  ```
- **ID da janela:** não tem convenção única imposta pelo motor — só precisa ser
  estável e único por documento (se abrir a mesma ficha duas vezes com o mesmo id,
  `windowManager.open` foca a existente em vez de abrir outra). O código nativo usa o
  id cru do documento (`windowManager.open(id, SheetClass, { itemId: id })`); fichas
  de terceiro costumam prefixar (`item-sheet-${id}`) — os dois funcionam.

## Como abrir a ficha (própria ou de outro documento) programaticamente

Não existe um helper `openItemSheet()`/`openSheet()` — o padrão é combinar
`sheets.get()` (pra achar a classe certa, incluindo fallback) com
`windowManager.open()`:

```typescript
import { sheets, windowManager } from '/_loom/sdk/index.js';

function openItemSheet(item: { id: string; type: string }) {
  const SheetClass = sheets.get('item', item.type) || sheets.get('item', '*');
  if (!SheetClass) return; // nenhuma sheet registrada pra esse tipo, nem fallback
  windowManager.open(`item-sheet-${item.id}`, SheetClass, { itemId: item.id });
}
```

Se a sua própria sheet já está registrada via `sheets.catalog(...)`, `sheets.get()`
retorna ela mesma — não precisa de lógica extra pra "abrir minha própria ficha".

## LoomHandlebarsMixin & Renderização de Fichas Convertidas

Fichas que utilizam o mixin Handlebars (`LoomHandlebarsMixin`) ou sheets de sistemas convertidos possuem garantias de ciclo de vida:

1. **Motor de Renderização Único:** O motor de render existe apenas uma vez na cadeia de herança, garantindo que `_onRender()` e `_postRender()` sejam chamados exatamente **uma vez** por render.
2. **Proteção contra Loop no `update()`:** O `ClientDocument` protege a execução contra chamadas acidentais a `this.update()` dentro de `prepareData()` ou `prepareDerivedData()` durante o ciclo de renderização através do guarda interno `_preparingDataDepth`. Alterações feitas durante esse estágio são atribuídas localmente sem disparar requisições HTTP/WebSocket duplicadas.
3. **Debounce em Inputs de Canvas:** Inputs contínuos que interagem com o canvas ou valores numéricos contínuos devem utilizar debounce de 300ms antes de persistir o update no servidor.
