/*******************************************************************************
 * LoomVTT
 * client/windows/tile-config-window.ts
 * 
 * 
 * Window for configuring map tiles.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { windowManager } from '../core/window-manager.js';
import { FilePickerWindow } from './file-picker-window.js';
import { Tabs } from '../components/tabs.js';
import { showConfirm } from '../components/dialog.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { scenesCollection } from '../core/scenes-collection.js';
import { gameContext } from '../core/game-context.js';
import { journalCollection } from '../core/journal-collection.js';

export interface TileTrigger {
  event: 'token-enter' | 'token-exit' | 'token-move-inside' | 'click';
}

export interface TileCondition {
  type: 'user-role-gte' | 'flag-equals';
  value: any;
}

export interface TileAction {
  type: 'teleport' | 'toggle-visibility' | 'play-sound' | 'show-dialog' | 'pause-game' | 'toggle-lock' | 'activate-tile' | 'show-notification' | 'chat-message' | 'floating-text';
  config: Record<string, any>;
}

export interface TileData {
  id: string;
  stageId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imgUrl: string;
  rotation?: number;
  tintColor?: string;
  opacity?: number;
  locked?: boolean;
  isActive: boolean;
  hidden: boolean;
  isOverhead: boolean;
  isRoof?: boolean;
  videoLoop?: boolean;
  videoAutoplay?: boolean;
  videoVolume?: number;
  floors?: string[];
  anchorX?: number;
  anchorY?: number;
  occlusion?: {
    mode?: string;
    radius?: number;
    alpha?: number;
  };
  recipeId?: string;
  triggers?: TileTrigger[];
  conditions?: TileCondition[];
  actions?: TileAction[];
  elevation?: number;
}

interface RecipeField {
  key: string;
  labelKey: string;
  /**
   * 'stage'    — <select> of world scenes (reuses renderStageOptions)
   * 'map-pick' — X/Y pair with button that opens canvas aim (reuses startMapPick)
   * 'tile'     — <select> of scene tiles
   * 'token'    — <select> of scene tokens
   * 'file'     — text field + file picker button
   */
  type: 'number' | 'text' | 'select' | 'checkbox' | 'stage' | 'map-pick' | 'tile' | 'token' | 'file';
  defaultValue: any;
  placeholderKey?: string;
}

interface Recipe {
  id: string;
  nameKey: string;
  icon: string;
  descKey: string;
  fields: RecipeField[];
  buildConfig: () => { triggers: TileTrigger[]; conditions: TileCondition[]; actions: TileAction[] };
}

function input(name: string, val: string | number, extra = ''): string {
  return `<input type="text" name="${name}" value="${val}" ${extra} class="field-input" />`;
}

function label(text: string): string {
  return `<label class="field-label">${text}</label>`;
}

const TRIGGER_EVENTS = ['token-enter', 'token-exit', 'token-move-inside', 'click'];
const ACTION_TYPES = ['teleport', 'toggle-visibility', 'play-sound', 'show-dialog', 'pause-game', 'toggle-lock', 'activate-tile', 'show-notification', 'chat-message', 'floating-text'];
const CONDITION_TYPES = ['user-role-gte', 'flag-equals'];

const RECIPES: Recipe[] = [
  {
    id: 'teleport', nameKey: 'tileConfig.recipe_teleport', icon: '\u{1F300}',
    descKey: 'tileConfig.recipe_teleport_desc',
    fields: [
      { key: 'targetX', labelKey: 'tileConfig.field_destination', type: 'map-pick', defaultValue: 0 },
      { key: 'stageId', labelKey: 'tileConfig.field_targetStage', type: 'stage', defaultValue: '' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'token-enter' }],
      conditions: [],
      actions: [{ type: 'teleport', config: { targetX: 0, targetY: 0, stageId: '' } }],
    }),
  },
  {
    id: 'trap', nameKey: 'tileConfig.recipe_trap', icon: '\u26A1',
    descKey: 'tileConfig.recipe_trap_desc',
    fields: [
      { key: 'content', labelKey: 'tileConfig.recipe_trap_message', type: 'text', defaultValue: 'Uma armadilha foi ativada!', placeholderKey: 'tileConfig.recipe_trap_message_placeholder' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'token-enter' }],
      conditions: [],
      actions: [
        { type: 'chat-message', config: { content: 'Uma armadilha foi ativada!' } },
        { type: 'activate-tile', config: { active: false } },
      ],
    }),
  },
  {
    id: 'secret-door', nameKey: 'tileConfig.recipe_secret_door', icon: '\u{1F6AA}',
    descKey: 'tileConfig.recipe_secret_door_desc',
    fields: [
      { key: 'targetTileId', labelKey: 'tileConfig.field_targetTile', type: 'tile', defaultValue: '' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'click' }],
      conditions: [],
      actions: [{ type: 'toggle-visibility', config: { targetTokenId: '', visible: false } }],
    }),
  },
  {
    id: 'scene-passage', nameKey: 'tileConfig.recipe_scene_passage', icon: '\u{1F30D}',
    descKey: 'tileConfig.recipe_scene_passage_desc',
    fields: [
      { key: 'stageId', labelKey: 'tileConfig.field_targetStage', type: 'stage', defaultValue: '' },
      { key: 'targetX', labelKey: 'tileConfig.field_destination', type: 'map-pick', defaultValue: 0 },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'token-enter' }],
      conditions: [],
      actions: [{ type: 'teleport', config: { targetX: 0, targetY: 0, stageId: '' } }],
    }),
  },
  {
    id: 'sign', nameKey: 'tileConfig.recipe_sign', icon: '\u{1F4D6}',
    descKey: 'tileConfig.recipe_sign_desc',
    fields: [
      { key: 'title', labelKey: 'tileConfig.field_dialogTitle', type: 'text', defaultValue: '', placeholderKey: 'tileConfig.field_dialogTitle' },
      { key: 'content', labelKey: 'tileConfig.field_dialogContent', type: 'text', defaultValue: '', placeholderKey: 'tileConfig.field_dialogContent' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'click' }],
      conditions: [],
      actions: [{ type: 'show-dialog', config: { title: '', content: '', imageUrl: '' } }],
    }),
  },
  {
    id: 'ambient-sound', nameKey: 'tileConfig.recipe_ambient_sound', icon: '\u{1F50A}',
    descKey: 'tileConfig.recipe_ambient_sound_desc',
    fields: [
      { key: 'soundUrl', labelKey: 'tileConfig.field_soundUrl', type: 'file', defaultValue: '' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'token-enter' }],
      conditions: [],
      actions: [{ type: 'play-sound', config: { soundUrl: '', volume: 1 } }],
    }),
  },
  {
    id: 'ambush', nameKey: 'tileConfig.recipe_ambush', icon: '\u{1F5E1}',
    descKey: 'tileConfig.recipe_ambush_desc',
    fields: [
      { key: 'targetTokenId', labelKey: 'tileConfig.field_targetToken', type: 'token', defaultValue: '' },
    ],
    buildConfig: () => ({
      triggers: [{ event: 'token-enter' }],
      conditions: [],
      actions: [{ type: 'toggle-visibility', config: { targetTokenId: '', visible: true } }],
    }),
  },
];

export class TileConfigWindow extends BaseWindow {
  private tile: TileData | null = null;
  private tabs: Tabs;
  private recipeFields: Record<string, any> = {};
  private showingAdvanced = false;
  private canvasPickActionIdx = -1;

  constructor(private props: { id: string; tileId: string }) {
    super({
      id: props.id,
      title: t('tileConfig.title'),
      icon: '<i class="fa-solid fa-image"></i>',
      width: 'auto',
      height: 'auto',
      bannerImage: '/images/general-banners/portal-banner.png'
    });
    this.tabs = new Tabs([
      { id: 'info', label: t('tileConfig.sectionInfo'), icon: 'fa-solid fa-circle-info' },
      { id: 'position', label: t('tileConfig.sectionPosition'), icon: 'fa-solid fa-arrows-up-down-left-right' },
      { id: 'appearance', label: t('tileConfig.sectionAppearance'), icon: 'fa-solid fa-palette' },
      { id: 'floors', label: t('tileConfig.sectionFloors'), icon: 'fa-solid fa-layer-group' },
      { id: 'video', label: t('tileConfig.sectionVideo'), icon: 'fa-solid fa-video' },
      { id: 'triggers', label: t('tileConfig.sectionTriggers'), icon: 'fa-solid fa-bolt' },
    ]);
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-tabs-fixed');
    }
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.tile = await api.get<TileData>(`/tiles/${this.props.tileId}`);

      // If tile has a recipeId, seed recipeFields from config
      if (this.tile.recipeId) {
        const recipe = RECIPES.find((r) => r.id === this.tile!.recipeId);
        this.showingAdvanced = false;
        this.recipeFields = {};
        if (recipe) {
          for (const f of recipe.fields) {
            // Try to find the field value from actions config
            let found = false;
            for (const act of this.tile.actions ?? []) {
              if (act.config && f.key in act.config) {
                this.recipeFields[f.key] = act.config[f.key];
                found = true;
                break;
              }
            }
            if (!found) {
              this.recipeFields[f.key] = f.defaultValue;
            }
          }
        }
      } else {
        this.showingAdvanced = (this.tile.triggers?.length ?? 0) > 0 || (this.tile.conditions?.length ?? 0) > 0 || (this.tile.actions?.length ?? 0) > 0;
      }

      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || t('tileConfig.loadError'), 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.tile) {
      return `<div class="empty-panel">${t('common.loading')}</div>`;
    }

    const tile = this.tile;

    const infoHtml = `
      ${label(t('tileConfig.nameLabel'))}
      ${input('name', tile.name, 'required')}
      ${label(t('tileConfig.imagePath'))}
      <div class="field-row">
        ${input('imgUrl', tile.imgUrl, 'required')}
        <button type="button" class="btn" id="pick-tile-img-btn" title="${t('tileConfig.pickFile')}" style="flex-shrink:0;">📁</button>
      </div>
      <div class="field-row">
        <input type="checkbox" name="isActive" id="tile-active" ${tile.isActive ? 'checked' : ''} style="cursor:pointer;" />
        <label for="tile-active" class="checkbox-label">${t('tileConfig.active')}</label>
      </div>
      <div class="field-row">
        <input type="checkbox" name="hidden" id="tile-hidden" ${tile.hidden ? 'checked' : ''} style="cursor:pointer;" />
        <label for="tile-hidden" class="checkbox-label">${t('tileConfig.hidden')}</label>
      </div>
    `;

    const positionHtml = `
      <div class="field-row">
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.positionX'))}
          ${input('x', tile.x)}
        </div>
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.positionY'))}
          ${input('y', tile.y)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.width'))}
          ${input('width', tile.width)}
        </div>
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.height'))}
          ${input('height', tile.height)}
        </div>
      </div>
      <div class="field-stack">
        ${label(t('tileConfig.rotation'))}
        ${input('rotation', tile.rotation ?? 0)}
      </div>
      <div class="field-stack">
        ${label(t('common.elevation') || 'Elevação')}
        ${input('elevation', tile.elevation ?? 0)}
      </div>
    `;

    const appearanceHtml = `
      <div class="field-stack">
        ${label(t('tileConfig.opacity'))}
        <div class="range-input-group">
          <input type="range" name="opacity" min="0" max="100" step="1" value="${Math.round((tile.opacity ?? 1) * 100)}" oninput="this.nextElementSibling.value = this.value + '%'" />
          <input type="text" class="range-value opacity-val" value="${Math.round((tile.opacity ?? 1) * 100)}%" readonly />
        </div>
      </div>
      <div class="field-stack">
        ${label(t('tileConfig.tintColor'))}
        <div class="color-input-group-full">
          <input type="color" name="tintColor" value="${tile.tintColor || '#ffffff'}" />
          <input type="text" name="tintColor" class="field-input input-flex-1" value="${tile.tintColor || '#ffffff'}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.anchorX'))}
          <input type="number" name="anchorX" value="${tile.anchorX ?? 0.5}" min="0" max="1" step="0.05" class="field-input" />
        </div>
        <div class="field-stack" style="flex:1;">
          ${label(t('tileConfig.anchorY'))}
          <input type="number" name="anchorY" value="${tile.anchorY ?? 0.5}" min="0" max="1" step="0.05" class="field-input" />
        </div>
      </div>
      <div class="field-row">
        <input type="checkbox" name="locked" id="tile-locked" ${tile.locked ? 'checked' : ''} style="cursor:pointer;" />
        <label for="tile-locked" class="checkbox-label">${t('tileConfig.locked')}</label>
      </div>
    `;

    const floorsHtml = `
      ${label(t('tileConfig.floorsLabel'))}
      ${input('floors', (tile.floors ?? []).join(', '))}
      <small style="font-size:0.7rem;color:var(--color-text-muted);">${t('tileConfig.floorsHint')}</small>
    `;

    const videoHtml = `
      <p style="margin:0;font-size:0.75rem;color:var(--color-text-muted);">${t('tileConfig.videoHint')}</p>
      <div class="field-row">
        <input type="checkbox" name="videoLoop" id="tile-video-loop" ${tile.videoLoop !== false ? 'checked' : ''} style="cursor:pointer;" />
        <label for="tile-video-loop" class="checkbox-label">${t('tileConfig.videoLoop')}</label>
      </div>
      <div class="field-row">
        <input type="checkbox" name="videoAutoplay" id="tile-video-autoplay" ${tile.videoAutoplay !== false ? 'checked' : ''} style="cursor:pointer;" />
        <label for="tile-video-autoplay" class="checkbox-label">${t('tileConfig.videoAutoplay')}</label>
      </div>
      <div class="field-stack">
        ${label(t('tileConfig.videoVolume'))}
        <div class="range-input-group">
          <input type="range" name="videoVolume" min="0" max="100" step="1" value="${Math.round((tile.videoVolume ?? 1) * 100)}" oninput="this.nextElementSibling.value = this.value + '%'" />
          <input type="text" class="range-value video-volume-val" value="${Math.round((tile.videoVolume ?? 1) * 100)}%" readonly />
        </div>
      </div>
    `;

    const triggersHtml = this.renderTriggersTab();

    return `
<div class="banner-spacer"></div>
${this.tabs.navTemplate()}
<form class="tile-config-form loom-form" style="display:flex;flex-direction:column;flex:auto;min-height:0;">
  ${this.tabs.contentWrapper('info', `<div class="field-stack">${infoHtml}</div>`)}
  ${this.tabs.contentWrapper('position', `<div class="field-stack">${positionHtml}</div>`)}
  ${this.tabs.contentWrapper('appearance', `<div class="field-stack">${appearanceHtml}</div>`)}
  ${this.tabs.contentWrapper('floors', `<div class="field-stack">${floorsHtml}</div>`)}
  ${this.tabs.contentWrapper('video', `<div class="field-stack">${videoHtml}</div>`)}
  ${this.tabs.contentWrapper('triggers', triggersHtml)}
</form>`;
  }

  private renderTriggersTab(): string {
    const tile = this.tile!;
    const hasConfig = (tile.triggers?.length ?? 0) > 0 || (tile.conditions?.length ?? 0) > 0 || (tile.actions?.length ?? 0) > 0;

    // Show recipe gallery if no config and not showing advanced
    if (!hasConfig && !tile.recipeId && !this.showingAdvanced) {
      return this.renderRecipeGallery();
    }

    // Show recipe adjustment screen if tile has a recipeId (and not in advanced mode)
    if (tile.recipeId && !this.showingAdvanced) {
      return this.renderRecipeConfig();
    }

    // Advanced builder with summary
    return this.renderAdvancedBuilder();
  }

  private renderRecipeGallery(): string {
    return `
      <div class="field-stack">
        <p style="margin:0;font-size:0.8rem;color:var(--color-text-muted);margin-bottom:0.5rem;">
          ${t('tileConfig.recipeGalleryHint')}
        </p>
        <p style="margin:0;font-size:0.75rem;color:var(--color-text-muted);margin-bottom:1rem;">
          ${t('tileConfig.triggersHint')}<br/>
          <em>${t('tileConfig.modelExplanation')}</em>
        </p>
        <div class="card-grid" style="padding:0;">
          ${RECIPES.map((r) => `
            <div class="card card-sm recipe-card" data-action="apply-recipe" data-id="${r.id}"
                 style="text-align:center;padding:1rem;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
              <span style="font-size:2rem;">${r.icon}</span>
              <strong class="card-title" style="padding:0;font-size:0.85rem;">${t(r.nameKey)}</strong>
              <span style="font-size:0.7rem;color:var(--color-text-muted);">${t(r.descKey)}</span>
            </div>
          `).join('')}
          <div class="card card-sm recipe-card" data-action="show-advanced"
               style="text-align:center;padding:1rem;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;border-style:dashed;">
            <span style="font-size:1.5rem;opacity:0.5;">{ }</span>
            <strong class="card-title" style="padding:0;font-size:0.85rem;">${t('tileConfig.recipe_advanced')}</strong>
            <span style="font-size:0.7rem;color:var(--color-text-muted);">${t('tileConfig.recipe_advanced_desc')}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderRecipeConfig(): string {
    const tile = this.tile!;
    const recipe = RECIPES.find((r) => r.id === tile.recipeId);
    if (!recipe) return this.renderAdvancedBuilder();

    const summary = this.generateSummary();
    const fieldHtml = recipe.fields.map((f) => {
      const val = this.recipeFields[f.key] ?? f.defaultValue ?? '';
      switch (f.type) {
        case 'stage':
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <select class="field-input recipe-field" data-recipe-field="${f.key}">
                <option value="">${t('tileConfig.stageSame')}</option>
                ${this.renderStageOptions(String(val))}
              </select>
            </div>`;
        case 'map-pick': {
          // Reuses startMapPick(0): the recipe always builds a single action, so the
          // index is 0. The picker saves targetX/targetY directly in tile.actions[0].config
          // and calls rerenderBody(), which rehydrates this.recipeFields.
          const x = this.recipeFields['targetX'] ?? 0;
          const y = this.recipeFields['targetY'] ?? 0;
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <div class="field-row" style="gap:0.5rem;align-items:center;">
                <input type="number" class="field-input recipe-field" data-recipe-field="targetX"
                       value="${this.esc(String(x))}" style="flex:1;min-width:0;" />
                <input type="number" class="field-input recipe-field" data-recipe-field="targetY"
                       value="${this.esc(String(y))}" style="flex:1;min-width:0;" />
                <button type="button" class="btn" data-action="recipe-pick-map" style="flex:0 0 auto;">
                  ${t('tileConfig.pickOnMap')}
                </button>
              </div>
            </div>`;
        }
        case 'tile':
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <select class="field-input recipe-field" data-recipe-field="${f.key}">
                <option value="">${t('tileConfig.tileNone')}</option>
                ${this.renderTileOptions(String(val))}
              </select>
            </div>`;
        case 'token':
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <select class="field-input recipe-field" data-recipe-field="${f.key}">
                <option value="">${t('tileConfig.tokenActivator')}</option>
                ${this.renderTokenOptions(String(val))}
              </select>
            </div>`;
        case 'file':
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <div class="field-row" style="gap:0.5rem;align-items:center;">
                <input type="text" class="field-input recipe-field" data-recipe-field="${f.key}"
                       value="${this.esc(String(val))}" style="flex:1;min-width:0;" />
                <button type="button" class="btn" data-action="recipe-pick-file"
                        data-recipe-field="${f.key}" style="flex:0 0 auto;">
                  <i class="fa-solid fa-folder-open"></i>
                </button>
              </div>
            </div>`;
        case 'number':
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <input type="number" class="field-input recipe-field" data-recipe-field="${f.key}" value="${this.esc(String(val))}" />
            </div>`;
        case 'checkbox':
          return `
            <div class="field-row">
              <input type="checkbox" class="recipe-field" data-recipe-field="${f.key}" id="rf-${f.key}" ${val ? 'checked' : ''} />
              <label for="rf-${f.key}" class="checkbox-label">${t(f.labelKey)}</label>
            </div>`;
        default:
          return `
            <div class="field-stack">
              ${label(t(f.labelKey))}
              <input type="text" class="field-input recipe-field" data-recipe-field="${f.key}" value="${this.esc(String(val))}" placeholder="${f.placeholderKey ? t(f.placeholderKey) : ''}" />
            </div>`;
      }
    }).join('');

    return `
      <div class="field-stack">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
          <span style="font-size:1.5rem;">${recipe.icon}</span>
          <strong>${t(recipe.nameKey)}</strong>
        </div>
        ${summary ? `<p style="margin:0;font-size:0.8rem;color:var(--color-text-secondary);padding:0.3rem 0.5rem;background:var(--color-bg-highlight,rgba(228,154,66,0.1));border-radius:4px;margin-bottom:0.5rem;">${summary}</p>` : ''}
        ${fieldHtml}
        <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" data-action="save-recipe">${t('tileConfig.saveRecipe')}</button>
          <button type="button" class="btn" data-action="recipe-test">${t('tileConfig.testButton')}</button>
          <button type="button" class="btn btn-sm" data-action="convert-advanced">${t('tileConfig.convertAdvanced')}</button>
        </div>
      </div>
    `;
  }

  private renderAdvancedBuilder(): string {
    const tile = this.tile!;
    const triggers = tile.triggers ?? [];
    const conditions = tile.conditions ?? [];
    const actions = tile.actions ?? [];

    const hasConfig = triggers.length > 0 || conditions.length > 0 || actions.length > 0;
    const summary = this.generateSummary();

    const triggerRows = triggers.map((tr, i) => `
      <div class="field-row" style="align-items:center;">
        <select data-trigger-idx="${i}" class="settings-select trigger-event-select" style="flex:1;">
          ${TRIGGER_EVENTS.map((ev) => `<option value="${ev}" ${ev === tr.event ? 'selected' : ''}>${t(`tileConfig.event_${ev.replace(/-/g, '_')}`)}</option>`).join('')}
        </select>
        <button type="button" class="btn" data-action="remove-trigger" data-id="${i}" title="${t('common.delete')}">✕</button>
      </div>
    `).join('') || `<p style="font-size:0.75rem;color:var(--color-text-muted);">${t('tileConfig.noneYet')}</p>`;

    const ROLES = ['none', 'player', 'trusted', 'assistant', 'gamemaster'];

    const conditionRows = conditions.map((c, i) => `
      <div class="field-row" style="align-items:center;">
        <select data-condition-idx="${i}" class="settings-select condition-type-select" style="flex:1;">
          ${CONDITION_TYPES.map((ct) => `<option value="${ct}" ${ct === c.type ? 'selected' : ''}>${t(`tileConfig.condition_${ct.replace(/-/g, '_')}`)}</option>`).join('')}
        </select>
        ${c.type === 'user-role-gte'
        ? `<select data-condition-idx="${i}" class="settings-select condition-role-select" style="flex:1;">
               ${ROLES.map((name, rv) => `<option value="${rv}" ${rv === Number(c.value) ? 'selected' : ''}>${t(`tileConfig.role_${name}`)}</option>`).join('')}
             </select>`
        : `<input type="text" class="field-input condition-value-input" data-condition-idx="${i}" value="${this.esc(String(c.value ?? ''))}" placeholder="chave=valor" style="flex:1;" />`
      }
        <button type="button" class="btn" data-action="remove-condition" data-id="${i}" title="${t('common.delete')}">✕</button>
      </div>
    `).join('') || `<p style="font-size:0.75rem;color:var(--color-text-muted);">${t('tileConfig.noneYet')}</p>`;

    const actionRows = actions.map((a, i) => `
      <div class="field-stack" style="border:1px solid var(--color-border);border-radius:4px;padding:0.4rem;margin-bottom:0.4rem;">
        <div class="field-row" style="align-items:center;">
          <select data-action-idx="${i}" class="settings-select action-type-select" style="flex:1;">
            ${ACTION_TYPES.map((at) => `<option value="${at}" ${at === a.type ? 'selected' : ''}>${t(`tileConfig.action_${at.replace(/-/g, '_')}`)}</option>`).join('')}
          </select>
          <button type="button" class="btn" data-action="remove-action" data-id="${i}" title="${t('common.delete')}">✕</button>
        </div>
        ${this.renderActionConfig(a, i)}
      </div>
    `).join('') || `<p style="font-size:0.75rem;color:var(--color-text-muted);">${t('tileConfig.noneYet')}</p>`;

    return `
      <div class="field-stack">
        ${summary ? `<div class="field-row" style="justify-content:space-between;align-items:flex-start;">
          <p style="margin:0;font-size:0.8rem;color:var(--color-text-secondary);padding:0.3rem 0.5rem;background:var(--color-bg-highlight,rgba(228,154,66,0.1));border-radius:4px;flex:1;">${summary}</p>
        </div>` : ''}

        <p style="margin:0;font-size:0.75rem;color:var(--color-text-muted);">${t('tileConfig.triggersHint')}</p>

        ${!hasConfig ? `<p style="font-size:0.75rem;color:var(--color-text-muted);font-style:italic;">${t('tileConfig.modelExplanation')}<br/>${t('tileConfig.emptyAdvancedHint')}</p>` : ''}

        <div class="field-stack">
          <div class="field-row" style="justify-content:space-between;align-items:center;">
            ${label(t('tileConfig.triggersLabel'))}
            <button type="button" class="btn" data-action="add-trigger">+ ${t('tileConfig.triggersLabel')}</button>
          </div>
          ${triggerRows}
        </div>

        <div class="field-stack">
          <div class="field-row" style="justify-content:space-between;align-items:center;">
            ${label(t('tileConfig.conditionsLabel'))}
            <button type="button" class="btn" data-action="add-condition">+ ${t('tileConfig.conditionsLabel')}</button>
          </div>
          ${conditionRows}
        </div>

        <div class="field-stack">
          <div class="field-row" style="justify-content:space-between;align-items:center;">
            ${label(t('tileConfig.actionsLabel'))}
            <button type="button" class="btn" data-action="add-action">+ ${t('tileConfig.actionsLabel')}</button>
          </div>
          ${actionRows}
        </div>

        <div style="margin-top:0.5rem;display:flex;gap:0.5rem;">
          <button type="button" class="btn" data-action="advanced-test">${t('tileConfig.testButton')}</button>
          ${tile.recipeId ? `<button type="button" class="btn btn-sm" data-action="back-to-recipe">${t('tileConfig.backToRecipe')}</button>` : ''}
        </div>
      </div>
    `;
  }

  private generateSummary(): string {
    const tile = this.tile;
    if (!tile) return '';
    const triggers = tile.triggers ?? [];
    const conditions = tile.conditions ?? [];
    const actions = tile.actions ?? [];
    if (triggers.length === 0 && actions.length === 0) return '';

    const eventLabels: Record<string, string> = {
      'token-enter': t('tileConfig.event_token_enter'),
      'token-exit': t('tileConfig.event_token_exit'),
      'token-move-inside': t('tileConfig.event_token_move_inside'),
      'click': t('tileConfig.event_click'),
    };
    const actionLabels: Record<string, (c: Record<string, any>) => string> = {
      'teleport': (c) => {
        const dest = c.stageId || `(${c.targetX ?? '?'}, ${c.targetY ?? '?'})`;
        return `${t('tileConfig.summary_teleports_to')} ${dest}`;
      },
      'toggle-visibility': () => t('tileConfig.summary_toggles_visibility'),
      'play-sound': () => t('tileConfig.summary_plays_sound'),
      'show-dialog': () => t('tileConfig.summary_shows_dialog'),
      'pause-game': () => t('tileConfig.summary_pauses_game'),
      'toggle-lock': () => t('tileConfig.summary_toggles_lock'),
      'activate-tile': (c) => `${c.active === false ? t('tileConfig.summary_deactivates') : t('tileConfig.summary_activates')} ${t('tileConfig.summary_this_tile')}`,
      'chat-message': () => t('tileConfig.summary_sends_message'),
      'show-notification': () => t('tileConfig.summary_shows_notification'),
      'floating-text': (c) => `${t('tileConfig.summary_floating_text')}${c.text ? `: "${c.text}"` : ''}`,
    };

    const when = triggers.map((tr) => eventLabels[tr.event] || tr.event).join(', ');
    const what = actions.map((a) => {
      const fn = actionLabels[a.type];
      return fn ? fn(a.config ?? {}) : a.type;
    }).join(', ');

    // No `summary_when` prefix: the event labels (`event_token_enter` etc) are already
    // complete sentences starting with "When" — they are the same texts from the trigger <select>
    // where the whole phrase is needed. Concatenating both generated
    // "When When a token enters". Fix here, not by shortening the label,
    // because the label has the other use.
    if (conditions.length > 0 && triggers.length > 0) {
      return `${when}, ${t('tileConfig.summary_if')} ${t('tileConfig.summary_conditions_met')}, ${what}.`;
    }
    if (triggers.length > 0 && actions.length > 0) {
      return `${when}, ${what}.`;
    }
    if (actions.length > 0) {
      return `${what}.`;
    }
    return '';
  }

  private startMapPick(actionIdx: number): void {
    const cm = CanvasManager.activeInstance;
    if (!cm || !this.tile) return;
    const action = this.tile.actions?.[actionIdx];
    if (!action) return;

    // If target stage differs from current, disable pick with explanation
    if (action.config.stageId && action.config.stageId !== this.tile.stageId) {
      showToast(t('tileConfig.pickMapOtherStage'), 'info');
      return;
    }

    this.canvasPickActionIdx = actionIdx;

    // Set up one-shot canvas click
    const handler = (x: number, y: number) => {
      if (!this.tile || this.canvasPickActionIdx < 0) return;
      const act = this.tile.actions?.[this.canvasPickActionIdx];
      if (act) {
        act.config.targetX = x;
        act.config.targetY = y;
        this.canvasPickActionIdx = -1;
        cm.setOnCanvasClickPick(null);
        this.rerenderBody();
        showToast(t('tileConfig.pickMapDone'), 'success');
      }
    };

    cm.setOnCanvasClickPick(handler);
    showToast(t('tileConfig.pickMapHint'), 'info');
  }

  private renderStageOptions(selectedId: string): string {
    return scenesCollection.contents.map((s) =>
      `<option value="${this.esc(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${this.esc(s.name)}</option>`
    ).join('');
  }

  private renderTileOptions(selectedId: string): string {
    const cm = CanvasManager.activeInstance;
    if (!cm) return '';
    const tiles = Array.from(cm.getTileData().values()).filter((t) => t.id !== this.tile?.id);
    return tiles.map((t) => {
      const label = t.name || `Tile (${(t.imgUrl || '').split('/').pop() || 'no image'})`;
      return `<option value="${this.esc(t.id)}" ${t.id === selectedId ? 'selected' : ''}>${this.esc(label)}</option>`;
    }).join('');
  }

  /**
   * Only the token <option>s. Exists because renderTokenSelector returns the full
   * block with radio (used in advanced builder), and the recipe only needs
   * the list for a simple <select>.
   */
  private renderTokenOptions(selectedId: string): string {
    const cm = CanvasManager.activeInstance;
    const tokens: Array<{ id: string; name?: string }> = [];
    if (cm) tokens.push(...Array.from(cm.getTokenData().values()));
    if (tokens.length === 0 && this.tile) {
      const stage = scenesCollection.get(this.tile.stageId);
      if (stage) tokens.push(...stage.tokens.contents);
    }
    return tokens.map((tk) =>
      `<option value="${this.esc(tk.id)}" ${tk.id === selectedId ? 'selected' : ''}>${this.esc(tk.name || tk.id.slice(0, 8))}</option>`
    ).join('');
  }

  private renderTokenSelector(idx: number, currentTokenId?: string): string {
    const isSpecific = !!currentTokenId;
    const cm = CanvasManager.activeInstance;
    const tokens: Array<{ id: string; name?: string }> = [];
    if (cm) {
      tokens.push(...Array.from(cm.getTokenData().values()));
    }
    // Also try from scenesCollection for the tile's stage
    if (tokens.length === 0 && this.tile) {
      const stage = scenesCollection.get(this.tile.stageId);
      if (stage) tokens.push(...stage.tokens.contents);
    }

    const tokenOpts = tokens.map((t) =>
      `<option value="${this.esc(t.id)}" ${t.id === currentTokenId ? 'selected' : ''}>${this.esc(t.name || t.id.slice(0, 8))}</option>`
    ).join('');

    return `
      <div class="field-stack">
        ${label(t('tileConfig.field_targetToken'))}
        <div class="field-row" style="gap:0.5rem;align-items:center;">
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;cursor:pointer;">
            <input type="radio" name="token-mode-${idx}" class="token-mode-radio" data-action-idx="${idx}" value="" ${!isSpecific ? 'checked' : ''} />
            ${t('tileConfig.tokenActivator')}
          </label>
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;cursor:pointer;">
            <input type="radio" name="token-mode-${idx}" class="token-mode-radio" data-action-idx="${idx}" value="specific" ${isSpecific ? 'checked' : ''} />
            ${t('tileConfig.tokenSpecific')}
          </label>
        </div>
        <select class="settings-select action-field token-specific-select" data-action-idx="${idx}" data-field="targetTokenId" style="${isSpecific ? '' : 'display:none;'}">
          <option value="">${t('tileConfig.selectToken')}</option>
          ${tokenOpts}
        </select>
      </div>
    `;
  }

  private renderRecipientOptions(current?: string): string {
    const opts = [
      { value: 'trigger', label: 'tileConfig.recipientActivator' },
      { value: 'all', label: 'tileConfig.recipientAll' },
      { value: 'gm', label: 'tileConfig.recipientGM' },
      { value: 'trigger+gm', label: 'tileConfig.recipientTriggerGM' },
    ];
    const selected = current || 'trigger';
    return opts.map((r) =>
      `<option value="${r.value}" ${r.value === selected ? 'selected' : ''}>${t(r.label)}</option>`
    ).join('');
  }

  private renderRecipientField(idx: number, current?: string): string {
    return `
      ${label(t('tileConfig.field_recipient'))}
      <select class="settings-select action-field" data-action-idx="${idx}" data-field="recipient">
        ${this.renderRecipientOptions(current)}
      </select>
    `;
  }

  private renderShowDialogConfig(action: TileAction, idx: number): string {
    const cfg = action.config ?? {};
    const isJournal = !!cfg.journalId;

    const journalOpts = journalCollection.contents.map((j) =>
      `<option value="${this.esc(j.id)}" ${j.id === cfg.journalId ? 'selected' : ''}>${this.esc(j.name)}</option>`
    ).join('');

    const journal = cfg.journalId ? journalCollection.get(cfg.journalId) : null;
    const pages = journal?.pages ?? [];
    const pageOpts = pages.map((p: any) =>
      `<option value="${this.esc(p.id)}" ${p.id === cfg.pageId ? 'selected' : ''}>${this.esc(p.name || 'Untitled')}</option>`
    ).join('');

    const modeRadio = `
      <div class="field-row" style="gap:0.5rem;align-items:center;margin-bottom:0.4rem;">
        <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;cursor:pointer;">
          <input type="radio" name="dialog-mode-${idx}" class="dialog-mode-radio" data-action-idx="${idx}" value="text" ${!isJournal ? 'checked' : ''} />
          ${t('tileConfig.dialogModeText')}
        </label>
        <label style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;cursor:pointer;">
          <input type="radio" name="dialog-mode-${idx}" class="dialog-mode-radio" data-action-idx="${idx}" value="journal" ${isJournal ? 'checked' : ''} />
          ${t('tileConfig.dialogModeJournal')}
        </label>
      </div>
    `;

    const textFields = `
      <div id="dialog-text-fields-${idx}" style="${isJournal ? 'display:none;' : ''}">
        <div class="field-stack">
          ${label(t('tileConfig.field_dialogTitle'))}
          <input type="text" class="field-input action-field" data-action-idx="${idx}" data-field="title" value="${this.esc(String(cfg.title ?? ''))}" />
        </div>
        <div class="field-stack">
          ${label(t('tileConfig.field_dialogContent'))}
          <textarea class="field-input action-field" data-action-idx="${idx}" data-field="content" rows="2">${this.esc(String(cfg.content ?? ''))}</textarea>
        </div>
        <div class="field-stack">
          ${label(t('tileConfig.field_dialogImage'))}
          <div class="field-row">
            <input type="text" class="field-input action-field" data-action-idx="${idx}" data-field="imageUrl" value="${this.esc(String(cfg.imageUrl ?? ''))}" style="flex:1;" />
            <button type="button" class="btn" data-action="pick-dialog-image" data-id="${idx}" title="${t('tileConfig.pickFile')}" style="flex-shrink:0;">📁</button>
          </div>
        </div>
      </div>
    `;

    const journalFields = `
      <div id="dialog-journal-fields-${idx}" style="${isJournal ? '' : 'display:none;'}">
        <div class="field-stack">
          ${label(t('tileConfig.field_journal'))}
          <select class="settings-select dialog-journal-select action-field" data-action-idx="${idx}" data-field="journalId">
            <option value="">${t('tileConfig.selectJournal')}</option>
            ${journalOpts}
          </select>
        </div>
        <div class="field-stack">
          ${label(t('tileConfig.field_journalPage'))}
          <select class="settings-select action-field" data-action-idx="${idx}" data-field="pageId">
            <option value="">${t('tileConfig.selectPage')}</option>
            ${pageOpts}
          </select>
        </div>
      </div>
    `;

    return `
      <div class="field-stack">
        ${modeRadio}
        ${textFields}
        ${journalFields}
        <div class="field-stack">
          ${this.renderRecipientField(idx, cfg.recipient)}
        </div>
      </div>
    `;
  }

  private renderActionConfig(action: TileAction, idx: number): string {
    const cfg = action.config ?? {};
    switch (action.type) {
      case 'teleport':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_stageId'))}
            <select class="settings-select action-field" data-action-idx="${idx}" data-field="stageId">
              <option value="">${t('tileConfig.sameStage')}</option>
              ${this.renderStageOptions(cfg.stageId ?? '')}
            </select>
          </div>
          <div class="field-row">
            <div class="field-stack" style="flex:1;">
              ${label(t('tileConfig.field_targetX'))}
              <input type="number" class="field-input action-field" data-action-idx="${idx}" data-field="targetX" value="${this.esc(String(cfg.targetX ?? ''))}" />
            </div>
            <div class="field-stack" style="flex:1;">
              ${label(t('tileConfig.field_targetY'))}
              <input type="number" class="field-input action-field" data-action-idx="${idx}" data-field="targetY" value="${this.esc(String(cfg.targetY ?? ''))}" />
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-block" data-action="pick-map-dest" data-id="${idx}" style="margin-bottom:0.4rem;">${t('tileConfig.pickMapDest')}</button>
          ${this.renderTokenSelector(idx, cfg.targetTokenId)}
        `;
      case 'toggle-visibility':
        return `
          <div class="field-row">
            <input type="checkbox" class="action-field" data-action-idx="${idx}" data-field="visible" id="action-${idx}-visible" ${cfg.visible === true ? 'checked' : ''} />
            <label for="action-${idx}-visible" class="checkbox-label">${t('tileConfig.field_visible')}</label>
          </div>
          ${this.renderTokenSelector(idx, cfg.targetTokenId)}
        `;
      case 'play-sound':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_soundUrl'))}
            <div class="field-row">
              <input type="text" class="field-input action-field" data-action-idx="${idx}" data-field="soundUrl" value="${this.esc(String(cfg.soundUrl ?? ''))}" style="flex:1;" />
              <button type="button" class="btn" data-action="pick-sound" data-id="${idx}" title="${t('tileConfig.pickFile')}" style="flex-shrink:0;">📁</button>
            </div>
          </div>
          <div class="field-stack">
            ${label(t('tileConfig.field_volume'))}
            <div class="range-input-group">
              <input type="range" class="action-field" data-action-idx="${idx}" data-field="volume" min="0" max="100" step="1" value="${Math.round((cfg.volume ?? 1) * 100)}" oninput="this.nextElementSibling.value = this.value + '%'" />
              <input type="text" class="range-value" value="${Math.round((cfg.volume ?? 1) * 100)}%" readonly />
            </div>
          </div>
          <div class="field-stack">
            ${this.renderRecipientField(idx, cfg.recipient)}
          </div>
        `;
      case 'show-dialog':
        return this.renderShowDialogConfig(action, idx);
      case 'pause-game':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_duration'))}
            <input type="number" class="field-input action-field" data-action-idx="${idx}" data-field="duration" value="${this.esc(String(cfg.duration ?? ''))}" min="0" step="0.5" placeholder="0" />
          </div>
        `;
      case 'toggle-lock':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_targetTileId'))}
            <select class="settings-select action-field" data-action-idx="${idx}" data-field="targetTileId">
              <option value="">${t('tileConfig.selectTile')}</option>
              ${this.renderTileOptions(cfg.targetTileId ?? '')}
            </select>
          </div>
          <div class="field-row">
            <input type="checkbox" class="action-field" data-action-idx="${idx}" data-field="locked" id="action-${idx}-locked" ${cfg.locked === true ? 'checked' : ''} />
            <label for="action-${idx}-locked" class="checkbox-label">${t('tileConfig.field_locked')}</label>
          </div>
        `;
      case 'activate-tile':
        return `
          <div class="field-row">
            <input type="checkbox" class="action-field" data-action-idx="${idx}" data-field="active" id="action-${idx}-active" ${cfg.active !== false ? 'checked' : ''} />
            <label for="action-${idx}-active" class="checkbox-label">${t('tileConfig.field_active')}</label>
          </div>
        `;
      case 'show-notification':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_notificationMessage'))}
            <input type="text" class="field-input action-field" data-action-idx="${idx}" data-field="message" value="${this.esc(String(cfg.message ?? ''))}" />
          </div>
          <div class="field-row">
            <input type="checkbox" class="action-field" data-action-idx="${idx}" data-field="persistent" id="action-${idx}-persistent" ${cfg.persistent === true ? 'checked' : ''} />
            <label for="action-${idx}-persistent" class="checkbox-label">${t('tileConfig.field_persistent')}</label>
          </div>
          <div class="field-stack">
            ${this.renderRecipientField(idx, cfg.recipient)}
          </div>
        `;
      case 'chat-message':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_chatMessage'))}
            <textarea class="field-input action-field" data-action-idx="${idx}" data-field="message" rows="2">${this.esc(String(cfg.message ?? ''))}</textarea>
          </div>
        `;
      case 'floating-text':
        return `
          <div class="field-stack">
            ${label(t('tileConfig.field_floatingText'))}
            <input type="text" class="field-input action-field" data-action-idx="${idx}" data-field="text" value="${this.esc(String(cfg.text ?? ''))}" />
          </div>
          <div class="field-stack">
            ${label(t('tileConfig.field_floatingColor'))}
            <input type="color" class="field-input action-field" data-action-idx="${idx}" data-field="color" value="${this.esc(String(cfg.color ?? '#ffffff'))}" />
          </div>
        `;
      default:
        return '';
    }
  }

  protected onRender(): void {
    this.tabs.bind(this.element);

    const formEl = this.element.querySelector('.tile-config-form') as HTMLElement;
    if (!formEl) return;

    const pickImgBtn = formEl.querySelector('#pick-tile-img-btn');
    pickImgBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          const urlInput = formEl.querySelector<HTMLInputElement>('[name="imgUrl"]');
          if (urlInput) urlInput.value = path;
        },
      });
    });

    const opacityRange = formEl.querySelector<HTMLInputElement>('[name="opacity"]');
    const opacityVal = formEl.querySelector<HTMLElement>('.opacity-val');
    if (opacityRange && opacityVal) {
      opacityRange.addEventListener('input', () => {
        opacityVal.textContent = Math.round(parseFloat(opacityRange.value)) + '%';
      });
    }

    const volumeRange = formEl.querySelector<HTMLInputElement>('[name="videoVolume"]');
    const volumeVal = formEl.querySelector<HTMLElement>('.video-volume-val');
    if (volumeRange && volumeVal) {
      volumeRange.addEventListener('input', () => {
        volumeVal.textContent = Math.round(parseFloat(volumeRange.value)) + '%';
      });
    }

    const resetBtn = formEl.querySelector<HTMLElement>('[data-action="reset"]');
    resetBtn?.addEventListener('click', () => {
      void this.load();
      showToast(t('tileConfig.resetSuccess'), 'info');
    });

    // Recipe field change detection
    formEl.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('recipe-field')) {
        this.saveRecipeFields();
      }
    });

    // Token mode radio toggle — show/hide specific token dropdown
    formEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Recipe: pick map destination (reuses startMapPick)
      const action = target.dataset.action ?? (target.closest('[data-action]') as HTMLElement | null)?.dataset.action;
      if (action === 'recipe-pick-map') {
        // The recipe builds a single action, so the index is always 0.
        this.startMapPick(0);
        return;
      }
      if (action === 'recipe-pick-file') {
        const btn = target.closest('[data-action]') as HTMLElement | null;
        const key = (btn ?? target).dataset.recipeField;
        if (!key) return;
        // Same pattern already used in #pick-tile-img-btn.
        this.renderChild(FilePickerWindow, 'file-picker', {
          onSelect: (path: string) => {
            this.recipeFields[key] = path;
            const el = this.element.querySelector<HTMLInputElement>(`[data-recipe-field="${key}"]`);
            if (el) el.value = path;
          },
        });
        return;
      }

      if (target.classList.contains('token-mode-radio')) {
        const idx = Number(target.dataset.actionIdx);
        const isSpecific = (target as HTMLInputElement).value === 'specific';
        const select = formEl.querySelector<HTMLElement>(`.token-specific-select[data-action-idx="${idx}"]`);
        if (select) {
          select.style.display = isSpecific ? '' : 'none';
        }
        // Clear targetTokenId when switching to activator mode
        if (!isSpecific && this.tile?.actions?.[idx]) {
          this.tile.actions[idx].config.targetTokenId = '';
        }
      }
      // Dialog mode radio toggle
      if (target.classList.contains('dialog-mode-radio')) {
        const idx = Number(target.dataset.actionIdx);
        const isJournal = (target as HTMLInputElement).value === 'journal';
        const textFields = formEl.querySelector<HTMLElement>(`#dialog-text-fields-${idx}`);
        const journalFields = formEl.querySelector<HTMLElement>(`#dialog-journal-fields-${idx}`);
        if (textFields) textFields.style.display = isJournal ? 'none' : '';
        if (journalFields) journalFields.style.display = isJournal ? '' : 'none';
        // Clear journal fields when switching to text mode
        if (!isJournal && this.tile?.actions?.[idx]) {
          this.tile.actions[idx].config.journalId = '';
          this.tile.actions[idx].config.pageId = '';
        }
      }
    });

    // Event delegation for triggers/conditions/actions
    formEl.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;

      // Trigger event select
      if (target.classList.contains('trigger-event-select')) {
        const idx = Number(target.dataset.triggerIdx);
        if (this.tile?.triggers?.[idx]) {
          this.tile.triggers[idx].event = (target as HTMLSelectElement).value as TileTrigger['event'];
        }
        return;
      }

      // Condition type select
      if (target.classList.contains('condition-type-select')) {
        const idx = Number(target.dataset.conditionIdx);
        if (this.tile?.conditions?.[idx]) {
          this.tile.conditions[idx].type = (target as HTMLSelectElement).value as TileCondition['type'];
          this.rerenderBody();
        }
        return;
      }

      // Condition role select (user-role-gte)
      if (target.classList.contains('condition-role-select')) {
        const idx = Number(target.dataset.conditionIdx);
        if (this.tile?.conditions?.[idx]) {
          this.tile.conditions[idx].value = Number((target as HTMLSelectElement).value);
        }
        return;
      }

      // Condition value text input (flag-equals)
      if (target.classList.contains('condition-value-input')) {
        const idx = Number(target.dataset.conditionIdx);
        if (this.tile?.conditions?.[idx]) {
          const val = (target as HTMLInputElement).value;
          const n = Number(val);
          this.tile.conditions[idx].value = Number.isNaN(n) ? val : n;
        }
        return;
      }

      // Journal select — refresh page dropdown
      if (target.classList.contains('dialog-journal-select')) {
        const idx = Number(target.dataset.actionIdx);
        if (this.tile?.actions?.[idx]) {
          this.tile.actions[idx].config.journalId = (target as HTMLSelectElement).value;
          // Clear pageId when journal changes
          this.tile.actions[idx].config.pageId = '';
        }
        this.rerenderBody();
        return;
      }

      // Action type select
      if (target.classList.contains('action-type-select')) {
        const idx = Number(target.dataset.actionIdx);
        if (this.tile?.actions?.[idx]) {
          this.tile.actions[idx].type = (target as HTMLSelectElement).value as TileAction['type'];
        }
        this.rerenderBody();
        return;
      }

      // Action form fields
      if (target.classList.contains('action-field')) {
        const idx = Number(target.dataset.actionIdx);
        const field = target.dataset.field;
        if (!this.tile?.actions?.[idx] || !field) return;
        let val: any;
        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
          val = target.checked;
        } else if (target instanceof HTMLInputElement && target.type === 'number') {
          val = parseFloat(target.value);
        } else {
          val = (target as HTMLInputElement).value;
        }
        this.tile.actions[idx].config = { ...this.tile.actions[idx].config, [field]: val };
        return;
      }
    });
  }

  async submit(options: { close?: boolean } = {}): Promise<void> {
    if (!this.tile) return;
    const body = this.element.querySelector('.tile-config-form');
    if (!body) return;

    const fd = new LoomFormData(body as HTMLElement);
    const data = fd.object;

    const floorsRaw = String(data.floors || '');
    const floors = floorsRaw
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const payload: Record<string, any> = {
      name: data.name,
      imgUrl: data.imgUrl,
      x: Number(data.x),
      y: Number(data.y),
      width: Number(data.width),
      height: Number(data.height),
      rotation: Number(data.rotation ?? 0),
      tintColor: (data.tintColor && data.tintColor !== '#ffffff') ? data.tintColor : '',
      opacity: Number(data.opacity ?? 100) / 100,
      locked: Boolean(data.locked),
      isActive: Boolean(data.isActive),
      hidden: Boolean(data.hidden),
      videoLoop: Boolean(data.videoLoop),
      videoAutoplay: Boolean(data.videoAutoplay),
      videoVolume: Number(data.videoVolume ?? 100) / 100,
      anchorX: Number(data.anchorX ?? 0.5),
      anchorY: Number(data.anchorY ?? 0.5),
      floors,
      elevation: Number(data.elevation ?? 0),
      triggers: this.tile.triggers ?? [],
      conditions: this.tile.conditions ?? [],
      actions: this.tile.actions ?? [],
      recipeId: this.tile.recipeId ?? null,
    };

    try {
      await api.put(`/tiles/${this.props.tileId}`, payload);
      showToast(t('tileConfig.saveSuccess'), 'success');
      if (options.close) {
        windowManager.close(this.options.id);
      }
    } catch (e: any) {
      showToast(e?.message || t('tileConfig.saveError'), 'error');
    }
  }

  protected _getHeaderControls(): Array<{
    icon: string;
    label: string;
    action: string;
    title?: string;
  }> {
    return [
      {
        icon: 'fas fa-trash',
        label: t('common.delete'),
        action: 'delete',
        title: t('tileConfig.deleteTile'),
      },
    ];
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  async deleteTile(): Promise<void> {
    try {
      await api.delete(`/tiles/${this.props.tileId}`);
      showToast(t('tileConfig.deleted'), 'success');
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || t('tileConfig.deleteError'), 'error');
    }
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (this.tabs.handleAction(action)) return;

    if (action === 'save') {
      void this.submit({ close: true });
      return;
    }
    if (action === 'cancel') {
      windowManager.close(this.options.id);
      return;
    }
    if (action === 'delete') {
      void this.deleteTile();
      return;
    }
    if (action === 'pick-sound' && id !== null) {
      const idx = Number(id);
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          if (this.tile?.actions?.[idx]) {
            this.tile.actions[idx].config.soundUrl = path;
            this.rerenderBody();
          }
        },
      });
      return;
    }
    if (action === 'pick-dialog-image' && id !== null) {
      const idx = Number(id);
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          if (this.tile?.actions?.[idx]) {
            this.tile.actions[idx].config.imageUrl = path;
            this.rerenderBody();
          }
        },
      });
      return;
    }
    if (action === 'pick-map-dest' && id !== null) {
      const idx = Number(id);
      this.startMapPick(idx);
      return;
    }
    if (!this.tile) return;

    // Apply recipe
    if (action === 'apply-recipe' && id !== null) {
      this.applyRecipe(id);
      return;
    }

    // Show advanced builder from gallery
    if (action === 'show-advanced') {
      this.showingAdvanced = true;
      this.rerenderBody();
      return;
    }

    // Save recipe fields and exit
    if (action === 'save-recipe') {
      this.saveRecipeFields();
      void this.submit({ close: true });
      return;
    }

    // Test from recipe view
    if (action === 'recipe-test') {
      this.saveRecipeFields();
      this.testTile();
      return;
    }

    // Convert recipe to advanced rules
    if (action === 'convert-advanced') {
      this.saveRecipeFields();
      this.showingAdvanced = true;
      if (this.tile) { delete this.tile.recipeId; }
      this.rerenderBody();
      return;
    }

    // Test from advanced view
    if (action === 'advanced-test') {
      this.testTile();
      return;
    }

    // Back to recipe view from advanced
    if (action === 'back-to-recipe') {
      if (this.tile && this.tile.recipeId) {
        this.showingAdvanced = false;
        this.rerenderBody();
      }
      return;
    }

    if (action === 'add-trigger') {
      this.tile.triggers = [...(this.tile.triggers ?? []), { event: 'token-enter' }];
      this.rerenderBody();
    } else if (action === 'remove-trigger' && id !== null) {
      this.tile.triggers = (this.tile.triggers ?? []).filter((_, i) => i !== Number(id));
      this.rerenderBody();
    } else if (action === 'add-condition') {
      this.tile.conditions = [...(this.tile.conditions ?? []), { type: 'user-role-gte', value: 4 }];
      this.rerenderBody();
    } else if (action === 'remove-condition' && id !== null) {
      this.tile.conditions = (this.tile.conditions ?? []).filter((_, i) => i !== Number(id));
      this.rerenderBody();
    } else if (action === 'add-action') {
      this.tile.actions = [...(this.tile.actions ?? []), { type: 'teleport', config: {} }];
      this.rerenderBody();
    } else if (action === 'remove-action' && id !== null) {
      this.tile.actions = (this.tile.actions ?? []).filter((_, i) => i !== Number(id));
      this.rerenderBody();
    }
  }

  private applyRecipe(recipeId: string): void {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !this.tile) return;
    const tile = this.tile;

    const cfg = recipe.buildConfig();
    tile.triggers = cfg.triggers;
    tile.conditions = cfg.conditions;
    tile.actions = cfg.actions;
    tile.recipeId = recipeId;
    this.showingAdvanced = false;

    // Init recipe fields with defaults
    this.recipeFields = {};
    for (const f of recipe.fields) {
      this.recipeFields[f.key] = f.defaultValue;
    }

    this.rerenderBody();
  }

  private saveRecipeFields(): void {
    if (!this.tile) return;
    const tile = this.tile;
    const recipe = RECIPES.find((r) => r.id === tile.recipeId);
    if (!recipe) return;

    // Read field values from DOM
    const container = this.element?.querySelector('.tile-config-form');
    if (!container) return;

    for (const f of recipe.fields) {
      const el = container.querySelector<HTMLInputElement>(`[data-recipe-field="${f.key}"]`);
      if (el) {
        if (f.type === 'checkbox') {
          this.recipeFields[f.key] = el.checked;
        } else if (f.type === 'number') {
          this.recipeFields[f.key] = parseFloat(el.value) || 0;
        } else {
          this.recipeFields[f.key] = el.value;
        }
      }
    }

    // Apply fields to the actual tile actions
    for (const action of tile.actions ?? []) {
      for (const [key, val] of Object.entries(this.recipeFields)) {
        if (key in (action.config ?? {})) {
          action.config[key] = val;
        }
        // Handle special mappings
        if (action.type === 'activate-tile' && key === 'active') {
          action.config.active = this.recipeFields.active;
        }
        if (action.type === 'chat-message' && key === 'message') {
          action.config.message = this.recipeFields.message;
        }
        if (action.type === 'show-notification' && key === 'message') {
          action.config.message = this.recipeFields.message;
        }
      }
    }
  }

  private testTile(): void {
    const cm = CanvasManager.activeInstance;
    if (!cm || !this.tile) {
      showToast(t('tileConfig.testNoCanvas'), 'error');
      return;
    }
    const eventType = this.tile.triggers?.[0]?.event ?? 'click';
    cm.executeTileTriggersManually(this.tile.id, eventType);
    showToast(t('tileConfig.testRunning'), 'info');
  }
}
