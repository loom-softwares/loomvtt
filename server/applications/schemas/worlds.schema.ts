import {
  IdField,
  StringField,
  BooleanField,
  NumberField,
  JSONField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const worldsSchema = {
  tableName: 'worlds',
  fields: {
    id: new IdField(),
    name: new StringField({ required: true }),
    system: new StringField({ default: 'generic' }),
    description: new StringField({ default: '' }),
    coverUrl: new StringField({ default: '' }),
    language: new StringField({ default: 'en' }),
    adminPassword: new StringField({ default: '' }),
    isActive: new BooleanField({ default: false }),
    isPaused: new BooleanField({ default: false }),
    worldTime: new NumberField({ default: 0 }),
    dataPath: new StringField({ default: '' }),
    backgroundUrl: new StringField({ default: '' }),
    theme: new StringField({ default: '' }),
    nextSession: new StringField({ default: '' }),
    safeMode: new BooleanField({ default: false }),
    packageIds: new JSONField({ default: () => [] }),
    packageConfig: new JSONField({ default: () => ({}) }),
    permissions: new JSONField({ default: () => ({ compendiumEdit: [], viewStages: [] }) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    actors: new ChildrenField({ ref: 'actors', foreignKey: 'worldId' }),
    stages: new ChildrenField({ ref: 'stages', foreignKey: 'worldId' }),
    items: new ChildrenField({ ref: 'items', foreignKey: 'worldId' }),
    journals: new ChildrenField({ ref: 'journals', foreignKey: 'worldId' }),
    combats: new ChildrenField({ ref: 'combats', foreignKey: 'worldId' }),
    chat_messages: new ChildrenField({ ref: 'chat_messages', foreignKey: 'worldId' }),
    macros: new ChildrenField({ ref: 'macros', foreignKey: 'worldId' }),
    users: new ChildrenField({ ref: 'users', foreignKey: 'worldId' }),
    folders: new ChildrenField({ ref: 'folders', foreignKey: 'worldId' }),
    roll_tables: new ChildrenField({ ref: 'roll_tables', foreignKey: 'worldId' }),
    compendium_packs: new ChildrenField({ ref: 'compendium_packs', foreignKey: 'worldId' }),
    playlists: new ChildrenField({ ref: 'playlists', foreignKey: 'worldId' }),
  },
} satisfies SchemaDefinition;

export class WorldsDocument extends LoomDocument {
  static schema = worldsSchema;
}
