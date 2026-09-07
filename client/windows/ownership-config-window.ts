/*******************************************************************************
 * LoomVTT
 * client/windows/ownership-config-window.ts
 * 
 * 
 * Window for configuring document ownership.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';

const LEVELS = [
  { value: 0, label: 'Nenhum' },
  { value: 1, label: 'Limitado' },
  { value: 2, label: 'Observador' },
  { value: 3, label: 'Proprietário' },
];

interface WorldUser {
  id: string;
  name: string;
  role: number;
}

export class OwnershipConfigWindow extends BaseWindow {
  private users: WorldUser[] = [];
  private ownership: Record<string, number> = {};
  private loaded = false;

  constructor(
    private props: {
      worldId: string;
      documentId: string;
      apiRoute: string; // ex: '/actors'
      ownership: Record<string, number>;
      onSaved?: (ownership: Record<string, number>) => void;
    },
  ) {
    super({
      id: `ownership-config-${props.documentId}`,
      title: 'Configurar Propriedade',
      icon: '<i class="fa-solid fa-user-group"></i>',
      width: 380,
      height: 'auto',
    } as BaseWindowOptions);
    this.ownership = { ...(props.ownership || {}) };
  }

  async mount(): Promise<void> {
    super.mount();
    try {
      this.users = await api.get<WorldUser[]>(`/worlds/${this.props.worldId}/users`);
      this.loaded = true;
      this.rerenderBody();
    } catch {
      showToast('Erro ao carregar jogadores', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div class="empty-state"><p>Carregando...</p></div>`;
    }
    const players = this.users.filter((u) => (u.role ?? 1) < 4);
    return `
      <div class="form-group">
        <label>Padrão (todos os jogadores)</label>
        <select name="default">
          ${LEVELS.map((l) => `<option value="${l.value}" ${(this.ownership.default ?? 0) === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
      </div>
      ${players.length === 0
        ? `<p class="text-secondary" style="margin-top: 1rem;">Nenhum jogador neste mundo ainda.</p>`
        : players
          .map(
            (u) => `
        <div class="form-group">
          <label>${this.esc(u.name)}</label>
          <select name="user:${u.id}">
            ${LEVELS.map((l) => `<option value="${l.value}" ${(this.ownership[u.id] ?? 0) === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
        </div>`,
          )
          .join('')}
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') void this.save();
  }

  private async save(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const next: Record<string, number> = {};
    body.querySelectorAll<HTMLSelectElement>('select[name]').forEach((sel) => {
      const key = sel.name === 'default' ? 'default' : sel.name.replace('user:', '');
      // Always saves, even 0 ("None") — PUT does merge (not replace) on
      // ownership, so an omitted key leaves the old value intact
      // instead of revoking. Without this, "None" never drops an
      // level >0 save after.
      next[key] = Number(sel.value);
    });
    try {
      await api.put(`${this.props.apiRoute}/${this.props.documentId}`, { ownership: next });
      showToast('Permissões atualizadas', 'success');
      this.props.onSaved?.(next);
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar permissões', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
