/*******************************************************************************
 * LoomVTT
 * client/windows/discord-config-window.ts
 * 
 * 
 * Window for configuring Discord integration.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { copyTextToClipboard } from '../lib/clipboard.js';

interface DiscordConfigData {
  configured: boolean;
  guildId: string | null;
  categoryId: string | null;
}

export class DiscordConfigWindow extends BaseWindow {
  private config: DiscordConfigData = { configured: false, guildId: null, categoryId: null };
  private loaded = false;
  private saving = false;
  private creatingRoom = false;

  constructor(private props: { worldId: string }) {
    super({
      id: `discord-config-${props.worldId}`,
      title: 'Configuração do Discord',
      icon: '<i class="fa-brands fa-discord"></i>',
      width: 540,
      height: 'auto',
      // The only window that keeps its own save button: it has a loading state
      // ("Saving...", opacity) that the standard footer doesn't support yet.
      // Without `showFooter: false` two "Save" buttons would appear.
      // When BaseWindow gains submit state in the footer, migrate this
      // window and remove this line.
      showFooter: false,
    } as BaseWindowOptions);
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.config = await api.get<DiscordConfigData>(`/worlds/${this.props.worldId}/discord/config`);
      this.loaded = true;
      this.rerenderBody();
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar configuração do Discord', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div style="padding:1rem;text-align:center;color:var(--color-text-secondary)">Carregando...</div>`;
    }

    const c = this.config;

    return `
      <div style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
        <div class="field-row">
          <span style="font-size:1.2rem;">${c.configured ? '✅' : '❌'}</span>
          <span style="color:var(--color-text-secondary);">
            ${c.configured ? 'Discord configurado' : 'Discord não configurado'}
          </span>
        </div>

        <div class="form-group">
          <label>Token do Bot</label>
          <input type="password" id="discord-bot-token" class="settings-select"
            placeholder="Cole o token do bot aqui"
            ${c.configured ? 'value="••••••••••••••••"' : ''}
            style="width:100%;box-sizing:border-box;" />
          <small>Token da Application do Discord Developer Portal. Mantido em sigilo.</small>
        </div>

        <div class="form-group">
          <label>Guild ID (Servidor)</label>
          <input type="text" id="discord-guild-id" class="settings-select"
            placeholder="ID numérico do servidor Discord"
            value="${c.guildId ?? ''}"
            style="width:100%;box-sizing:border-box;" />
          <small>Clique com botão direito no servidor → "Copiar ID".</small>
        </div>

        <div class="form-group">
          <label>Categoria (opcional)</label>
          <input type="text" id="discord-category-id" class="settings-select"
            placeholder="ID da categoria onde criar as salas"
            value="${c.categoryId ?? ''}"
            style="width:100%;box-sizing:border-box;" />
          <small>ID da categoria de canais. Deixe vazio para criar fora de categoria.</small>
        </div>

        <button class="btn" data-action="save-config" style="width:100%;${this.saving ? 'opacity:0.6;' : ''}">
          ${this.saving ? 'Salvando...' : '💾 Salvar Configuração'}
        </button>
      </div>
    `;
  }

  protected onAction(action: string, _id: string | null, _target: HTMLElement): void {
    if (action === 'save-config') {
      void this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.rerenderBody();

    try {
      const tokenInput = this.element.querySelector<HTMLInputElement>('#discord-bot-token');
      const guildInput = this.element.querySelector<HTMLInputElement>('#discord-guild-id');
      const categoryInput = this.element.querySelector<HTMLInputElement>('#discord-category-id');

      const botToken = tokenInput?.value?.trim() || undefined;
      const guildId = guildInput?.value?.trim();
      const categoryId = categoryInput?.value?.trim() || null;

      if (!botToken && !this.config.configured) {
        showToast('Token do bot é obrigatório.', 'error');
        this.saving = false;
        this.rerenderBody();
        return;
      }

      if (!guildId) {
        showToast('Guild ID é obrigatório.', 'error');
        this.saving = false;
        this.rerenderBody();
        return;
      }

      await api.put(`/worlds/${this.props.worldId}/discord/config`, {
        botToken,
        guildId,
        categoryId,
      });

      showToast('Configuração do Discord salva!', 'success');
      await this.loadConfig();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar configuração', 'error');
    } finally {
      this.saving = false;
    }
  }
}
