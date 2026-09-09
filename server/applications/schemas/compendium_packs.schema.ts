import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

// `entries` NÃO existe mais aqui — cada entry mora em `compendium_entries` (1 linha por
// entry, ver esse schema). Isso é só o metadado do pack. Ver memory:
// project_compendio_arquitetura_2026_09_08 pro porquê (blob de 2.2MB reescrito por edição
// de 1 entry, achado real em rulesets/sdr5e/packs/monsters.json).
export const compendium_packsSchema = {
  tableName: 'compendium_packs',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'Actor' }),
    ownership: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class Compendium_packsDocument extends LoomDocument {
  static schema = compendium_packsSchema;
}
