import {
  IdField,
  StringField,
  JSONField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const itemsSchema = {
  tableName: 'items',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    actorId: new StringField({ default: '' }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'equipment' }),
    data: new JSONField({ default: () => ({}) }),
    imgUrl: new StringField({ default: '' }),
    ownership: new JSONField({ default: () => ({}) }),
    flags: new JSONField({ default: () => ({}) }),
    suppressed: new JSONField({ default: () => false }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    effects: new ChildrenField({ ref: 'buffs', foreignKey: 'itemId' }),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class ItemsDocument extends LoomDocument {
  static schema = itemsSchema;
}
