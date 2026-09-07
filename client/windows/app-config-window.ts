/*******************************************************************************
 * LoomVTT
 * client/windows/app-config-window.ts
 * 
 * 
 * Window for configuring application settings.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api, API_PATHS } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { windowManager } from '../core/window-manager.js';
import { CloudflaredTunnelWindow } from './cloudflared-tunnel-window.js';
import { openAppearanceDialog } from '../core/appearance-dialog.js';

interface AppConfig {
  dataPath: string;
  port: number;
  language: string;
  dbClient: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
  dbSsl?: boolean;
  compressStatic: boolean;
  fullscreen: boolean;
  upnp: boolean;
  defaultWorldId: string;
}

export class AppConfigWindow extends BaseWindow {
  private config: AppConfig | null = null;
  private worlds: Array<{ id: string; name: string }> = [];

  constructor() {
    super({
      id: 'app-config',
      title: 'Configuração do Aplicativo',
      icon: '<i class="fa-solid fa-sliders"></i>',
      width: 500,
    } as BaseWindowOptions);
  }

  async mount(): Promise<void> {
    try {
      this.config = await api.get<AppConfig>(API_PATHS.SETUP_CONFIG);
    } catch (e) {
      showToast('Erro ao carregar configurações', 'error');
      this.config = {
        dataPath: '',
        port: 3000,
        language: 'pt-BR',
        dbClient: 'sqlite3',
        dbHost: '',
        dbPort: 5432,
        dbUser: '',
        dbPassword: '',
        dbName: '',
        dbSsl: false,
        compressStatic: true,
        fullscreen: false,
        upnp: false,
        defaultWorldId: '',
      };
    }

    try {
      this.worlds = await api.get<Array<{ id: string; name: string }>>('/worlds');
    } catch (e) {
      this.worlds = [];
    }

    super.mount();
  }

  bodyTemplate(): string {
    if (!this.config) return '';

    return `
      <div class="form-group">
        <label>Caminho de Dados</label>
        <input type="text" class="form__input" name="dataPath" value="${this.escapeHtml(this.config.dataPath)}" placeholder="/caminho/para/dados" />
        <small>Deixe em branco para usar o padrão do sistema</small>
      </div>

      <div class="form-group">
        <label>Porta</label>
        <input type="number" class="form__input" name="port" value="${this.config.port}" min="1024" max="65535" />
      </div>

      <div class="form-group">
        <label>Idioma Padrão</label>
        <select name="language" class="form__select">
          <option value="pt-BR" ${this.config.language === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
          <option value="en-US" ${this.config.language === 'en-US' ? 'selected' : ''}>English (US)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Banco de Dados</label>
        <select name="dbClient" class="form__select" data-action="toggle-db-fields">
          <option value="sqlite3" ${this.config.dbClient === 'sqlite3' ? 'selected' : ''}>SQLite</option>
          <option value="mysql" ${this.config.dbClient === 'mysql' ? 'selected' : ''}>MySQL</option>
          <option value="pg" ${this.config.dbClient === 'pg' ? 'selected' : ''}>PostgreSQL</option>
          <option value="supabase" ${this.config.dbClient === 'supabase' ? 'selected' : ''}>Supabase</option>
        </select>
        <small>Requer reiniciar o servidor pra ter efeito</small>
      </div>

      <fieldset id="db-connection-fields" class="db-connection-fields" style="${this.config.dbClient === 'sqlite3' ? 'display:none;' : ''}">
        <div class="form-group">
          <label>Host</label>
          <input type="text" class="form__input" name="dbHost" value="${this.escapeHtml(this.config.dbHost || '')}" placeholder="${this.config.dbClient === 'supabase' ? 'aws-0-<região>.pooler.supabase.com' : this.config.dbClient === 'pg' ? 'localhost' : 'localhost'}" />
          ${this.config.dbClient === 'supabase' ? '<small>Painel Supabase → Project Settings → Database → Connection Pooling. O host direto (db.&lt;projeto&gt;.supabase.co) exige IPv6 e pode não resolver — use o host do pooler.</small>' : ''}
        </div>
        <div class="form-group">
          <label>Porta</label>
          <input type="number" class="form__input" name="dbPort" value="${this.config.dbPort || (this.config.dbClient === 'mysql' ? 3306 : 5432)}" />
          ${this.config.dbClient === 'supabase' ? '<small>5432 (session pooler) ou 6543 (transaction pooler)</small>' : ''}
        </div>
        <div class="form-group">
          <label>Usuário</label>
          <input type="text" class="form__input" name="dbUser" value="${this.escapeHtml(this.config.dbUser || '')}" placeholder="${this.config.dbClient === 'supabase' ? 'postgres.<project-ref>' : this.config.dbClient === 'pg' ? 'postgres' : 'root'}" />
          ${this.config.dbClient === 'supabase' ? '<small>No pooler o usuário inclui a referência do projeto: postgres.&lt;project-ref&gt;, não só "postgres"</small>' : ''}
        </div>
        <div class="form-group">
          <label>Senha</label>
          <input type="password" class="form__input" name="dbPassword" value="${this.escapeHtml(this.config.dbPassword || '')}" />
          ${this.config.dbClient === 'supabase' ? '<small>Senha do banco (Database Password) — em Database Settings, NÃO é a API key</small>' : ''}
        </div>
        <div class="form-group">
          <label>Nome do Banco</label>
          <input type="text" class="form__input" name="dbName" value="${this.escapeHtml(this.config.dbName || '')}" placeholder="${this.config.dbClient === 'pg' || this.config.dbClient === 'supabase' ? 'postgres' : 'loomvtt'}" />
        </div>
        <div class="form-group form-group-checkbox">
          <label>
            <input type="checkbox" class="form__checkbox" name="dbSsl" ${this.config.dbSsl || this.config.dbClient === 'supabase' ? 'checked' : ''} ${this.config.dbClient === 'supabase' ? 'disabled' : ''} />
            Conexão SSL
          </label>
          <small>${this.config.dbClient === 'supabase' ? 'Sempre ativo pra Supabase (obrigatório no provedor, não editável).' : 'Obrigatório pra bancos gerenciados (Neon, RDS, etc).'}</small>
        </div>
      </fieldset>

      <div class="form-group">
        <label>Mundo Padrão</label>
        <select name="defaultWorldId" class="form__select">
          <option value="">Nenhum</option>
          ${this.worlds.map((w) => `<option value="${this.escapeHtml(w.id)}" ${this.config!.defaultWorldId === w.id ? 'selected' : ''}>${this.escapeHtml(w.name)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group form-group-checkbox">
        <label>
          <input type="checkbox" class="form__checkbox" name="upnp" ${this.config.upnp ? 'checked' : ''} />
          Habilitar UPnP
        </label>
      </div>

      <div class="form-group form-group-checkbox">
        <label>
          <input type="checkbox" class="form__checkbox" name="compressStatic" ${this.config.compressStatic ? 'checked' : ''} />
          Compactar Arquivos Estáticos
        </label>
      </div>

      <div class="form-group form-group-checkbox">
        <label>
          <input type="checkbox" class="form__checkbox" name="fullscreen" ${this.config.fullscreen ? 'checked' : ''} />
          Iniciar em Tela Cheia
        </label>
      </div>

      <div class="form-group">
        <label>Acesso Externo</label>
        <button type="button" class="btn" data-action="open-tunnel"><i class="fa-solid fa-globe"></i> Túnel Cloudflare</button>
        <small>Compartilhe a sessão pela internet sem abrir porta no roteador</small>
      </div>

      <div class="form-group">
        <label>Aparência</label>
        <button type="button" class="btn" data-action="open-appearance"><i class="fa-solid fa-palette"></i> Tema e Paleta</button>
        <small>Vale pro Setup Hub inteiro, não só dentro de um mundo</small>
      </div>
    `;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'save') {
      this.saveConfig();
    } else if (action === 'open-tunnel') {
      windowManager.open('cloudflared-tunnel', CloudflaredTunnelWindow);
    } else if (action === 'open-appearance') {
      openAppearanceDialog();
    } else if (action === 'toggle-db-fields') {
      const select = target as HTMLSelectElement;
      if (this.config) this.config.dbClient = select.value;
      this.rerenderBody();
    }
  }

  private async saveConfig(): Promise<void> {
    const body = this.element.querySelector('.loom-window-body')!;

    const dataPath =
      (body.querySelector<HTMLInputElement>('[name="dataPath"]')?.value ||
        '') ?? '';
    const port =
      parseInt(body.querySelector<HTMLInputElement>('[name="port"]')?.value ||
        '3000') || 3000;
    const language =
      body.querySelector<HTMLSelectElement>('[name="language"]')?.value ||
      'pt-BR';
    const dbClient =
      body.querySelector<HTMLSelectElement>('[name="dbClient"]')?.value ||
      'sqlite3';
    const dbHost =
      body.querySelector<HTMLInputElement>('[name="dbHost"]')?.value || '';
    const dbPort =
      parseInt(body.querySelector<HTMLInputElement>('[name="dbPort"]')?.value || '0') || undefined;
    const dbUser =
      body.querySelector<HTMLInputElement>('[name="dbUser"]')?.value || '';
    const dbPassword =
      body.querySelector<HTMLInputElement>('[name="dbPassword"]')?.value || '';
    const dbName =
      body.querySelector<HTMLInputElement>('[name="dbName"]')?.value || '';
    const dbSsl =
      body.querySelector<HTMLInputElement>('[name="dbSsl"]')?.checked || false;
    const defaultWorldId =
      body.querySelector<HTMLSelectElement>('[name="defaultWorldId"]')?.value ||
      '';
    const upnp =
      body.querySelector<HTMLInputElement>('[name="upnp"]')?.checked || false;
    const compressStatic =
      body.querySelector<HTMLInputElement>('[name="compressStatic"]')
        ?.checked || false;
    const fullscreen =
      body.querySelector<HTMLInputElement>('[name="fullscreen"]')?.checked ||
      false;

    try {
      await api.post(API_PATHS.SETUP_CONFIG, {
        dataPath,
        port,
        language,
        dbClient,
        dbHost,
        dbPort,
        dbUser,
        dbPassword,
        dbName,
        dbSsl,
        defaultWorldId,
        upnp,
        compressStatic,
        fullscreen,
      });
      showToast('Configurações salvas com sucesso', 'success');
    } catch (e) {
      showToast('Erro ao salvar configurações', 'error');
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
