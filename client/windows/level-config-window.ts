/*******************************************************************************
 * LoomVTT
 * client/windows/level-config-window.ts
 * 
 * 
 * Window for configuring scene levels.
 ******************************************************************************/

import { BaseWindow, type BaseWindowOptions } from './base-window.js';
import { t } from '../lib/i18n.js';
import { LoomFormData } from '../core/form-data.js';
import { FilePickerWindow } from './file-picker-window.js';
import { windowManager } from '../core/window-manager.js';

export interface LevelData {
  id?: string;
  stageId: string;
  name: string;
  bottomElevation: number;
  topElevation: number;
  backgroundUrl: string;
  backgroundColor: string;
  backgroundTint?: string;
  alphaThreshold?: number;
  foregroundUrl?: string;
  foregroundTint?: string;
  fogExplorationUrl?: string;
  anchorX?: number;
  anchorY?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  fitMode?: string;
  rotation?: number;
}

export class LevelConfigWindow extends BaseWindow {
  private levelData: LevelData;
  private onSaveCallback?: (data: LevelData) => void;

  constructor(props: { levelData: LevelData; onSave?: (data: LevelData) => void; options?: Partial<BaseWindowOptions> }) {
    super({
      id: `level-config-${props.levelData.id || 'new'}`,
      title: props.levelData.id ? t('levelConfig.titleEdit', { name: props.levelData.name }) : t('levelConfig.titleNew'),
      width: 500,
      height: 'auto',
      // This window already has its own Save button (full width, at the end of the
      // form) and saves via `submit`. Without this, BaseWindow would draw
      // Cancel/Save at the bottom and two Save buttons would appear.
      showFooter: false,
      bannerImage: '/images/general-banners/map-banner.png',
      ...(props.options || {})
    });

    this.levelData = props.levelData;
    this.onSaveCallback = props.onSave;
  }

  bodyTemplate(): string {
    const data = this.levelData;

    return `
      <form autocomplete="off">
        <fieldset class="form-fieldset">
          <legend class="form-legend">Básico</legend>
          <div class="form-group form-group-horizontal">
            <label>${t('levelConfig.name')}</label>
            <div class="form-fields">
              <input type="text" name="name" value="${data.name || ''}" placeholder="${t('levelConfig.namePlaceholder')}" required />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>${t('levelConfig.elevation')}</label>
            <div class="form-fields">
              <label>${t('levelConfig.bottomElevation')}</label>
              <input type="number" name="bottomElevation" value="${data.bottomElevation ?? 0}" />
              <label>${t('levelConfig.topElevation')}</label>
              <input type="number" name="topElevation" value="${data.topElevation ?? 20}" />
            </div>
          </div>
          <small>${t('levelConfig.elevationDesc')}</small>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">Fundo</legend>
          <div class="form-group form-group-horizontal">
            <label>${t('levelConfig.backgroundImage')}</label>
            <div class="form-fields">
              <input type="text" name="backgroundUrl" id="level-bg-url" value="${data.backgroundUrl || ''}" placeholder="${t('levelConfig.backgroundImagePlaceholder')}" />
              <button type="button" class="icon-button" data-action="pick-image" data-target="level-bg-url" title="${t('levelConfig.pickExistingFile')}">
                <i class="fas fa-file-image"></i>
              </button>
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>${t('levelConfig.backgroundColor')}</label>
            <div class="form-fields">
              <input type="color" name="backgroundColor" value="${data.backgroundColor || '#000000'}" />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Matiz de Fundo</label>
            <div class="form-fields">
              <input type="color" name="backgroundTint" value="${data.backgroundTint || '#ffffff'}" />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Limite de Alfa</label>
            <div class="form-fields">
              <input type="number" name="alphaThreshold" value="${data.alphaThreshold ?? 0.75}" min="0" max="1" step="0.05" />
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">Primeiro Plano</legend>
          <div class="form-group form-group-horizontal">
            <label>Textura</label>
            <div class="form-fields">
              <input type="text" name="foregroundUrl" id="level-fg-url" value="${data.foregroundUrl || ''}" />
              <button type="button" class="icon-button" data-action="pick-image" data-target="level-fg-url" title="${t('levelConfig.pickExistingFile')}">
                <i class="fas fa-file-image"></i>
              </button>
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Matiz</label>
            <div class="form-fields">
              <input type="color" name="foregroundTint" value="${data.foregroundTint || '#ffffff'}" />
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">Exploração da Névoa</legend>
          <div class="form-group form-group-horizontal">
            <label>Textura Inexplorada</label>
            <div class="form-fields">
              <input type="text" name="fogExplorationUrl" id="level-fog-url" value="${data.fogExplorationUrl || ''}" />
              <button type="button" class="icon-button" data-action="pick-image" data-target="level-fog-url" title="${t('levelConfig.pickExistingFile')}">
                <i class="fas fa-file-image"></i>
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-fieldset">
          <legend class="form-legend">Posicionamento</legend>
          <div class="form-group form-group-horizontal">
            <label>Âncora (X, Y)</label>
            <div class="form-fields">
              <input type="number" name="anchorX" value="${data.anchorX ?? 0.5}" step="0.1" />
              <input type="number" name="anchorY" value="${data.anchorY ?? 0.5}" step="0.1" />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Deslocamento (X, Y)</label>
            <div class="form-fields">
              <input type="number" name="offsetX" value="${data.offsetX ?? 0}" />
              <input type="number" name="offsetY" value="${data.offsetY ?? 0}" />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Escala (X, Y)</label>
            <div class="form-fields">
              <input type="number" name="scaleX" value="${data.scaleX ?? 1}" step="0.1" />
              <input type="number" name="scaleY" value="${data.scaleY ?? 1}" step="0.1" />
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Modo de Ajuste</label>
            <div class="form-fields">
              <select name="fitMode">
                <option value="fill" ${data.fitMode === 'fill' ? 'selected' : ''}>Preencher (Fill)</option>
                <option value="cover" ${data.fitMode === 'cover' ? 'selected' : ''}>Cobrir (Cover)</option>
                <option value="contain" ${data.fitMode === 'contain' ? 'selected' : ''}>Conter (Contain)</option>
                <option value="none" ${data.fitMode === 'none' ? 'selected' : ''}>Nenhum</option>
              </select>
            </div>
          </div>
          <div class="form-group form-group-horizontal">
            <label>Rotação (graus)</label>
            <div class="form-fields">
              <input type="number" name="rotation" value="${data.rotation ?? 0}" />
            </div>
          </div>
        </fieldset>

        <footer class="sheet-footer">
          <button type="submit" class="primary">
            <i class="fas fa-save"></i> ${t('common.save')}
          </button>
        </footer>
      </form>
    `;
  }

  protected _postRender(): void {
    super._postRender();
    if (!this.element) return;

    const form = this.element.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        // O dispatcher genérico de `submit` em dom-render.ts (attachDataActionDispatch)
        // escuta esse mesmo evento no elemento raiz da window e, partindo do princípio de
        // que nenhum form deste projeto usa submit nativo, despacha o PRIMEIRO
        // `[data-action]` que achar dentro do form — que aqui é o botão "pick-image" do
        // fundo, não o Salvar. Sem stopPropagation, salvar reabria o seletor de arquivo.
        e.stopPropagation();
        const fd = new LoomFormData(form);
        const formData = fd.object as any;

        const updatedData: LevelData = {
          ...this.levelData,
          ...formData,
          bottomElevation: Number(formData.bottomElevation),
          topElevation: Number(formData.topElevation),
          alphaThreshold: Number(formData.alphaThreshold),
          anchorX: Number(formData.anchorX),
          anchorY: Number(formData.anchorY),
          offsetX: Number(formData.offsetX),
          offsetY: Number(formData.offsetY),
          scaleX: Number(formData.scaleX),
          scaleY: Number(formData.scaleY),
          rotation: Number(formData.rotation),
        };

        if (this.onSaveCallback) {
          this.onSaveCallback(updatedData);
        }
        windowManager.close(this.options.id);
      });
    }

  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'pick-image') {
      const targetId = target.getAttribute('data-target');
      this.renderChild(FilePickerWindow, `file-picker-${targetId}`, {
        onSelect: (path: string) => {
          if (targetId) {
            const input = this.element!.querySelector(`#${targetId}`) as HTMLInputElement;
            if (input) input.value = path;
          }
        }
      });
    }
  }
}
