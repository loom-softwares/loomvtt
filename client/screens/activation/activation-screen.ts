import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';
import { openOAuthPopup } from '../../lib/oauth-popup.js';

interface LicenseEntry {
  key: string;
  label?: string;
  createdAt?: string;
}

export class ActivationScreen extends BaseComponent {
  private isDevEnvironment = false;
  private availableLicenses: LicenseEntry[] = [];
  private isGoogleBusy = false;

  constructor(
    container: HTMLElement,
    private props: { isDevEnvironment?: boolean } = {},
  ) {
    super(container);
    this.isDevEnvironment = !!props.isDevEnvironment;
    this.render();
  }

  protected template(): string {
    return `
      <div class="admin-login-container">
        <div class="admin-login-card" role="region" aria-label="License Activation">
          <div class="admin-login-header">
            <img src="/images/loom-logo.png" alt="LoomVTT Logo" class="admin-login-logo" />
            <h1 class="admin-login-title">LoomVTT</h1>
            <p class="admin-login-subtitle">${t('activation.title')}</p>
          </div>

          <form class="admin-login-body" onsubmit="return false" novalidate>
            <div class="form-group">
              <label for="license-key">${t('activation.licenseKey')}</label>
              <input 
                type="text" 
                id="license-key" 
                name="licenseKey" 
                placeholder="LOOM-CORE-XXXX-YYYY" 
                autocomplete="off" 
                spellcheck="false" 
                required 
                style="text-transform: uppercase; font-family: monospace; letter-spacing: 1px;"
              />
            </div>

            ${this.isDevEnvironment ? `
              <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 6px; padding: 10px; font-size: 11px; color: #a5b4fc; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-code" style="font-size: 14px;"></i>
                <div>
                  <strong>${t('activation.devMode')}</strong> ${t('activation.devModeHint')}
                </div>
              </div>
            ` : ''}

            <div id="activation-error" role="alert" aria-live="polite" class="form-error" hidden></div>

            <button type="submit" class="btn" data-action="activate" id="btn-activate">
              <span aria-hidden="true"><i class="fa-solid fa-key"></i></span>
              ${t('activation.btnActivate')}
            </button>

            <div class="wg-oauth-divider" style="display: flex; align-items: center; text-align: center; margin: 16px 0 12px; color: #71717a; font-family: monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;">
              <span style="flex: 1; border-bottom: 1px solid rgba(255,255,255,0.1);"></span>
              <span style="padding: 0 10px;">ou</span>
              <span style="flex: 1; border-bottom: 1px solid rgba(255,255,255,0.1);"></span>
            </div>

            <button type="button" class="wg-btn-google" data-action="google-licenses" id="btn-google-licenses" ${this.isGoogleBusy ? 'disabled' : ''} style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 10px 16px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 4px; background: rgba(255, 255, 255, 0.05); color: #f1f5f9; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>${this.isGoogleBusy ? 'Buscando compras...' : 'Buscar Chave com Google'}</span>
            </button>

            ${this.availableLicenses.length > 1 ? `
              <div class="license-picker" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(228, 154, 66, 0.35); border-radius: 6px; padding: 12px; margin-top: 14px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #fbbf24; font-weight: 600;">
                  Escolha qual chave ativar nesta máquina:
                </p>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${this.availableLicenses.map((lic) => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;">
                      <div>
                        <strong style="font-family: monospace; letter-spacing: 1px; color: #f8fafc; font-size: 12px;">${this.escapeHtml(lic.key)}</strong>
                        ${lic.label ? `<br><small style="color: #94a3b8; font-size: 10px;">${this.escapeHtml(lic.label)}</small>` : ''}
                      </div>
                      <button type="button" class="btn btn-sm btn-primary" data-action="pick-license" data-key="${this.escapeHtml(lic.key)}">
                        Ativar
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </form>

          <div class="admin-login-footer" style="margin-top: 16px;">
            ${t('activation.footer')}
          </div>
        </div>
      </div>
    `;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'activate') {
      this.handleActivate();
    } else if (action === 'google-licenses') {
      void this.fetchGoogleLicenses();
    } else if (action === 'pick-license') {
      const key = target.dataset.key || target.closest<HTMLElement>('[data-key]')?.dataset.key;
      if (key) {
        const input = this.element.querySelector<HTMLInputElement>('[name="licenseKey"]');
        if (input) input.value = key;
        this.availableLicenses = [];
        this.render();
        void this.handleActivate();
      }
    }
  }

  private setError(message: string): void {
    const errorEl = this.element.querySelector('#activation-error');
    if (errorEl) {
      errorEl.innerHTML = message;
      errorEl.removeAttribute('hidden');
    }
  }

  private clearError(): void {
    const errorEl = this.element.querySelector('#activation-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.setAttribute('hidden', '');
    }
  }

  private async fetchGoogleLicenses(): Promise<void> {
    this.clearError();
    this.isGoogleBusy = true;
    this.render();

    try {
      const res = await openOAuthPopup<{ licenses?: LicenseEntry[] }>({
        mode: 'activation',
      });

      const licenses = Array.isArray(res?.licenses) ? res.licenses : [];

      if (licenses.length === 0) {
        this.setError(
          'Nenhuma licença encontrada nesta conta Google.<br><a href="https://loomvtt.site" target="_blank" style="color: #fbbf24; text-decoration: underline;">Clique aqui para adquirir sua licença</a> ou insira a chave manualmente.',
        );
      } else if (licenses.length === 1) {
        const key = licenses[0].key;
        const input = this.element.querySelector<HTMLInputElement>('[name="licenseKey"]');
        if (input) input.value = key;
        showToast('Chave encontrada! Validando licença...', 'info');
        void this.handleActivate();
      } else {
        this.availableLicenses = licenses;
        this.render();
      }
    } catch (err: any) {
      this.setError(err?.message || 'Falha ao buscar licenças com Google.');
    } finally {
      this.isGoogleBusy = false;
      this.render();
    }
  }

  private async handleActivate(): Promise<void> {
    this.clearError();

    const input = this.element.querySelector<HTMLInputElement>('[name="licenseKey"]');
    const key = input?.value?.trim().toUpperCase();

    if (!key) {
      this.setError(t('activation.errorEmpty'));
      return;
    }

    const btn = this.element.querySelector<HTMLButtonElement>('#btn-activate');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="fa-solid fa-spinner fa-spin"></i> ${t('activation.btnValidating')}`;
    }

    try {
      const res = await api.post<{ success: boolean; message: string }>('/license/activate', { key });
      showToast(res.message || t('activation.success'), 'success');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e: any) {
      console.error('[Activation] Error:', e);
      this.setError(e.message || t('activation.errorValidate'));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span aria-hidden="true"><i class="fa-solid fa-key"></i></span> ${t('activation.btnActivate')}`;
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
