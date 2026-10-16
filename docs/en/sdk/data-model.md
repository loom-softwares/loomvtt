# Data Model — Fields + TypeDataModel (`data-model.ts`)

Data modeling compatibility layer for converted systems: declarative data fields
(`StringField`, `NumberField`, etc.) and `TypeDataModel` as the schema base.

Source: `client/core/data-model.ts`. Exposed at runtime as `Loom.fields_v14`
(the fields), `Loom.abstract.TypeDataModel`, and by the global aliases `vtt.data.fields`
and `vtt.abstract` (see `globals.md`).

> **Note:** `Loom.fields` and `Loom.fields_v14` expose the **same** classes, both imported from
> `client/core/data-model.ts` in `client/main.ts`. A field created from either one is an
> `instanceof` match for `TypeDataModel`. Converted systems that use
> `class MyModel extends TypeDataModel` + `static defineSchema()` can use `Loom.fields_v14` or
> `vtt.data.fields`.

## Exports

| Export | Type | Description |
|--------|------|-----------|
| `DataField` | `class` | Common base — holds `options` (including `initial`) |
| `ArrayField` | `class extends DataField` | Array field |
| `BooleanField` | `class extends DataField` | Boolean field |
| `ColorField` | `class extends DataField` | Color field (string) |
| `HTMLField` | `class extends DataField` | HTML/rich text field |
| `NumberField` | `class extends DataField` | Numeric field |
| `ObjectField` | `class extends DataField` | Object field |
| `SchemaField` | `class extends DataField` | Nested schema field |
| `StringField` | `class extends DataField` | String field |
| `TypedObjectField` | `class extends DataField` | Object whose keys are not pre-declared (defaults to `{}`) |
| `TypeDataModel` | `class` | Schema base — `static defineSchema()` + hydration of `initial` |

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

`TypeDataModel` constructor:
- Reads `this.constructor.defineSchema()`.
- For each schema key, applies `data[key]` if provided; otherwise, the field's `initial`
  (if `initial` is a function, calls it; if it's a value, uses it directly).
- Any other key in `data` that is still `undefined` is also assigned.

## Example

```js
// Not an SDK import — only exists as the window.Loom global (or vtt.data/vtt.abstract).
const { TypeDataModel } = Loom.abstract;
const { StringField, NumberField } = Loom.fields_v14;

class CreatureModel extends TypeDataModel {
  static defineSchema() {
    return {
      name: new StringField({ initial: 'No name' }),
      hp: new NumberField({ initial: () => 10 }),
    };
  }
}

const model = new CreatureModel({ hp: 20 });
console.log(model.name, model.hp); // 'No name' 20
```
