import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const fogRevealsSchema = {
  tableName: 'fog_reveals',
  fields: {
    id: new IdField(),
    stageId: new StringField({ required: true }),
    userId: new StringField({ required: true }),
    explored: new JSONField({ default: () => [] }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class FogRevealsDocument extends LoomDocument {
  static schema = fogRevealsSchema;
}