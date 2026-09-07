/*******************************************************************************
 * LoomVTT
 * client/windows/game-settings-window.ts
 * 
 * 
 * Window for managing game settings menus.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/dialog.js';
import { UserPermissionsWindow } from './user-permissions-window.js';
import { TourManager } from '../core/tour-manager.js';
import { settingsRegistry, normalizeType } from '../core/settings-registry.js';
import { ModuleSettingsWindow } from './module-settings-window.js';
import { openAppearanceDialog } from '../core/appearance-dialog.js';

interface GameSettingItem {
  id: string;
  label: string;
  description: string;
  category: string;
  action?: () => void;
  isInline?: boolean;
  value?: any;
}

export class GameSettingsWindow extends BaseWindow {
  private settings: GameSettingItem[] = [];
  private searchTerm = '';
  private selectedCategory = 'all';

  constructor(private props?: { worldId: string }) {
    super({
      id: 'game-settings',
      title: t('gameSettings.title'),
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 720,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    const filteredSettings = this.getFilteredSettings();
    const categories = this.getCategories();

    return `
      <div class="game-settings-container">
        <div class="sidebar">
          <div class="search-box">
            <input type="text" 
                   class="search-input" 
                   placeholder="${t('gameSettings.searchPlaceholder')}" 
                   value="${this.searchTerm}"
                   data-action="search">
          </div>
          <div class="categories">
            <div class="category-item ${this.selectedCategory === 'all' ? 'active' : ''}" 
                 data-category="all">
              ${t('gameSettings.allCategories')} ${this.settings.length > 0 ? `[${this.settings.length}]` : ''}
            </div>
            ${categories.map(cat => `
              <div class="category-item ${this.selectedCategory === cat ? 'active' : ''}" 
                   data-category="${cat}">
                ${cat} ${this.settings.filter(s => s.category === cat).length > 0 ? `[${this.settings.filter(s => s.category === cat).length}]` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="main-content">
          <div class="settings-list">
            ${filteredSettings.map(setting => `
              <div class="setting-row ${setting.isInline ? 'inline' : 'button'}">
                <div class="setting-info">
                  <div class="setting-label">${setting.label}</div>
                  <div class="setting-description">${setting.description}</div>
                </div>
                <div class="setting-action">
                  ${setting.isInline ?
        (typeof setting.value === 'boolean' ?
          `<input type="checkbox" class="setting-checkbox" ${setting.value ? 'checked' : ''} data-setting="${setting.id}">` :
          `<select class="setting-select" data-setting="${setting.id}">
                        <option value="option1" ${setting.value === 'option1' ? 'selected' : ''}>${t('gameSettings.option1')}</option>
                        <option value="option2" ${setting.value === 'option2' ? 'selected' : ''}>${t('gameSettings.option2')}</option>
                      </select>`) :
        `<button class="btn btn-secondary" data-action="open-setting" data-setting="${setting.id}">
                      ${t('gameSettings.open')}
                    </button>`
      }
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" data-action="reset-defaults">${t('gameSettings.resetDefaults')}</button>
      </div>
    `;
  }

  protected _preFirstRender(): void {
    this.initializeSettings();
  }

  private initializeSettings(): void {
    const worldId = this.props?.worldId || '';
    this.settings = [
      {
        id: 'user-permissions',
        label: t('gameSettings.userPermissions'),
        description: t('gameSettings.userPermissionsDesc'),
        category: 'Core',
        action: () => windowManager.open(`user-permissions-${worldId}`, UserPermissionsWindow, { worldId })
      },
      {
        id: 'tours',
        label: t('gameSettings.tours'),
        description: t('gameSettings.toursDesc'),
        category: 'Core',
        action: () => {
          showToast(t('gameSettings.tourStarting'), 'info');
          TourManager.getInstance().startGameHudTourAfterSeen();
        }
      },
      {
        id: 'world-config',
        label: t('gameSettings.worldConfig'),
        description: t('gameSettings.worldConfigDesc'),
        category: 'Core',
        action: () => showToast(t('gameSettings.comingSoon'), 'info')
      },
      {
        id: 'appearance',
        label: t('gameSettings.appearance'),
        description: t('gameSettings.appearanceDesc'),
        category: 'Aparência',
        action: () => openAppearanceDialog()
      },
      // Menus registered at runtime by systems/addons via `Loom.settings.registerMenu()`
      // before this it was a no-op.
      ...settingsRegistry.getMenus().map((menu) => ({
        id: `menu-${menu.module}-${menu.key}`,
        label: t(menu.label || menu.name || menu.key),
        description: t(menu.hint || ''),
        category: 'System',
        action: () => {
          if (menu.type) {
            // Instantiate the customized menu
            const MenuClass = menu.type;
            const menuInstance = new MenuClass();
            menuInstance.render(true);
          } else {
            // Fallback to old behavior
            this.openSystemSettings(menu.module);
          }
        },
      })),
    ];
  }

  private openSystemSettings(module: string): void {
    const worldId = this.props?.worldId || '';
    const definitions = settingsRegistry.getDefinitionsForModule(module).filter((d) => d.config !== false);
    windowManager.open(`module-settings-${module}`, ModuleSettingsWindow, {
      worldId,
      moduleId: module,
      manifest: {
        name: module,
        title: module,
        settings: definitions.map((d) => ({
          key: d.key,
          type: normalizeType(d.type),
          default: d.default,
          label: d.name || d.key,
          hint: d.hint,
          scope: d.scope,
        })),
      },
    });
  }

  private getFilteredSettings(): GameSettingItem[] {
    let filtered = this.settings;

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === this.selectedCategory);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.label.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  private getCategories(): string[] {
    const categories = [...new Set(this.settings.map(s => s.category))];
    return categories.sort();
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'open-setting') {
      const settingId = id;
      const setting = this.settings.find(s => s.id === settingId);
      if (setting && setting.action) {
        setting.action();
      }
    } else if (action === 'reset-defaults') {
      showConfirm(t('gameSettings.resetDefaults'), t('gameSettings.resetConfirm')).then(confirmed => {
        if (confirmed) {
          showToast(t('gameSettings.resetSuccess'), 'success');
        }
      });
      // 'save' = rodape padrao do BaseWindow (antes havia um "Salvar" duplicado no corpo).
    } else if (action === 'save') {
      showToast(t('gameSettings.saveSuccess'), 'success');
    }
  }

  // Handle search and category changes
  private updateSearchAndCategories(): void {
    // Search
    const searchInput = this.element.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e: Event) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.rerenderBody();
      }, 300));
    }

    // Categories
    this.element.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const category = (e.currentTarget as HTMLElement).dataset.category;
        this.selectedCategory = category || 'all';
        this.rerenderBody();
      });
    });

    // Inline settings
    this.element.querySelectorAll('.setting-checkbox, .setting-select').forEach(input => {
      input.addEventListener('change', (e) => {
        const settingId = (e.target as HTMLInputElement | HTMLSelectElement).dataset.setting;
        // TODO: Implementar persistência de settings
        console.log(`Setting ${settingId} changed to`, (e.target as HTMLInputElement).value);
      });
    });
  }

  protected _postRender(): void {
    super._postRender();
    this.updateSearchAndCategories();
  }
}

// Helper debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}