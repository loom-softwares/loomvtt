import {
  IdField,
  StringField,
  JSONField,
  ForeignField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const actorsSchema = {
  tableName: 'actors',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'character' }),
    avatarUrl: new StringField({ default: '' }),
    systemData: new JSONField({ default: () => ({}) }),
    ownership: new JSONField({ default: () => ({}) }),
    flags: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    items: new ChildrenField({ ref: 'items', foreignKey: 'actorId' }),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class ActorsDocument extends LoomDocument {
  static schema = actorsSchema;
}
