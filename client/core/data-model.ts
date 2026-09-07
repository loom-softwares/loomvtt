/*******************************************************************************
 * LoomVTT
 * client/core/data-model.ts
 * 
 * 
 * Data model fields (`StringField`, `NumberField`, `TypeDataModel`, etc.), exposed as `window.Loom.fields_v14`/`Loom.abstract`.
 ******************************************************************************/

export class DataField {
  options: any;
  constructor(options: any = {}) {
    this.options = options;
  }

  /** Compatibility with `DataField#toInput`. Generates the basic input element for the field.
   * `choices` (map `{value: label}` or array) becomes `<select>`; otherwise, a text input is used. */
  toInput(config: Record<string, any> = {}): HTMLElement {
    const name = config.name ?? this.options.name ?? '';
    const value = config.value ?? this.options.initial ?? '';
    const choices = config.choices ?? this.options.choices;
    if (choices) {
      const select = document.createElement('select');
      select.name = name;
      const entries = Array.isArray(choices)
        ? choices.map((c: any) => [c, c])
        : Object.entries(choices);
      for (const [val, label] of entries) {
        const opt = document.createElement('option');
        opt.value = String(val);
        opt.textContent = String(label);
        if (String(val) === String(value)) opt.selected = true;
        select.appendChild(opt);
      }
      return select;
    }
    const input = document.createElement('input');
    input.name = name;
    input.type = 'text';
    input.value = value ?? '';
    return input;
  }

  /** Compatibility with `DataField#toFormGroup`. Wraps `toInput()` in a
   * `<div class="form-group">` with a label, used to build selects inside dialogs. */
  toFormGroup(groupConfig: Record<string, any> = {}, inputConfig: Record<string, any> = {}): HTMLElement {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = groupConfig.label ?? inputConfig.label ?? this.options.label;
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.textContent = label;
      group.appendChild(labelEl);
    }
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    fields.appendChild(this.toInput(inputConfig));
    group.appendChild(fields);
    return group;
  }
}
export class BooleanField extends DataField {
  toInput(config: Record<string, any> = {}): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = config.name ?? this.options.name ?? '';
    input.checked = !!(config.value ?? this.options.initial);
    return input;
  }
}
export class HTMLField extends DataField { }
export class NumberField extends DataField {
  toInput(config: Record<string, any> = {}): HTMLElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.name = config.name ?? this.options.name ?? '';
    input.value = String(config.value ?? this.options.initial ?? '');
    return input;
  }
}
export class ObjectField extends DataField { }
export class StringField extends DataField { }
export class ColorField extends DataField { }

/** The origin signature is `new ArrayField(elementField, options)` — 2 arguments,
 * similar to `SchemaField`/`TypedObjectField` above. */
export class ArrayField extends DataField {
  element: any;
  constructor(element: any, options: any = {}) {
    super(options);
    this.element = element;
  }
}

/**
 * The origin signature is `new SchemaField(fields, options)` — two separate arguments
 * (the sub-fields map and block options, e.g., `{required, initial}`).
 * Without this dedicated class, `SchemaField` inherits the single-argument constructor from
 * `DataField`, making the sub-fields map indistinguishable from `options`, silently discarding
 * any second argument.
 */
export class SchemaField extends DataField {
  fields: Record<string, any>;
  constructor(fields: Record<string, any> = {}, options: any = {}) {
    super(options);
    this.fields = fields;
  }
}

/**
 * The origin signature is `new TypedObjectField(elementField, options)` — dynamic dictionary
 * where each VALUE follows the `elementField` schema. Without this dedicated class, it inherits
 * the 1-argument constructor from `DataField` and breaks with "not a constructor" upon initialization.
 */
export class TypedObjectField extends DataField {
  element: any;
  constructor(element: any, options: any = {}) {
    super(options);
    this.element = element;
  }
}

/** Resolves the default value of a field by recursing into nested `SchemaField`s.
 * Since `field.options` in a SchemaField contains the sub-fields map and not `{initial}`,
 * a direct check (`field.options.initial !== undefined`) would always fail for nested blocks. */
function resolveFieldDefault(field: unknown): any {
  if (field instanceof SchemaField) {
    const obj: Record<string, any> = {};
    for (const [key, sub] of Object.entries(field.fields)) {
      const def = resolveFieldDefault(sub);
      if (def !== undefined) obj[key] = def;
    }
    return obj;
  }
  if (field instanceof TypedObjectField) {
    // Keys are not pre-declared (derived from actual data). `{}` is the correct default for this field.
    return field.options?.initial ?? {};
  }
  if (field instanceof ArrayField) {
    return field.options?.initial ?? [];
  }
  if (field instanceof DataField && field.options?.initial !== undefined) {
    return typeof field.options.initial === 'function' ? field.options.initial() : field.options.initial;
  }
  return undefined;
}

export class TypeDataModel {
  [key: string]: any;

  constructor(data: any = {}, options: any = {}) {
    const schema = (this.constructor as any).defineSchema?.() || {};
    for (const [key, field] of Object.entries(schema)) {
      const provided = data[key];
      if (field instanceof SchemaField) {
        // Shallow merge: existing values take priority, the schema only fills missing gaps.
        const defaults = resolveFieldDefault(field) ?? {};
        this[key] = provided !== undefined ? { ...defaults, ...provided } : defaults;
      } else if (provided !== undefined) {
        this[key] = provided;
      } else {
        const def = resolveFieldDefault(field);
        if (def !== undefined) this[key] = def;
      }
    }
    // Also retains any data not declared in the schema (legacy/unmigrated fields).
    for (const key of Object.keys(data)) {
      if (this[key] === undefined) {
        this[key] = data[key];
      }
    }
  }

  static defineSchema(): Record<string, any> {
    return {};
  }
}

/**
 * Applies the defaults from `dataModels[type]` on top of the raw `systemData` coming from the API.
 * Ensures newly loaded documents have default fields even if never edited by the user.
 * Returns the untouched original `systemData` if the system didn't register a model for the type.
 */
export function applyTypeDataModelDefaults(
  dataModels: Record<string, any> | undefined,
  type: string | undefined,
  systemData: Record<string, any> | undefined,
): Record<string, any> {
  const ModelClass = type ? dataModels?.[type] : undefined;
  if (typeof ModelClass !== 'function') return systemData ?? {};
  return new ModelClass(systemData ?? {});
}
