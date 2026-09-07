import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const world_packagesSchema = {
  tableName: 'world_packages',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    packageId: new ForeignField({ ref: 'id' }),
    enabled: new BooleanField({ default: true }),
    loadOrder: new NumberField({ default: 0 }),
    config: new JSONField({ default: () => ({}) }),
    installedAt: new StringField({ default: 'knex.fn.now(' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] },
    { columns: ['packageId'] },
    { columns: ['enabled'] },
    { columns: ['loadOrder'] }
  ],
} satisfies SchemaDefinition;

export class World_packagesDocument extends LoomDocument {
  static schema = world_packagesSchema;
}
