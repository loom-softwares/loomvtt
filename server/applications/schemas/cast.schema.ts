import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const castSchema = {
  tableName: 'cast',
  fields: {
    id: new IdField(),
    worldId: new StringField({ default: 'world-1' }),
    stageId: new StringField({ default: 'stage-1' }),
    name: new StringField({ required: true }),
    kind: new StringField({ default: 'adventurer' }),
    traits: new JSONField({ default: () => ({}) }),
    x: new NumberField({ default: 100 }),
    y: new NumberField({ default: 100 }),
    colorHex: new StringField({ default: '#e74c3c' }),
    avatarUrl: new StringField({ default: '' }),
    ringColor: new StringField({ default: '#e74c3c' }),
    ringUrl: new StringField({ default: '' }),
    ringEffect: new StringField({ default: 'none' }),
    ringScale: new NumberField({ default: 1.6 }),
    shape: new StringField({ default: 'circle' }),
    effects: new JSONField({ default: () => [] }),
    statusMarkers: new JSONField({ default: () => [] }),
    systemData: new JSONField({ default: () => ({}) }),
    actorId: new StringField({ default: '' }),
    isLinked: new BooleanField({ default: false }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    // Quem manda na visibilidade. `elevation` fica so para ordenacao/teleporte.
    levelId: new StringField({ default: '' }),
    elevation: new NumberField({ default: 0 }),
    locked: new BooleanField({ default: false }),
    hidden: new BooleanField({ default: false }),
    movementAction: new StringField({ default: 'walk' }),
    targetedBy: new JSONField({ default: () => [] }),
    tintColor: new StringField({ default: '#ffffff' }),
    opacity: new NumberField({ default: 1 }),
    rotation: new NumberField({ default: 0 }),
    scale: new NumberField({ default: 1 }),
    sightEnabled: new BooleanField({ default: true }),
    sightRange: new NumberField({ default: 0 }),
    sightAngle: new NumberField({ default: 360 }),
    sightMode: new StringField({ default: 'basic' }),
    detectionModes: new JSONField({ default: () => [] }),
    lightDimRange: new NumberField({ default: 0 }),
    lightBrightRange: new NumberField({ default: 0 }),
    lightColor: new StringField({ default: '#ffffff' }),
    lightAnimation: new StringField({ default: 'none' }),
    barGridSize: new NumberField({ default: 1 }),
    bar1: new JSONField({ default: () => ({ attribute: 'attributes.hp', color: 'dynamic' }) }),
    bar2: new JSONField({ default: () => ({ attribute: '', color: '#3498db' }) }),
    displayBars: new NumberField({ default: 20 }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class CastsDocument extends LoomDocument {
  static schema = castSchema;
}
