/**
 * Utils for object manipulation, dot-notation expansion and deep merging.
 */

function isPlainObject(value: any): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function setProperty(obj: any, path: string, value: any): void {
  if (!obj || !path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === null || current[part] === undefined) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

export function expandObject(obj: any): any {
  const _expand = (value: any, depth: number): any => {
    if (depth > 32) throw new Error("Maximum object expansion depth exceeded");
    if (!value) return value;
    if (Array.isArray(value)) return value.map(v => _expand(v, depth + 1));
    if (!isPlainObject(value)) return value;
    const expanded: any = {};
    for (const [k, v] of Object.entries(value)) {
      setProperty(expanded, k, _expand(v, depth + 1));
    }
    return expanded;
  };
  return _expand(obj, 0);
}

export function mergeObject(original: any, other: any): any {
  if (!original) original = {};
  if (!other) return original;
  
  const result = { ...original };
  
  for (const key in other) {
    if (other.hasOwnProperty(key)) {
      if (key.startsWith('-=')) {
        const targetKey = key.substring(2);
        delete result[targetKey];
        continue;
      }

      const otherValue = other[key];
      const originalValue = result[key];
      
      if (isPlainObject(otherValue) && isPlainObject(originalValue)) {
        result[key] = mergeObject(originalValue, otherValue);
      } else {
        result[key] = otherValue;
      }
    }
  }
  
  return result;
}
