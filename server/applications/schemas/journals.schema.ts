import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export interface JournalPage {
  id: string;
  name: string;
  content: string;
  sort: number;
  type?: 'text' | 'image' | 'pdf';
  src?: string;
  categoryId?: string;
}

/** Groups pages within a single JournalEntry — lightweight named/sorted label,
 * same shape as Foundry's `JournalEntryCategory` (no own `system` data). */
export interface JournalCategory {
  id: string;
  name: string;
  sort: number;
}

export const journalsSchema = {
  tableName: 'journals',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    name: new StringField({ required: true }),
    content: new StringField({ default: '' }),
    pages: new JSONField({ default: () => [] as JournalPage[] }),
    categories: new JSONField({ default: () => [] as JournalCategory[] }),
    folderId: new StringField({ default: '' }),
    isPinned: new BooleanField({ default: false }),
    pinX: new NumberField({ default: 0 }),
    pinY: new NumberField({ default: 0 }),
    flags: new JSONField({ default: () => ({}) }),
    ownership: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class JournalsDocument extends LoomDocument {
  static schema = journalsSchema;
}
