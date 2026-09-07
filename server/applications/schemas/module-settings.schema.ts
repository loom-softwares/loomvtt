import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const moduleSettingsSchema = {
  tableName: 'module_settings',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    moduleId: new StringField({ required: true }),
    key: new StringField({ required: true }),
    value: new JSONField({ nullable: true }),
    scope: new StringField({ required: true, default: 'world' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId', 'moduleId', 'key'], unique: true },
    { columns: ['worldId'] },
    { columns: ['moduleId'] },
  ],
} satisfies SchemaDefinition;

export class ModuleSettingsDocument extends LoomDocument {
  static schema = moduleSettingsSchema;
}