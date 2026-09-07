import {
  IdField,
  StringField,
  type SchemaDefinition,
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const discordConfigSchema = {
  tableName: 'discord_configs',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    botToken: new StringField({ required: true }),
    guildId: new StringField({ required: true }),
    categoryId: new StringField({ nullable: true }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'], unique: true },
  ],
} satisfies SchemaDefinition;

export class DiscordConfigDocument extends LoomDocument {
  static schema = discordConfigSchema;
}
