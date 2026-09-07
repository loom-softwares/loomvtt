import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  ForeignField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const usersSchema = {
  tableName: 'users',
  fields: {
    id: new IdField(),
    worldId: new ForeignField({ ref: 'id' }),
    name: new StringField({ required: true }),
    role: new NumberField({ default: 1 }),
    password: new StringField({ default: '' }),
    color: new StringField({ default: '#4f46e5' }),
    colorHex: new StringField({ default: '#4f46e5' }),
    avatarUrl: new StringField({ default: '' }),
    pronouns: new StringField({ default: '' }),
    actorId: new StringField({ default: '' }),
    siteAccountId: new StringField({ default: '' }),
    authProvider: new StringField({ default: 'local' }),
    pendingApproval: new BooleanField({ default: false }),
    lastLogin: new StringField({ default: '' }),
    flags: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] },
    { columns: ['worldId', 'siteAccountId'] },
  ],
} satisfies SchemaDefinition;

export class UsersDocument extends LoomDocument {
  static schema = usersSchema;
}
