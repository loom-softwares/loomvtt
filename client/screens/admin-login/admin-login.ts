import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api, API_PATHS, ApiError } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { showToast } from '../../components/toast.js';

export class AdminLoginScreen extends BaseComponent {
  constructor(
    container: HTMLElement,
    private props: { mode: 'init' | 'login' },
  ) {
    super(container);
    this.render();
  }

  protected template(): string {
    const isInit = this.props.mode === 'init';

    return `
      <div class="admin-login-container">
        <div class="admin-login-card" role="region" aria-label="${isInit ? t('adminLogin.ariaInit') : t('adminLogin.ariaLogin')}">
          <div class="admin-login-header">
            <img src="/images/loom-logo.png" alt="LoomVTT Logo" class="admin-login-logo" />
            <h1 class="admin-login-title">LoomVTT</h1>
            <p class="admin-login-subtitle">${t('adminLogin.subtitle')}</p>
          </div>

          <form class="admin-login-body" onsubmit="return false" novalidate>
            ${isInit ? `
              <div class="form-group">
                <label for="init-password">${t('adminLogin.initPasswordLabel')}</label>
                <input type="password" id="init-password" name="password" placeholder="${t('adminLogin.initPasswordPlaceholder')}" required minlength="8" />
              </div>
              <div class="form-group">
                <label for="init-confirm">${t('adminLogin.initConfirmLabel')}</label>
                <input type="password" id="init-confirm" name="confirmPassword" placeholder="${t('adminLogin.initConfirmPlaceholder')}" required />
              </div>
            ` : `
              <div class="form-group">
                <label for="login-password">${t('adminLogin.loginPasswordLabel')}</label>
                <input type="password" id="login-password" name="password" placeholder="${t('adminLogin.loginPasswordPlaceholder')}" required />
              </div>
            `}

            <div id="login-error" role="alert" aria-live="polite" class="form-error" hidden></div>

            <button type="submit" class="btn" data-action="login">
              <span aria-hidden="true">${isInit ? '<i class="fa-solid fa-gear"></i>' : '<i class="fa-solid fa-lock"></i>'}</span>
              ${isInit ? t('adminLogin.initButton') : t('adminLogin.loginButton')}
            </button>
          </form>

          <div class="admin-login-footer">
            LoomVTT — Build 1
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
    if (action === 'login') {
      this.handleLogin();
    }
  }

  private setError(message: string): void {
    const errorEl = this.element.querySelector('#login-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.removeAttribute('hidden');
    }
  }

  private clearError(): void {
    const errorEl = this.element.querySelector('#login-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.setAttribute('hidden', '');
    }
  }

  private async handleLogin(): Promise<void> {
    this.clearError();

    const password = this.element.querySelector<HTMLInputElement>(
      '[name="password"]',
    )?.value;

    if (!password) {
      this.setError(t('adminLogin.errorPasswordRequired'));
      return;
    }

    if (this.props.mode === 'init') {
      if (password.length < 8) {
        this.setError(t('adminLogin.errorPasswordMinLength'));
        return;
      }

      const confirmPassword = this.element.querySelector<HTMLInputElement>(
        '[name="confirmPassword"]',
      )?.value;

      if (password !== confirmPassword) {
        this.setError(t('adminLogin.errorPasswordsDontMatch'));
        return;
      }
    }

    const submitBtn = this.element.querySelector<HTMLButtonElement>('button[data-action="login"]');
    const originalBtnHtml = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = this.props.mode === 'init' ? t('adminLogin.configuring') : t('adminLogin.loggingIn');
    }

    try {
      if (this.props.mode === 'init') {
        try {
          await api.post(API_PATHS.SETUP_INIT, { password });
          showToast(t('adminLogin.serverConfigured'), 'success');
          // Auto-login com a senha configurada para evitar digitação repetida
          try {
            await api.post(API_PATHS.SETUP_LOGIN, { password });
            showToast(t('adminLogin.authSuccess'), 'success');
            setTimeout(() => window.location.reload(), 200);
          } catch {
            await router.navigate('admin-login', { mode: 'login' });
          }
        } catch (e) {
          console.error('[Setup] Init error:', e);
          this.setError(t('adminLogin.errorSetupFailed'));
        }
      } else {
        try {
          await api.post(API_PATHS.SETUP_LOGIN, { password });
          showToast(t('adminLogin.authSuccess'), 'success');
          setTimeout(() => window.location.reload(), 200);
        } catch (e) {
          console.error('[Login] Error:', e);
          // Mensagem real do servidor quando disponivel (ex: rate limit
          // estourado) — "senha incorreta" generico escondia a causa real
          // toda vez que nao era literalmente senha errada (401).
          this.setError(e instanceof ApiError && e.status !== 401 ? e.message : t('adminLogin.errorWrongPassword'));
        }
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (originalBtnHtml !== undefined) {
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    }
  }
}
