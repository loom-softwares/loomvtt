import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const noisesSchema = {
  tableName: 'noises',
  fields: {
    id: new IdField(),
    stageId: new StringField({ required: true }),
    levelId: new StringField({ default: '' }),
    src: new StringField({ required: true }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    radius: new NumberField({ default: 100 }),
    volume: new NumberField({ default: 1.0 }),
    easing: new BooleanField({ default: true }),
    hidden: new BooleanField({ default: false }),
    darknessMin: new NumberField({ default: 0 }),
    darknessMax: new NumberField({ default: 1 }),
    wallsBlock: new BooleanField({ default: false }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class NoisesDocument extends LoomDocument {
  static schema = noisesSchema;
}