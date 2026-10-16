# Data Model — Fields + TypeDataModel (`data-model.ts`)

Camada de compatibilidade de modelagem de dados para sistemas convertidos: data fields
declarativos (`StringField`, `NumberField`, etc.) e `TypeDataModel` como base de schema.

Fonte: `client/core/data-model.ts`. Exposto no runtime como `Loom.fields_v14`
(os fields), `Loom.abstract.TypeDataModel`, e pelos alias globais `vtt.data.fields`
e `vtt.abstract` (ver `globals.md`).

> **Nota:** `Loom.fields` e `Loom.fields_v14` expõem as **mesmas** classes, ambas importadas de
> `client/core/data-model.ts` em `client/main.ts`. Um field criado a partir de qualquer um dos dois
> faz match de `instanceof` com `TypeDataModel`. Sistemas convertidos que usam
> `class MyModel extends TypeDataModel` + `static defineSchema()` podem usar `Loom.fields_v14` ou
> `vtt.data.fields`.

## Exports

| Export | Tipo | Descrição |
|--------|------|-----------|
| `DataField` | `class` | Base comum — guarda `options` (incluindo `initial`) |
| `ArrayField` | `class extends DataField` | Field de array |
| `BooleanField` | `class extends DataField` | Field de booleano |
| `ColorField` | `class extends DataField` | Field de cor (string) |
| `HTMLField` | `class extends DataField` | Field de HTML/rich text |
| `NumberField` | `class extends DataField` | Field numérico |
| `ObjectField` | `class extends DataField` | Field de objeto |
| `SchemaField` | `class extends DataField` | Field de schema aninhado |
| `StringField` | `class extends DataField` | Field de string |
| `TypedObjectField` | `class extends DataField` | Objeto cujas chaves não são pré-declaradas (padrão `{}`) |
| `TypeDataModel` | `class` | Base de schema — `static defineSchema()` + hidratação de `initial` |

## API

```typescript
class DataField {
  options: any;
  constructor(options?: any);
}

class TypeDataModel {
  [key: string]: any;
  constructor(data?: any, options?: any);
  static defineSchema(): Record<string, any>;
}
```

`TypeDataModel` no construtor:
- Lê `this.constructor.defineSchema()`.
- Pra cada chave do schema, aplica `data[key]` se fornecido; senão, o `initial` do field
  (se `initial` for função, chama; se for valor, usa direto).
- Qualquer outra chave em `data` que ainda esteja `undefined` também é atribuída.

## Exemplo

```js
// Não é import do SDK — só existe como global window.Loom (ou vtt.data/vtt.abstract).
const { TypeDataModel } = Loom.abstract;
const { StringField, NumberField } = Loom.fields_v14;

class CreatureModel extends TypeDataModel {
  static defineSchema() {
    return {
      name: new StringField({ initial: 'Sem nome' }),
      hp: new NumberField({ initial: () => 10 }),
    };
  }
}

const model = new CreatureModel({ hp: 20 });
console.log(model.name, model.hp); // 'Sem nome' 20
```
