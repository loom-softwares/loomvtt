/*******************************************************************************
 * LoomVTT
 * client/core/settings-registry.ts
 * 
 * 
 * Registry for game and module settings.
 ******************************************************************************/

import { api } from './api.js';
import { gameContext } from './game-context.js';

export type SettingScope = 'world' | 'client';

export interface SettingConfig {
  name?: string;
  hint?: string;
  scope: SettingScope;
  config?: boolean;
  /**
   * Accepts both constructors (String/Number/Boolean/Array) and literal strings.
   */
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor | 'string' | 'number' | 'boolean' | 'object' | 'array';
  default: any;
  choices?: Record<string, string>;
  onChange?: (value: any) => void;
}

export interface SettingMenuConfig {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  restricted?: boolean;
  /**
   * Class to instantiate when opening the menu.
   */
  type?: new (...args: any[]) => any;
}

export interface RegisteredSetting extends SettingConfig {
  module: string;
  key: string;
}

export interface RegisteredMenu extends SettingMenuConfig {
  module: string;
  key: string;
}

function normalizeType(type: SettingConfig['type']): 'string' | 'number' | 'boolean' {
  if (type === String || type === 'string') return 'string';
  if (type === Number || type === 'number') return 'number';
  if (type === Boolean || type === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Actual settings registry (register/get/set/registerMenu), additive (by module+key),
 * without monkey-patchable global objects.
 *
 * Persistence: scope 'world' -> /api/module-settings/:worldId/:module/:key (per-world, real);
 * scope 'client' -> localStorage (per user/browser). The `get()` method is synchronous
 * (parity with the API expected by converted systems), so when registering a 'world'
 * setting, we trigger an asynchronous pre-loading of all settings for that module.
 * — This works because systems
 * always call `register()` in the `init` hook, long before any `get()` in `ready`/render.
 */
class SettingsRegistry {
  private definitions = new Map<string, RegisteredSetting>();
  private menus = new Map<string, RegisteredMenu>();
  private worldCache = new Map<string, any>();
  private loadingModules = new Set<string>();

  constructor() {
    // Settings that converted systems assume already exist
    // without ever calling `register()` for them. Without this, `.get('core.X')` returns undefined and
    // `.default = ...` breaks with "Cannot set properties of undefined". Only those we have seen
    // real systems touch — add more here as they appear, never invent the entire list at once.
    this.register('core', 'chatBubblesPan', { scope: 'client', type: Boolean, default: true });
    this.register('core', 'notesDisplayToggle', { scope: 'client', type: Boolean, default: false });
    this.register('core', 'language', { scope: 'client', type: String, default: 'en' });
  }

  register(module: string, key: string, config: SettingConfig): void {
    this.definitions.set(`${module}.${key}`, { module, key, ...config });
    if (config.scope === 'world') this.ensureModuleLoaded(module);
  }

  registerMenu(module: string, key: string, config: SettingMenuConfig): void {
    this.menus.set(`${module}.${key}`, { module, key, ...config });
  }

  getMenus(): RegisteredMenu[] {
    return Array.from(this.menus.values());
  }

  getDefinitionsForModule(module: string): RegisteredSetting[] {
    return Array.from(this.definitions.values()).filter((d) => d.module === module);
  }

  /**
   * Actual map of registered definitions (key `module.key` -> config), not values.
   * Some legacy systems read directly from here instead of using `get()`.
   */
  get settingsMap(): Map<string, RegisteredSetting> {
    return this.definitions;
  }

  private storageKey(module: string, key: string): string {
    return `loom_setting_${module}_${key}`;
  }

  private ensureModuleLoaded(module: string): void {
    const worldId = gameContext.worldId;
    if (!worldId || this.loadingModules.has(module)) return;
    this.loadingModules.add(module);
    api
      .get<{ data: Record<string, any>; error: string | null }>(`/module-settings/${worldId}/${module}`)
      .then((res) => {
        for (const [key, value] of Object.entries(res.data ?? {})) {
          this.worldCache.set(`${module}.${key}`, value);
        }
      })
      .catch(() => {
        // No settings saved yet for this module — get() falls back to the default.
      });
  }

  get(module: string, key: string): any {
    const def = this.definitions.get(`${module}.${key}`);
    const scope = def?.scope ?? 'world';
    if (scope === 'client') {
      const raw = localStorage.getItem(this.storageKey(module, key));
      if (raw === null) return def?.default;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    const cacheKey = `${module}.${key}`;
    if (this.worldCache.has(cacheKey)) {
      const val = this.worldCache.get(cacheKey);
      // If the type is Array and the cache is dirty with a non-array object (e.g., {}), fallback to default
      if (def?.type === Array && !Array.isArray(val)) {
        return def?.default;
      }
      return val;
    }
    return def?.default;
  }

  async set(module: string, key: string, value: any): Promise<void> {
    const def = this.definitions.get(`${module}.${key}`);
    const scope = def?.scope ?? 'world';
    if (scope === 'client') {
      localStorage.setItem(this.storageKey(module, key), JSON.stringify(value));
    } else {
      const worldId = gameContext.worldId;
      if (!worldId) throw new Error(`Loom.settings.set('${module}.${key}') called without an active world`);
      await api.put(`/module-settings/${worldId}/${module}/${key}`, { value, scope: 'world' });
      this.worldCache.set(`${module}.${key}`, value);
    }
    def?.onChange?.(value);
  }
}

export const settingsRegistry = new SettingsRegistry();
export { normalizeType };
