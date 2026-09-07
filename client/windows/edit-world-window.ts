/*******************************************************************************
 * LoomVTT
 * client/windows/edit-world-window.ts
 * 
 * 
 * Window for editing world settings.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { windowManager } from '../core/window-manager.js';
import { LoomFormData } from '../core/form-data.js';
import { FilePickerWindow } from './file-picker-window.js';
import { mountRichTextEditor, type RichTextEditorHandle } from '../lib/rich-text-registry.js';

interface System {
  id: string;
  title: string;
  version: string;
}

interface WorldPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

interface World {
  id: string;
  name: string;
  system: string;
  description?: string;
  coverUrl?: string;
  createdAt?: string;
  dataPath?: string;
  backgroundUrl?: string;
  theme?: string;
  nextSession?: string;
  safeMode?: boolean;
}

export class EditWorldWindow extends BaseWindow {
  private systems: System[] = [];
  private packages: WorldPackage[] = [];
  private world: World;
  private editorHandle: RichTextEditorHandle | null = null;

  private onSaved: () => void;

  constructor(props: { world: World; onSaved: () => void }) {
    super({
      id: `edit-world-${props.world.id}`,
      title: 'Configuração do Mundo',
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 600,
      height: 'auto',
    } as BaseWindowOptions);
    this.world = props.world;
    this.onSaved = props.onSaved;
  }

  async mount(): Promise<void> {
    try {
      this.systems = await api.get<System[]>('/systems');
    } catch (e) {
      this.systems = [];
    }

    try {
      this.packages = await api.get<WorldPackage[]>(`/worlds/${this.world.id}/packages`);
    } catch (e) {
      this.packages = [];
    }

    super.mount();
  }

  bodyTemplate(): string {
    const dataPathName = this.world.dataPath
      ? this.world.dataPath.replace(/^Data\/worlds\//, '')
      : this.world.id;

    const systemOptions = this.systems
      .map(
        (s) =>
          `<option value="${s.id}" ${this.world.system === s.id ? 'selected' : ''}>${s.title}</option>`,
      )
      .join('');

    return `
      <div class="tabs">
        <button class="tab-button active" data-action="tab-details" data-tab="details">Detalhes</button>
        <button class="tab-button" data-action="tab-modules" data-tab="modules">Módulos</button>
        <button class="tab-button" data-action="tab-permissions" data-tab="permissions">Permissões</button>
      </div>

      <div class="tab-content active" data-tab="details">
        <div class="form-group">
          <label>Nome do Mundo</label>
          <input type="text" name="name" value="${this.escapeHtml(this.world.name)}" required />
        </div>

        <div class="form-group path-group">
          <label>Caminho dos Dados</label>
          <div class="input-pair">
            <input type="text" value="Data/worlds/" readonly class="path-prefix" />
            <input type="text" name="dataPathName" value="${this.escapeHtml(dataPathName)}" placeholder="${this.escapeHtml(this.world.id)}" />
          </div>
        </div>

        <div class="form-group">
          <label>Sistema de RPG</label>
          <select name="system" required disabled>
            <option value="">Selecione um sistema...</option>
            ${systemOptions}
          </select>
          <small>O sistema de regras não pode ser alterado após a criação do mundo.</small>
        </div>

        <div class="form-group file-picker-group">
          <label>Imagem da Capa</label>
          <div class="input-with-button">
            <input type="text" name="coverUrl" value="${this.escapeHtml(this.world.coverUrl || '')}" placeholder="Nenhum arquivo selecionado" />
            <button type="button" class="btn btn-secondary btn-pick-file" data-action="pick-cover">📂</button>
          </div>
          <small>Usada como miniatura do mundo e como fundo da tela de login.</small>
        </div>

        <div class="form-group">
          <label>Tema da Página de Início</label>
          <select name="theme">
            <option value="" ${!this.world.theme ? 'selected' : ''}>Padrão</option>
          </select>
          <small>Ainda só existe um tema disponível — este campo fica pronto pra quando houver mais opções.</small>
        </div>

        <div class="form-group">
          <label>Próxima Sessão</label>
          <input type="datetime-local" name="nextSession" value="${this.toDatetimeLocal(this.world.nextSession)}" />
        </div>

        <div class="form-group form-group-checkbox">
          <label for="reset-passwords">Redefinir Senhas de Usuários</label>
          <input type="checkbox" id="reset-passwords" name="resetPasswords" />
          <small>Ao salvar, todos os usuários deste mundo ficarão sem senha (exceto o Gamemaster, que usa a senha do admin).</small>
        </div>

        <div class="form-group form-group-checkbox">
          <label for="safe-mode">Iniciar no Modo de Segurança</label>
          <input type="checkbox" id="safe-mode" name="safeMode" ${this.world.safeMode ? 'checked' : ''} />
          <small>Desativa todos os addons/módulos na próxima vez que este mundo for ativado — útil pra diagnosticar travamentos.</small>
        </div>

        <div class="form-group form-group-full">
          <label>Descrição do Mundo</label>
          <div class="journal-editor" style="min-height: 160px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(228, 154, 66, 0.25); border-radius: 4px;"></div>
        </div>

        ${this.world.createdAt ? `<small>Criado em: ${new Date(this.world.createdAt).toLocaleString('pt-BR')}</small>` : ''}
      </div>

      <div class="tab-content" data-tab="modules">
        ${this.packages.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">Nenhum addon instalado</div>
            <p>Instale addons na aba Módulos do Setup Hub pra poder ativá-los aqui.</p>
          </div>
        ` : this.packages.map((pkg) => `
          <div class="form-group">
            <label>
              <input type="checkbox" name="pkg:${this.escapeHtml(pkg.id)}" ${pkg.enabled ? 'checked' : ''} />
              ${this.escapeHtml(pkg.name)} <small>v${this.escapeHtml(pkg.version)}</small>
            </label>
            ${pkg.description ? `<small>${this.escapeHtml(pkg.description)}</small>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="tab-content" data-tab="permissions">
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <div class="empty-state-title">Permissões</div>
          <p>Configure permissões de usuários (em breve)</p>
        </div>
      </div>
    `;
  }

  protected onRender(): void {
    const container = this.element.querySelector<HTMLElement>('.journal-editor');
    if (container) {
      if (this.editorHandle) {
        this.editorHandle.destroy();
      }
      this.editorHandle = mountRichTextEditor(container, this.world.description || '');
    }
  }

  protected onClose(): void {
    if (this.editorHandle) {
      this.editorHandle.destroy();
      this.editorHandle = null;
    }
  }

  private pickImage(inputName: 'coverUrl'): void {
    this.renderChild(FilePickerWindow, 'file-picker', {
      onSelect: (path: string) => {
        const input = this.element.querySelector<HTMLInputElement>(`[name="${inputName}"]`);
        if (input) {
          input.value = path;
          // Trigger change event to update any binds
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
      worldId: this.world.id,
    });
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    const body = this.element.querySelector('.loom-window-body')!;

    if (action.startsWith('tab-')) {
      // Tab switching
      const tabName = action.replace('tab-', '');
      body
        .querySelectorAll('.tab-button')
        .forEach((btn) => btn.classList.remove('active'));
      body
        .querySelectorAll('.tab-content')
        .forEach((tab) => tab.classList.remove('active'));

      target.classList.add('active');
      body.querySelector(`.tab-content[data-tab="${tabName}"]`)?.classList.add('active');
    } else if (action === 'pick-cover') {
      this.pickImage('coverUrl');
    } else if (action === 'save') {
      this.saveWorld();
    }
  }

  private async saveWorld(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    const missing = fd.missing;

    if (missing.length > 0) {
      showToast('Nome e Sistema são obrigatórios', 'error');
      return;
    }

    try {
      const descriptionHtml = this.editorHandle ? this.editorHandle.getHTML() : '';
      const finalDataPath = data.dataPathName ? `Data/worlds/${data.dataPathName}` : '';

      await api.put(`/worlds/${this.world.id}`, {
        name: data.name,
        system: data.system,
        description: descriptionHtml,
        coverUrl: data.coverUrl || '',
        // Login screen background always uses the same cover image — see
        // comment on form-group above. Keeps the backgroundUrl column in
        // DB (other screens still read this field) but always mirrored.
        backgroundUrl: data.coverUrl || '',
        dataPath: finalDataPath,
        theme: data.theme || '',
        nextSession: data.nextSession || '',
        safeMode: !!data.safeMode,
        resetPasswords: !!data.resetPasswords,
      });

      if (this.packages.length > 0) {
        const pkgState = (data.pkg as Record<string, boolean>) || {};
        const enabledModules = this.packages
          .filter((pkg) => pkgState[pkg.id])
          .map((pkg) => pkg.id);
        await api.post(`/worlds/${this.world.id}/packages`, { enabledModules });
      }

      showToast('Mundo atualizado com sucesso', 'success');
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e) {
      showToast('Erro ao atualizar mundo', 'error');
    }
  }

  /** Converts an ISO/DB datetime to the format accepted by <input type="datetime-local"> (no timezone) */
  private toDatetimeLocal(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
