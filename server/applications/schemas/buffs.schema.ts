import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const buffsSchema = {
  tableName: 'buffs',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    actorId: new StringField({ default: '' }),
    itemId: new StringField({ default: '' }),
    name: new StringField({ required: true }),
    icon: new StringField({ default: '' }),
    origin: new StringField({ default: '' }),
    duration: new NumberField({ default: -1 }),
    disabled: new BooleanField({ default: false }),
    changes: new JSONField({ default: () => [] }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class BuffsDocument extends LoomDocument {
  static schema = buffsSchema;
}