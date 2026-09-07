import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const templatesSchema = {
  tableName: 'templates',
  fields: {
    id: new IdField(),
    stageId: new ForeignField({ ref: 'id' }),
    userId: new StringField({ default: '' }),
    type: new StringField({ default: 'cone' }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    rotation: new NumberField({ default: 0 }),
    radius: new NumberField({ default: 100 }),
    width: new NumberField({ default: 100 }),
    height: new NumberField({ default: 100 }),
    angle: new NumberField({ default: 90 }),
    distance: new NumberField({ default: 100 }),
    fillColor: new StringField({ default: '#6366f1' }),
    strokeColor: new StringField({ default: '#6366f1' }),
    opacity: new NumberField({ default: 0.3 }),
    locked: new BooleanField({ default: false }),
    hidden: new BooleanField({ default: false }),
    flags: new StringField({ default: '{}' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class TemplatesDocument extends LoomDocument {
  static schema = templatesSchema;
}
