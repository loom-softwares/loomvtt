import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const packagesSchema = {
  tableName: 'packages',
  fields: {
    id: new IdField(),
    name: new StringField({ required: true }),
    type: new StringField({ required: true, default: 'module' }),
    version: new StringField({ required: true, default: '1.0.0' }),
    description: new StringField({ default: '' }),
    manifest: new JSONField({ default: () => ({}) }),
    author: new StringField({ default: '' }),
    authorUrl: new StringField({ default: '' }),
    license: new StringField({ default: '' }),
    url: new StringField({ default: '' }),
    downloadUrl: new StringField({ default: '' }),
    downloadCount: new NumberField({ default: 0 }),
    isCompatible: new BooleanField({ default: true }),
    minVersion: new StringField({ default: '0.0.0' }),
    maxVersion: new StringField({ default: '999.999.999' }),
    compatibility: new StringField({ default: '1.0.0' }),
    isActive: new BooleanField({ default: false }),
    installedAt: new StringField({ default: 'knex.fn.now(' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['name'] },
    { columns: ['type'] },
    { columns: ['version'] },
    { columns: ['isCompatible'] }
  ],
} satisfies SchemaDefinition;

export class PackagesDocument extends LoomDocument {
  static schema = packagesSchema;
}
