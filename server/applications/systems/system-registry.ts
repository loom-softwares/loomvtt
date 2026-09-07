import logger from '../utils/logger.js';

export interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean' | 'dots' | 'actions'
    | 'select' | 'color' | 'image' | 'square-counter';
  /** Used by 'dots' (pip count) and 'square-counter' (total squares). */
  max?: number;
  /** Only for type 'select' — list of options. */
  options?: { value: string; label: string }[];
}

export interface SheetTab {
  id: string;
  label: string;
  icon?: string;
  fields: SheetField[];
}

export interface SheetSchema {
  tabs: SheetTab[];
}

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
  /** Optional actor sheet layout. If omitted, actors of this system get the bare-bones fallback sheet (name + portrait only). */
  getSheetSchema?(actorType: string): SheetSchema | null;
  /** Optional item sheet layout. If omitted, items of this system get the bare-bones fallback sheet (name + icon only). */
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  /** CSS bruto do sistema — injetado 1x quando o sistema fica ativo. */
  styles?: string;
  /** Optional manifest URLs for system links */
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}

class Registry {
  private systems = new Map<string, LoomSystem>();
  private activeSystemId: string | null = null;

  register(system: LoomSystem) {
    this.systems.set(system.id, system);
    logger.info(`[SystemRegistry] Registered system: ${system.id} v${system.version}`);
  }

  get(id: string): LoomSystem | undefined {
    return this.systems.get(id);
  }

  getAll(): LoomSystem[] {
    return Array.from(this.systems.values());
  }

  getActive(): LoomSystem | undefined {
    return this.activeSystemId ? this.systems.get(this.activeSystemId) : undefined;
  }

  setActive(id: string) {
    if (this.systems.has(id)) {
      this.activeSystemId = id;
      logger.info(`[SystemRegistry] Active system changed to: ${id}`);
    }
  }
}

export const SystemRegistry = new Registry();

// Rulesets live in the OS data folder (installable content, not part of the
// source tree), so they can't reach this module via a relative import — the
// path distance changes between dev/prod/AppData. Expose the singleton on
// globalThis so ruleset core scripts can grab it without knowing where the
// app itself is physically installed.
(globalThis as any).__loomSystemRegistry = SystemRegistry;
