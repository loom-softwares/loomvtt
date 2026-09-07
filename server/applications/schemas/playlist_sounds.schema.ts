import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const playlist_soundsSchema = {
  tableName: 'playlist_sounds',
  fields: {
    id: new IdField(),
    playlistId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    path: new StringField({ required: true }),
    volume: new NumberField({ default: 0.5 }),
    loop: new BooleanField({ default: false }),
    fadeIn: new NumberField({ default: 0 }),
    fadeOut: new NumberField({ default: 0 }),
    sortOrder: new NumberField({ default: 0 }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class Playlist_soundsDocument extends LoomDocument {
  static schema = playlist_soundsSchema;
}
