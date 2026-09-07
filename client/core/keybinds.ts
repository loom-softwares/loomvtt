/*******************************************************************************
 * LoomVTT
 * client/core/keybinds.ts
 * 
 * 
 * Keybind registration and event dispatcher.
 ******************************************************************************/

const STORAGE_KEY = 'loom-keybinds';

export interface KeybindAction {
  id: string;
  label: string;
  description: string;
  defaultKey: string;
  category?: string;
  onPress?: () => void;
}

type KeybindMap = Record<string, string>;

class KeybindManager {
  private overrides: KeybindMap = {};
  private actions = new Map<string, KeybindAction>();

  register(action: KeybindAction): void {
    this.actions.set(action.id, action);
  }

  unregister(id: string): void {
    this.actions.delete(id);
    delete this.overrides[id];
  }

  load(): void {
    try {
      this.overrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      this.overrides = {};
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
  }

  getKey(actionId: string): string {
    if (this.overrides[actionId]) return this.overrides[actionId];
    return this.actions.get(actionId)?.defaultKey || '';
  }

  getAction(key: string): string | null {
    for (const [actionId, overrideKey] of Object.entries(this.overrides)) {
      if (overrideKey === key) return actionId;
    }
    for (const a of this.actions.values()) {
      if (a.defaultKey === key && !(a.id in this.overrides)) return a.id;
    }
    return null;
  }

  getActionObject(actionId: string): KeybindAction | undefined {
    return this.actions.get(actionId);
  }

  getAllBindings(): KeybindAction[] {
    return Array.from(this.actions.values()).map(a => ({
      ...a,
      defaultKey: this.overrides[a.id] || a.defaultKey,
    }));
  }

  setBinding(actionId: string, key: string): void {
    this.overrides[actionId] = key;
    this.save();
  }

  resetBinding(actionId: string): void {
    delete this.overrides[actionId];
    this.save();
  }

  resetAll(): void {
    this.overrides = {};
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const keybindManager = new KeybindManager();
