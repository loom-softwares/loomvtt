import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const tilesSchema = {
  tableName: 'tiles',
  fields: {
    id: new IdField(),
    stageId: new StringField({ required: true }),
    // Quem manda na visibilidade. `elevation` fica so para ordenacao/teleporte.
    levelId: new StringField({ default: '' }),
    elevation: new NumberField({ default: 0 }),
    name: new StringField({ required: true }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    width: new NumberField({ default: 100 }),
    height: new NumberField({ default: 100 }),
    imgUrl: new StringField({ default: '' }),
    isActive: new BooleanField({ default: true }),
    isOverhead: new BooleanField({ default: false }),
    isRoof: new BooleanField({ default: false }),
    rotation: new NumberField({ default: 0 }),
    tintColor: new StringField({ default: '' }),
    opacity: new NumberField({ default: 1 }),
    hidden: new BooleanField({ default: false }),
    locked: new BooleanField({ default: false }),
    videoLoop: new BooleanField({ default: true }),
    videoAutoplay: new BooleanField({ default: true }),
    videoVolume: new NumberField({ default: 1 }),
    occlusion: new JSONField({ default: () => ({ mode: 'fade', radius: 100, alpha: 0 }) }),
    floors: new JSONField({ default: () => [] }),
    anchorX: new NumberField({ default: 0.5 }),
    anchorY: new NumberField({ default: 0.5 }),
    triggers: new JSONField({ default: () => [] }),
    conditions: new JSONField({ default: () => [] }),
    actions: new JSONField({ default: () => [] }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['stageId'] }
  ],
} satisfies SchemaDefinition;

export class TilesDocument extends LoomDocument {
  static schema = tilesSchema;
}
