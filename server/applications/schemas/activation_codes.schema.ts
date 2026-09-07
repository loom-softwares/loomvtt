import {
  IdField,
  StringField,
  BooleanField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const activationCodesSchema = {
  tableName: 'activation_codes',
  fields: {
    id: new IdField(),
    code: new StringField({ required: true }),
    packageName: new StringField({ required: true }),
    used: new BooleanField({ default: false }),
    worldId: new StringField({ default: '' }),
    redeemedAt: new StringField({ default: '' }),
    createdAt: new StringField(),
  },
  indexes: [
    { columns: ['packageName'] },
    { columns: ['used'] },
  ],
} satisfies SchemaDefinition;

export class ActivationCodesDocument extends LoomDocument {
  static schema = activationCodesSchema;
}
