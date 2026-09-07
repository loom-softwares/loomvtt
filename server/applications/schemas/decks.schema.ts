import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const decksSchema = {
  tableName: 'decks',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    type: new StringField({ default: 'standard' }),
    /** Tipo de pilha real: 'deck' | 'hand' | 'pile'. Nao confundir
     * com `type` acima, que e o preset de baralho (ex: "standard"). */
    stackType: new StringField({ default: 'deck' }),
    /** Dono da mao — só usado quando stackType === 'hand' (uma hand pertence a um user). */
    ownerId: new StringField({ default: '' }),
    cards: new JSONField({ default: () => [] }),
    state: new JSONField({ default: () => ({}) }),
    folderId: new StringField({ default: '' }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class DecksDocument extends LoomDocument {
  static schema = decksSchema;
}