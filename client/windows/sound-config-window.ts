/*******************************************************************************
 * LoomVTT
 * client/windows/sound-config-window.ts
 * 
 * 
 * Window for configuring sound effects.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { FilePickerWindow } from './file-picker-window.js';
import { t } from '../lib/i18n.js';

export class SoundConfigWindow extends BaseWindow {
  private sound: any = null;
  private loaded = false;
  private playlistId: string;
  private soundId: string;
  private onSaved: () => void;

  constructor(props: { playlistId: string; soundId: string; onSaved?: () => void }) {
    super({
      id: `sound-config-${props.soundId}`,
      title: t('common.soundConfigTitle'),
      icon: '<i class="fa-solid fa-volume-high"></i>',
      width: 400,
      height: 'auto',
    } as BaseWindowOptions);
    this.playlistId = props.playlistId;
    this.soundId = props.soundId;
    this.onSaved = props.onSaved || (() => { });
  }

  async mount(): Promise<void> {
    super.mount();
    try {
      const sounds = await api.get<any[]>(`/playlists/${this.playlistId}/sounds`);
      this.sound = sounds.find((s: any) => s.id === this.soundId);
      if (!this.sound) {
        showToast('Som não encontrado', 'error');
        return;
      }
      this.loaded = true;
      this.rerenderBody();
    } catch {
      showToast('Erro ao carregar som', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.loaded || !this.sound) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    return `
      <div class="form-group">
        <label>Nome</label>
        <input type="text" name="name" value="${this.esc(this.sound.name)}" required />
      </div>
      <div class="form-group">
        <label>Caminho do Arquivo</label>
        <div style="display:flex;gap:0.5rem;">
          <input type="text" name="path" value="${this.esc(this.sound.path || '')}" placeholder="Caminho..." style="flex:1;" />
          <button type="button" class="btn" id="pick-sound-file-btn" title="Escolher arquivo">📁</button>
        </div>
      </div>
      <div class="form-group">
        <label>Volume</label>
        <input type="range" name="volume" value="${this.sound.volume ?? 0.5}" min="0" max="1" step="0.05" />
        <small>${Math.round((this.sound.volume ?? 0.5) * 100)}%</small>
      </div>
      <div class="form-group">
        <label class="field-row">
          <input type="checkbox" name="loop" ${this.sound.loop ? 'checked' : ''} />
          Repetir
        </label>
      </div>
      <div class="form-group">
        <label>Fade In (s)</label>
        <input type="number" name="fadeIn" value="${this.sound.fadeIn ?? 0}" min="0" max="60" step="0.5" />
      </div>
      <div class="form-group">
        <label>Fade Out (s)</label>
        <input type="number" name="fadeOut" value="${this.sound.fadeOut ?? 0}" min="0" max="60" step="0.5" />
      </div>
    `;
  }

  protected onRender(): void {
    const pickBtn = this.element.querySelector('#pick-sound-file-btn');
    pickBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (path: string) => {
          const pathInput = this.element.querySelector('[name="path"]') as HTMLInputElement;
          if (pathInput) pathInput.value = path;
        },
      });
    });
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.saveSound();
    }
  }

  private async saveSound(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    const missing = fd.missing;
    if (missing.length > 0) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    try {
      await api.put(`/playlists/${this.playlistId}/sounds/${this.soundId}`, {
        name: data.name,
        path: data.path,
        volume: parseFloat(data.volume ?? 0.5),
        loop: !!data.loop,
        fadeIn: parseFloat(data.fadeIn ?? '0'),
        fadeOut: parseFloat(data.fadeOut ?? '0'),
      });
      showToast('Som atualizado', 'success');
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar som', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
