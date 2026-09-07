/*******************************************************************************
 * LoomVTT
 * client/windows/user-permissions-window.ts
 * 
 * 
 * Window for managing user permissions.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';

const ROLE_COLUMNS = [
  { value: 1, label: 'Jogador' },
  { value: 2, label: 'Jogador Confiável' },
  { value: 3, label: 'Assistente de Mestre' },
];

const DEFAULT_PERMISSIONS: Record<string, number[]> = {
  viewStages: [],
  compendiumEdit: [],
  createActor: [],
  createItem: [],
  createJournal: [],
  createDeck: [],
  createMacro: [],
  createPlaylist: [],
};

const PERMISSION_ROWS: { key: keyof typeof DEFAULT_PERMISSIONS; label: string; hint: string }[] = [
  { key: 'viewStages', label: 'Ver Aba de Cenas', hint: 'Permite ver a lista de cenas na barra lateral.' },
  { key: 'compendiumEdit', label: 'Editar Compêndio', hint: 'Permite criar, editar e excluir pacotes de compêndio.' },
  { key: 'createActor', label: 'Criar Novos Atores', hint: 'Permite criar fichas de ator no Mundo.' },
  { key: 'createItem', label: 'Criar Novos Itens', hint: 'Permite criar itens no Mundo.' },
  { key: 'createJournal', label: 'Criar Diário', hint: 'Permite criar entradas de diário.' },
  { key: 'createDeck', label: 'Criar Baralhos', hint: 'Permite criar baralhos de cartas.' },
  { key: 'createMacro', label: 'Criar Macros', hint: 'Permite criar macros.' },
  { key: 'createPlaylist', label: 'Criar Playlists', hint: 'Permite criar novas playlists no Mundo.' },
];

export class UserPermissionsWindow extends BaseWindow {
  private permissions: Record<string, number[]> = { ...DEFAULT_PERMISSIONS };
  private loaded = false;

  constructor(private props: { worldId: string }) {
    super({
      id: `user-permissions-${props.worldId}`,
      title: 'Permissões de Usuários',
      icon: '<i class="fa-solid fa-shield-halved"></i>',
      width: 640,
      height: 'auto',
    } as BaseWindowOptions);
  }

  async mount(): Promise<void> {
    super.mount();
    try {
      const world = await api.get<{ permissions?: Record<string, unknown> }>(`/worlds/${this.props.worldId}`);
      const raw = { ...DEFAULT_PERMISSIONS, ...(world.permissions || {}) };
      for (const key of Object.keys(raw)) {
        if (!Array.isArray((raw as any)[key])) (raw as any)[key] = [];
      }
      this.permissions = raw as Record<string, number[]>;
    } catch {
      showToast('Erro ao carregar permissões', 'error');
    }
    this.loaded = true;
    this.rerenderBody();
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div class="empty-state"><p>Carregando...</p></div>`;
    }
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
        <p style="color:var(--color-text-secondary);font-size:0.85rem;margin:0;">
          Configure quais cargos, além do Mestre, têm permissão para cada ação.
        </p>
        <button class="btn" data-action="reset-permissions">↺ Redefinir Padrões</button>
      </div>
      <table class="permissions-table">
        <thead>
          <tr>
            <th>Permissão</th>
            ${ROLE_COLUMNS.map((r) => `<th>${r.label}</th>`).join('')}
            <th>Mestre</th>
          </tr>
        </thead>
        <tbody>
          ${PERMISSION_ROWS.map((row) => `
            <tr>
              <td>
                <div class="permissions-row-label">${row.label}</div>
                <div class="permissions-row-hint">${row.hint}</div>
              </td>
              ${ROLE_COLUMNS.map((r) => `
                <td class="permissions-cell">
                  <input type="checkbox" data-perm-key="${row.key}" data-perm-role="${r.value}"
                    ${(this.permissions[row.key] || []).includes(r.value) ? 'checked' : ''} />
                </td>
              `).join('')}
              <td class="permissions-cell"><input type="checkbox" checked disabled /></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  protected onAction(action: string): void {
    if (action === 'save') {
      void this.save();
    } else if (action === 'reset-permissions') {
      this.permissions = { ...DEFAULT_PERMISSIONS };
      this.rerenderBody();
    }
  }

  private async save(): Promise<void> {
    const next: Record<string, number[]> = {};
    for (const row of PERMISSION_ROWS) {
      const roles: number[] = [];
      this.element.querySelectorAll<HTMLInputElement>(`input[data-perm-key="${row.key}"]:checked`).forEach((el) => {
        roles.push(Number(el.dataset.permRole));
      });
      next[row.key] = roles;
    }
    try {
      await api.put(`/worlds/${this.props.worldId}/permissions`, { permissions: next });
      this.permissions = next;
      showToast('Permissões salvas', 'success');
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar permissões', 'error');
    }
  }
}
