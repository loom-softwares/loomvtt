/*******************************************************************************
 * LoomVTT
 * client/windows/game-config-window.ts
 * 
 * 
 * Window for configuring general game settings.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { DiscordConfigWindow } from './discord-config-window.js';
import { systemRegistry } from '../core/system-registry.js';
import { settingsRegistry, normalizeType } from '../core/settings-registry.js';
import { packageTitles } from '../core/addon-client-loader.js';

interface GameConfigProps {
  worldId: string;
  liveVisionOnDrag: boolean;
  onLiveVisionDragChange: (val: boolean) => void;
  lightAnimationsEnabled: boolean;
  onLightAnimationsChange: (val: boolean) => void;
  locale: string;
  onLocaleChange: (val: string) => void;
  hideCanvas: boolean;
  onHideCanvasChange: (val: boolean) => void;
  leftClickDeselect: boolean;
  onLeftClickDeselectChange: (val: boolean) => void;
  maxFps: string;
  onMaxFpsChange: (val: string) => void;
  showTooltips: boolean;
  onShowTooltipsChange: (val: boolean) => void;
  autosaveInterval: string;
  onAutosaveIntervalChange: (val: string) => void;
  universalKeys: boolean;
  onUniversalKeysChange: (val: boolean) => void;
  onOpenSheetConfig?: () => void;
}

interface ConfigToggle {
  action: string;
  label: string;
  desc: string;
  type?: 'checkbox' | 'select' | 'button' | 'text' | 'number';
  get: () => boolean;
  set: (val: boolean) => void;
  getValue?: () => string;
  setValue?: (val: string) => void;
  options?: { value: string; label: string }[];
}

interface ConfigCategory {
  id: string;
  label: string;
  toggles: ConfigToggle[];
}

export class GameConfigWindow extends BaseWindow {
  private categories: ConfigCategory[];
  private activeCategory: string;
  private search = '';

  constructor(private props: GameConfigProps) {
    super({
      id: 'game-config',
      title: t('gameConfig.title'),
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 820,
      height: 'auto',
    });

    this.categories = [
      {
        id: 'core',
        label: t('gameConfig.categoryCore'),
        toggles: [
          {
            action: 'toggle-live-vision-drag',
            label: t('gameConfig.liveVisionDrag'),
            desc: t('gameConfig.liveVisionDragDesc'),
            get: () => this.props.liveVisionOnDrag,
            set: (val) => { this.props.liveVisionOnDrag = val; this.props.onLiveVisionDragChange(val); },
          },
          {
            action: 'toggle-light-animations',
            label: t('gameConfig.lightAnimations'),
            desc: t('gameConfig.lightAnimationsDesc'),
            get: () => this.props.lightAnimationsEnabled,
            set: (val) => { this.props.lightAnimationsEnabled = val; this.props.onLightAnimationsChange(val); },
          },
          {
            action: 'select-locale',
            label: t('gameConfig.locale'),
            desc: t('gameConfig.localeDesc'),
            type: 'select',
            get: () => true,
            set: () => { },
            getValue: () => this.props.locale,
            setValue: (val) => { this.props.locale = val; this.props.onLocaleChange(val); },
            options: [
              { value: 'pt-BR', label: 'Português (Brasil)' },
              { value: 'en', label: 'English' },
            ],
          },
          {
            action: 'toggle-hide-canvas',
            label: t('gameConfig.hideCanvas'),
            desc: t('gameConfig.hideCanvasDesc'),
            get: () => this.props.hideCanvas,
            set: (val) => { this.props.hideCanvas = val; this.props.onHideCanvasChange(val); },
          },
          {
            action: 'toggle-left-click-deselect',
            label: t('gameConfig.leftClickDeselect'),
            desc: t('gameConfig.leftClickDeselectDesc'),
            get: () => this.props.leftClickDeselect,
            set: (val) => { this.props.leftClickDeselect = val; this.props.onLeftClickDeselectChange(val); },
          },
          {
            action: 'select-max-fps',
            label: t('gameConfig.maxFps'),
            desc: t('gameConfig.maxFpsDesc'),
            type: 'select',
            get: () => true,
            set: () => { },
            getValue: () => this.props.maxFps,
            setValue: (val) => { this.props.maxFps = val; this.props.onMaxFpsChange(val); },
            options: [
              { value: '30', label: '30 FPS' },
              { value: '60', label: '60 FPS' },
              { value: '0', label: 'Ilimitado' },
            ],
          },
          {
            action: 'toggle-show-tooltips',
            label: t('gameConfig.showTooltips'),
            desc: t('gameConfig.showTooltipsDesc'),
            get: () => this.props.showTooltips,
            set: (val) => { this.props.showTooltips = val; this.props.onShowTooltipsChange(val); },
          },
          {
            action: 'select-autosave-interval',
            label: t('gameConfig.autosaveInterval'),
            desc: t('gameConfig.autosaveIntervalDesc'),
            type: 'select',
            get: () => true,
            set: () => { },
            getValue: () => this.props.autosaveInterval,
            setValue: (val) => { this.props.autosaveInterval = val; this.props.onAutosaveIntervalChange(val); },
            options: [
              { value: '10000', label: '10 segundos' },
              { value: '30000', label: '30 segundos' },
              { value: '60000', label: '60 segundos' },
              { value: '0', label: 'Desativado' },
            ],
          },
          {
            action: 'toggle-universal-keys',
            label: t('gameConfig.universalKeys'),
            desc: t('gameConfig.universalKeysDesc'),
            get: () => this.props.universalKeys,
            set: (val) => { this.props.universalKeys = val; this.props.onUniversalKeysChange(val); },
          },
          {
            action: 'open-sheet-config',
            label: t('gameConfig.sheetConfig'),
            desc: t('gameConfig.sheetConfigDesc'),
            type: 'button',
            get: () => false,
            set: () => { },
          },
        ],
      },
    ];

    const activeSystem = systemRegistry.getActive();
    if (activeSystem) {
      const systemSettings = settingsRegistry.getDefinitionsForModule(activeSystem.id);
      if (systemSettings.length > 0) {
        this.categories.push({
          id: 'system',
          label: activeSystem.title,
          toggles: systemSettings.map((s) => {
            const kind = normalizeType(s.type); // 'boolean' | 'string' | 'number'
            const controlType: ConfigToggle['type'] = s.choices
              ? 'select'
              : kind === 'boolean'
                ? 'checkbox'
                : kind === 'number'
                  ? 'number'
                  : 'text';
            return {
              action: `system-setting-${s.module}-${s.key}`,
              label: s.name || s.key,
              desc: s.hint || '',
              type: controlType,
              options: s.choices ? Object.entries(s.choices).map(([value, label]) => ({ value, label })) : undefined,
              get: () => settingsRegistry.get(s.module, s.key),
              set: (val: boolean) => { void settingsRegistry.set(s.module, s.key, val); },
              getValue: () => String(settingsRegistry.get(s.module, s.key) ?? ''),
              setValue: (val: string) => { void settingsRegistry.set(s.module, s.key, kind === 'number' ? Number(val) : val); },
            };
          }),
        });
      }
    }

    // Add categories for any active addons/modules that registered settings
    const activeSystemId = activeSystem?.id;
    const handledModules = new Set<string>(['core', ...(activeSystemId ? [activeSystemId] : [])]);
    const allDefs = Array.from(settingsRegistry.settingsMap.values());
    const addonModules = Array.from(new Set(allDefs.map((d) => d.module).filter((m) => !handledModules.has(m))));

    for (const modId of addonModules) {
      const modSettings = settingsRegistry.getDefinitionsForModule(modId);
      if (modSettings.length > 0) {
        this.categories.push({
          id: `module-${modId}`,
          label: packageTitles.get(modId) || modId,
          toggles: modSettings.map((s) => {
            const kind = normalizeType(s.type);
            const controlType: ConfigToggle['type'] = s.choices
              ? 'select'
              : kind === 'boolean'
                ? 'checkbox'
                : kind === 'number'
                  ? 'number'
                  : 'text';
            return {
              action: `module-setting-${s.module}-${s.key}`,
              label: s.name || s.key,
              desc: s.hint || '',
              type: controlType,
              options: s.choices ? Object.entries(s.choices).map(([value, label]) => ({ value, label })) : undefined,
              get: () => settingsRegistry.get(s.module, s.key),
              set: (val: boolean) => { void settingsRegistry.set(s.module, s.key, val); },
              getValue: () => String(settingsRegistry.get(s.module, s.key) ?? ''),
              setValue: (val: string) => { void settingsRegistry.set(s.module, s.key, kind === 'number' ? Number(val) : val); },
            };
          }),
        });
      }
    }

    this.categories.push({
      id: 'integrations',
      label: t('gameConfig.categoryIntegrations'),
      toggles: [
        {
          action: 'open-discord-config',
          label: t('gameConfig.discord'),
          desc: t('gameConfig.discordDesc'),
          type: 'button',
          get: () => false,
          set: () => { },
        },
      ],
    });

    this.activeCategory = this.categories[0].id;
  }

  bodyTemplate(): string {
    const search = this.search.trim().toLowerCase();
    const category = this.categories.find((c) => c.id === this.activeCategory) ?? this.categories[0];
    const toggles = category.toggles.filter(
      (toggle) => !search || toggle.label.toLowerCase().includes(search) || toggle.desc.toLowerCase().includes(search),
    );

    const renderControl = (toggle: ConfigToggle): string => {
      if (toggle.type === 'select') {
        const current = toggle.getValue?.() ?? '';
        return `<select data-action="${toggle.action}" class="settings-select">
          ${(toggle.options ?? []).map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>`;
      }
      if (toggle.type === 'button') {
        return `<button class="btn btn-secondary" data-action="${toggle.action}">${t('gameConfig.configure')}</button>`;
      }
      if (toggle.type === 'text' || toggle.type === 'number') {
        const current = toggle.getValue?.() ?? '';
        return `<input type="${toggle.type}" data-action="${toggle.action}" value="${current}" class="settings-select" />`;
      }
      return `<input type="checkbox" data-action="${toggle.action}" ${toggle.get() ? 'checked' : ''} />`;
    };

    return `
      <div class="settings-shell">
        <div class="settings-sidebar">
          <input type="text" class="settings-search" name="settings-search" placeholder="${t('gameConfig.search')}" value="${this.search}" />
          <div class="settings-category-list">
            ${this.categories.map((c) => `
              <button class="settings-category-btn ${c.id === this.activeCategory ? 'active' : ''}" data-action="select-category" data-id="${c.id}">
                <span>${c.label}</span>
                <span class="badge">[${c.toggles.length}]</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="settings-content">
          <div class="settings-group-title">${category.label}</div>
          ${toggles.length === 0 ? `<p class="hint">${t('gameConfig.noSettingsFound')}</p>` : toggles.map((toggle) => `
            <div class="settings-row">
              <div class="settings-row-top">
                <span class="settings-row-label">${toggle.label}</span>
                <span class="settings-row-control">${renderControl(toggle)}</span>
              </div>
              <div class="settings-row-desc">${toggle.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  protected _postRender(): void {
    super._postRender();
    const footer = this.element.querySelector('.loom-window-footer');
    if (footer) (footer as HTMLElement).style.display = 'none';
    const searchInput = this.element.querySelector<HTMLInputElement>('[name="settings-search"]');
    searchInput?.addEventListener('input', () => {
      this.search = searchInput.value;
      this.rerenderBody();
    });
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'select-category' && id) {
      this.activeCategory = id;
      this.rerenderBody();
      return;
    }
    if (action === 'open-sheet-config') {
      this.props.onOpenSheetConfig?.();
      return;
    }
    if (action === 'open-discord-config') {
      windowManager.open(`discord-config-${this.props.worldId}`, DiscordConfigWindow, { worldId: this.props.worldId });
      return;
    }
    for (const category of this.categories) {
      const toggle = category.toggles.find((t) => t.action === action);
      if (toggle) {
        if ((toggle.type === 'select' || toggle.type === 'text' || toggle.type === 'number') && toggle.setValue) {
          toggle.setValue((target as HTMLInputElement | HTMLSelectElement).value);
        } else {
          toggle.set(!toggle.get());
        }
        this.rerenderBody();
        return;
      }
    }
  }
}
