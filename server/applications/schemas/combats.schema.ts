import {
  IdField,
  StringField,
  NumberField,
  BooleanField,
  JSONField,
  type SchemaDefinition
} from '../data/fields.js';
import { LoomDocument } from '../data/document.js';

/** Groups combatants sharing one rolled initiative (e.g. "Goblin Squad") — same
 * shape `CombatantGroup`, minus `members`/`defeated`/`hidden` (those
 * are computed client-side from each combatant's own `groupId`/`hp`, not stored). */
export interface CombatantGroup {
  id: string;
  name: string;
  initiative: number | null;
}

export const combatsSchema = {
  tableName: 'combats',
  fields: {
    id: new IdField(),
    worldId: new StringField({ required: true }),
    round: new NumberField({ default: 1 }),
    currentTurn: new NumberField({ default: 0 }),
    combatants: new JSONField({ default: () => [] }),
    groups: new JSONField({ default: () => [] as CombatantGroup[] }),
    isActive: new BooleanField({ default: false }),
    createdAt: new StringField(),
    updatedAt: new StringField(),
  },
  indexes: [
    { columns: ['worldId'] }
  ],
} satisfies SchemaDefinition;

export class CombatsDocument extends LoomDocument {
  static schema = combatsSchema;
}
