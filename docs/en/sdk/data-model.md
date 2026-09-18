# Data Model — Fields + TypeDataModel (`data-model.ts`)

Data modeling compatibility layer for converted systems: declarative data fields
(`StringField`, `NumberField`, etc.) and `TypeDataModel` as the schema base.

Source: `client/core/data-model.ts`. Exposed at runtime as `Loom.fields_v14`
(the fields), `Loom.abstract.TypeDataModel`, and by the global aliases `vtt.data.fields`
and `vtt.abstract` (see `globals.md`).

> **Important:** there are **two** fields APIs in LoomVTT. `Loom.fields` is a **separate**
> set, with minimalist classes defined inline in `client/main.ts` (without schema logic).
> `Loom.fields_v14` (this module's fields) are the classes that extend `DataField`
> and are the ones a `TypeDataModel` understands. Converted systems that use
> `class MyModel extends TypeDataModel` + `static defineSchema()` must use the fields from
> **`Loom.fields_v14`** / `vtt.data.fields`.

## Exports

| Export | Type | Description |
|--------|------|-----------|
| `DataField` | `class` | Common base — holds `options` (including `initial`) |
| `ArrayField` | `class extends DataField` | Array field |
| `BooleanField` | `class extends DataField` | Boolean field |
| `HTMLField` | `class extends DataField` | HTML/rich text field |
| `NumberField` | `class extends DataField` | Numeric field |
| `ObjectField` | `class extends DataField` | Object field |
| `SchemaField` | `class extends DataField` | Nested schema field |
| `StringField` | `class extends DataField` | String field |
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

## How this feeds `actor.system` / `item.system`

Once a system registers a `TypeDataModel` subclass per type (`Loom.config.Actor.dataModels[type] = MyModel`,
same for `Loom.config.Item.dataModels`), every live `Actor`/`Item` instance's `.system` getter
runs the raw stored data through that model on **every access** (not cached — see `globals.md`),
so `initial` values declared in `defineSchema()` always fill in fields missing from what's
actually saved.

> **Gotcha:** if your system also does its own `.system`-aliasing for raw, non-instance
> documents (e.g. a "give plain DB rows a `.system` getter too" compatibility shim), guard it
> with `'system' in document` — which checks the **whole prototype chain** — not
> `Object.getOwnPropertyDescriptor(document, 'system')`, which only sees **own** properties.
> A real `Actor`/`Item` instance already has `.system` as an *inherited* getter from its
> prototype; an own-property-only check won't see it and will install a second, shadowing
> getter that returns the raw data verbatim — silently dropping every `initial` your schema
> declares for that instance.
