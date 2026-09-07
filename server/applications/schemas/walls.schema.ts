import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const wallsSchema = {
  tableName: 'walls',
  fields: {
    id: new IdField(),
    stageId: new ForeignField({ ref: 'id' }),
    levelId: new StringField({ default: '' }),
    x1: new NumberField({ default: 0 }),
    y1: new NumberField({ default: 0 }),
    x2: new NumberField({ default: 0 }),
    y2: new NumberField({ default: 0 }),
    sight: new BooleanField({ default: true }),
    light: new BooleanField({ default: true }),
    movement: new BooleanField({ default: true }),
    sound: new BooleanField({ default: true }),
    direction: new NumberField({ default: 0 }),
    wallType: new StringField({ default: 'normal' }),
    door: new NumberField({ default: 0 }),
    doorState: new NumberField({ default: 0 }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['stageId'] }
  ],
} satisfies SchemaDefinition;

export class WallsDocument extends LoomDocument {
  static schema = wallsSchema;
}
