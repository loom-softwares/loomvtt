/*******************************************************************************
 * LoomVTT
 * client/core/modules-collection.ts
 * 
 * 
 * Collection manager for active modules/addons.
 ******************************************************************************/

import { api } from './api.js';

interface ModuleEntry {
  id: string;
  title: string;
  active: boolean;
  flags: Record<string, any>;
  [key: string]: any;
}

interface PackageApiEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

/** Actual collection of addons installed in the world (Loom's `enabled`),
 * pre-loaded when entering the world. Must be exposed here to prevent systems
 * that check `game.modules.filter(m => m.active && m.flags.x)` from crashing
 * with "Cannot read properties of undefined". */
class ModulesCollection {
  private entries: ModuleEntry[] = [];

  async load(worldId: string): Promise<void> {
    try {
      const packages = await api.get<PackageApiEntry[]>(`/worlds/${worldId}/packages`);
      this.entries = packages.map((pkg) => ({
        id: pkg.id,
        title: pkg.name,
        active: pkg.enabled,
        version: pkg.version,
        description: pkg.description,
        flags: {},
      }));
    } catch {
      this.entries = [];
    }
  }

  clear(): void {
    this.entries = [];
  }

  get(id: string): ModuleEntry | undefined {
    return this.entries.find((m) => m.id === id);
  }

  filter(predicate: (module: ModuleEntry) => boolean): ModuleEntry[] {
    return this.entries.filter(predicate);
  }

  find(predicate: (module: ModuleEntry) => boolean): ModuleEntry | undefined {
    return this.entries.find(predicate);
  }

  map<T>(fn: (module: ModuleEntry) => T): T[] {
    return this.entries.map(fn);
  }

  forEach(fn: (module: ModuleEntry) => void): void {
    this.entries.forEach(fn);
  }

  get contents(): ModuleEntry[] {
    return this.entries;
  }

  get size(): number {
    return this.entries.length;
  }
}

export const modulesCollection = new ModulesCollection();
