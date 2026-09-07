/*******************************************************************************
 * LoomVTT
 * client/screens/setup-hub/loom-account-widget.ts
 *
 * Setup Hub topbar widget: lets the installation Admin connect/disconnect the
 * central Loom Account (loomvtt.site) that unlocks purchased modules. This
 * screen is always an Admin session (Setup Hub cookie), so no extra
 * permission check is needed here — the server still enforces requireAdmin
 * on connect/disconnect regardless.
 ******************************************************************************/

import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';
import { openOAuthPopup } from '../../lib/oauth-popup.js';

interface LoomAccountStatus {
  connected: boolean;
  accountId?: string;
  role?: string;
  displayName?: string;
  avatarUrl?: string;
  stale?: boolean;
}

export class LoomAccountWidget extends BaseComponent {
  private status: LoomAccountStatus = { connected: false };
  private isOpen = false;
  private isBusy = false;

  constructor(container: HTMLElement) {
    super(container);
    this.refresh();
    // Capture phase: precisa rodar ANTES do listener local (que troca o DOM
    // via render() e desanexa o node original). Em fase de bubble o target do
    // clique no proprio botao de abrir ja estaria desanexado quando chegasse
    // aqui, e contains(target) sempre dava falso — fechava no mesmo clique
    // que abria.
    document.addEventListener('click', this.onDocumentClick, true);
  }

  async refresh(): Promise<void> {
    try {
      this.status = await api.get<LoomAccountStatus>('/loom-account/status');
    } catch {
      this.status = { connected: false };
    }
    this.render();
  }

  protected template(): string {
    const isConnected = !!this.status.connected;
    const isStale = !!this.status.stale;
    const statusClass = isConnected ? (isStale ? 'is-stale' : 'is-connected') : 'is-disconnected';
    const statusTitle = isConnected
      ? `Conta Loom: ${this.status.displayName || 'Conectado'} (${this.status.role || 'comprador'})${isStale ? ' - Conexão expirada' : ''}`
      : 'Conta Loom: Desconectada';

    return `
      <div class="loom-account-widget ${statusClass}">
        <button type="button" class="btn-icon loom-account-btn" data-action="toggle-popover" title="${this.escapeHtml(statusTitle)}" aria-label="${this.escapeHtml(statusTitle)}">
          ${isConnected && this.status.avatarUrl
            ? `<img class="loom-account-avatar" src="${this.escapeHtml(this.status.avatarUrl)}" alt="" />`
            : `<i class="fa-solid fa-cloud" aria-hidden="true"></i>`}
          <span class="loom-account-dot"></span>
        </button>

        ${this.isOpen ? this.renderPopover() : ''}
      </div>
    `;
  }

  private renderPopover(): string {
    const isConnected = !!this.status.connected;
    const isStale = !!this.status.stale;

    return `
      <div class="loom-account-popover" data-part="popover">
        <div class="popover-header">
          <div class="popover-title">
            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            <span>Conta Loom (Instalação)</span>
          </div>
          <button type="button" class="btn-close-popover" data-action="close-popover" title="Fechar" aria-label="Fechar">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div class="popover-body">
          ${isConnected ? `
            <div class="account-card connected">
              <div class="account-info">
                ${this.status.avatarUrl ? `<img class="account-avatar-lg" src="${this.escapeHtml(this.status.avatarUrl)}" alt="" />` : ''}
                <span class="account-name">${this.escapeHtml(this.status.displayName || '')}</span>
                <span class="account-badge ${this.status.role}">${this.escapeHtml(this.status.role || 'comprador')}</span>
              </div>
              ${isStale ? `
                <div class="account-alert stale">
                  <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  <span>Aviso: Conexão expirada (stale). Verifique sua internet.</span>
                </div>
              ` : `
                <div class="account-alert ok">
                  <i class="fa-solid fa-check" aria-hidden="true"></i>
                  <span>Sincronizada com loomvtt.site</span>
                </div>
              `}
              <div class="account-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-action="disconnect-account" ${this.isBusy ? 'disabled' : ''}>
                  ${this.isBusy ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Desconectando...' : 'Desconectar Conta'}
                </button>
              </div>
            </div>
          ` : `
            <div class="account-card disconnected">
              <p class="account-hint">
                Vincule esta instalação à sua conta do <strong>loomvtt.site</strong> para liberar módulos e compêndios comprados. Módulos gratuitos continuam baixando normalmente sem conexão nenhuma.
              </p>
              <button type="button" class="btn-google" data-action="connect-google" ${this.isBusy ? 'disabled' : ''}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>${this.isBusy ? 'Conectando...' : 'Entrar com Google'}</span>
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  protected onAction(action: string, _id: string | null, _target: HTMLElement): void {
    if (action === 'toggle-popover') {
      this.isOpen = !this.isOpen;
      this.render();
    } else if (action === 'close-popover') {
      this.isOpen = false;
      this.render();
    } else if (action === 'connect-google') {
      void this.connectWithGoogle();
    } else if (action === 'disconnect-account') {
      void this.disconnect();
    }
  }

  private onDocumentClick = (e: MouseEvent): void => {
    if (!this.isOpen) return;
    const target = e.target as Node;
    if (!this.element.contains(target)) {
      this.isOpen = false;
      this.render();
    }
  };

  private async connectWithGoogle(): Promise<void> {
    this.isBusy = true;
    this.render();

    try {
      const res = await openOAuthPopup<{ exchangeCode?: string; refreshToken?: string }>({ mode: 'admin_connect' });
      if (!res?.exchangeCode) {
        throw new Error('Código de autorização não recebido.');
      }
      await api.post('/loom-account/connect-google', { exchangeCode: res.exchangeCode, refreshToken: res.refreshToken });
      showToast('Conta conectada com sucesso', 'success');
      await this.refresh();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao conectar com Google', 'error');
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  private async disconnect(): Promise<void> {
    this.isBusy = true;
    this.render();

    try {
      await api.post('/loom-account/disconnect', {});
      showToast('Conta desconectada com sucesso', 'success');
      await this.refresh();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao desconectar conta', 'error');
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    document.removeEventListener('click', this.onDocumentClick, true);
    super.destroy();
  }
}
