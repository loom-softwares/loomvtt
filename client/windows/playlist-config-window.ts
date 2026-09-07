/*******************************************************************************
 * LoomVTT
 * client/windows/playlist-config-window.ts
 * 
 * 
 * Window for configuring audio playlists.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { t } from '../lib/i18n.js';

export class PlaylistConfigWindow extends BaseWindow {
  private playlist: any = null;
  private loaded = false;
  private playlistId: string;
  private onSaved: () => void;

  constructor(props: { playlistId: string; onSaved?: () => void }) {
    super({
      id: `playlist-config-${props.playlistId}`,
      title: t('common.playlistConfigTitle'),
      icon: '<i class="fa-solid fa-music"></i>',
      width: 400,
      height: 'auto',
    } as BaseWindowOptions);
    this.playlistId = props.playlistId;
    this.onSaved = props.onSaved || (() => { });
  }

  async mount(): Promise<void> {
    super.mount();
    try {
      this.playlist = await api.get<any>(`/playlists/${this.playlistId}`);
      this.loaded = true;
      this.rerenderBody();
    } catch {
      showToast(t('common.errorLoad'), 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.loaded || !this.playlist) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    return `
      <div class="form-group">
        <label>Nome</label>
        <input type="text" name="name" value="${this.esc(this.playlist.name)}" required />
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea name="description" rows="2">${this.esc(this.playlist.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Modo</label>
        <select name="mode">
          <option value="sequential" ${this.playlist.mode === 'sequential' ? 'selected' : ''}>Sequencial</option>
          <option value="shuffle" ${this.playlist.mode === 'shuffle' ? 'selected' : ''}>Aleatório</option>
          <option value="simultaneous" ${this.playlist.mode === 'simultaneous' ? 'selected' : ''}>Simultâneo</option>
          <option value="soundboard" ${this.playlist.mode === 'soundboard' ? 'selected' : ''}>Sonoplastia</option>
        </select>
      </div>
      <div class="form-group">
        <label>Volume</label>
        <input type="range" name="volume" value="${this.playlist.volume ?? 0.5}" min="0" max="1" step="0.05" />
        <small>${Math.round((this.playlist.volume ?? 0.5) * 100)}%</small>
      </div>
      <div class="form-group">
        <label class="field-row">
          <input type="checkbox" name="loop" ${this.playlist.loop ? 'checked' : ''} />
          Repetir
        </label>
      </div>
      <div class="form-group">
        <label>Duração do Fade (s)</label>
        <input type="number" name="fadeDuration" value="${this.playlist.fadeDuration ?? 2}" min="0" max="60" step="1" />
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.savePlaylist();
    }
  }

  private async savePlaylist(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    const missing = fd.missing;
    if (missing.length > 0) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    try {
      await api.put(`/playlists/${this.playlistId}`, {
        name: data.name,
        description: data.description || '',
        mode: data.mode,
        volume: parseFloat(data.volume ?? 0.5),
        loop: !!data.loop,
        fadeDuration: parseInt(data.fadeDuration ?? '2'),
      });
      showToast('Playlist atualizada', 'success');
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar playlist', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
