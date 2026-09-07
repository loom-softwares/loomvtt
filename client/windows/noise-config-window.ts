/*******************************************************************************
 * LoomVTT
 * client/windows/noise-config-window.ts
 * 
 * 
 * Window for configuring ambient sounds.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { FilePickerWindow } from './file-picker-window.js';
import { Tabs } from '../components/tabs.js';
import { t } from '../lib/i18n.js';

function input(name: string, val: string | number, extra = ''): string {
  return `<input type="text" name="${name}" value="${val}" ${extra} class="field-input" />`;
}

function range(name: string, val: number, min: number, max: number, step: number): string {
  return `<input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${val}" style="flex:1;" />`;
}

function label(text: string): string {
  return `<label class="field-label">${text}</label>`;
}



export class NoiseConfigWindow extends BaseWindow {
  private noise: any;
  private noiseId: string;
  private onSaved: () => void;
  private tabs: Tabs;

  constructor(props: { noise: any; noiseId: string; onSaved?: () => void }) {
    super({
      id: `noise-config-${props.noiseId}`,
      title: 'Configurar Som Ambiente',
      icon: '<i class="fa-solid fa-volume-high"></i>',
      width: 'auto',
      height: 'auto',
      bannerImage: '/images/general-banners/lights-banner.png',
    });
    this.noise = props.noise;
    this.noiseId = props.noiseId;
    this.onSaved = props.onSaved || (() => { });
    this.tabs = new Tabs([
      { id: 'info', label: 'Informações' },
      { id: 'audio', label: 'Áudio' },
      { id: 'activation', label: t('noiseConfig.tabActivation') }
    ]);
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-tabs-fixed');
    }
  }

  bodyTemplate(): string {
    if (!this.noise) {
      return `<div class="empty-panel">Carregando...</div>`;
    }

    const n = this.noise;

    const infoHtml = `
      <fieldset>
        <legend>Informações</legend>
        ${label('Arquivo de Áudio')}
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          ${input('src', n.src || '', 'placeholder="Selecione um arquivo..." readonly')}
          <button type="button" class="btn" id="pick-audio-btn" title="Escolher arquivo" style="flex-shrink:0;">📁</button>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <div style="flex:1;display:flex;flex-direction:column;gap:0.25rem;">
            ${label('Posição X (px)')}
            ${input('x', n.x ?? 0)}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:0.25rem;">
            ${label('Posição Y (px)')}
            ${input('y', n.y ?? 0)}
          </div>
        </div>
        <div class="field-stack" style="margin-top:0.5rem;">
          ${label('Raio (alcance em pixels)')}
          ${input('radius', n.radius ?? 100)}
        </div>
        <div class="form-group">
          <label>${t('common.level') || 'Andar'}</label>
          <select name="levelId">
            <option value="">${t('common.globalLevel') || 'Térreo (Global)'}</option>
            ${(CanvasManager.activeInstance?.levels || []).map(l => `<option value="${l.id}" ${n.levelId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>
      </fieldset>
    `;

    const audioHtml = `
      <fieldset>
        <legend>Configurações de Áudio</legend>
        <div class="field-stack">
          ${label('Volume')}
          <div class="field-row">
            ${range('volume', Math.round((n.volume ?? 1) * 100), 0, 100, 1)}
            <span class="volume-val" style="font-size:0.8rem;color:var(--color-text-secondary);min-width:3em;text-align:right;">${Math.round((n.volume ?? 1) * 100)}%</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
          <input type="checkbox" name="easing" id="noise-easing" ${n.easing ? 'checked' : ''} style="cursor:pointer;" />
          <label for="noise-easing" style="font-size:0.85rem;color:var(--color-text-primary);cursor:pointer;user-select:none;">${t('noiseConfig.easingLabel')}</label>
        </div>
      </fieldset>
    `;

    const activationHtml = `
      <fieldset>
        <legend>${t('noiseConfig.activationLegend')}</legend>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <input type="checkbox" name="hidden" id="noise-hidden" ${n.hidden ? 'checked' : ''} style="cursor:pointer;" />
          <label for="noise-hidden" style="font-size:0.85rem;color:var(--color-text-primary);cursor:pointer;user-select:none;">${t('noiseConfig.hidden')}</label>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <input type="checkbox" name="wallsBlock" id="noise-walls-block" ${n.wallsBlock ? 'checked' : ''} style="cursor:pointer;" />
          <label for="noise-walls-block" style="font-size:0.85rem;color:var(--color-text-primary);cursor:pointer;user-select:none;">${t('noiseConfig.wallsBlock')}</label>
        </div>
        <div class="field-stack">
          ${label(t('noiseConfig.darknessMin'))}
          <div class="field-row">
            ${range('darknessMin', n.darknessMin ?? 0, 0, 1, 0.05)}
            <span class="darkness-min-val" style="font-size:0.8rem;color:var(--color-text-secondary);min-width:3em;text-align:right;">${Math.round((n.darknessMin ?? 0) * 100)}%</span>
          </div>
        </div>
        <div class="field-stack" style="margin-top:0.5rem;">
          ${label(t('noiseConfig.darknessMax'))}
          <div class="field-row">
            ${range('darknessMax', n.darknessMax ?? 1, 0, 1, 0.05)}
            <span class="darkness-max-val" style="font-size:0.8rem;color:var(--color-text-secondary);min-width:3em;text-align:right;">${Math.round((n.darknessMax ?? 1) * 100)}%</span>
          </div>
        </div>
      </fieldset>
    `;

    return `
      <div class="banner-spacer"></div>
      ${this.tabs.navTemplate()}
      <form class="noise-config-form loom-form" style="display:flex;flex-direction:column;flex:auto;min-height:0;">
        ${this.tabs.contentWrapper('info', infoHtml)}
        ${this.tabs.contentWrapper('audio', audioHtml)}
        ${this.tabs.contentWrapper('activation', activationHtml)}
      </form>
    `;
  }

  protected onRender(): void {
    this.tabs.bind(this.element);
    const formEl = this.element.querySelector('.noise-config-form') as HTMLElement;
    if (!formEl) return;

    const pickBtn = formEl.querySelector('#pick-audio-btn');
    pickBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          const srcInput = formEl.querySelector<HTMLInputElement>('[name="src"]');
          if (srcInput) srcInput.value = path;
        }
      });
    });

    const volRange = formEl.querySelector<HTMLInputElement>('[name="volume"]');
    const volLabel = formEl.querySelector<HTMLElement>('.volume-val');
    if (volRange && volLabel) {
      volRange.addEventListener('input', () => {
        volLabel.textContent = Math.round(parseFloat(volRange.value)) + '%';
      });
    }

    const darknessMinRange = formEl.querySelector<HTMLInputElement>('[name="darknessMin"]');
    const darknessMinLabel = formEl.querySelector<HTMLElement>('.darkness-min-val');
    if (darknessMinRange && darknessMinLabel) {
      darknessMinRange.addEventListener('input', () => {
        darknessMinLabel.textContent = Math.round(parseFloat(darknessMinRange.value) * 100) + '%';
      });
    }

    const darknessMaxRange = formEl.querySelector<HTMLInputElement>('[name="darknessMax"]');
    const darknessMaxLabel = formEl.querySelector<HTMLElement>('.darkness-max-val');
    if (darknessMaxRange && darknessMaxLabel) {
      darknessMaxRange.addEventListener('input', () => {
        darknessMaxLabel.textContent = Math.round(parseFloat(darknessMaxRange.value) * 100) + '%';
      });
    }
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      void this.submit({ close: true });
    } else if (action === 'cancel') {
      windowManager.close(this.options.id);
    } else if (action === 'delete') {
      void this.deleteNoise();
    }
  }

  private async submit(options: { close?: boolean } = {}): Promise<void> {
    if (!this.noise) return;
    const formEl = this.element.querySelector('.noise-config-form');
    if (!formEl) return;

    const fd = new LoomFormData(formEl as HTMLElement);
    const data = fd.object;

    try {
      await api.put(`/noises/${this.noiseId}`, {
        src: data.src || '',
        x: parseFloat(data.x ?? '0'),
        y: parseFloat(data.y ?? '0'),
        radius: parseFloat(data.radius ?? '100'),
        volume: parseFloat(data.volume ?? '100') / 100,
        easing: !!data.easing,
        hidden: !!data.hidden,
        wallsBlock: !!data.wallsBlock,
        darknessMin: parseFloat(data.darknessMin ?? '0'),
        darknessMax: parseFloat(data.darknessMax ?? '1'),
        levelId: data.levelId ?? '',
      });
      showToast('Som atualizado', 'success');
      if (options.close) {
        windowManager.close(this.options.id);
      }
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar som', 'error');
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
        label: 'Excluir',
        action: 'delete',
        title: 'Excluir Som Ambiente',
      },
    ];
  }

  private async deleteNoise(): Promise<void> {
    try {
      await api.delete(`/noises/${this.noiseId}`);
      showToast('Som excluído', 'success');
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir som', 'error');
    }
  }
}
