/*******************************************************************************
 * LoomVTT
 * client/core/form-data.ts
 * 
 * 
 * Extended form data handler for complex forms.
 ******************************************************************************/

export interface SerializeFormOptions {
  /** Delimiter used to build nested objects from field names, e.g. "sd:hp" -> { sd: { hp } }. Default ':'. */
  nestDelimiter?: string;
}

export interface SerializeFormResult {
  data: Record<string, any>;
  /** Names of required fields left empty. */
  missing: string[];
  /** Map of field names to their HTML elements. */
  elements: Map<string, HTMLElement>;
}

/**
 * FormData wrapper — turn a form/container into
 * structured data with required-field validation.
 *
 * Basic usage:
 *   const fd = new LoomFormData(formEl);
 *   fd.toObject()   // → { name: "...", stats: { hp: 10 } }
 *   fd.get("name")  // → "..."
 *   fd.missing      // → ["name"]  (required fields left empty)
 *
 * Matching LoomFormData
 */
export class LoomFormData {
  readonly #data: Record<string, any>;
  readonly #missing: string[];
  readonly #elements: Map<string, HTMLElement>;

  constructor(
    container: HTMLElement | Document,
    options: SerializeFormOptions = {},
  ) {
    const result = _serializeFormImpl(container, options);
    this.#data = result.data;
    this.#missing = result.missing;
    this.#elements = result.elements;
  }

  /** The plain-data object (live reference — mutating affects the source). */
  get object(): Record<string, any> {
    return this.#data;
  }

  /** Returns a shallow clone of the data object. */
  toObject(): Record<string, any> {
    return { ...this.#data };
  }

  /** Returns the value for a single key. */
  get(key: string): any {
    return this.#data[key];
  }

  /** Key–value tuples, useful with Object.fromEntries() or for-of. */
  entries(): [string, any][] {
    return Object.entries(this.#data);
  }

  /** Yields [key, value] pairs, making LoomFormData iterable. */
  *[Symbol.iterator](): Generator<[string, any]> {
    yield* this.entries();
  }

  /** Names of required fields that were left empty. */
  get missing(): string[] {
    return this.#missing;
  }

  /** Map of form field names to their HTML Elements. */
  get elements(): Map<string, HTMLElement> {
    return this.#elements;
  }

  /** Serialization protocol for JSON.stringify() support. */
  toJSON(): Record<string, any> {
    return this.toObject();
  }
}

/**
 * Reads every [name] field under `container` into a plain object.
 *
 * Prefer `new LoomFormData(container)` for new code.
 * This function is kept for backward compatibility.
 */
export function serializeForm(
  container: HTMLElement | Document,
  options: SerializeFormOptions = {},
): SerializeFormResult {
  return _serializeFormImpl(container, options);
}

function _serializeFormImpl(
  container: HTMLElement | Document,
  options: SerializeFormOptions = {},
): SerializeFormResult {
  const delimiter = options.nestDelimiter ?? ':';
  const data: Record<string, any> = {};
  const missing: string[] = [];
  const elements = new Map<string, HTMLElement>();

  const fields = container.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('[name]');

  fields.forEach((el) => {
    if (
      el instanceof HTMLInputElement &&
      (el.type === 'submit' || el.type === 'button')
    ) {
      return;
    }

    const name = el.getAttribute('name')!;
    elements.set(name, el);
    let value: unknown;

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      value = el.checked;
    } else if (el instanceof HTMLInputElement && el.type === 'number') {
      value = el.value === '' ? null : Number(el.value);
    } else if (el instanceof HTMLInputElement && el.type === 'file') {
      value = el.files;
    } else {
      value = el.value;
    }

    if (el.required && (value === '' || value === null || (el instanceof HTMLInputElement && el.type === 'file' && (!el.files || el.files.length === 0)))) {
      missing.push(name);
    }

    setNested(data, name.split(delimiter), value);
  });

  return { data, missing, elements };
}

function setNested(
  target: Record<string, any>,
  path: string[],
  value: unknown,
): void {
  if (path.length === 1) {
    target[path[0]] = value;
    return;
  }
  const [head, ...rest] = path;
  if (typeof target[head] !== 'object' || target[head] === null) {
    target[head] = {};
  }
  setNested(target[head], rest, value);
}
