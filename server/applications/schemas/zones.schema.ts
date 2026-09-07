import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const zonesSchema = {
  tableName: 'zones',
  fields: {
    id: new IdField(),
    stageId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    shape: new StringField({ default: 'rect' }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    width: new NumberField({ default: 100 }),
    height: new NumberField({ default: 100 }),
    points: new JSONField({ default: () => [] }),
    handlers: new JSONField({ default: () => [] }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class ZonesDocument extends LoomDocument {
  static schema = zonesSchema;
}