/*******************************************************************************
 * LoomVTT
 * client/windows/create-world-window.ts
 * 
 * 
 * Window for creating a new world.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { windowManager } from '../core/window-manager.js';

interface System {
  id: string;
  title: string;
  version: string;
}

export class CreateWorldWindow extends BaseWindow {
  private systems: System[] = [];

  private onCreated: () => void;

  constructor(props: { onCreated: () => void }) {
    super({
      id: 'create-world',
      title: 'Criar Mundo',
      icon: '<i class="fa-solid fa-earth-americas"></i>',
      width: 600,
    } as BaseWindowOptions);
    this.onCreated = props.onCreated;
  }

  async mount(): Promise<void> {
    try {
      this.systems = await api.get<System[]>('/systems');
    } catch (e) {
      this.systems = [];
    }

    super.mount();

    this.element
      .querySelector<HTMLInputElement>('[data-action="upload-cover"]')
      ?.addEventListener('change', (e) => this.uploadCover(e.target as HTMLInputElement));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bodyTemplate(): string {
    const systemOptions = this.systems
      .map((s) => `<option value="${this.escapeHtml(s.id)}">${this.escapeHtml(s.title)}</option>`)
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
          <input type="text" name="name" placeholder="Meu Mundo Incrível" required />
        </div>

        <div class="form-group">
          <label>Sistema de RPG</label>
          <select name="system" required>
            <option value="">Selecione um sistema...</option>
            ${systemOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Descrição</label>
          <textarea name="description" placeholder="Descreva seu mundo..."></textarea>
        </div>

        <div class="form-group">
          <label>Imagem da Capa</label>
          <input type="file" accept="image/*" data-action="upload-cover" />
          <input type="hidden" name="coverUrl" />
        </div>
      </div>

      <div class="tab-content" data-tab="modules">
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">Módulos</div>
          <p>Selecione módulos para incluir neste mundo (em breve)</p>
        </div>
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
    } else if (action === 'save') {
      this.createWorld();
    }
  }

  private async uploadCover(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload falhou');
      const hiddenInput = this.element.querySelector<HTMLInputElement>('[name="coverUrl"]');
      if (hiddenInput) hiddenInput.value = data.path;
      showToast('Imagem enviada com sucesso', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao enviar imagem', 'error');
    }
  }

  private async createWorld(): Promise<void> {
    const body = this.element.querySelector('.loom-window-body')!;

    const name = body.querySelector<HTMLInputElement>('[name="name"]')?.value;
    const system = body.querySelector<HTMLSelectElement>(
      '[name="system"]',
    )?.value;
    const description = body.querySelector<HTMLTextAreaElement>(
      '[name="description"]',
    )?.value;
    const coverUrl = body.querySelector<HTMLInputElement>(
      '[name="coverUrl"]',
    )?.value;

    if (!name || !system) {
      showToast('Nome e Sistema são obrigatórios', 'error');
      return;
    }

    try {
      await api.post('/worlds', {
        name,
        system,
        description: description || '',
        coverUrl: coverUrl || '',
      });
      showToast('Mundo criado com sucesso', 'success');
      windowManager.close('create-world');
      this.onCreated();
    } catch (e) {
      showToast('Erro ao criar mundo', 'error');
    }
  }
}
