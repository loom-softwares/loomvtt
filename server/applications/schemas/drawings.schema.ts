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

export const drawingsSchema = {
  tableName: 'drawings',
  fields: {
    id: new IdField(),
    stageId: new ForeignField({ ref: 'id' }),
    levelId: new StringField({ default: '' }),
    type: new StringField({ default: 'rectangle' }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    width: new NumberField({ default: 100 }),
    height: new NumberField({ default: 100 }),
    rotation: new NumberField({ default: 0 }),
    z: new NumberField({ default: 0 }),
    fillColor: new StringField({ default: '#000000' }),
    fillOpacity: new NumberField({ default: 0.3 }),
    strokeColor: new StringField({ default: '#ffffff' }),
    strokeWidth: new NumberField({ default: 1 }),
    text: new StringField({ default: '' }),
    fontFamily: new StringField({ default: 'Arial' }),
    fontSize: new NumberField({ default: 16 }),
    points: new JSONField({ default: () => [] }),
    imgUrl: new StringField({ default: '' }),
    isHidden: new BooleanField({ default: false }),
    isLocked: new BooleanField({ default: false }),
    authorId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['stageId'] }
  ],
} satisfies SchemaDefinition;

export class DrawingsDocument extends LoomDocument {
  static schema = drawingsSchema;
}
