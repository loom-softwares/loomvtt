/*******************************************************************************
 * LoomVTT
 * client/core/system-registry.ts
 * 
 * 
 * Registry for the active game system.
 ******************************************************************************/

// SheetField/SheetTab/SheetSchema live in components/sheet-schema.ts.
// Previously, duplicated interfaces here caused silent structural divergence
// (duck typing) that bypassed TSC but failed type-checking later.
import type { SheetField, SheetSchema } from '../components/sheet-schema.js';
export type { SheetField, SheetTab, SheetSchema } from '../components/sheet-schema.js';

export interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  /**
   * Intercepts rolls for a `rollable` sheet field (skill/attribute) before
   * the standard fallback (`resolveFormula` + direct dispatch). Systems with
   * custom mechanics (dice pool, difficulty prompt, etc.) implement this.
   * Return `true` to signal the UI that the system handled the click;
   * `false`/`undefined` lets the standard behavior execute.
   */
  rollField?(field: SheetField, actor: any, dispatch: (formula: string) => void): boolean | Promise<boolean>;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  /**
   * The ruleset's parsed `ruleset.json` (set by `loadClientAddons` right after the
   * system's client script registers), so UI can read manifest-only fields like
   * `compendiums` without a second fetch. Absent until the ruleset finishes loading.
   */
  manifest?: Record<string, any>;
  styles?: string;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}

class ClientSystemRegistry {
  private systems = new Map<string, LoomSystem>();
  private activeSystemId: string | null = null;

  register(system: LoomSystem): void {
    this.systems.set(system.id, system);
  }

  get(id: string): LoomSystem | undefined {
    return this.systems.get(id);
  }

  getAll(): LoomSystem[] {
    return Array.from(this.systems.values());
  }

  getActive(): LoomSystem | undefined {
    if (this.activeSystemId && this.systems.has(this.activeSystemId)) {
      return this.systems.get(this.activeSystemId);
    }
    if (this.systems.size === 1) {
      return Array.from(this.systems.values())[0];
    }
    return undefined;
  }

  setActive(id: string): void {
    if (!this.systems.has(id)) return;

    // Remove a classe do sistema anterior (se houver) antes de trocar
    document.body.classList.forEach((cls) => {
      if (this.systems.has(cls)) document.body.classList.remove(cls);
    });
    document.body.classList.add(id);

    this.activeSystemId = id;
    const system = this.systems.get(id)!;
    let tag = document.getElementById('loom-system-styles') as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'loom-system-styles';
      document.head.appendChild(tag);
    }
    tag.textContent = system.styles ?? '';
  }
}

export const systemRegistry = new ClientSystemRegistry();
