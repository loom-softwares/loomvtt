/*******************************************************************************
 * LoomVTT
 * client/windows/cloudflared-tunnel-window.ts
 * 
 * 
 * Window for managing Cloudflare tunnels.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { copyTextToClipboard } from '../lib/clipboard.js';
import { t } from '../lib/i18n.js';

interface TunnelStatus {
  running: boolean;
  mode: 'off' | 'quick' | 'named';
  url: string | null;
}

export class CloudflaredTunnelWindow extends BaseWindow {
  private status: TunnelStatus = { running: false, mode: 'off', url: null };
  private loaded = false;
  private saving = false;
  private selectedTab: 'quick' | 'named' = 'quick';

  constructor() {
    super({
      id: 'cloudflared-tunnel',
      title: t('tunnel.title'),
      icon: '<i class="fa-solid fa-globe"></i>',
      width: 500,
      height: 'auto',
    } as BaseWindowOptions);
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadStatus();
  }

  private async loadStatus(): Promise<void> {
    try {
      this.status = await api.get<TunnelStatus>('/tunnel/status');
      if (this.status.mode !== 'off') {
        this.selectedTab = this.status.mode;
      }
      this.loaded = true;
      this.rerenderBody();
    } catch (err: any) {
      showToast(err.message || 'Error loading tunnel status', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div style="padding:1rem;text-align:center;color:var(--color-text-secondary)">${t('tunnel.loading')}</div>`;
    }

    const { running, url } = this.status;

    return `
      <div style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
        <div class="tabs" style="display:flex; gap:0.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
          <button class="btn ${this.selectedTab === 'quick' ? 'btn-primary' : ''}" data-action="tab-quick" ${running ? 'disabled' : ''}>Quick</button>
          <button class="btn ${this.selectedTab === 'named' ? 'btn-primary' : ''}" data-action="tab-named" ${running ? 'disabled' : ''}>Named</button>
        </div>

        <div class="field-row">
          <span style="font-size:1.2rem;">${running ? '✅' : '❌'}</span>
          <span style="color:var(--color-text-secondary);">
            ${running ? t('tunnel.statusRunning') : t('tunnel.statusStopped')}
          </span>
        </div>

        <div class="alert alert-warning" style="background: rgba(255, 153, 0, 0.1); border: 1px solid var(--color-warning, orange); padding: 0.75rem; border-radius: 4px;">
          ⚠️ <strong>${t('tunnel.warningTitle')}</strong><br>
          ${this.selectedTab === 'quick' ? t('tunnel.quickWarning') : t('tunnel.namedWarning')}
        </div>

        ${this.selectedTab === 'named' ? `
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>${t('tunnel.namedLabel')}</label>
              <span style="font-size:0.75rem; padding:0.125rem 0.375rem; border-radius:3px; background:var(--color-bg-secondary, #333); color:var(--color-text-secondary);">${t('tunnel.namedAdvancedBadge')}</span>
            </div>
            <input type="text" id="tunnel-name-input" class="settings-select"
              placeholder="${t('tunnel.namedPlaceholder')}"
              ${running ? 'disabled' : ''}
              style="width:100%;box-sizing:border-box;" />
            <small style="display:block; margin-top:0.25rem;">${t('tunnel.namedHelp')} <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary, #6366f1); text-decoration:underline;">${t('tunnel.namedDocsLink')}</a></small>
          </div>
        ` : ''}

        ${url ? `
          <div class="form-group">
            <label>${t('tunnel.activeUrl')}</label>
            <div style="display:flex; gap: 0.5rem;">
              <input type="text" class="settings-select" value="${url}" readonly style="width:100%;box-sizing:border-box;" />
              <button class="btn" data-action="copy-url" data-url="${url}">📋</button>
            </div>
            <small style="display:block; margin-top:0.375rem; color:var(--color-text-secondary);">${t('tunnel.inviteTip')}</small>
          </div>
        ` : ''}

        <button class="btn btn-block ${running ? 'btn-danger' : 'btn-primary'}" data-action="${running ? 'stop-tunnel' : 'start-tunnel'}" ${this.saving ? 'disabled' : ''}>
          ${this.saving ? '...' : (running ? t('tunnel.stop') : t('tunnel.start'))}
        </button>
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'tab-quick' && !this.status.running) {
      this.selectedTab = 'quick';
      this.rerenderBody();
    } else if (action === 'tab-named' && !this.status.running) {
      this.selectedTab = 'named';
      this.rerenderBody();
    } else if (action === 'start-tunnel') {
      void this.startTunnel();
    } else if (action === 'stop-tunnel') {
      void this.stopTunnel();
    } else if (action === 'copy-url') {
      const url = target.dataset.url;
      if (url) {
        if (copyTextToClipboard(url)) {
          showToast(t('tunnel.copied'), 'success');
        }
      }
    }
  }

  private async startTunnel(): Promise<void> {
    if (this.saving) return;

    let name: string | undefined;
    if (this.selectedTab === 'named') {
      const input = this.element?.querySelector('#tunnel-name-input') as HTMLInputElement;
      name = input?.value?.trim();
      if (!name) {
        showToast(t('tunnel.nameRequired'), 'error');
        return;
      }
    }

    this.saving = true;
    this.rerenderBody();

    try {
      this.status = await api.post<TunnelStatus>('/tunnel/start', {
        mode: this.selectedTab,
        name
      });
      showToast(t('tunnel.startSuccess'), 'success');
    } catch (err: any) {
      showToast(err.message || t('tunnel.startError'), 'error');
    } finally {
      this.saving = false;
      this.rerenderBody();
    }
  }

  private async stopTunnel(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.rerenderBody();

    try {
      this.status = await api.post<TunnelStatus>('/tunnel/stop', {});
      showToast(t('tunnel.stopSuccess'), 'success');
    } catch (err: any) {
      showToast(err.message || t('tunnel.stopError'), 'error');
    } finally {
      this.saving = false;
      this.rerenderBody();
    }
  }
}
