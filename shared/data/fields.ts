// Web Crypto (globalThis.crypto.randomUUID) em vez de importar o módulo 'crypto' do
// Node — este arquivo é compartilhado com o client (Vite/browser), e Vite externaliza
// módulos built-in do Node pro bundle do browser, jogando erro em runtime no primeiro
// acesso à propriedade. globalThis.crypto existe nativamente tanto no browser quanto
// no Node 19+ (mesma API Web Crypto nos dois lados), sem precisar de import nenhum.
const randomUUID = (): string => globalThis.crypto.randomUUID();

export interface FieldOptions<T = any> {
  required?: boolean;
  default?: T | (() => T);
  nullable?: boolean;
  validate?: (value: T, context?: any) => string | null;
  label?: string;
}

export interface StringFieldOptions extends FieldOptions<string> {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  textSearch?: boolean;
  enum?: readonly string[];
}

export interface NumberFieldOptions extends FieldOptions<number> {
  min?: number;
  max?: number;
  integer?: boolean;
  step?: number;
}

export interface ForeignFieldOptions extends FieldOptions<string> {
  ref: string;
  refKey?: string;
}

export interface ChildrenFieldOptions {
  ref: string;
  foreignKey: string;
}

export class Field<T = any> {
  readonly type: string;
  readonly required: boolean;
  readonly default: T | (() => T) | undefined;
  readonly nullable: boolean;
  readonly validate?: (value: T, context?: any) => string | null;

  constructor(type: string, options: FieldOptions<T> = {}) {
    this.type = type;
    this.required = options.required ?? false;
    this.default = options.default;
    this.nullable = options.nullable ?? !options.required;
    this.validate = options.validate;
  }
}

export class StringField extends Field<string> {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly textSearch?: boolean;
  readonly enum?: readonly string[];
  readonly sql: string;

  constructor(options: StringFieldOptions = {}) {
    super('string', options);
    this.minLength = options.minLength;
    this.maxLength = options.maxLength;
    this.pattern = options.pattern;
    this.textSearch = options.textSearch;
    this.enum = options.enum;
    this.sql = options.maxLength ? `VARCHAR(${options.maxLength})` : 'TEXT';
  }
}

export class HTMLField extends StringField {
  constructor(options: StringFieldOptions = {}) { super(options); }
}
export class RichTextField extends HTMLField {}

export class FileField extends StringField {
  readonly category: 'image' | 'video' | 'audio' | 'any';
  constructor(options: StringFieldOptions & { category?: 'image'|'video'|'audio'|'any' } = {}) {
    super(options);
    this.category = options.category ?? 'any';
  }
}
export class VideoField extends FileField {
  constructor(options: StringFieldOptions = {}) { super({ ...options, category: 'video' }); }
}
export class AudioField extends FileField {
  constructor(options: StringFieldOptions = {}) { super({ ...options, category: 'audio' }); }
}

export class NumberField extends Field<number> {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly step?: number;
  readonly sql: string;

  constructor(options: NumberFieldOptions = {}) {
    super('number', options);
    this.min = options.min;
    this.max = options.max;
    this.integer = options.integer;
    this.step = options.step;
    this.sql = options.integer ? 'INTEGER' : 'REAL';
  }
}

export class BooleanField extends Field<boolean> {
  readonly sql = 'INTEGER';

  constructor(options: FieldOptions<boolean> = {}) {
    super('boolean', options);
  }
}

export class DateField extends Field<number> {
  readonly sql = 'INTEGER';

  constructor(options: FieldOptions<number> = {}) {
    super('date', options);
  }
}

export class JSONField<T = any> extends Field<T> {
  readonly sql = 'TEXT';

  constructor(options: FieldOptions<T> = {}) {
    super('json', options);
  }
}

export class IdField extends Field<string> {
  readonly sql = 'TEXT';

  constructor(options: FieldOptions<string> = {}) {
    super('id', { ...options, default: options.default ?? (() => randomUUID()) });
  }
}

export class ForeignField extends Field<string> {
  readonly ref: string;
  readonly refKey: string;
  readonly sql: string;

  constructor(options: ForeignFieldOptions) {
    super('foreign', options);
    this.ref = options.ref;
    this.refKey = options.refKey ?? 'id';
    this.sql = 'TEXT';
  }
}

export class ChildrenField {
  readonly type = 'children' as const;
  readonly ref: string;
  readonly foreignKey: string;

  constructor(options: ChildrenFieldOptions) {
    this.ref = options.ref;
    this.foreignKey = options.foreignKey;
  }
}

export class SchemaField<T extends Record<string, Field<any> | SchemaField<any> | ChildrenField>> {
  readonly type = 'schema' as const;
  readonly schema: T;
  readonly nullable: boolean;
  readonly required: boolean;
  readonly default: (() => Record<string, any>) | undefined;

  constructor(schema: T, options: { nullable?: boolean; default?: () => Record<string, any> } = {}) {
    this.schema = schema;
    this.nullable = options.nullable ?? false;
    this.required = !options.nullable;
    this.default = options.default;
  }
}

export class SetField<T = any> {
  readonly type = 'set' as const;
  readonly element: Field<T>;
  readonly default: (() => T[]) | undefined;
  readonly nullable: boolean;
  readonly required: boolean;

  constructor(element: Field<T>, options: { nullable?: boolean; default?: () => T[] } = {}) {
    this.element = element;
    this.default = options.default ?? (() => []);
    this.nullable = options.nullable ?? false;
    this.required = !options.nullable;
  }
}

export type FieldType = Field<any> | SchemaField<any> | ChildrenField | SetField<any>;

export type InferFieldType<F extends FieldType> =
  F extends StringField ? string :
  F extends NumberField ? number :
  F extends DateField ? number :
  F extends BooleanField ? boolean :
  F extends JSONField<infer T> ? T :
  F extends IdField ? string :
  F extends ForeignField ? string :
  F extends ChildrenField ? any[] :
  F extends SetField<infer T> ? T[] :
  F extends SchemaField<infer S> ? { [K in keyof S]: InferFieldType<S[K]> } :
  any;

export interface SchemaDefinition {
  tableName: string;
  fields: Record<string, FieldType>;
  indexes?: { columns: string[]; unique?: boolean }[];
  primaryKey?: string;
}

export type InferSchema<S extends SchemaDefinition> = {
  [K in keyof S['fields']]: InferFieldType<S['fields'][K]>;
} & { id?: string };

/**
 * Gera SQL CREATE TABLE a partir de uma definição de schema.
 */
export function generateCreateTable(schema: SchemaDefinition): string {
  const columns: string[] = [];
  const fieldEntries = Object.entries(schema.fields);

  for (const [name, field] of fieldEntries) {
    if (field instanceof SchemaField || field instanceof ChildrenField) continue;
    if (name === '_id') {
      columns.push(`_id TEXT PRIMARY KEY`);
      continue;
    }

    const parts: string[] = [name];

    if (field instanceof StringField) parts.push(field.sql);
    else if (field instanceof NumberField) parts.push(field.sql);
    else if (field instanceof DateField) parts.push('INTEGER');
    else if (field instanceof BooleanField) parts.push('INTEGER');
    else if (field instanceof JSONField) parts.push('TEXT');
    else if (field instanceof ForeignField) parts.push('TEXT');
    else if (field instanceof IdField) parts.push('TEXT');
    else if (field instanceof SetField) parts.push('TEXT');
    else continue;

    if (field.required) parts.push('NOT NULL');
    columns.push(parts.join(' '));
  }

  let sql = `CREATE TABLE IF NOT EXISTS ${schema.tableName} (\n  ${columns.join(',\n  ')}\n);`;

  if (schema.indexes) {
    for (const idx of schema.indexes) {
      const idxName = `idx_${schema.tableName}_${idx.columns.join('_')}`;
      const unique = idx.unique ? 'UNIQUE ' : '';
      sql += `\nCREATE ${unique}INDEX IF NOT EXISTS ${idxName} ON ${schema.tableName} (${idx.columns.join(', ')});`;
    }
  }

  return sql;
}

/**
 * Valida dados contra um schema. Retorna null se válido, ou mensagem de erro.
 */
export function validateAgainstSchema(schema: SchemaDefinition, data: Record<string, any>, context?: any): Record<string, string> | null {
  const errors: Record<string, string> = {};

  for (const [name, field] of Object.entries(schema.fields)) {
    const value = data[name];

    if (field instanceof ChildrenField) continue;

    if (value === undefined || value === null) {
      if (field instanceof Field && field.required) {
        errors[name] = `"${name}" is required`;
      }
      continue;
    }

    if (field instanceof Field && field.validate) {
      const err = field.validate(value, context);
      if (err) errors[name] = err;
      continue;
    }

    if (field instanceof StringField) {
      if (typeof value !== 'string') { errors[name] = `"${name}" must be a string`; continue; }
      if (field.minLength && value.length < field.minLength) errors[name] = `"${name}" must be at least ${field.minLength} characters`;
      if (field.maxLength && value.length > field.maxLength) errors[name] = `"${name}" must be at most ${field.maxLength} characters`;
      if (field.pattern && !field.pattern.test(value)) errors[name] = `"${name}" has invalid format`;
      if (field.enum && !field.enum.includes(value)) errors[name] = `"${name}" must be one of: ${field.enum.join(', ')}`;
    }

    if (field instanceof NumberField) {
      if (typeof value !== 'number' || isNaN(value)) { errors[name] = `"${name}" must be a number`; continue; }
      if (field.integer && !Number.isInteger(value)) errors[name] = `"${name}" must be an integer`;
      if (field.min !== undefined && value < field.min) errors[name] = `"${name}" must be >= ${field.min}`;
      if (field.max !== undefined && value > field.max) errors[name] = `"${name}" must be <= ${field.max}`;
    }

    if (field instanceof BooleanField) {
      if (typeof value !== 'boolean') errors[name] = `"${name}" must be a boolean`;
    }

    if (field instanceof DateField) {
      if (typeof value !== 'number' || isNaN(value)) {
        errors[name] = `"${name}" must be a number (epoch ms)`;
      }
    }

    if (field instanceof SetField) {
      if (!Array.isArray(value)) { errors[name] = `"${name}" must be an array`; continue; }
      if (new Set(value).size !== value.length) {
        errors[name] = `"${name}" must not contain duplicate values`;
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
