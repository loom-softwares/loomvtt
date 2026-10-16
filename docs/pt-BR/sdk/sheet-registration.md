# Registro de Fichas — `Actors`/`Items`/`DocumentSheetConfig` (`sheet-registration.ts`)

Camada de compatibilidade que permite registrar fichas de ator/item no catálogo usando a
API de registro de sistemas convertidos. É um **side-effect module**: só importar ele já
expõe os globais `Actors`, `Items` e `DocumentSheetConfig` em `window`. O módulo também tem exports
nomeados dos mesmos objetos, mas o SDK (`/_loom/sdk/index.js`) não os reexporta, então use os globais.

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
  makeDefault?: boolean; // aceito, mas ignorado (ver CODE ISSUE abaixo)
  label?: string;        // aceito, mas ignorado (ver CODE ISSUE abaixo)
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

Só `types` é usado. O argumento `scope` das três funções é ignorado, e `makeDefault` e
`label` não têm efeito. Cada entrada de `types` é registrada no catálogo como está.

> **CODE ISSUE:** `client/core/sheet-registration.ts` (`registerInCatalog`) lê apenas `options.types`. `makeDefault`
> e `label` nunca são usados, então uma ficha registrada com `makeDefault: true` não vira a padrão por causa dessa flag.
