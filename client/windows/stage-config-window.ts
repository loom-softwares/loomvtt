/*******************************************************************************
 * LoomVTT
 * client/windows/stage-config-window.ts
 * 
 * 
 * Window for configuring stages and scenes.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/dialog.js';
import { LoomFormData } from '../core/form-data.js';
import { FilePickerWindow } from './file-picker-window.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { transitionEffectRegistry } from '../canvas/transition-effect-registry.js';
import { LevelConfigWindow, type LevelData } from './level-config-window.js';

interface Stage {
  id: string;
  name: string;
  backgroundUrl?: string;
  backgroundColor?: string;
  weatherEffect?: string;
  gridSize: number;
  gridColor: string;
  gridStyle: string;
  gridType: string;
  gridDistance: number;
  gridUnit: string;
  gridOpacity: number;
  padding: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  tokenVision?: boolean;
  fogExplorationMode?: string;
  fogExploredColor?: string;
  fogUnexploredColor?: string;
  fogImage?: string;
  globalLight?: boolean;
  globalLightThreshold?: number;
  flags?: {
    initialX?: number;
    initialY?: number;
    initialZoom?: number;
    initialLevel?: string;
  };
  journalId?: string;
  journalPageId?: string;
  transitionType?: string;
  transitionDuration?: number;
  sceneType?: string;
  parentStageId?: string;
}

export class StageConfigWindow extends BaseWindow {
  private stage: Stage;
  private onSaved: () => void;
  private originalGridOpacity = 0.4;
  private saved = false;
  private activeTab = 'basics';
  private worldId = '';
  private levels: LevelData[] = [];
  private journals: any[] = [];
  private parentCandidates: { id: string; name: string }[] = [];

  constructor(props: { stage: Stage; onSaved: () => void; initialTab?: string; worldId?: string }) {
    super({
      id: `stage-config-${props.stage.id}`,
      title: t('stageConfig.title'),
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 720,
      height: 'auto',
      bannerImage: '/images/general-banners/map-banner.png',
      documentId: props.stage.id,
    } as BaseWindowOptions);
    this.stage = props.stage;
    this.onSaved = props.onSaved;
    if (props.worldId) this.worldId = props.worldId;
    this.originalGridOpacity = typeof props.stage.gridOpacity === 'number' ? props.stage.gridOpacity : 0.4;
    this.activeTab = props.initialTab || 'basics';
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-tabs-fixed');
    }
    this.fetchLevels();
    this.fetchJournals();
    this.fetchParentCandidates();
  }

  private async fetchParentCandidates(): Promise<void> {
    try {
      const stages = await api.get<{ id: string; name: string; sceneType?: string }[]>('/stages');
      this.parentCandidates = stages.filter((s) => s.sceneType === 'map' && s.id !== this.stage.id);
      this.renderParentStageList();
    } catch (err) {
      console.error('Failed to fetch parent stage candidates:', err);
    }
  }

  private renderParentStageList(): void {
    const select = this.element.querySelector('select[name="parentStageId"]') as HTMLSelectElement;
    if (!select) return;
    let html = `<option value="">${t('stageConfig.noParentStage') || '— Nenhuma —'}</option>`;
    for (const s of this.parentCandidates) {
      html += `<option value="${s.id}" ${this.stage.parentStageId === s.id ? 'selected' : ''}>${s.name}</option>`;
    }
    select.innerHTML = html;
  }

  /**
   * Notifies the HUD that this scene's levels changed. Without this `fetchLevels`
   * only updated the list inside this window: the scene bar remained
   * with the old list until the user reloaded the page.
   */
  private notifyLevelsChanged(): void {
    window.dispatchEvent(
      new CustomEvent('levels-changed', { detail: { stageId: this.stage.id } }),
    );
  }

  private async fetchLevels(): Promise<void> {
    try {
      this.levels = await api.get(`/stages/${this.stage.id}/levels`);
      this.renderLevelsList();
    } catch (err) {
      console.error('Failed to fetch levels:', err);
    }
  }

  private async fetchJournals(): Promise<void> {
    try {
      if (!this.worldId) return;
      this.journals = await api.get(`/journals?worldId=${this.worldId}`);
      this.renderJournalsList();
    } catch (err) {
      console.error('Failed to fetch journals:', err);
    }
  }

  private renderJournalsList(): void {
    const journalSelect = this.element.querySelector('select[name="journalId"]') as HTMLSelectElement;
    if (journalSelect) {
      let html = `<option value="">Nenhum</option>`;
      for (const j of this.journals) {
        html += `<option value="${j.id}" ${this.stage.journalId === j.id ? 'selected' : ''}>${j.name}</option>`;
      }
      journalSelect.innerHTML = html;
      journalSelect.addEventListener('change', () => this.updatePagesList(journalSelect.value));
      if (this.stage.journalId) {
        this.updatePagesList(this.stage.journalId);
      }
    }
  }

  private updatePagesList(journalId: string): void {
    const pageSelect = this.element.querySelector('select[name="journalPageId"]') as HTMLSelectElement;
    if (!pageSelect) return;
    const journal = this.journals.find(j => j.id === journalId);
    let html = `<option value="">Nenhuma</option>`;
    if (journal && journal.pages) {
      for (const p of journal.pages) {
        html += `<option value="${p.id}" ${this.stage.journalPageId === p.id ? 'selected' : ''}>${p.name}</option>`;
      }
    }
    pageSelect.innerHTML = html;
  }

  private renderLevelsList(): void {
    const container = this.element.querySelector('#levels-list-container');
    const select = this.element.querySelector('select[name="flags.initialLevel"]') as HTMLSelectElement;
    if (!container) return;

    let html = '';
    if (this.levels.length === 0) {
      html = '<div style="text-align:center; padding: 10px;">Nenhum andar encontrado.</div>';
    } else {
      for (const level of this.levels) {
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: bold;">
              ${level.id === this.stage.flags?.initialLevel ? '<i class="fa-solid fa-bullseye" style="color:var(--color-primary);"></i> ' : ''}
              ${level.name}
            </span>
            <span>
              [${level.bottomElevation}, ${level.topElevation}] 
              <i class="fa-solid fa-edit level-edit" data-id="${level.id}" style="cursor:pointer; margin: 0 5px;" title="Editar"></i> 
              <i class="fa-solid fa-trash level-delete" data-id="${level.id}" style="cursor:pointer; color: var(--color-danger);" title="Excluir"></i>
            </span>
          </div>
        `;
      }
    }
    container.innerHTML = html;

    // Update initialLevel select options
    if (select) {
      const currentVal = select.value || this.stage.flags?.initialLevel || (this.levels.length > 0 ? this.levels[0].id : '');
      select.innerHTML = this.levels.length === 0 ? '<option value="">(Sem andares)</option>' : this.levels.map(l => `<option value="${l.id}" ${currentVal === l.id ? 'selected' : ''}>${l.name}</option>`).join('');
    }

    // Bind events
    container.querySelectorAll('.level-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const level = this.levels.find(l => l.id === id);
        if (level) this.openLevelConfig(level);
      });
    });

    container.querySelectorAll('.level-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (await showConfirm('Excluir Andar', 'Tem certeza que deseja excluir este andar?')) {
          try {
            await api.delete(`/stages/${this.stage.id}/levels/${id}`);
            this.fetchLevels();
            this.notifyLevelsChanged();
          } catch (e) {
            showToast('Erro ao excluir andar', 'error');
          }
        }
      });
    });
  }

  private openLevelConfig(levelData: LevelData): void {
    windowManager.open(`level-config-${levelData.id || 'new'}`, LevelConfigWindow, {
      levelData,
      onSave: async (updatedData: LevelData) => {
        try {
          if (updatedData.id) {
            await api.put(`/stages/${this.stage.id}/levels/${updatedData.id}`, updatedData);
          } else {
            await api.post(`/stages/${this.stage.id}/levels`, updatedData);
          }
          this.fetchLevels();
          this.notifyLevelsChanged();
        } catch (e) {
          showToast('Erro ao salvar andar', 'error');
        }
      }
    });
  }

  bodyTemplate(): string {
    return `
      <div class="banner-spacer"></div>
      <div class="tabs">
        <button class="tab-button active" data-action="tab-basics" data-tab="basics"><i class="fa-solid fa-image"></i> ${t('stageConfig.tabBasics')}</button>
        ${this.stage.sceneType !== 'map' ? `<button class="tab-button" data-action="tab-levels" data-tab="levels"><i class="fa-solid fa-layer-group"></i> ${t('stageConfig.tabLevels')}</button>` : ''}
        <button class="tab-button" data-action="tab-grid" data-tab="grid"><i class="fa-solid fa-border-all"></i> ${t('stageConfig.tabGrid')}</button>
        <button class="tab-button" data-action="tab-visibility" data-tab="visibility"><i class="fa-solid fa-eye"></i> ${t('stageConfig.tabVisibility')}</button>
        <button class="tab-button" data-action="tab-env" data-tab="env"><i class="fa-solid fa-sun"></i> ${t('stageConfig.tabEnv')}</button>
        <button class="tab-button" data-action="tab-misc" data-tab="misc"><i class="fa-solid fa-cogs"></i> ${t('stageConfig.tabMisc')}</button>
      </div>

      <!-- BASICS TAB -->
      <div class="tab-content active" data-tab="basics">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.presentation')}</legend>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.name')}</label>
            <div class="form-fields">
              <input type="text" name="name" value="${this.stage.name}" required />
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.sceneType') || 'Tipo de Cena'}</label>
            <div class="form-fields">
              <select name="sceneType">
                <option value="tactical" ${(this.stage.sceneType || 'tactical') === 'tactical' ? 'selected' : ''}>${t('stageConfig.sceneTypeTactical') || 'Tático (grid/combate)'}</option>
                <option value="map" ${this.stage.sceneType === 'map' ? 'selected' : ''}>${t('stageConfig.sceneTypeMap') || 'Mapa (waypoints)'}</option>
              </select>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.parentStage') || 'Cena Pai (mapa)'}</label>
            <div class="form-fields">
              <select name="parentStageId">
                <option value="">${t('stageConfig.noParentStage') || '— Nenhuma —'}</option>
              </select>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.theaterDefault') || 'Abrir em Modo Teatro'}</label>
            <div class="form-fields">
              <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="flags.theaterDefault" ${(this.stage.flags as any)?.theaterDefault ? 'checked' : ''} />
                ${t('stageConfig.theaterDefaultDesc') || 'A cena já abre em modo teatro (o GM desliga quando a ação começa).'}
              </label>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.permissions')}</label>
            <div class="form-fields">
              <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="showInNavigation" ${(this.stage as any).showInNavigation ? 'checked' : ''} />
                ${t('stageConfig.showInNavigation')}
              </label>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.navigationName')}</label>
            <div class="form-fields">
              <input type="text" name="navigationName" value="${(this.stage as any).navigationName || ''}" />
            </div>
            <small>${t('stageConfig.navigationNameDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.thumbnail')}</label>
            <div class="form-fields">
              <input type="text" name="thumbnailUrl" value="${(this.stage as any).thumbnailUrl || ''}" placeholder="${t('stageConfig.thumbnailPlaceholder')}" />
              <button type="button" class="icon-button" id="pick-thumbnail-btn" title="${t('stageConfig.pickExistingFile')}"><i class="fa-solid fa-folder-open"></i></button>
            </div>
            <small>${t('stageConfig.thumbnailDesc')}</small>
          </div>
        </fieldset>
      </div>

      <!-- LEVELS TAB -->
      <div class="tab-content" data-tab="levels">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.levels')} <i class="fa-solid fa-square-plus" id="add-level-btn" style="cursor: pointer; margin-left: 5px;" title="${t('stageConfig.addLevel')}"></i></legend>
          <div id="levels-list-container" style="background: rgba(0,0,0,0.2); border: 1px solid var(--color-border-glass); border-radius: 4px; padding: 10px; margin-bottom: 15px;">
            ${t('stageConfig.loadingLevels')}
          </div>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.initialCamera')}</label>
            <div class="form-fields">
              <span class="units">X</span>
              <input type="number" name="flags.initialX" value="${this.stage.flags?.initialX || 0}" step="1" />
              <span class="units">Y</span>
              <input type="number" name="flags.initialY" value="${this.stage.flags?.initialY || 0}" step="1" />
              <span class="units">Zoom</span>
              <input type="number" name="flags.initialZoom" value="${this.stage.flags?.initialZoom || 1}" step="0.05" min="0.1" max="3" />
              <button type="button" class="btn btn-secondary" id="capture-cam-btn" title="${t('stageConfig.captureCurrentView')}" style="padding: 5px 10px;"><i class="fa-solid fa-crop-simple"></i></button>
            </div>
            <small>${t('stageConfig.cameraHint')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.initialLevel')}</label>
            <div class="form-fields">
              <select name="flags.initialLevel">
                <option value="">${t('stageConfig.loading')}</option>
              </select>
            </div>
            <small>${t('stageConfig.initialLevelDesc')}</small>
          </div>
        </fieldset>
      </div>

      <!-- GRID TAB -->
      <div class="tab-content" data-tab="grid">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.mechanics')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.grid')}</label>
            <div class="form-fields">
              <input type="number" name="gridSize" value="${this.stage.gridSize}" min="10" max="200" step="5" />
              <span class="units">Pixels</span>
              <select name="gridType">
                <option value="square" ${this.stage.gridType === 'square' ? 'selected' : ''}>${t('stageConfig.square')}</option>
                <option value="hex" ${this.stage.gridType === 'hex' ? 'selected' : ''}>${t('stageConfig.hexagonal')}</option>
                <option value="gridless" ${this.stage.gridType === 'gridless' ? 'selected' : ''}>${t('stageConfig.noGrid')}</option>
              </select>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.measures')}</label>
            <div class="form-fields">
              <span class="units">Distância</span>
              <input type="number" name="gridDistance" value="${this.stage.gridDistance}" min="1" max="100" step="1" />
              <span class="units">Unidades</span>
              <select name="gridUnit">
                <option value="ft" ${this.stage.gridUnit === 'ft' ? 'selected' : ''}>${t('stageConfig.feet')}</option>
                <option value="m" ${this.stage.gridUnit === 'm' ? 'selected' : ''}>${t('stageConfig.meters')}</option>
                <option value="yd" ${this.stage.gridUnit === 'yd' ? 'selected' : ''}>${t('stageConfig.yards')}</option>
                <option value="km" ${this.stage.gridUnit === 'km' ? 'selected' : ''}>${t('stageConfig.kilometers')}</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.appearance')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.gridStyle')}</label>
            <div class="form-fields">
              <select name="gridStyle">
                <option value="solid" ${this.stage.gridStyle === 'solid' ? 'selected' : ''}>${t('stageConfig.solid')}</option>
                <option value="dashed" ${this.stage.gridStyle === 'dashed' ? 'selected' : ''}>${t('stageConfig.dashed')}</option>
                <option value="dotted" ${this.stage.gridStyle === 'dotted' ? 'selected' : ''}>${t('stageConfig.dotted')}</option>
              </select>
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.gridColor')}</label>
            <div class="form-fields color-input-group">
              <input type="color" name="gridColor" value="${this.stage.gridColor}" />
              <input type="text" name="gridColorText" value="${this.stage.gridColor}" style="flex: 1;" />
            </div>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.gridOpacity')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="gridOpacity" value="${this.stage.gridOpacity}" min="0" max="1" step="0.01" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${this.stage.gridOpacity}" readonly style="width: 40px;" />
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.sceneProperties')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.dimensions')}</label>
            <div class="form-fields">
              <span class="units">Largura</span>
              <input type="number" name="width" value="${this.stage.width}" min="100" max="20000" step="10" />
              <i class="fa-solid fa-link"></i>
              <span class="units">Altura</span>
              <input type="number" name="height" value="${this.stage.height}" min="100" max="20000" step="10" />
            </div>
            <small>${t('stageConfig.dimensionsDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.padding')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="padding" value="${this.stage.padding}" min="0" max="100" step="1" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${this.stage.padding}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.paddingDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.offset')}</label>
            <div class="form-fields">
              <span class="units">X</span>
              <input type="number" name="offsetX" value="${this.stage.offsetX}" step="10" />
              <span class="units">Y</span>
              <input type="number" name="offsetY" value="${this.stage.offsetY}" step="10" />
            </div>
            <small>${t('stageConfig.offsetDesc')}</small>
          </div>
        </fieldset>
      </div>

      <!-- VISIBILITY TAB -->
      <div class="tab-content" data-tab="visibility">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.vision')}</legend>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.tokenVision')}</label>
            <div class="form-fields">
              <input type="checkbox" name="tokenVision" ${this.stage.tokenVision !== false ? 'checked' : ''} />
            </div>
          </div>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.explorationMode')}</label>
            <div class="form-fields">
              <select name="fogExplorationMode">
                <option value="none" ${this.stage.fogExplorationMode === 'none' ? 'selected' : ''}>${t('stageConfig.none')}</option>
                <option value="individual" ${(this.stage.fogExplorationMode ?? 'individual') === 'individual' ? 'selected' : ''}>${t('stageConfig.individual')}</option>
                <option value="shared" ${this.stage.fogExplorationMode === 'shared' ? 'selected' : ''}>${t('stageConfig.shared')}</option>
              </select>
            </div>
          </div>
        </fieldset>
        
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.globalLight')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.globalLight')}</label>
            <div class="form-fields">
              <input type="checkbox" name="globalLight" ${this.stage.globalLight ? 'checked' : ''} />
            </div>
            <small>${t('stageConfig.globalLightDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.threshold')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="globalLightThreshold" value="${this.stage.globalLightThreshold ?? 1}" min="0" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${this.stage.globalLightThreshold ?? 1}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.thresholdDesc')}</small>
          </div>
        </fieldset>
      </div>

      <!-- ENVIRONMENT TAB -->
      <div class="tab-content" data-tab="env">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.envBase')}</legend>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.brightness')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="flags.envLuminosity" value="${(this.stage as any).flags?.envLuminosity || 0}" min="-1" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${(this.stage as any).flags?.envLuminosity || 0}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.brightnessDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.saturation')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="flags.envSaturation" value="${(this.stage as any).flags?.envSaturation || 0}" min="-1" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${(this.stage as any).flags?.envSaturation || 0}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.saturationDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.shadows')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="flags.envShadows" value="${(this.stage as any).flags?.envShadows || 0}" min="0" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${(this.stage as any).flags?.envShadows || 0}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.shadowsDesc')}</small>
          </div>

          <div class="form-group-horizontal">
            <label>${t('stageConfig.hue')}</label>
            <div class="form-fields color-input-group">
              <input type="color" name="flags.envHue" value="${(this.stage as any).flags?.envHue || '#000000'}" />
              <input type="text" name="flags.envHueText" value="${(this.stage as any).flags?.envHue || '#000000'}" style="flex: 1;" />
            </div>
            <small>${t('stageConfig.hueDesc')}</small>
          </div>
          
          <div class="form-group-horizontal">
            <label>${t('stageConfig.hueIntensity')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="flags.envHueIntensity" value="${(this.stage as any).flags?.envHueIntensity || 0}" min="0" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${(this.stage as any).flags?.envHueIntensity || 0}" readonly style="width: 40px;" />
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.darkness')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.darknessLevel')}</label>
            <div class="form-fields range-input-group">
              <input type="range" name="darknessLevel" value="${(this.stage as any).darknessLevel || 0}" min="0" max="1" step="0.05" oninput="this.nextElementSibling.value = this.value" style="flex:1;" />
              <input type="text" class="range-value" value="${(this.stage as any).darknessLevel || 0}" readonly style="width: 40px;" />
            </div>
            <small>${t('stageConfig.darknessLevelDesc')}</small>
          </div>
        </fieldset>
      </div>

      <!-- MISC TAB -->
      <div class="tab-content" data-tab="misc">
        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.details')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.journalEntry')}</label>
            <div class="form-fields">
              <select name="journalId">
                <option value="">${t('stageConfig.loading')}</option>
              </select>
            </div>
          </div>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.journalPage')}</label>
            <div class="form-fields">
              <select name="journalPageId">
                <option value="">Nenhuma</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.audio')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.playlist')}</label>
            <div class="form-fields">
              <select name="ambientPlaylistId">
                <option value="">${t('stageConfig.none')}</option>
                <!-- Playlists serão injetadas via JS -->
              </select>
            </div>
            <small>${t('stageConfig.playlistDesc')}</small>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">${t('stageConfig.environment')}</legend>
          <div class="form-group-horizontal">
            <label>${t('stageConfig.weatherEffect')}</label>
            <div class="form-fields">
              <select name="weatherEffect">
                <option value="none" ${(this.stage.weatherEffect ?? 'none') === 'none' ? 'selected' : ''}>${t('stageConfig.none')}</option>
                <option value="rain" ${this.stage.weatherEffect === 'rain' ? 'selected' : ''}>${t('stageConfig.rain')}</option>
                <option value="snow" ${this.stage.weatherEffect === 'snow' ? 'selected' : ''}>${t('stageConfig.snow')}</option>
                <option value="fog" ${this.stage.weatherEffect === 'fog' ? 'selected' : ''}>${t('stageConfig.fog')}</option>
                <option value="storm" ${this.stage.weatherEffect === 'storm' ? 'selected' : ''}>${t('stageConfig.storm')}</option>
              </select>
            </div>
            <small>${t('stageConfig.weatherEffectDesc')}</small>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">Animação de Transição</legend>
          <div class="form-group-horizontal">
            <label>Tipo de Transição</label>
            <div class="form-fields">
              <select name="transitionType">
                ${transitionEffectRegistry.getAll().map((def) => `
                <option value="${def.id}" ${(this.stage.transitionType ?? 'none') === def.id ? 'selected' : ''}>${def.label}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="form-group-horizontal">
            <label>Duração (ms)</label>
            <div class="form-fields">
              <input type="number" name="transitionDuration" value="${this.stage.transitionDuration ?? 1500}" min="0" max="5000" step="100" />
            </div>
          </div>
        </fieldset>
      </div>
    `;
  }

  protected onRender(): void {
    if (this.activeTab !== 'basics') {
      const body = this.element.querySelector('.loom-window-body')!;
      body.querySelectorAll('.tab-button').forEach((btn) => {
        if (btn.getAttribute('data-tab') === this.activeTab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      body.querySelectorAll('.tab-content').forEach((tab) => {
        if (tab.getAttribute('data-tab') === this.activeTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    const addLevelBtn = this.element.querySelector('#add-level-btn');
    if (addLevelBtn) {
      addLevelBtn.addEventListener('click', () => {
        const existingNames = new Set(this.levels.map(l => l.name));
        let n = this.levels.length + 1;
        while (existingNames.has(t('levelConfig.defaultName', { n }))) n++;
        this.openLevelConfig({
          stageId: this.stage.id,
          name: t('levelConfig.defaultName', { n }),
          bottomElevation: 0,
          topElevation: 20,
          backgroundUrl: '',
          backgroundColor: '#000000'
        });
      });
    }

    const uploadBtn = this.element.querySelector('#upload-bg-btn');
    const filePicker = this.element.querySelector('#bg-file-picker') as HTMLInputElement;
    uploadBtn?.addEventListener('click', () => filePicker?.click());
    filePicker?.addEventListener('change', async () => {
      if (!filePicker.files || filePicker.files.length === 0) return;
      const file = filePicker.files[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        const qs = this.worldId ? `?worldId=${this.worldId}` : '';
        const response = await fetch(`/api/assets/upload${qs}`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();
        if (result.path) {
          const urlInput = this.element.querySelector('[name="backgroundUrl"]') as HTMLInputElement;
          if (urlInput) urlInput.value = result.path;
          showToast(t('stageConfig.imageUploadSuccess'), 'success');
          this.updateDimensionsFromImage(result.path);
        } else {
          showToast(result.error || t('stageConfig.imageUploadError'), 'error');
        }
      } catch (err) {
        console.error('Failed to upload bg', err);
        showToast(t('stageConfig.imageUploadError'), 'error');
      }
    });

    const pickBtn = this.element.querySelector('#pick-bg-btn');
    pickBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker-bg', {
        onSelect: (path: string) => {
          const urlInput = this.element.querySelector('[name="backgroundUrl"]') as HTMLInputElement;
          if (urlInput) urlInput.value = path;
          this.updateDimensionsFromImage(path);
        },
        worldId: this.worldId,
      });
    });

    const pickThumbnailBtn = this.element.querySelector('#pick-thumbnail-btn');
    pickThumbnailBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker-thumbnail', {
        onSelect: (path: string) => {
          const thumbInput = this.element.querySelector('[name="thumbnailUrl"]') as HTMLInputElement;
          if (thumbInput) thumbInput.value = path;
        },
        worldId: this.worldId,
      });
    });

    const pickFogBtn = this.element.querySelector('#pick-fog-image-btn');
    pickFogBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker-fog', {
        onSelect: (path: string) => {
          const fogInput = this.element.querySelector('[name="fogImage"]') as HTMLInputElement;
          if (fogInput) fogInput.value = path;
        },
        worldId: this.worldId,
      });
    });

    const captureBtn = this.element.querySelector('#capture-cam-btn');
    captureBtn?.addEventListener('click', () => {
      const activeCM = CanvasManager.activeInstance;
      if (!activeCM) {
        showToast(t('stageConfig.canvasNotActive'), 'error');
        return;
      }
      const view = activeCM.getCameraView();
      const xInput = this.element?.querySelector('[name="flags.initialX"]') as HTMLInputElement;
      const yInput = this.element?.querySelector('[name="flags.initialY"]') as HTMLInputElement;
      const zoomInput = this.element?.querySelector('[name="flags.initialZoom"]') as HTMLInputElement;

      if (xInput) xInput.value = view.x.toString();
      if (yInput) yInput.value = view.y.toString();
      if (zoomInput) zoomInput.value = view.zoom.toString();
      showToast(t('stageConfig.cameraViewCaptured'), 'success');
    });

    // Real-time grid opacity preview and label update
    const opacityInput = this.element.querySelector('[name="gridOpacity"]') as HTMLInputElement;
    const label = opacityInput?.nextElementSibling as HTMLElement;
    opacityInput?.addEventListener('input', () => {
      const val = parseFloat(opacityInput.value);
      if (label) {
        label.textContent = `${Math.round(val * 100)}%`;
      }
      const activeCM = CanvasManager.activeInstance;
      if (activeCM) {
        (activeCM as any).gridOpacity = val;
        activeCM.drawGrid();
      }
    });
  }

  private updateDimensionsFromImage(url: string): void {
    if (!url) return;
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const widthInput = this.element.querySelector('[name="width"]') as HTMLInputElement;
      const heightInput = this.element.querySelector('[name="height"]') as HTMLInputElement;
      if (widthInput && heightInput) {
        widthInput.value = img.naturalWidth.toString();
        heightInput.value = img.naturalHeight.toString();
        showToast(t('stageConfig.dimensionsAdjusted', { width: img.naturalWidth, height: img.naturalHeight }), 'info');
      }
    };
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    const body = this.element.querySelector('.loom-window-body')!;

    if (action.startsWith('tab-')) {
      // Tab switching
      const tabName = action.replace('tab-', '');
      body
        .querySelectorAll('.tab-button')
        .forEach((btn) => btn.classList.remove('active'));
      body
        .querySelectorAll('.tab-content')
        .forEach((tab) => tab.classList.remove('active'));

      target.classList.add('active');
      body.querySelector(`.tab-content[data-tab="${tabName}"]`)?.classList.add('active');
    } else if (action === 'save') {
      this.saveStage();
    }
  }

  private async saveStage(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    const missing = fd.missing;

    if (missing.length > 0) {
      showToast(t('stageConfig.fillRequiredFields'), 'error');
      return;
    }

    try {
      await api.put(`/stages/${this.stage.id}`, {
        name: data.name,
        backgroundUrl: data.backgroundUrl,
        backgroundColor: data.backgroundColor,
        thumbnailUrl: data.thumbnailUrl,
        weatherEffect: data.weatherEffect,
        gridSize: parseInt(data.gridSize),
        gridColor: data.gridColor,
        gridStyle: data.gridStyle,
        gridType: data.gridType,
        gridDistance: parseInt(data.gridDistance),
        gridUnit: data.gridUnit,
        gridOpacity: parseFloat(data.gridOpacity),
        padding: parseInt(data.padding),
        offsetX: parseInt(data.offsetX),
        offsetY: parseInt(data.offsetY),
        width: parseInt(data.width),
        height: parseInt(data.height),
        tokenVision: !!data.tokenVision,
        fogExplorationMode: data.fogExplorationMode,
        fogExploredColor: data.fogExploredColor,
        fogUnexploredColor: data.fogUnexploredColor,
        fogImage: data.fogImage,
        globalLight: !!data.globalLight,
        globalLightThreshold: parseFloat(data.globalLightThreshold),
        journalId: data.journalId,
        journalPageId: data.journalPageId,
        sceneType: data.sceneType || 'tactical',
        parentStageId: data.parentStageId || '',
        transitionType: data.transitionType,
        transitionDuration: parseInt(data.transitionDuration),
        flags: {
          ...(this.stage.flags || {}),
          initialX: parseInt(data['flags.initialX'] || '0'),
          initialY: parseInt(data['flags.initialY'] || '0'),
          initialZoom: parseFloat(data['flags.initialZoom'] || '1'),
          initialLevel: data['flags.initialLevel'] || this.stage.flags?.initialLevel,
          theaterDefault: !!data['flags.theaterDefault'],
        }
      });

      showToast(t('stageConfig.stageUpdateSuccess'), 'success');
      this.saved = true;
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || t('stageConfig.stageUpdateError'), 'error');
    }
  }

  override onClose(): void {
    super.onClose?.();
    // If not saved, restore original grid opacity on the active canvas instance
    if (!this.saved) {
      const activeCM = CanvasManager.activeInstance;
      if (activeCM) {
        (activeCM as any).gridOpacity = this.originalGridOpacity;
        activeCM.drawGrid();
      }
    }
  }
}