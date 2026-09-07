import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const levelsSchema = {
  tableName: 'levels',
  fields: {
    id: new IdField(),
    stageId: new StringField({ required: true }),
    name: new StringField({ default: 'Térreo' }),
    bottomElevation: new NumberField({ default: 0 }),
    topElevation: new NumberField({ default: 20 }),
    backgroundUrl: new StringField({ default: '' }),
    backgroundColor: new StringField({ default: '#0d0d0f' }),
    backgroundTint: new StringField({ default: '#ffffff' }),
    alphaThreshold: new NumberField({ default: 0.75 }),
    foregroundUrl: new StringField({ default: '' }),
    foregroundTint: new StringField({ default: '#ffffff' }),
    fogExplorationUrl: new StringField({ default: '' }),
    anchorX: new NumberField({ default: 0.5 }),
    anchorY: new NumberField({ default: 0.5 }),
    offsetX: new NumberField({ default: 0 }),
    offsetY: new NumberField({ default: 0 }),
    scaleX: new NumberField({ default: 1 }),
    scaleY: new NumberField({ default: 1 }),
    fitMode: new StringField({ default: 'fill' }),
    rotation: new NumberField({ default: 0 }),
    flags: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['stageId'] }
  ],
} satisfies SchemaDefinition;

export class LevelsDocument extends LoomDocument {
  static schema = levelsSchema;
}
