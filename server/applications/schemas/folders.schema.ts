import {
  IdField,
  StringField,
  ForeignField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const foldersSchema = {
  tableName: 'folders',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    type: new StringField({ required: true }),
    // Só usado quando type === 'compendium-entry': escopa a pasta a UM pack específico
    // (organizar entries DENTRO de um pack), distinto do type 'compendium' que organiza a
    // lista de packs do mundo inteiro. Vazio pros demais tipos.
    packId: new StringField({ default: '' }),
    parent: new StringField({ default: '' }),
    sorting: new StringField({ default: 'm' }),
    color: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class FoldersDocument extends LoomDocument {
  static schema = foldersSchema;
}
