import { db } from '../database/db.js';
import { ChildrenField, type SchemaDefinition } from '../data/fields.js';

/** Colunas JSON (JSONField/SchemaField) chegam do SQLite como TEXT cru — a query
 * direta abaixo não passa pelo `Document.deserializeRow()` que normalmente faz esse
 * parse. Sem isso, `item.data` de todo item filho de um actor/etc chega como STRING
 * pro client (ex: `data.discipline` vira `undefined` num objeto que na verdade é
 * texto), quebrando qualquer tela que leia campos aninhados dos filhos. Parse
 * genérico e seguro: só converte string que É JSON válido, resto passa direto. */
function deserializeJsonColumns(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        result[key] = JSON.parse(value);
        continue;
      } catch {
        // não era JSON de verdade, cai pro valor original abaixo
      }
    }
    result[key] = value;
  }
  return result;
}

export async function populateChildren<T extends Record<string, any>>(
  parent: T,
  schema: SchemaDefinition,
): Promise<T> {
  const result: Record<string, any> = { ...parent };
  for (const [fieldName, field] of Object.entries(schema.fields)) {
    if (!(field instanceof ChildrenField)) continue;
    const parentPk = schema.primaryKey || 'id';
    const parentId = result[parentPk];
    if (!parentId) continue;
    const rows = await db(field.ref).where({ [field.foreignKey]: parentId });
    result[fieldName] = rows.map(deserializeJsonColumns);
  }
  return result as T;
}

export async function deleteChildren(
  parentId: string,
  schema: SchemaDefinition,
): Promise<void> {
  for (const [, field] of Object.entries(schema.fields)) {
    if (!(field instanceof ChildrenField)) continue;
    await db(field.ref).where({ [field.foreignKey]: parentId }).delete();
  }
}
