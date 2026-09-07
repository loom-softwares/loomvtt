import { SystemRegistry } from '../systems/system-registry.js';
import { withActiveEffects } from './effects.js';

export async function prepareActor(row: any) {
  if (!row) return row;
  if (row.systemData) {
    row = { ...row, systemData: await withActiveEffects(row.id, row.systemData) };
  }
  const activeSystem = SystemRegistry.getActive();
  if (activeSystem && activeSystem.prepareData) {
    return activeSystem.prepareData(row);
  }
  return row;
}

/**
 * Visao "Limitado" (nivel 1) — quem so tem visao limitada nao deveria
 * receber a ficha inteira (systemData) no JSON, so porque canView deixou
 * passar. Mantem campos universais (nome/retrato/tipo) e só os campos de
 * systemData que o ruleset declarar em `limitedFields` no ruleset.json —
 * sistema sem manifesto (ou sem o campo) não expõe nada além do universal.
 */
export function redactActorForLimited(actor: any, limitedFields: string[]): any {
  if (!actor) return actor;
  const systemData: Record<string, any> = {};
  for (const key of limitedFields) {
    if (actor.systemData && Object.prototype.hasOwnProperty.call(actor.systemData, key)) {
      systemData[key] = actor.systemData[key];
    }
  }
  return {
    id: actor.id,
    worldId: actor.worldId,
    name: actor.name,
    type: actor.type,
    avatarUrl: actor.avatarUrl,
    folderId: actor.folderId,
    ownership: actor.ownership,
    createdAt: actor.createdAt,
    updatedAt: actor.updatedAt,
    systemData,
  };
}
