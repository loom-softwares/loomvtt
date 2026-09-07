/*******************************************************************************
 * LoomVTT
 * client/core/primitives.ts
 * 
 * 
 * Extended methods on native prototypes (Array/String/Number/Set/Date), applied as side effects on import.
 ******************************************************************************/

export { };

declare global {
  interface Array<T> {
    equals(other: T[]): boolean;
    partition(fn: (item: T, index: number) => boolean): [T[], T[]];
    findSplice(fn: (item: T, index: number) => boolean, replacement?: T): T | undefined;
    filterJoin(sep: string, fn?: (item: T, index: number) => boolean): string;
    deepFlatten(): any[];
  }

  interface ArrayConstructor {
    fromRange(n: number, start?: number): number[];
  }

  interface String {
    capitalize(): string;
    titleCase(): string;
    slugify(options?: { replacement?: string; lower?: boolean }): string;
    stripScripts(): string;
    stripDiacritics(): string;
    compare(other: string): number;
  }

  interface Math {
    clamp(value: number, min: number, max: number): number;
    mix(a: number, b: number, t: number): number;
    toDegrees(radians: number): number;
    toRadians(degrees: number): number;
    normalizeDegrees(degrees: number): number;
    normalizeRadians(radians: number): number;
    readonly SQRT1_3: number;
    readonly SQRT3: number;
  }

  interface NumberConstructor {
    isNumeric(value: any): boolean;
    between(num: number, min: number, max: number, inclusive?: boolean): boolean;
    fromString(str: string): number | null;
    paddedString(value: number, digits: number): string;
    signedString(value: number): string;
    ordinalString(value: number): string;
  }

  interface Set<T> {
    equals(other: Set<T>): boolean;
    isSubset(other: Set<T>): boolean;
    intersects(other: Set<T>): boolean;
    filter(fn: (item: T) => boolean): Set<T>;
    map<R>(fn: (item: T) => R): Set<R>;
    find(fn: (item: T) => boolean): T | undefined;
    every(fn: (item: T) => boolean): boolean;
    some(fn: (item: T) => boolean): boolean;
    reduce<R>(fn: (acc: R, item: T) => R, initial: R): R;
    first(): T | undefined;
    toObject(): T[];
  }

  interface Date {
    isValid(): boolean;
    toDateInputString(): string;
    toTimeInputString(): string;
  }
}

function define<T>(proto: object, name: string, fn: T): void {
  Object.defineProperty(proto, name, { value: fn, writable: true, configurable: true, enumerable: false });
}

/* ── Array.prototype ── */

define(Array.prototype, 'equals', function (this: any[], other: any[]): boolean {
  if (this.length !== other.length) return false;
  return this.every((v, i) => v === other[i]);
});

define(Array.prototype, 'partition', function (this: any[], fn: (v: any) => boolean): [any[], any[]] {
  const fail: any[] = [];
  const pass: any[] = [];
  for (let i = 0; i < this.length; i++) {
    if (fn(this[i])) pass.push(this[i]);
    else fail.push(this[i]);
  }
  return [fail, pass];
});

define(Array.prototype, 'findSplice', function (this: any[], fn: (v: any) => boolean, replacement?: any): any {
  const idx = this.findIndex(fn);
  if (idx === -1) return undefined;
  const [removed] = this.splice(idx, 1);
  if (replacement !== undefined) this.splice(idx, 0, replacement);
  return removed;
});

define(Array.prototype, 'filterJoin', function (this: any[], sep: string, fn?: (v: any) => boolean): string {
  return this.filter(fn || ((v: any) => v)).join(sep);
});

define(Array.prototype, 'deepFlatten', function (this: any[]): any[] {
  const result: any[] = [];
  for (const v of this) {
    if (Array.isArray(v)) result.push(...(v as any[]).deepFlatten());
    else result.push(v);
  }
  return result;
});

define(Array, 'fromRange', function (n: number, start = 0): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
});

/* ── String.prototype ── */

define(String.prototype, 'capitalize', function (this: string): string {
  return this.charAt(0).toUpperCase() + this.slice(1);
});

define(String.prototype, 'titleCase', function (this: string): string {
  return this.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
});

define(String.prototype, 'slugify', function (this: string, options?: { replacement?: string; lower?: boolean }): string {
  const rep = options?.replacement ?? '-';
  let str = this.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, rep);
  if (options?.lower !== false) str = str.toLowerCase();
  return str;
});

define(String.prototype, 'stripScripts', function (this: string): string {
  return this.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
});

define(String.prototype, 'stripDiacritics', function (this: string): string {
  return this.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
});

define(String.prototype, 'compare', function (this: string, other: string): number {
  return this.localeCompare(other, undefined, { sensitivity: 'base' });
});

/* ── Math ── */

define(Math, 'clamp', function (value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
});

define(Math, 'mix', function (a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
});

define(Math, 'toDegrees', function (radians: number): number {
  return radians * 180 / Math.PI;
});

define(Math, 'toRadians', function (degrees: number): number {
  return degrees * Math.PI / 180;
});

define(Math, 'normalizeDegrees', function (degrees: number): number {
  return ((degrees % 360) + 360) % 360;
});

define(Math, 'normalizeRadians', function (radians: number): number {
  const pi2 = Math.PI * 2;
  return ((radians % pi2) + pi2) % pi2;
});

Object.defineProperty(Math, 'SQRT1_3', { value: 1 / Math.sqrt(3), writable: false, configurable: false, enumerable: false });
Object.defineProperty(Math, 'SQRT3', { value: Math.sqrt(3), writable: false, configurable: false, enumerable: false });

/* ── Number ── */

define(Number, 'isNumeric', function (value: any): boolean {
  if (value === null || value === false || value === true) return false;
  if (typeof value === 'number') return !isNaN(value) && isFinite(value);
  if (typeof value === 'string') return value.trim() !== '' && !isNaN(Number(value)) && isFinite(Number(value));
  return false;
});

define(Number, 'between', function (num: number, min: number, max: number, inclusive = true): boolean {
  return inclusive ? num >= min && num <= max : num > min && num < max;
});

define(Number, 'fromString', function (str: string): number | null {
  if (typeof str !== 'string') return null;
  const num = Number(str);
  return !isNaN(num) ? num : null;
});

define(Number, 'paddedString', function (value: number, digits: number): string {
  return String(value).padStart(digits, '0');
});

define(Number, 'signedString', function (value: number): string {
  return value < 0 ? String(value) : `+${value}`;
});

define(Number, 'ordinalString', function (value: number): string {
  const mod100 = value % 100;
  const suffix = ['th', 'st', 'nd', 'rd'];
  const idx = (mod100 - 20) % 10;
  const s = suffix[idx] || suffix[mod100] || suffix[0];
  return `${value}${s}`;
});

/* ── Set.prototype ── */

define(Set.prototype, 'every', function (this: Set<any>, fn: (v: any) => boolean): boolean {
  for (const v of this) { if (!fn(v)) return false; }
  return true;
});

define(Set.prototype, 'some', function (this: Set<any>, fn: (v: any) => boolean): boolean {
  for (const v of this) { if (fn(v)) return true; }
  return false;
});

define(Set.prototype, 'filter', function (this: Set<any>, fn: (v: any) => boolean): Set<any> {
  const out = new Set<any>();
  for (const v of this) { if (fn(v)) out.add(v); }
  return out;
});

define(Set.prototype, 'map', function (this: Set<any>, fn: (v: any) => any): Set<any> {
  const out = new Set<any>();
  for (const v of this) { out.add(fn(v)); }
  return out;
});

define(Set.prototype, 'find', function (this: Set<any>, fn: (v: any) => boolean): any {
  for (const v of this) { if (fn(v)) return v; }
  return undefined;
});

define(Set.prototype, 'reduce', function (this: Set<any>, fn: (acc: any, v: any) => any, initial: any): any {
  let acc = initial;
  for (const v of this) { acc = fn(acc, v); }
  return acc;
});

define(Set.prototype, 'equals', function (this: Set<any>, other: Set<any>): boolean {
  if (this.size !== other.size) return false;
  for (const v of this) { if (!other.has(v)) return false; }
  return true;
});

define(Set.prototype, 'isSubset', function (this: Set<any>, other: Set<any>): boolean {
  for (const v of this) { if (!other.has(v)) return false; }
  return true;
});

define(Set.prototype, 'intersects', function (this: Set<any>, other: Set<any>): boolean {
  for (const v of this) { if (other.has(v)) return true; }
  return false;
});

define(Set.prototype, 'first', function (this: Set<any>): any {
  return this.values().next().value;
});

define(Set.prototype, 'toObject', function (this: Set<any>): any[] {
  return [...this];
});

/* ── Date.prototype ── */

define(Date.prototype, 'isValid', function (this: Date): boolean {
  return !isNaN(this.getTime());
});

define(Date.prototype, 'toDateInputString', function (this: Date): string {
  const y = this.getFullYear();
  const m = String(this.getMonth() + 1).padStart(2, '0');
  const d = String(this.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});

define(Date.prototype, 'toTimeInputString', function (this: Date): string {
  const h = String(this.getHours()).padStart(2, '0');
  const m = String(this.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
});
