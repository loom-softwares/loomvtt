# Registro de Fichas — `Actors`/`Items`/`DocumentSheetConfig` (`sheet-registration.ts`)

Camada de compatibilidade que permite registrar fichas de ator/item no catálogo usando a
API de registro de sistemas convertidos. É um **side-effect module**: só importar ele já
expõe os globais `Actors`, `Items` e `DocumentSheetConfig` em `window` (não exporta nada
pra importar direto).

Fonte: `client/core/sheet-registration.ts`. Os registros feitos aqui vão parar no
mesmo catálogo exposto em `Loom.sheets` (ver `sheets.md`) — não é um registro separado.

## Globais expostos (side-effect)

| Global | API | Descrição |
|--------|-----|-----------|
| `window.Actors` | `{ registerSheet(scope, SheetClass, options?) }` | Registra ficha de ator |
| `window.Items` | `{ registerSheet(scope, SheetClass, options?) }` | Registra ficha de item |
| `window.DocumentSheetConfig` | `{ registerSheet(documentClass, scope, SheetClass, options?) }` | Registra ficha resolvendo o tipo a partir da classe do documento |

```typescript
interface RegisterSheetOptions {
  types?: string[];   // subtipos de documento; vazio/ausente = ['*']
  makeDefault?: boolean;
  label?: string;
}

Actors.registerSheet(scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
Items.registerSheet(scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
DocumentSheetConfig.registerSheet(documentClass: any, scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
```

`DocumentSheetConfig.registerSheet` resolve o tipo pela classe: compara com os globais
`Actor`/`Item` e, como fallback, pelo `documentClass.name` em minúsculas (`'actor'`/`'item'`).
Classe desconhecida loga um warning e não registra nada.

## Exemplo

```js
// Registro equivalente a Actors.registerSheet
Actors.registerSheet('world', MyActorSheet, { types: ['npc'], makeDefault: true });

// Registro por classe de documento (estilo DocumentSheetConfig)
DocumentSheetConfig.registerSheet(Actor, 'world', MyActorSheet, { types: ['character'] });

// Registro genérico — vale pra todos os subtipos
Items.registerSheet('world', MyItemSheet);
```

O `SheetClass` registrado precisa seguir o contrato de sheet (`LoomDocumentSheet` com
`LoomHandlebarsMixin(...)` aplicado na declaração, ver `sheets.md` e `windows.md`).
