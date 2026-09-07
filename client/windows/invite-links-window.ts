/*******************************************************************************
 * LoomVTT
 * client/windows/invite-links-window.ts
 * 
 * 
 * Window for generating player invite links.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { copyTextToClipboard } from '../lib/clipboard.js';
import { t } from '../lib/i18n.js';

interface InviteLinkData {
  localLink: string;
}

interface TunnelStatus {
  running: boolean;
  mode: 'off' | 'quick' | 'named';
  url: string | null;
}

export class InviteLinksWindow extends BaseWindow {
  private inviteData: InviteLinkData | null = null;
  private tunnel: TunnelStatus | null = null;

  constructor(private props: { worldId: string }) {
    super({
      id: `invite-links-${props.worldId}`,
      title: t('inviteLinks.title'),
      icon: '<i class="fa-solid fa-link"></i>',
      width: 420,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    return `
      <div class="invite-links-container">
        <div class="section">
          <h3>${t('inviteLinks.localNetwork')}</h3>
          <div class="input-group" style="display:flex;gap:.375rem;align-items:stretch;">
            <input type="text" class="input-field" id="local-link-input" readonly value="${this.inviteData?.localLink || ''}" style="flex:1;min-width:0;">
            <button class="btn-icon" data-action="copy-local" title="${t('inviteLinks.copyButtonTitle')}" aria-label="${t('inviteLinks.copyLocalAria')}" style="flex:0 0 auto;padding:0 .625rem;"><i class="fa-regular fa-copy"></i></button>
          </div>
          <p class="help-text">${t('inviteLinks.copyLocalHelp')}</p>
        </div>
        ${this.tunnel?.running && this.tunnel.url ? `
        <div class="section">
          <h3>${t('inviteLinks.tunnelNetwork')}</h3>
          <div class="input-group" style="display:flex;gap:.375rem;align-items:stretch;">
            <input type="text" class="input-field" id="tunnel-link-input" readonly value="${this.tunnel.url}" style="flex:1;min-width:0;">
            <button class="btn-icon" data-action="copy-tunnel" title="${t('inviteLinks.copyButtonTitle')}" aria-label="${t('inviteLinks.copyTunnelAria')}" style="flex:0 0 auto;padding:0 .625rem;"><i class="fa-regular fa-copy"></i></button>
          </div>
          <p class="help-text">${t('inviteLinks.copyTunnelHelp')}${this.tunnel.mode === 'quick' ? t('inviteLinks.tunnelTemporaryHelp') : ''}</p>
        </div>` : ''}
      </div>
    `;
  }

  protected _preFirstRender(): void {
    this.loadInviteData();
  }

  private async loadInviteData(): Promise<void> {
    try {
      const response = await api.get(`/worlds/${this.props.worldId}/invite-links`);
      this.inviteData = response as InviteLinkData;
      // Tunnel is optional (route requires admin session) — failure here cannot
      // crash the local link, which is the main case for this window.
      try {
        this.tunnel = await api.get<TunnelStatus>('/tunnel/status');
      } catch {
        this.tunnel = null;
      }
      this.rerenderBody();
    } catch (error) {
      console.error('Failed to load invite links:', error);
      showToast(t('inviteLinks.loadError'), 'error');
    }
  }

  private copyToClipboard(text: string): void {
    if (copyTextToClipboard(text)) {
      showToast(t('inviteLinks.copiedSuccess'), 'success');
    } else {
      showToast(t('inviteLinks.copyError'), 'error');
    }
  }

  protected onAction(action: string): void {
    if (action === 'copy-local') {
      const localLink = this.inviteData?.localLink || '';
      this.copyToClipboard(localLink);
    } else if (action === 'copy-tunnel') {
      this.copyToClipboard(this.tunnel?.url || '');
    }
  }
}
