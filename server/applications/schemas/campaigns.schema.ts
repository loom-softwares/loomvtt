import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const campaignsSchema = {
  tableName: 'campaigns',
  fields: {
    id: new IdField(),
    name: new StringField({ required: true }),
    description: new StringField({ default: '' }),
    manifest: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class CampaignsDocument extends LoomDocument {
  static schema = campaignsSchema;
}