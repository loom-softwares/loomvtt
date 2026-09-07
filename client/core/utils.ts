/*******************************************************************************
 * LoomVTT
 * client/core/utils.ts
 * 
 * 
 * General-purpose utility functions, exposed as `window.Loom.utils`.
 ******************************************************************************/

export function debounce<T extends (...args: any[]) => any>(callback: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  return function (this: any, ...args: Parameters<T>) {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback.apply(this, args), delay);
  };
}

/**
 * Wraps a callback function with a throttle threshold.
 * @param callback  The function to throttle
 * @param delay     The threshold in milliseconds
 * @returns         The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(callback: T, delay: number): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: number | undefined;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    // If enough time has passed, execute immediately
    if (now - lastTime >= delay) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      lastTime = now;
      callback.apply(this, args);
    }
    // Otherwise, schedule execution at the end of the delay period if not already scheduled
    else if (!timeoutId) {
      timeoutId = window.setTimeout(() => {
        lastTime = Date.now();
        timeoutId = undefined;
        callback.apply(this, args);
      }, delay - (now - lastTime));
    }
  };
}

/**
 * Recursively merges two objects, optionally overwriting existing keys.
 * @param original - The original object to merge into
 * @param other - The object to merge from
 * @param options - Merge options (currently supports basic recursive merge)
 * @returns The merged object
 */
export function mergeObject(original: any, other: any, options: any = {}): any {
  const result = { ...original };

  for (const key in other) {
    if (other.hasOwnProperty(key)) {
      const otherValue = other[key];
      const originalValue = result[key];

      // If both values are objects and not null, merge them recursively
      if (otherValue && typeof otherValue === 'object' &&
        originalValue && typeof originalValue === 'object' &&
        !Array.isArray(otherValue) && !Array.isArray(originalValue)) {
        result[key] = mergeObject(originalValue, otherValue, options);
      } else {
        // Overwrite with the new value
        result[key] = otherValue;
      }
    }
  }

  return result;
}

/**
 * Creates a deep clone of an object using JSON.parse/stringify.
 * Note: This has the same limitations as the original (functions, Maps, Sets are not cloned).
 * @param obj - The object to clone
 * @returns A deep clone of the object
 */
export function duplicate(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Retrieves a nested property value from an object using a dot notation path.
 * @param obj - The object to retrieve the property from
 * @param path - The dot notation path (e.g., 'system.attributes.strength.value')
 * @returns The property value or undefined if not found
 */
export function getProperty(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Expands Foundry-style flattened update keys (`"system.dicepool.abc": {...}`,
 * `"system.dicepool.-=abc": null`) into Loom's native document shape. Converted systems
 * still think in Foundry's `system.*` update convention; Loom names that field `data`
 * (Item) or `systemData` (Actor), and the PUT routes only recognize those exact top-level
 * keys — without this, a `system.*` key matches nothing server-side and silently drops
 * (400 "No valid fields provided for update"). `-=key` as the final path segment is
 * Foundry's delete-this-key convention.
 */
export function expandFoundryUpdate(
  existing: Record<string, any> | undefined,
  changes: Record<string, any>,
  systemField: string,
): Record<string, any> {
  const result: Record<string, any> = {};
  let systemPatch: Record<string, any> | null = null;

  for (const [key, value] of Object.entries(changes)) {
    if (key !== 'system' && !key.startsWith('system.')) {
      result[key] = value;
      continue;
    }
    if (!systemPatch) systemPatch = duplicate(existing?.[systemField] ?? {});
    const patch: Record<string, any> = systemPatch!;
    const subPath = key === 'system' ? '' : key.slice('system.'.length);
    if (!subPath) {
      Object.assign(patch, value);
      continue;
    }
    const parts = subPath.split('.');
    const last = parts[parts.length - 1];
    if (last.startsWith('-=')) {
      const parentPath = parts.slice(0, -1).join('.');
      const parent = parentPath ? getProperty(patch, parentPath) : patch;
      if (parent && typeof parent === 'object') delete parent[last.slice(2)];
    } else {
      setProperty(patch, subPath, value);
    }
  }

  if (systemPatch) result[systemField] = systemPatch;
  return result;
}

/**
 * Sets a nested property value in an object using a dot notation path.
 * Creates intermediate objects if they don't exist.
 * @param obj - The object to set the property in
 * @param path - The dot notation path (e.g., 'system.attributes.strength.value')
 * @param value - The value to set
 */
export function setProperty(obj: any, path: string, value: any): void {
  if (!obj || !path) return;

  const parts = path.split('.');
  let current = obj;

  // Navigate to the parent of the target property
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === null || current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }

  // Set the final property value
  const finalPart = parts[parts.length - 1];
  current[finalPart] = value;
}

/**
 * Checks whether a nested property exists at a dot notation path, without
 * triggering getters/proxies beyond what a plain property read would do.
 * @param obj - The object to check
 * @param path - The dot notation path (e.g., 'system.attributes.strength.value')
 * @returns True if every segment of the path exists on the object
 */
export function hasProperty(obj: any, path: string): boolean {
  if (!obj || !path) return false;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = current[part];
  }

  return true;
}

/**
 * Creates a deep clone of an object (alias for duplicate in this implementation).
 * @param obj - The object to clone
 * @returns A deep clone of the object
 */
export function deepClone(obj: any): any {
  return duplicate(obj);
}

/**
 * Checks if a value is effectively empty.
 * @param value - The value to check
 * @returns True if the value is empty, false otherwise
 */
export function isEmpty(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Generates a random alphanumeric string ID.
 * @param length - The length of the ID to generate (default 16)
 * @returns A random string ID
 */
export function randomID(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const random = new Uint32Array(length);
  window.crypto.getRandomValues(random);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[random[i] % chars.length];
  }
  return id;
}

/**
 * Converts a nested object into a flat object with dot-notation keys.
 * (compatibility with origin `flattenObject`). Ex: `{ a: { b: 1 } }`
 * becomes `{ "a.b": 1 }`. Arrays are preserved intact.
 * @param obj    - The nested object
 * @param _options - Placeholder (chained, etc.)
 * @returns Flattened object
 */
export function flattenObject(obj: any, _options: any = {}): any {
  const flattened: any = {};
  function _flatten(source: any, prefix = '') {
    for (const key of Object.keys(source)) {
      const value = source[key];
      const next = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        _flatten(value, next);
      } else {
        flattened[next] = value;
      }
    }
  }
  _flatten(obj);
  return flattened;
}

/**
 * Re-expands a dot-notation object into a nested object
 * (inverse of `flattenObject`, compatibility with origin `expandObject`).
 * Ex: `{ "a.b": 1 }` becomes `{ a: { b: 1 } }`.
 * @param obj - The flattened object
 * @returns Expanded object
 */
export function expandObject(obj: any): any {
  const expanded: any = {};
  for (const [key, value] of Object.entries(obj)) {
    setProperty(expanded, key, value);
  }
  return expanded;
}

/**
 * Parses an HTML string into a DOM element (compatibility with origin `parseHTML`).
 * Returns a `<div>` containing the markup.
 * @param html - The HTML string
 * @param inline - If true, uses an inline fragment — defaults to `<div>`
 * @returns DOM Element
 */
export function parseHTML(html: string, inline = false): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  if (inline) {
    const frag = document.createDocumentFragment();
    while (div.firstChild) frag.appendChild(div.firstChild);
    return frag as unknown as HTMLElement;
  }
  return div;
}

/**
 * Escapes special HTML characters (& < > " ') for safe insertion into text
 * (compatibility with origin `escapeHTML`).
 * @param text - The text to escape
 * @returns Escaped text
 */
export function escapeHTML(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reorders an entire collection by an integer field (`key`, default `"sort"`),
 * shifting other siblings accordingly.
 * Same semantics as origin `performIntegerSort`.
 * @param source - Collection of objects with `.id`
 * @param options - Sort options
 * @returns Updates `{ target, update }` — contract expected by converted systems
 */
export function performIntegerSort(
  source: any[],
  { target = null, key = 'sort', sortBy = null }: { target?: any; key?: string; sortBy?: ((id: string) => number) | null } = {},
): any[] {
  // Mount a sortable map of the source, keeping the original target object (origin shape)
  const sortData = new Map<string, { target: any; sort: any; id: string }>(
    source.map((v, i) => [v.id, { target: v, sort: v[key] ?? i, id: v.id }]),
  );

  // Optionally target an element that must be moved
  if (target !== null) sortData.delete(target.id);

  // Optionally apply a sortBy function
  if (sortBy) {
    for (const datum of sortData.values()) datum.sort = sortBy(datum.id);
  }

  // Sort the data
  const sorted = [...sortData.values()].sort((a, b) => a.sort - b.sort);

  // Re-number all sort indices to integer values
  const max = sorted[sorted.length - 1]?.sort ?? 0;
  const updates = sorted.map((elem, i) => ({ target: elem.target, update: { [key]: i } }));
  if (target !== null) updates.push({ target, update: { [key]: max + 1 } });

  return updates;
}

/** Defensive counter to collapse successive reloads (multiple calls in one tick). */
let _reloadQueued = false;

/**
 * Reloads the page with a debounce — multiple calls in the same tick
 * (common in migrations) become a single `location.reload()` call
 * (compatibility with origin `debouncedReload`).
 */
export function debouncedReload(..._args: any[]): void {
  if (_reloadQueued) return;
  _reloadQueued = true;
  window.setTimeout(() => {
    _reloadQueued = false;
    window.location.reload();
  }, 100);
}