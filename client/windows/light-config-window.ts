/*******************************************************************************
 * LoomVTT
 * client/windows/light-config-window.ts
 * 
 * 
 * Window for configuring ambient lights.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { CanvasManager } from '../canvas/canvas-manager.js';

export class LightConfigWindow extends BaseWindow {
  private light: any;
  private lightId: string;
  private onSaved: () => void;
  private originalLight: any;
  private saved = false;

  constructor(props: { light: any; lightId: string; onSaved?: () => void }) {
    super({
      id: `light-config-${props.lightId}`,
      title: t('lightConfig.title'),
      icon: '<i class="fa-solid fa-lightbulb"></i>',
      width: 420,
      height: 'auto',
      bannerImage: '/images/general-banners/lights-banner.png',
    } as BaseWindowOptions);
    this.light = props.light;
    this.lightId = props.lightId;
    this.onSaved = props.onSaved || (() => { });
    this.originalLight = { ...props.light };
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-tabs-fixed');
    }
  }

  bodyTemplate(): string {
    if (!this.light) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    return `
      <div class="banner-spacer"></div>
      <div class="tabs">
        <button type="button" class="tab-button active" data-tab="basic"><i class="fa-solid fa-gear"></i> ${t('lightConfig.tabBasic')}</button>
        <button type="button" class="tab-button" data-tab="animation">⚡ ${t('lightConfig.tabAnimation')}</button>
        <button type="button" class="tab-button" data-tab="advanced">🛠️ ${t('lightConfig.tabAdvanced')}</button>
      </div>

      <div class="tab-content active" data-tab="basic">
        <div class="form-group">
          <label>${t('lightConfig.lightColor')}</label>
          <div class="color-input-group">
            <input type="color" name="color" value="${this.light.color || '#ffffff'}" />
            <input type="text" id="color-hex" value="${this.light.color || '#ffffff'}" />
          </div>
        </div>
        <div class="form-group">
          <label>${t('lightConfig.intensity')}</label>
          <div class="range-input-group">
            <input type="range" name="intensity" min="0.05" max="1" step="0.05" value="${this.light.intensity || 0.5}" oninput="this.nextElementSibling.value = Math.round(this.value * 100) + '%'" />
            <input type="text" class="range-value" id="val-intensity" value="${Math.round((this.light.intensity || 0.5) * 100)}%" readonly />
          </div>
        </div>
        <div class="form-group">
          <label>${t('lightConfig.radius')}</label>
          <input type="number" name="radius" min="10" max="2000" value="${this.light.radius || 300}" />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.bright')}</label>
          <input type="number" name="bright" min="0" max="2000" value="${this.light.bright || 150}" />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.dim')}</label>
          <input type="number" name="dim" min="0" max="2000" value="${this.light.dim || 300}" />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.angle')}</label>
          <input type="number" name="angle" min="10" max="360" value="${this.light.angle || 360}" />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.rotation')}</label>
          <input type="number" name="rotation" min="0" max="360" value="${this.light.rotation || 0}" />
        </div>
        <div class="field">
          <label>${t('common.level') || 'Andar'}</label>
          <select name="levelId">
            <option value="">${t('common.globalLevel') || 'Térreo (Global)'}</option>
            ${(CanvasManager.activeInstance?.levels || []).map(l => `<option value="${l.id}" ${this.light.levelId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="tab-content" data-tab="animation">
        <div class="form-group">
          <label>${t('lightConfig.animType')}</label>
          <select name="animation">
            <option value="none" ${this.light.animation === 'none' ? 'selected' : ''}>${t('lightConfig.animNone')}</option>
            <option value="torch" ${this.light.animation === 'torch' ? 'selected' : ''}>🕯️ ${t('lightConfig.animTorch')}</option>
            <option value="pulse" ${this.light.animation === 'pulse' ? 'selected' : ''}>💓 ${t('lightConfig.animPulse')}</option>
            <option value="chroma" ${this.light.animation === 'chroma' ? 'selected' : ''}>🌈 ${t('lightConfig.animChroma')}</option>
            <option value="wave" ${this.light.animation === 'wave' ? 'selected' : ''}>🌊 ${t('lightConfig.animWave')}</option>
            <option value="fog" ${this.light.animation === 'fog' ? 'selected' : ''}>☁️ ${t('lightConfig.animFog')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${t('lightConfig.animSpeed')}</label>
          <input type="number" name="animationSpeed" min="0" max="10" step="0.1" value="${this.light.animationSpeed || 1}" />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.animIntensity')}</label>
          <input type="range" name="animationIntensity" min="0" max="1" step="0.05" value="${this.light.animationIntensity || 0.5}" />
          <span class="range-value" id="val-animationIntensity">${Math.round((this.light.animationIntensity || 0.5) * 100)}%</span>
        </div>
      </div>

      <div class="tab-content" data-tab="advanced">
        <div class="form-group">
          <label>${t('lightConfig.darknessMin')}</label>
          <input type="range" name="darknessMin" min="0" max="1" step="0.05" value="${this.light.darknessMin ?? 0}" />
          <span class="range-value" id="val-darknessMin">${Math.round((this.light.darknessMin ?? 0) * 100)}%</span>
        </div>
        <div class="form-group">
          <label>${t('lightConfig.darknessMax')}</label>
          <input type="range" name="darknessMax" min="0" max="1" step="0.05" value="${this.light.darknessMax ?? 1}" />
          <span class="range-value" id="val-darknessMax">${Math.round((this.light.darknessMax ?? 1) * 100)}%</span>
        </div>
        <div class="form-group">
          <label>${t('lightConfig.walls')}</label>
          <input type="checkbox" name="walls" ${this.light.walls !== false ? 'checked' : ''} />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.vision')}</label>
          <input type="checkbox" name="vision" ${this.light.vision ? 'checked' : ''} />
        </div>
        <div class="form-group">
          <label>${t('lightConfig.hidden')}</label>
          <input type="checkbox" name="isHidden" ${this.light.isHidden ? 'checked' : ''} />
        </div>
      </div>
    `;
  }

  protected onRender(): void {
    // 1. Tab Switching Logic
    const tabs = this.element.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const contents = this.element.querySelectorAll('.tab-content');
        contents.forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-tab') === targetTab);
        });
      });
    });

    // Color text input sync with color picker
    const colorPicker = this.element.querySelector('[name="color"]') as HTMLInputElement;
    const colorHex = this.element.querySelector('#color-hex') as HTMLInputElement;
    if (colorPicker && colorHex) {
      colorPicker.addEventListener('input', () => {
        colorHex.value = colorPicker.value;
        updatePreview();
      });
      colorHex.addEventListener('input', () => {
        if (/^#[0-9A-F]{6}$/i.test(colorHex.value)) {
          colorPicker.value = colorHex.value;
          updatePreview();
        }
      });
    }

    const updatePreview = () => {
      const activeCM = CanvasManager.activeInstance;
      if (!activeCM) return;

      const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
      const fd = new LoomFormData(body);
      const data = fd.object;

      // Construct updated light data copy
      const updatedLight = {
        ...this.light,
        color: data.color || '#ffffff',
        intensity: parseFloat(data.intensity || '0.5'),
        radius: parseInt(data.radius || '300'),
        angle: parseInt(data.angle || '360'),
        rotation: parseInt(data.rotation || '0'),
        bright: parseInt(data.bright || '150'),
        dim: parseInt(data.dim || '300'),
        animation: data.animation || 'none',
        animationSpeed: parseFloat(data.animationSpeed || '1'),
        animationIntensity: parseFloat(data.animationIntensity || '0.5'),
        darknessMin: parseFloat(data.darknessMin || '0'),
        darknessMax: parseFloat(data.darknessMax || '1'),
        isHidden: !!data.isHidden,
        walls: !!data.walls,
        vision: !!data.vision,
        levelId: data.levelId ?? '',
      };

      // Sync local lights list
      const lights = (activeCM as any).allLights;
      const idx = lights.findIndex((l: any) => l.id === this.lightId);
      if (idx >= 0) {
        lights[idx] = updatedLight;
      }

      // Update renderer preview
      activeCM.updateLight(updatedLight);
    };

    // Add live range value displays
    const ranges = ['intensity', 'animationIntensity', 'darknessMin', 'darknessMax'];
    ranges.forEach(name => {
      const input = this.element.querySelector(`[name="${name}"]`) as HTMLInputElement;
      const span = this.element.querySelector(`#val-${name}`) as HTMLElement;
      if (input && span) {
        input.addEventListener('input', () => {
          span.textContent = Math.round(parseFloat(input.value) * 100) + '%';
          updatePreview();
        });
      }
    });

    // Listeners for all inputs
    const inputs = this.element.querySelectorAll('input[type="number"], input[type="text"], input[type="color"], input[type="checkbox"], select');
    inputs.forEach(input => {
      input.addEventListener('change', updatePreview);
    });

    // Prevent propagation for custom action buttons inside body
    const bodyEl = this.element.querySelector('.loom-window-body');
    if (bodyEl) {
      const buttons = bodyEl.querySelectorAll('button[data-action]');
      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
        });
      });
    }
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.saveLight();
    }
  }

  private async saveLight(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;

    try {
      const stageId = this.light.stageId;
      if (!stageId) {
        throw new Error('ID da cena não encontrado');
      }

      await api.put(`/stages/${stageId}/lights/${this.lightId}`, {
        color: data.color || '#ffffff',
        intensity: parseFloat(data.intensity || '0.5'),
        radius: parseInt(data.radius || '300'),
        angle: parseInt(data.angle || '360'),
        rotation: parseInt(data.rotation || '0'),
        bright: parseInt(data.bright || '150'),
        dim: parseInt(data.dim || '300'),
        animation: data.animation || 'none',
        animationSpeed: parseFloat(data.animationSpeed || '1'),
        animationIntensity: parseFloat(data.animationIntensity || '0.5'),
        darknessMin: parseFloat(data.darknessMin || '0'),
        darknessMax: parseFloat(data.darknessMax || '1'),
        isHidden: !!data.isHidden,
        walls: data.walls !== false,
        vision: !!data.vision,
        levelId: data.levelId ?? '',
      });

      showToast(t('lightConfig.saveSuccess'), 'success');
      this.saved = true;
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || t('lightConfig.saveError'), 'error');
    }
  }

  override onClose(): void {
    super.onClose?.();
    if (!this.saved) {
      const activeCM = CanvasManager.activeInstance;
      if (activeCM) {
        const lights = (activeCM as any).allLights;
        const idx = lights.findIndex((l: any) => l.id === this.lightId);
        if (idx >= 0) {
          lights[idx] = this.originalLight;
          activeCM.updateLight(this.originalLight);
        }
      }
    }
  }
}