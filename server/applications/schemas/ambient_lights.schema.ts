import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const ambient_lightsSchema = {
  tableName: 'ambient_lights',
  fields: {
    id: new IdField(),
    stageId: new ForeignField({ ref: 'id' }),
    levelId: new StringField({ default: '' }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    radius: new NumberField({ default: 200 }),
    color: new StringField({ default: '#ffdd88' }),
    intensity: new NumberField({ default: 0.5 }),
    rotation: new NumberField({ default: 0 }),
    animation: new StringField({ default: 'none' }),
    darknessMin: new NumberField({ default: 0 }),
    darknessMax: new NumberField({ default: 1 }),
    isHidden: new BooleanField({ default: false }),
    bright: new NumberField({ default: 100 }),
    dim: new NumberField({ default: 200 }),
    angle: new NumberField({ default: 360 }),
    walls: new BooleanField({ default: true }),
    vision: new BooleanField({ default: false }),
    animationSpeed: new NumberField({ default: 5 }),
    animationIntensity: new NumberField({ default: 5 }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class Ambient_lightsDocument extends LoomDocument {
  static schema = ambient_lightsSchema;
}
