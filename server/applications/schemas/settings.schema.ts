import {
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const settingsSchema = {
  tableName: 'settings',
  primaryKey: 'key',
  fields: {
    key: new StringField({ required: true }),
    value: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class SettingsDocument extends LoomDocument {
  static schema = settingsSchema;
}
