import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';

type Channel = 'stable' | 'preview';

const CHANNEL_HINT: Record<Channel, string> = {
  stable: 'setupHub.updates.hintStable',
  preview: 'setupHub.updates.hintPreview',
};

interface UpdateCheckResponse {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  changelog: string;
  publishedAt: string;
  channel: Channel;
  error?: string;
}

interface UpdateResultResponse {
  success: boolean;
  log: string;
}

export class UpdatesScreen extends BaseComponent {
  private updateInfo: UpdateCheckResponse | null = null;
  private channel: Channel = 'stable';
  private forceUpdate = false;
  private isUpdating = false;
  private updateLog = '';
  private updateSuccess: boolean | null = null;

  constructor(
    container: HTMLElement,
    private props: { onClose: () => void },
  ) {
    super(container);
    this.render();
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.updateInfo = await api.get<UpdateCheckResponse>(`/system/update-check?channel=${this.channel}`);
    } catch (e: any) {
      this.updateInfo = {
        currentVersion: '?',
        latestVersion: '?',
        hasUpdate: false,
        changelog: '',
        publishedAt: '',
        channel: this.channel,
        error: e.message || 'Unknown error',
      };
    }
    this.render();
  }

  protected template(): string {
    const info = this.updateInfo;
    const version = info ? this.escapeHtml(info.currentVersion) : '...';

    let statusLine = t('setupHub.updates.checking');
    let statusTone = 'checking';
    let changelogBlock = '';

    if (this.isUpdating) {
      statusLine = t('setupHub.updates.updating');
      statusTone = 'checking';
    } else if (this.updateLog) {
      statusLine = this.updateSuccess
        ? t('setupHub.updates.downloaded')
        : t('setupHub.updates.error');
      statusTone = this.updateSuccess ? 'ok' : 'error';
      changelogBlock = `<pre class="su-log">${this.escapeHtml(this.updateLog)}</pre>`;
    } else if (info?.error) {
      statusLine = info.error;
      statusTone = 'error';
    } else if (info?.hasUpdate) {
      statusLine = t('setupHub.updates.newVersion', { version: this.escapeHtml(info.latestVersion) });
      statusTone = 'ok';
      changelogBlock = info.changelog
        ? `<pre class="su-log">${this.escapeHtml(info.changelog)}</pre>`
        : '';
    } else if (info) {
      statusLine = t('setupHub.updates.latestVersion');
      statusTone = 'ok';
    }

    const canUpdate = info && !this.updateLog && (info.hasUpdate || this.forceUpdate);

    return `
      <div class="create-world-container su-updates-container">
        <header class="setup-hub-header" style="display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 0; margin-bottom: 1rem; position: relative;">
          <h1 style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 2.2rem; letter-spacing: -0.02em; margin: 0; z-index: 1; background: linear-gradient(180deg, #ffffff 0%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 8px rgba(79, 172, 254, 0.4)); text-transform: uppercase; transform: translateX(10px);">LOOM</h1>
          <img src="/images/loom-logo.png" alt="LoomVTT Logo" style="height: 70px; width: auto; z-index: 2; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8)); position: relative;" />
          <h1 style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 2.2rem; letter-spacing: -0.02em; margin: 0; z-index: 1; background: linear-gradient(180deg, #ffffff 0%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 8px rgba(79, 172, 254, 0.4)); text-transform: uppercase; transform: translateX(-10px);">VTT</h1>
        </header>

        <section class="su-panel">
          <div class="su-panel-title">
            <h2>${t('setupHub.updates.title')}</h2>
            <span class="su-thread" aria-hidden="true"></span>
          </div>

          <div class="su-status su-status-${statusTone}">
            <span class="su-version-tag">v${version}</span>
            <span class="su-status-text">${this.escapeHtml(statusLine)}</span>
          </div>

          <div class="su-form-group">
            <label>${t('setupHub.updates.channel')}</label>
            <div class="su-channel-switch" role="radiogroup" aria-label="${t('setupHub.updates.channel')}">
              <button type="button" class="su-channel-option ${this.channel === 'stable' ? 'active' : ''}" data-action="channel-stable" role="radio" aria-checked="${this.channel === 'stable'}"><i class="fa-solid fa-gift"></i> ${t('setupHub.updates.channelStable')}</button>
              <button type="button" class="su-channel-option ${this.channel === 'preview' ? 'active' : ''}" data-action="channel-preview" role="radio" aria-checked="${this.channel === 'preview'}"><i class="fa-solid fa-wrench"></i> ${t('setupHub.updates.channelPreview')}</button>
            </div>
            <p class="su-field-hint">${t(CHANNEL_HINT[this.channel])}</p>
          </div>

          ${changelogBlock ? `<div class="su-body">${changelogBlock}</div>` : ''}

          <div class="su-footer-row">
            <label class="su-force-check">
              <input type="checkbox" data-field="force" ${this.forceUpdate ? 'checked' : ''} />
              ${t('setupHub.updates.forceUpdate')}
            </label>

            <div class="su-actions">
              <button class="btn btn-secondary" data-action="back"><i class="fa-solid fa-arrow-left"></i> ${t('setupHub.updates.btnBack')}</button>
              ${canUpdate
                ? `<button class="btn" data-action="run-update" ${this.isUpdating ? 'disabled' : ''}><i class="fa-solid fa-download"></i> ${t('setupHub.updates.btnUpdateNow')}</button>`
                : `<button class="btn" data-action="check" ${this.isUpdating ? 'disabled' : ''}><i class="fa-solid fa-rotate-right"></i> ${t('setupHub.updates.btnCheck')}</button>`
              }
            </div>
          </div>
        </section>
      </div>
    `;
  }

  protected onAction(action: string): void {
    if (action === 'back') {
      this.props.onClose();
    } else if (action === 'check') {
      this.updateInfo = null;
      this.updateLog = '';
      this.updateSuccess = null;
      this.render();
      this.load();
    } else if (action === 'run-update') {
      this.runUpdate();
    } else if (action === 'channel-stable' || action === 'channel-preview') {
      const channel = action.replace('channel-', '') as Channel;
      if (channel === this.channel) return;
      this.channel = channel;
      this.updateInfo = null;
      this.render();
      this.load();
    }
  }

  render(): void {
    super.render();
    const forceCheckbox = this.element.querySelector<HTMLInputElement>('[data-field="force"]');
    forceCheckbox?.addEventListener('change', () => {
      this.forceUpdate = forceCheckbox.checked;
      this.render();
    });
  }

  private async runUpdate(): Promise<void> {
    this.isUpdating = true;
    this.render();

    try {
      const response = await api.post<UpdateResultResponse>('/system/update', {});
      this.updateLog = response.log || '';
      this.updateSuccess = response.success;
      showToast(
        response.success
          ? t('setupHub.updates.downloaded')
          : t('setupHub.updates.error'),
        response.success ? 'success' : 'error',
      );
    } catch (e: any) {
      this.updateLog = e.message || 'Unknown network error';
      this.updateSuccess = false;
      showToast(t('setupHub.updates.error'), 'error');
    } finally {
      this.isUpdating = false;
      this.render();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
