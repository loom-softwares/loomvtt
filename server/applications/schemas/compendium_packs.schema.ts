import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const compendium_packsSchema = {
  tableName: 'compendium_packs',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'Actor' }),
    entries: new JSONField({ default: () => [] }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class Compendium_packsDocument extends LoomDocument {
  static schema = compendium_packsSchema;
}
