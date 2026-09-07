import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  ForeignField,
  ChildrenField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const playlistsSchema = {
  tableName: 'playlists',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    description: new StringField({ default: '' }),
    imgUrl: new StringField({ default: '' }),
    mode: new StringField({ default: 'sequential' }),
    volume: new NumberField({ default: 0.5 }),
    loop: new BooleanField({ default: false }),
    fadeDuration: new NumberField({ default: 2 }),
    folderId: new StringField({ default: '' }),
    ownership: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
    sounds: new ChildrenField({ ref: 'playlist_sounds', foreignKey: 'playlistId' }),
  },
} satisfies SchemaDefinition;

export class PlaylistsDocument extends LoomDocument {
  static schema = playlistsSchema;
}
