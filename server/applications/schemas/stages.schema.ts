import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const stagesSchema = {
  tableName: 'stages',
  fields: {
    id: new IdField(),
    worldId: new StringField({ default: 'world-1' }),
    name: new StringField({ required: true }),
    gridSize: new NumberField({ default: 50 }),
    gridColor: new StringField({ default: '#ffffff' }),
    navigationName: new StringField({ default: '' }),
    thumbnailUrl: new StringField({ default: '' }),
    showInNavigation: new BooleanField({ default: false }),
    darknessLevel: new NumberField({ default: 0 }),
    weatherEffect: new StringField({ default: 'none' }),
    gridDistance: new NumberField({ default: 5 }),
    gridUnit: new StringField({ default: 'ft' }),
    gridStyle: new StringField({ default: 'solid' }),
    gridOpacity: new NumberField({ default: 0.2 }),
    gridType: new StringField({ default: 'square' }),
    padding: new NumberField({ default: 0 }),
    offsetX: new NumberField({ default: 0 }),
    offsetY: new NumberField({ default: 0 }),
    isActive: new BooleanField({ default: false }),
    width: new NumberField({ default: 3000 }),
    height: new NumberField({ default: 2000 }),
    ambientPlaylistId: new StringField({ default: '' }),
    tokenVision: new BooleanField({ default: true }),
    fogExplorationMode: new StringField({ default: 'individual' }),
    fogExploredColor: new StringField({ default: '#000000' }),
    fogUnexploredColor: new StringField({ default: '#000000' }),
    fogImage: new StringField({ default: '' }),
    globalLight: new BooleanField({ default: false }),
    globalLightThreshold: new NumberField({ default: 1 }),
    journalId: new StringField({ default: '' }),
    journalPageId: new StringField({ default: '' }),
    sceneType: new StringField({ default: 'tactical' }),
    parentStageId: new StringField({ default: '' }),
    transitionType: new StringField({ default: 'fade' }),
    transitionDuration: new NumberField({ default: 1500 }),
    flags: new JSONField({ default: () => ({}) }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    tiles: new ChildrenField({ ref: 'tiles', foreignKey: 'stageId' }),
    walls: new ChildrenField({ ref: 'walls', foreignKey: 'stageId' }),
    drawings: new ChildrenField({ ref: 'drawings', foreignKey: 'stageId' }),
    lights: new ChildrenField({ ref: 'ambient_lights', foreignKey: 'stageId' }),
    notes: new ChildrenField({ ref: 'notes', foreignKey: 'stageId' }),
    levels: new ChildrenField({ ref: 'levels', foreignKey: 'stageId' }),
  },
  indexes: [
    { columns: ['worldId'] },
    { columns: ['width'] },
    { columns: ['height'] }
  ],
} satisfies SchemaDefinition;

export class StagesDocument extends LoomDocument {
  static schema = stagesSchema;
}
