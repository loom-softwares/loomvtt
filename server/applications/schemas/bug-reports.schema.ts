import { IdField, StringField, JSONField, type SchemaDefinition } from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

export const bugReportsSchema = {
  tableName: 'bug_reports',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    title: new StringField({ required: true }),
    description: new StringField({ default: '' }),
    severity: new StringField({ default: 'medium' }),
    category: new StringField({ default: 'other' }),
    status: new StringField({ default: 'open' }),
    reporterId: new StringField({ required: true }),
    metadata: new JSONField({ default: () => ({}) }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
} satisfies SchemaDefinition;

export class BugReportsDocument extends LoomDocument {
  static schema = bugReportsSchema;
}
