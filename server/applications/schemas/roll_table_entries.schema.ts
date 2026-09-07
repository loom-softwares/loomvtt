import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const roll_table_entriesSchema = {
  tableName: 'roll_table_entries',
  fields: {
    id: new IdField(),
    rollTableId: new ForeignField({ ref: 'id' }),
    text: new JSONField({ default: () => '' }),
    imgUrl: new JSONField({ default: () => '' }),
    weight: new NumberField({ default: 1 }),
    collectionId: new StringField({ default: '' }),
    drawn: new StringField({ default: 'NONE' }),
    type: new StringField({ default: 'text' }),
    documentCollection: new StringField({ default: '' }),
    documentId: new StringField({ default: '' }),
    rangeMin: new NumberField({ default: 1 }),
    rangeMax: new NumberField({ default: 1 }),
    description: new JSONField({ default: () => '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['rollTableId'] }
  ],
} satisfies SchemaDefinition;

export class Roll_table_entriesDocument extends LoomDocument {
  static schema = roll_table_entriesSchema;
}
