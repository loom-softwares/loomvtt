import {
  IdField,
  StringField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const foldersSchema = {
  tableName: 'folders',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    type: new StringField({ required: true }),
    parent: new StringField({ default: '' }),
    sorting: new StringField({ default: 'm' }),
    color: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class FoldersDocument extends LoomDocument {
  static schema = foldersSchema;
}
