import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const macrosSchema = {
  tableName: 'macros',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'chat' }),
    command: new StringField({ default: '' }),
    imgUrl: new StringField({ default: '' }),
    slot: new NumberField({ default: -1 }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class MacrosDocument extends LoomDocument {
  static schema = macrosSchema;
}
