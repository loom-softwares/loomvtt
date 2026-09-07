/*******************************************************************************
 * LoomVTT
 * client/core/main-menu-registry.ts
 *
 *
 * Registry for entries in the main menu (opened via the hotbar button, not ESC
 * — see client/screens/game-hud/game-hud.ts for why ESC does something else
 * here). Lets any part of Loom, or a future addon, add an item without editing
 * macro-hotbar.ts directly. Same pattern as status-effect-registry.ts.
 ******************************************************************************/

import { windowManager } from './window-manager.js';
import { UserManagementWindow } from '../windows/user-management-window.js';

export interface MainMenuItemDef {
  id: string;
  label: string;
  icon?: string;
  /** Renders the item in the "destructive" style (used by "Sair"). */
  danger?: boolean;
  onClick: (ctx: { worldId: string }) => void;
}

const BUILTIN: MainMenuItemDef[] = [
  { id: 'reload', label: 'Recarregar Aplicação', icon: 'fa-solid fa-rotate-right', onClick: () => window.location.reload() },
  { id: 'users', label: 'Gestão de Usuários', icon: 'fa-solid fa-users', onClick: (ctx) => windowManager.open('users', UserManagementWindow, { worldId: ctx.worldId }) },
  { id: 'config', label: 'Voltar à Configuração', icon: 'fa-solid fa-gear', onClick: () => { window.location.href = '/'; } },
  { id: 'logout', label: 'Sair', icon: 'fa-solid fa-arrow-right-from-bracket', danger: true, onClick: () => { localStorage.removeItem('token'); window.location.href = '/login'; } },
];

class MainMenuRegistry {
  private items = new Map<string, MainMenuItemDef>(BUILTIN.map(i => [i.id, i]));

  /** Registers (or overwrites) a menu item — systems/addons declare their own. */
  register(def: MainMenuItemDef): void {
    this.items.set(def.id, def);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  getAll(): MainMenuItemDef[] {
    return Array.from(this.items.values());
  }
}

export const mainMenuRegistry = new MainMenuRegistry();
