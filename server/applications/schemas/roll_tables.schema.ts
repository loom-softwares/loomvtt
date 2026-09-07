import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  ForeignField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const roll_tablesSchema = {
  tableName: 'roll_tables',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    description: new StringField({ default: '' }),
    formula: new StringField({ default: '1d20' }),
    sortMode: new NumberField({ default: 0 }),
    imgUrl: new StringField({ default: '' }),
    replacement: new NumberField({ default: 1 }),
    displayRollFormula: new NumberField({ default: 1 }),
    flags: new JSONField({ default: () => ({}) }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    entries: new ChildrenField({ ref: 'roll_table_entries', foreignKey: 'rollTableId' }),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class Roll_tablesDocument extends LoomDocument {
  static schema = roll_tablesSchema;
}
