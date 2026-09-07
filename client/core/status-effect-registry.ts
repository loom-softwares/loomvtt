/*******************************************************************************
 * LoomVTT
 * client/core/status-effect-registry.ts
 * 
 * 
 * Registry for status effects and conditions.
 ******************************************************************************/

export interface StatusEffectDef {
  id: string;
  label: string;
  color: number;
  icon?: string;
}

const BUILTIN: StatusEffectDef[] = [
  { id: 'blinded', label: 'Blinded', color: 0x000000 },
  { id: 'poisoned', label: 'Poisoned', color: 0x228b22 },
  { id: 'stunned', label: 'Stunned', color: 0xffd700 },
  { id: 'prone', label: 'Prone', color: 0x8b4513 },
  { id: 'invisible', label: 'Invisible', color: 0x9370db },
];

class ClientStatusEffectRegistry {
  private effects = new Map<string, StatusEffectDef>(BUILTIN.map(e => [e.id, e]));

  /** Registers (or overwrites) a condition — systems declare their own. */
  register(def: StatusEffectDef): void {
    this.effects.set(def.id, def);
  }

  get(id: string): StatusEffectDef | undefined {
    return this.effects.get(id);
  }

  getAll(): StatusEffectDef[] {
    return Array.from(this.effects.values());
  }
}

export const statusEffectRegistry = new ClientStatusEffectRegistry();
