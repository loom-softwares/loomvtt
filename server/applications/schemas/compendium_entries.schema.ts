import {
  IdField,
  StringField,
  NumberField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

/** Uma linha por entry (spell, monstro, item...) — nunca um blob com o pack inteiro.
 * `data` é o payload mecânico só daquela entry (schemaless por natureza, varia por
 * sistema), não o array inteiro do pack. Ver memory: project_compendio_arquitetura_2026_09_08. */
export const compendium_entriesSchema = {
  tableName: 'compendium_entries',
  fields: {
    id: new IdField(),
    packId: new StringField({ required: true }),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    type: new StringField({ default: '' }),
    sortOrder: new NumberField({ default: 0 }),
    imgUrl: new StringField({ default: '' }),
    ownership: new JSONField({ default: () => ({}) }),
    data: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['packId'] },
    { columns: ['worldId'] },
  ],
} satisfies SchemaDefinition;

export class Compendium_entriesDocument extends LoomDocument {
  static schema = compendium_entriesSchema;
}
