/*******************************************************************************
 * LoomVTT
 * client/windows/user-management-window.ts
 * 
 * 
 * Window for managing user accounts.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { UserPermissionsWindow } from './user-permissions-window.js';

const ROLE_OPTIONS = [
  { value: 1, label: 'Jogador' },
  { value: 2, label: 'Jogador Confiável' },
  { value: 3, label: 'Assistente de Mestre' },
  { value: 4, label: 'Mestre do Jogo' },
];

interface WorldUser {
  id: string;
  name: string;
  role: number;
  avatarUrl?: string;
  authProvider?: string;
  siteAccountId?: string;
  pendingApproval?: boolean;
}

export class UserManagementWindow extends BaseWindow {
  private users: WorldUser[] = [];
  private loaded = false;

  constructor(private props: { worldId: string }) {
    super({
      id: `user-management-${props.worldId}`,
      title: 'Gestão de Usuários',
      icon: '<i class="fa-solid fa-users"></i>',
      width: 620,
      height: 'auto',
    } as BaseWindowOptions);
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.users = await api.get<WorldUser[]>(`/worlds/${this.props.worldId}/users`);
    } catch {
      showToast('Erro ao carregar usuários', 'error');
    }
    this.loaded = true;
    this.rerenderBody();
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div class="empty-state"><p>Carregando...</p></div>`;
    }

    const pendingUsers = this.users.filter((u) => !!u.pendingApproval);
    const activeUsers = this.users.filter((u) => !u.pendingApproval);

    return `
      ${pendingUsers.length > 0 ? `
        <div class="pending-approvals-section" style="margin-bottom: 18px; padding: 12px 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #fbbf24; margin-bottom: 10px;">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>Vínculos Pendentes de Aprovação (${pendingUsers.length})</span>
          </div>
          <table class="user-management-table pending-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Jogador (Google)</th>
                <th>Cargo a Atribuir</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${pendingUsers.map((u) => `
                <tr data-user-id="${u.id}">
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      ${u.avatarUrl ? `<img src="${this.esc(u.avatarUrl)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" alt="" />` : '<i class="fa-brands fa-google" style="color: #4285F4;"></i>'}
                      <strong>${this.esc(u.name)}</strong>
                      <small style="color: #94a3b8; font-size: 11px;">(Google)</small>
                    </div>
                  </td>
                  <td>
                    <select class="um-pending-role">
                      ${ROLE_OPTIONS.map((r) => `<option value="${r.value}" ${r.value === 1 ? 'selected' : ''}>${r.label}</option>`).join('')}
                    </select>
                  </td>
                  <td style="text-align: right;">
                    <button type="button" class="btn btn-sm btn-primary" data-action="approve-user" data-id="${u.id}" title="Aprovar">
                      <i class="fa-solid fa-check"></i> Aprovar
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" data-action="reject-user" data-id="${u.id}" title="Rejeitar">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <table class="user-management-table">
        <thead>
          <tr><th>Nome do Usuário</th><th>Senha</th><th>Cargo</th><th></th></tr>
        </thead>
        <tbody>
          ${activeUsers
            .map(
              (u) => `
            <tr data-user-id="${u.id}">
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <input type="text" class="um-name" value="${this.esc(u.name)}" style="flex: 1;" />
                  ${u.authProvider === 'loom_site' ? '<span title="Conta Google Vinculada" style="color: #4285F4; font-size: 13px;"><i class="fa-brands fa-google"></i></span>' : ''}
                </div>
              </td>
              <td><input type="password" class="um-password" placeholder="${u.authProvider === 'loom_site' ? 'Conta vinculada (sem senha)' : 'Definir senha...'}" /></td>
              <td>
                <select class="um-role">
                  ${ROLE_OPTIONS.map((r) => `<option value="${r.value}" ${u.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
              </td>
              <td><button class="btn btn-danger" data-action="delete-user" data-id="${u.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <div class="user-management-footer-actions">
        <button class="btn" data-action="create-user">➕ Criar Usuário Adicional</button>
        <button class="btn" data-action="open-permissions">🛡️ Permissões de Usuários</button>
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target?: HTMLElement): void {
    if (action === 'save') {
      void this.saveAll();
    } else if (action === 'create-user') {
      void this.createUser();
    } else if (action === 'delete-user' && id) {
      void this.deleteUser(id);
    } else if (action === 'approve-user' && id) {
      void this.approveUser(id, target);
    } else if (action === 'reject-user' && id) {
      void this.rejectUser(id);
    } else if (action === 'open-permissions') {
      windowManager.open(`user-permissions-${this.props.worldId}`, UserPermissionsWindow, { worldId: this.props.worldId });
    }
  }

  private async approveUser(id: string, target?: HTMLElement): Promise<void> {
    const row = target?.closest('tr');
    const select = row?.querySelector<HTMLSelectElement>('.um-pending-role');
    const role = Number(select?.value || 1);

    try {
      await api.post(`/worlds/${this.props.worldId}/users/${id}/approve`, { role });
      showToast('Jogador aprovado com sucesso', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao aprovar usuário', 'error');
    }
  }

  private async rejectUser(id: string): Promise<void> {
    try {
      await api.post(`/worlds/${this.props.worldId}/users/${id}/reject`, {});
      showToast('Vínculo rejeitado', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao rejeitar vínculo', 'error');
    }
  }

  private async createUser(): Promise<void> {
    try {
      const name = nextDefaultName('Novo Usuário', this.users.map(u => u.name));
      await api.post(`/worlds/${this.props.worldId}/users`, { name, role: 1 });
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar usuário', 'error');
    }
  }

  private async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/worlds/${this.props.worldId}/users/${id}`);
      await this.load();
      showToast('Usuário removido', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover usuário', 'error');
    }
  }

  private async saveAll(): Promise<void> {
    const rows = this.element.querySelectorAll<HTMLElement>('.user-management-table:not(.pending-table) tbody tr');
    try {
      for (const row of Array.from(rows)) {
        const id = row.getAttribute('data-user-id')!;
        const nameInput = row.querySelector<HTMLInputElement>('.um-name');
        if (!nameInput) continue;
        const name = nameInput.value.trim();
        const password = row.querySelector<HTMLInputElement>('.um-password')!.value;
        const role = Number(row.querySelector<HTMLSelectElement>('.um-role')!.value);
        const update: Record<string, any> = { name, role };
        if (password) update.password = password;
        await api.put(`/worlds/${this.props.worldId}/users/${id}`, update);
      }
      showToast('Usuários salvos', 'success');
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar usuários', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}

