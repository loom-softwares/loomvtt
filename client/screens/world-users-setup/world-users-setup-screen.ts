import { t } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { showToast } from '../../components/toast.js';
import { windowManager } from '../../core/window-manager.js';
import { nextDefaultName } from '../../lib/unique-name.js';
import { UserPermissionsWindow } from '../../windows/user-permissions-window.js';

const ROLE_OPTIONS = [
  { value: 1, label: t('worldUsersSetup.roles.player') },
  { value: 2, label: t('worldUsersSetup.roles.trusted') },
  { value: 3, label: t('worldUsersSetup.roles.assistant') },
  { value: 4, label: t('worldUsersSetup.roles.gm') },
];

interface WorldUser {
  id: string;
  name: string;
  role: number;
}

export class WorldUsersSetupScreen extends BaseComponent {
  private users: WorldUser[] = [];
  private loaded = false;

  constructor(
    container: HTMLElement,
    private props: { worldId: string },
  ) {
    super(container);
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.users = await api.get<WorldUser[]>(`/worlds/${this.props.worldId}/users`);
    } catch {
      showToast(t('worldUsersSetup.toasts.errorLoading'), 'error');
    }
    this.loaded = true;
    this.render();
  }

  protected template(): string {
    return `
      <div class="world-login-container">
        <div class="wus-card">
          <h1>${t('worldUsersSetup.header.title')}</h1>
          ${!this.loaded
            ? `<p>${t('worldUsersSetup.header.loading')}</p>`
            : `
            <table class="user-management-table">
              <thead>
                <tr><th>${t('worldUsersSetup.header.username')}</th><th>${t('worldUsersSetup.header.password')}</th><th>${t('worldUsersSetup.header.userRole')}</th><th></th></tr>
              </thead>
              <tbody>
                ${this.users
                  .map(
                    (u) => `
                  <tr data-user-id="${u.id}" class="${u.role === 4 && !u.name.trim() ? 'wus-row-warn' : ''}">
                    <td><input type="text" class="um-name" value="${this.esc(u.name)}" /></td>
                    <td><input type="password" class="um-password" placeholder="${t('worldUsersSetup.actions.noPassword')}" /></td>
                    <td>
                      <select class="um-role">
                        ${ROLE_OPTIONS.map((r) => `<option value="${r.value}" ${u.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                      </select>
                    </td>
                    <td>${u.role === 4 ? '' : `<button class="btn btn-danger" data-action="delete-user" data-id="${u.id}" title="${t('worldUsersSetup.actions.delete')}"><i class="fa-solid fa-trash"></i></button>`}</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            <div class="wus-actions">
              <button class="btn" data-action="create-user">${t('worldUsersSetup.actions.createAdditional')}</button>
              <button class="btn" data-action="open-permissions">${t('worldUsersSetup.actions.permissions')}</button>
              <button class="btn bright" data-action="save-and-continue">${t('worldUsersSetup.actions.saveContinue')}</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  protected onAction(action: string, id: string | null): void {
    if (action === 'create-user') {
      void this.createUser();
    } else if (action === 'delete-user' && id) {
      void this.deleteUser(id);
    } else if (action === 'open-permissions') {
      windowManager.open(`user-permissions-${this.props.worldId}`, UserPermissionsWindow, { worldId: this.props.worldId });
    } else if (action === 'save-and-continue') {
      void this.saveAndContinue();
    }
  }

  private async createUser(): Promise<void> {
    try {
      const name = nextDefaultName(t('worldUsersSetup.toasts.newUser'), this.users.map(u => u.name));
      await api.post(`/worlds/${this.props.worldId}/users`, { name, role: 1 });
      await this.load();
    } catch (e: any) {
      showToast(e?.message || t('worldUsersSetup.toasts.errorCreating'), 'error');
    }
  }

  private async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/worlds/${this.props.worldId}/users/${id}`);
      await this.load();
    } catch (e: any) {
      showToast(e?.message || t('worldUsersSetup.toasts.errorRemoving'), 'error');
    }
  }

  private async saveAndContinue(): Promise<void> {
    const rows = this.element.querySelectorAll<HTMLElement>('.user-management-table tbody tr');
    try {
      for (const row of Array.from(rows)) {
        const id = row.getAttribute('data-user-id')!;
        const name = row.querySelector<HTMLInputElement>('.um-name')!.value.trim();
        const password = row.querySelector<HTMLInputElement>('.um-password')!.value;
        const role = Number(row.querySelector<HTMLSelectElement>('.um-role')!.value);
        const update: Record<string, any> = { name, role };
        if (password) update.password = password;
        await api.put(`/worlds/${this.props.worldId}/users/${id}`, update);
      }
      const result = await api.post<{ session: any }>(`/worlds/${this.props.worldId}/launch-gm`, {});
      setTimeout(() => window.location.reload(), 200);
    } catch (e: any) {
      showToast(e?.message || t('worldUsersSetup.toasts.errorSaving'), 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
