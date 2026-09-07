import {
  IdField,
  StringField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const chat_messagesSchema = {
  tableName: 'chat_messages',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    userId: new StringField({ default: 'system' }),
    userName: new StringField({ default: 'System' }),
    userColor: new StringField({ default: '#888' }),
    type: new StringField({ default: 'chat' }),
    content: new StringField({ required: true }),
    rollData: new JSONField({ default: () => null }),
    flags: new JSONField({ default: () => ({}) }),
    speaker: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class Chat_messagesDocument extends LoomDocument {
  static schema = chat_messagesSchema;
}
