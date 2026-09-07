import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const notesSchema = {
  tableName: 'notes',
  fields: {
    id: new IdField(),
    stageId: new ForeignField({ ref: 'id' }),
    levelId: new StringField({ default: '' }),
    journalId: new StringField({ default: '' }),
    x: new NumberField({ default: 0 }),
    y: new NumberField({ default: 0 }),
    visibleToPlayers: new BooleanField({ default: false }),
    // Campos novos para funcionalidade de notas
    floors: new NumberField({ default: 0 }),
    visibleGlobally: new BooleanField({ default: false }),
    iconEntry: new StringField({ default: 'bookmark' }),
    iconFontSize: new NumberField({ default: 40 }),
    iconTint: new StringField({ default: '#ffffff' }),
    textLabel: new StringField({ default: '' }),
    fontFamily: new StringField({ default: 'Padrão' }),
    fontSize: new NumberField({ default: 32 }),
    textColor: new StringField({ default: '#ffffff' }),
    textAnchor: new StringField({ default: 'center' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['stageId'] }
  ],
} satisfies SchemaDefinition;

export class NotesDocument extends LoomDocument {
  static schema = notesSchema;
}
