import { randomUUID } from 'crypto';
import { db } from '../database/db.js';
import { getKnexForTable } from '../database/world-db.js';
import { Knex } from 'knex';
import { Signal } from '../signals/index.js';
import { LoomHooks } from '../utils/hooks.js';
import logger from '../utils/logger.js';
import { mergeObject } from '../utils/helpers.js';
import { populateChildren } from '../lib/embedded-docs.js';
import { getUserId, isGM, buildOwnership, canEdit } from '../middleware/permissions.js';
import {
  SchemaDefinition, validateAgainstSchema, FieldType,
  Field, StringField, NumberField, BooleanField, DateField, JSONField, IdField, ForeignField,
  ChildrenField, SchemaField, SetField
} from '../../../shared/data/fields.js';

export interface DocumentContext {
  req?: any;
  userId?: string;
  isGM?: boolean;
}

function getDefaultValue(field: Field<any> | SchemaField<any> | SetField<any>): any {
  if (field instanceof SchemaField) {
    if (field.default) return field.default();
    const obj: Record<string, any> = {};
    for (const [key, f] of Object.entries(field.schema)) {
      obj[key] = getDefaultValue(f as Field<any> | SchemaField<any> | SetField<any>);
    }
    return obj;
  }
  if (field instanceof ChildrenField) return [];
  if (field instanceof SetField) {
    if (field.default) return field.default();
    if (field.nullable) return null;
    return [];
  }
  if (field.default !== undefined) return typeof field.default === 'function' ? (field.default as () => any)() : field.default;
  if (field.nullable) return null;
  if (field instanceof StringField) return '';
  if (field instanceof NumberField) return 0;
  if (field instanceof DateField) return 0;
  if (field instanceof BooleanField) return false;
  if (field instanceof JSONField) return {};
  if (field instanceof IdField) return randomUUID();
  return null;
}

function serializeValue(field: FieldType, value: any): any {
  if (field instanceof ChildrenField) return undefined;
  if (field instanceof SchemaField) return typeof value === 'object' ? JSON.stringify(value) : value;
  if (field instanceof SetField) return JSON.stringify(value);
  if (field instanceof JSONField) return JSON.stringify(value);
  if (field instanceof BooleanField) return value ? 1 : 0;
  return value;
}

function deserializeValue(field: FieldType, value: any): any {
  if (value === null || value === undefined) return value;
  if (field instanceof SchemaField) return typeof value === 'string' ? JSON.parse(value) : value;
  if (field instanceof SetField) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
  if (field instanceof JSONField) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
  if (field instanceof BooleanField) return value === 1 || value === true;
  return value;
}

function getDocumentName(schema: SchemaDefinition): string {
  return schema.tableName.replace(/^./, c => c.toUpperCase()).replace(/_./g, c => c[1].toUpperCase());
}

export interface DocumentHooksConfig {
  preCreate?: string;
  postCreate?: string;
  preUpdate?: string;
  postUpdate?: string;
  preDelete?: string;
  postDelete?: string;
}

export class LoomDocument {
  static schema: SchemaDefinition;
  /** Opt-in por schema — ver HANDOFF-marketplace-fase3-adapter-supabase.md. Sem isto
   * definido, find/findById/findOne funcionam 100% como hoje (SQLite local). */
  static remoteAdapter?: import('../licensing/remote-content-adapter.js').RemoteAdapter;

  static get db(): Knex {
    return getKnexForTable(this.tableName);
  }

  static get tableName(): string {
    return this.schema.tableName;
  }

  static get primaryKey(): string {
    return this.schema.primaryKey || 'id';
  }

  static async find<T = any>(filter?: Record<string, any>): Promise<T[]> {
    const requestedColumns = filter?.columns;
    const query = requestedColumns ? this.db(this.tableName).select(requestedColumns) : this.db(this.tableName).select('*');
    const reservedKeys = ['orderBy', 'orderDir', 'columns', 'limit', 'offset'];
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && !reservedKeys.includes(key)) query.where(key, value);
      }
    }
    if (filter?.orderBy) {
      if (Array.isArray(filter.orderBy)) {
        for (const ob of filter.orderBy) query.orderBy(ob.column, ob.dir || 'asc');
      } else {
        query.orderBy(filter.orderBy, filter.orderDir || 'asc');
      }
    }
    // Opcional e aditivo — sem limit/offset no filter, comportamento não muda (retorna tudo).
    if (filter?.limit !== undefined) query.limit(Number(filter.limit));
    if (filter?.offset !== undefined) query.offset(Number(filter.offset));
    const rows = await query;
    return rows.map(row => this.deserializeRow(row)) as T[];
  }

  static async findById<T = any>(id: string, context?: DocumentContext): Promise<T | null> {
    const row = await this.db(this.tableName).where({ [this.primaryKey]: id }).first();
    if (!row) return null;
    const local = this.deserializeRow(row) as T;

    // Registro local aqui é só a "casca" (metadata + id) — o schema com
    // remoteAdapter nunca grava o conteúdo completo no SQLite (ver Fase 3 no
    // memory do projeto). Conteúdo de verdade vem do Supabase por demanda.
    if (this.remoteAdapter) {
      const { fetchRemoteRecord } = await import('../licensing/remote-content-adapter.js');
      const accountToken = context?.req?.loomAccountToken; // injetado pelo middleware da Fase 2
      if (!accountToken) return local; // sem conta conectada, devolve só a casca
      const remote = await fetchRemoteRecord(this.remoteAdapter, id, accountToken);
      if (remote) return { ...local, ...remote } as T;
    }

    return local;
  }

  static async findOne<T = any>(filter: Record<string, any>): Promise<T | null> {
    const row = await this.db(this.tableName).where(filter).first();
    if (!row) return null;
    return this.deserializeRow(row) as T;
  }

  static async create<T = any>(data: Record<string, any>, context?: DocumentContext, opts?: { upsert?: boolean }): Promise<{ data: T; error?: string }> {
    const schema = this.schema;
    const docName = getDocumentName(schema);
    const pk = this.primaryKey;

    const merged: Record<string, any> = {};

    for (const [name, field] of Object.entries(schema.fields)) {
      merged[name] = data[name] !== undefined ? data[name] : getDefaultValue(field as Field<any> | SchemaField<any>);
    }

    if (pk === 'id' && !merged.id) merged.id = randomUUID();

    const now = new Date().toISOString();
    merged.createdAt = now;
    merged.updatedAt = now;

    if ((!merged.ownership || Object.keys(merged.ownership).length === 0) && context?.req) {
      const userId = getUserId(context.req);
      if (userId) merged.ownership = buildOwnership(userId);
    }

    const errors = validateAgainstSchema(schema, merged, context);
    if (errors) return { data: null as any, error: Object.values(errors).join('; ') };

    await LoomHooks.call(`preCreate${docName}`, merged);

    const serialized: Record<string, any> = {};
    for (const [name, field] of Object.entries(schema.fields)) {
      if (field instanceof ChildrenField) continue;
      serialized[name] = serializeValue(field, merged[name]);
    }

    try {
      const query = this.db(schema.tableName).insert(serialized);
      if (opts?.upsert) query.onConflict(pk).merge();
      await query;
    } catch (err: any) {
      logger.error(`LoomDocument.create(${schema.tableName}) failed`, { error: err.message });
      return { data: null as any, error: `Database error: ${err.message}` };
    }

    const created = this.deserializeRow(merged) as T;
    Signal.broadcast(`${schema.tableName}.created`, { data: created });
    logger.info(`${docName} created`, { id: (created as any).id });

    try { await LoomHooks.call(`onCreate${docName}`, created); } catch {}

    return { data: created };
  }

  static async update<T = any>(id: string, data: Record<string, any>, context?: DocumentContext): Promise<{ data: T | null; error?: string }> {
    const schema = this.schema;
    const docName = getDocumentName(schema);

    const existingRaw = await this.db(schema.tableName).where({ [this.primaryKey]: id }).first();
    if (!existingRaw) return { data: null, error: 'Not found' };
    // Query direta acima devolve colunas JSON como TEXT cru (mesma classe de bug do
    // populateChildren) — sem deserializar, o merge de JSONField abaixo (linha ~220)
    // nunca reconhecia `existing[name]` como objeto e pulava o merge, deixando o
    // client fazer `{...stringCrua, ...patch}` e corromper `data` em pares de índice
    // numérico (achado real: Mérito salvo como `{"0":"{","1":"\"",...}`).
    const existing = this.deserializeRow(existingRaw);

    if (context?.req) {
      const userId = getUserId(context.req);
      if (!isGM(context.req) && !canEdit(existing.ownership, userId)) {
        return { data: null, error: 'Access denied' };
      }
    }

    await LoomHooks.call(`preUpdate${docName}`, id, data);

    const updates: Record<string, any> = {};
    for (const [name, field] of Object.entries(schema.fields)) {
      if (field instanceof ChildrenField) continue;
      if (field instanceof SchemaField) continue;
      if (data[name] === undefined) continue;
      
      let newValue = data[name];
      if (field instanceof JSONField && existing[name] && typeof existing[name] === 'object' && newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
        newValue = mergeObject(existing[name], newValue);
      }
      
      updates[name] = serializeValue(field, newValue);
    }

    updates.updatedAt = new Date().toISOString();

    if (Object.keys(updates).length === 0) {
      return { data: null, error: 'No valid fields provided' };
    }

    try {
      await this.db(schema.tableName).where({ [this.primaryKey]: id }).update(updates);
    } catch (err: any) {
      logger.error(`LoomDocument.update(${schema.tableName}) failed`, { error: err.message, id });
      return { data: null, error: `Database error: ${err.message}` };
    }

    const updated = await this.findById<T>(id);
    if (!updated) {
      // Update no banco confirmado, mas findById não achou o registro de volta —
      // não deixa result.data sair null sem error: quem chama (rotas em api/*.ts)
      // só checa result.error antes de fazer Signal.broadcast(result.data), e um
      // null vazando pro WebSocket derruba qualquer janela escutando esse evento
      // (ex: deck-sheet-window.ts lendo deck.id de um payload null).
      logger.error(`LoomDocument.update(${schema.tableName}) — update aplicado mas findById não retornou`, { id });
      return { data: null, error: 'Update applied but document could not be reloaded' };
    }

    // findById() devolve o row cru, sem ChildrenField (items, etc). Sem popular antes do
    // broadcast, todo cliente escutando `${table}.updated` (document-sheet.ts) recebe items
    // como array vazio — e o merge no cliente trata array vazio como "usuário apagou tudo",
    // sobrescrevendo a lista de verdade. Bug batia em qualquer update que passasse por aqui,
    // não só nos dots do wod6e.
    const populated = await populateChildren(updated, schema);
    Signal.broadcast(`${schema.tableName}.updated`, { data: populated });
    logger.info(`${docName} updated`, { id });
    try { await LoomHooks.call(`onUpdate${docName}`, updated); } catch {}

    return { data: updated };
  }

  static async delete(id: string, context?: DocumentContext): Promise<{ success: boolean; error?: string }> {
    const schema = this.schema;
    const docName = getDocumentName(schema);

    const existing = await this.db(schema.tableName).where({ [this.primaryKey]: id }).first();
    if (!existing) return { success: false, error: 'Not found' };

    if (context?.req) {
      const userId = getUserId(context.req);
      if (!isGM(context.req) && !canEdit(existing.ownership, userId)) {
        return { success: false, error: 'Access denied' };
      }
    }

    await LoomHooks.call(`preDelete${docName}`, id);

    try {
      await this.db(schema.tableName).where({ [this.primaryKey]: id }).delete();
    } catch (err: any) {
      logger.error(`LoomDocument.delete(${schema.tableName}) failed`, { error: err.message, id });
      return { success: false, error: `Database error: ${err.message}` };
    }

    // worldId/stageId: inclui os dois quando existirem na tabela (undefined
    // nas que não têm) — listeners de WS decidem qual usar pra escopar o
    // broadcast (mundo inteiro vs só a stage específica).
    Signal.broadcast(`${schema.tableName}.deleted`, { id, worldId: existing.worldId, stageId: existing.stageId });
    logger.info(`${docName} deleted`, { id });
    try { await LoomHooks.call(`onDelete${docName}`, id); } catch {}

    return { success: true };
  }

  static async bulkDelete(filter: Record<string, any>): Promise<{ count: number; error?: string }> {
    try {
      const rows = await this.db(this.tableName).where(filter).select('*');
      if (rows.length === 0) return { count: 0 };
      const ids = rows.map((r: any) => r.id);
      await this.db(this.tableName).whereIn('id', ids).delete();
      for (const row of rows) Signal.broadcast(`${this.schema.tableName}.deleted`, { id: row.id, worldId: row.worldId, stageId: row.stageId });
      return { count: ids.length };
    } catch (err: any) {
      logger.error(`LoomDocument.bulkDelete(${this.schema.tableName}) failed`, { error: err.message });
      return { count: 0, error: `Database error: ${err.message}` };
    }
  }

  static async count(filter?: Record<string, any>): Promise<number> {
    const query = this.db(this.tableName);
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined) query.where(key, value);
      }
    }
    const result = await query.count('* as count').first();
    return Number((result as any)?.count ?? 0);
  }

  static async getFlag<T = any>(scope: string, key: string, id: string): Promise<T | undefined> {
    const doc = await this.findById<any>(id);
    if (!doc) return undefined;
    const flags = doc.flags ?? {};
    return flags[scope]?.[key] as T | undefined;
  }

  static async setFlag(scope: string, key: string, value: any, id: string, context?: DocumentContext): Promise<boolean> {
    const doc = await this.findById<any>(id);
    if (!doc) return false;
    const flags = doc.flags ?? {};
    if (!flags[scope]) flags[scope] = {};
    flags[scope][key] = value;
    const result = await this.update(id, { flags }, context);
    return result.error === undefined;
  }

  static async unsetFlag(scope: string, key: string, id: string, context?: DocumentContext): Promise<boolean> {
    const doc = await this.findById<any>(id);
    if (!doc) return false;
    const flags = doc.flags ?? {};
    if (flags[scope]?.[key] !== undefined) {
      delete flags[scope][key];
      if (Object.keys(flags[scope]).length === 0) delete flags[scope];
    }
    const result = await this.update(id, { flags }, context);
    return result.error === undefined;
  }

  static deserializeRow(row: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, field] of Object.entries(this.schema.fields)) {
      if (field instanceof ChildrenField) {
        result[name] = [];
        continue;
      }
      result[name] = deserializeValue(field, row[name]);
    }
    for (const key of Object.keys(row)) {
      if (!(key in this.schema.fields)) {
        result[key] = row[key];
      }
    }
    return result;
  }

  static async getEmbeddedDocuments<T = any>(embeddedName: string, filter?: Record<string, any>): Promise<T[]> {
    const embeddedField = this.schema.fields[embeddedName];
    if (!(embeddedField instanceof ChildrenField)) {
      throw new Error(`Field ${embeddedName} is not a ChildrenField`);
    }
    
    const parentDocs = await this.find();
    const embeddedDocs: T[] = [];
    
    for (const parent of parentDocs) {
      const children = parent[embeddedName] || [];
      if (Array.isArray(children)) {
        if (filter) {
          const filtered = children.filter((child: any) => {
            return Object.entries(filter).every(([key, value]) => child[key] === value);
          });
          embeddedDocs.push(...filtered);
        } else {
          embeddedDocs.push(...children);
        }
      }
    }
    
    return embeddedDocs;
  }

  static async createEmbeddedDocuments<T = any>(embeddedName: string, data: Record<string, any>[], parentIds: string[], context?: DocumentContext): Promise<{ data: T[]; error?: string }> {
    const embeddedField = this.schema.fields[embeddedName];
    if (!(embeddedField instanceof ChildrenField)) {
      return { data: [], error: `Field ${embeddedName} is not a ChildrenField` };
    }

    const results: T[] = [];
    
    for (const parentId of parentIds) {
      const parent = await this.findById(parentId);
      if (!parent) {
        logger.error(`Parent document not found: ${parentId}`);
        continue;
      }

      const children = parent[embeddedName] || [];
      for (const itemData of data) {
        const child = { ...itemData, id: randomUUID(), parentId };
        children.push(child);
        
        const updated = await this.update(parentId, { [embeddedName]: children }, context);
        if (updated.data) {
          results.push(child as T);
        }
      }
    }
    
    return { data: results };
  }

  static async updateEmbeddedDocuments<T = any>(embeddedName: string, updates: Record<string, any>[], parentIds: string[], context?: DocumentContext): Promise<{ data: T[]; error?: string }> {
    const embeddedField = this.schema.fields[embeddedName];
    if (!(embeddedField instanceof ChildrenField)) {
      return { data: [], error: `Field ${embeddedName} is not a ChildrenField` };
    }

    const results: T[] = [];
    
    for (const parentId of parentIds) {
      const parent = await this.findById(parentId);
      if (!parent) {
        logger.error(`Parent document not found: ${parentId}`);
        continue;
      }

      const children = parent[embeddedName] || [];
      for (const update of updates) {
        const index = children.findIndex((child: any) => child.id === update.id);
        if (index !== -1) {
          children[index] = { ...children[index], ...update };
        }
      }
      
      const updated = await this.update(parentId, { [embeddedName]: children }, context);
      if (updated.data) {
        results.push(...(children as T[]));
      }
    }
    
    return { data: results };
  }

  static async deleteEmbeddedDocuments(embeddedName: string, ids: string[], parentIds: string[], context?: DocumentContext): Promise<{ success: boolean; error?: string }> {
    const embeddedField = this.schema.fields[embeddedName];
    if (!(embeddedField instanceof ChildrenField)) {
      return { success: false, error: `Field ${embeddedName} is not a ChildrenField` };
    }

    for (const parentId of parentIds) {
      const parent = await this.findById(parentId);
      if (!parent) {
        logger.error(`Parent document not found: ${parentId}`);
        continue;
      }

      const children = parent[embeddedName] || [];
      const filtered = children.filter((child: any) => !ids.includes(child.id));
      
      const result = await this.update(parentId, { [embeddedName]: filtered }, context);
      if (result.error) {
        return { success: false, error: result.error };
      }
    }
    
    return { success: true };
  }

  static hasPlayerOwner(userId: string): boolean {
    return userId !== null && userId !== undefined;
  }

  static testUserPermission(userId: string, permission: string): boolean {
    if (!userId) return false;
    if (permission === 'OWNER') return true;
    if (permission === 'LIMITED') return true;
    if (permission === 'NONE') return false;
    return false;
  }

  static async clear(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db(this.tableName).delete();
      Signal.broadcast(`${this.schema.tableName}.cleared`, {});
      logger.info(`${getDocumentName(this.schema)} cleared`);
      return { success: true };
    } catch (err: any) {
      logger.error(`LoomDocument.clear(${this.schema.tableName}) failed`, { error: err.message });
      return { success: false, error: `Database error: ${err.message}` };
    }
  }

  static async clone(id: string, context?: DocumentContext): Promise<{ data: any; error?: string }> {
    const original = await this.findById(id);
    if (!original) {
      return { data: null, error: 'Not found' };
    }

    const cloned = { ...original };
    delete cloned.id;
    cloned.id = randomUUID();
    cloned.createdAt = new Date().toISOString();
    cloned.updatedAt = new Date().toISOString();
    
    if (cloned.ownership && context?.req) {
      const userId = getUserId(context.req);
      if (userId) {
        cloned.ownership = buildOwnership(userId);
      }
    }

    const result = await this.create(cloned, context);
    if (result.error) {
      return { data: null, error: result.error };
    }

    Signal.broadcast(`${this.schema.tableName}.cloned`, { originalId: id, clonedId: cloned.id });
    logger.info(`${getDocumentName(this.schema)} cloned`, { originalId: id, clonedId: cloned.id });
    
    return { data: result.data };
  }

  static toObject(source: any, options: { 
    compact?: boolean; 
    clone?: boolean; 
    secrets?: boolean; 
    delta?: boolean;
  } = {}): any {
    if (!source) return null;
    
    const result = options.clone ? { ...source } : source;
    
    if (!options.secrets) {
      delete result._key;
      delete result._stats;
    }
    
    if (options.delta) {
      delete result.createdAt;
      delete result.updatedAt;
    }
    
    return result;
  }

  static async prepareData(): Promise<void> {
    const docs = await this.find();
    for (const doc of docs) {
      await LoomHooks.call(`prepareData${getDocumentName(this.schema)}`, doc);
    }
  }

  static async sort(sorting: Record<string, 'asc' | 'desc'>): Promise<{ data: any[]; error?: string }> {
    const filter = { ...sorting, orderBy: Object.keys(sorting).map(key => ({ column: key, dir: sorting[key] })) };
    const sorted = await this.find(filter);
    return { data: sorted };
  }

  static async bulkUpdate(filter: Record<string, any>, updates: Record<string, any>): Promise<{ count: number; error?: string }> {
    try {
      const result = await this.db(this.tableName)
        .where(filter)
        .update(updates);
      
      return { count: result };
    } catch (err: any) {
      logger.error(`LoomDocument.bulkUpdate(${this.schema.tableName}) failed`, { error: err.message });
      return { count: 0, error: `Database error: ${err.message}` };
    }
  }
}
