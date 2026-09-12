import { BaseComponent } from '../../components/base-component.js';
import { wsClient } from '../../core/ws-client.js';
import { gameContext } from '../../core/game-context.js';
import { api } from '../../core/api.js';
import { actorsCollection } from '../../core/actors-collection.js';
import { showToast } from '../../components/toast.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';
import { LoomDialog } from '../../windows/loom-dialog.js';
import { FilePickerWindow } from '../../windows/file-picker-window.js';
import { windowManager } from '../../core/window-manager.js';
import { t } from '../../lib/i18n.js';
import { applyUiOverride } from '../../core/ui-override.js';
import { DEFAULT_PORTRAIT_URL } from '../../lib/default-portrait.js';

interface Player {
  id: string;
  name: string;
  role: number;
  color?: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

interface OnlineUserPayload {
  userId: string;
  userName: string;
  userColor?: string;
  userRole: number;
}

interface FullUser {
  id: string;
  name: string;
  role: number;
  color?: string;
  avatarUrl?: string;
  pronouns?: string;
  actorId?: string;
}

// Resolved per call (not as a module const) so that changing language at
// runtime reflects on the next render, instead of freezing the import locale.
const roleKeys = ['roleNone', 'rolePlayer', 'roleTrusted', 'roleAssistant', 'roleGamemaster'];
const roleLabel = (role: number): string =>
  roleKeys[role] ? t(`playersList.${roleKeys[role]}`) : t('playersList.roleUnknown');

export class PlayersList extends BaseComponent {
  private players: Player[] = [];
  private lastOnlinePayload: OnlineUserPayload[] = [];
  private unsubscribe: (() => void) | null = null;
  private pongUnsub: (() => void) | null = null;

  private fps = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private rafId = 0;
  private latency = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** Decorates the native template with a registered `CONFIG.ui.players` class, if any — never replaces it. */
  render(): void {
    super.render();
    applyUiOverride('players', this.element, { players: this.players, options: { worldId: this.worldId } });
  }

  constructor(container: HTMLElement, private worldId: string) {
    super(container);
    this.element.addEventListener('contextmenu', this.onContextMenu);
    this.fetchAllUsers();
    this.setupWebSocketListeners();
    this.startPerfMonitors();
    this.render();
  }

  private async fetchAllUsers() {
    try {
      const users = await api.get<FullUser[]>(`/worlds/${this.worldId}/users`);
      this.players = users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        color: u.color,
        avatarUrl: u.avatarUrl,
        isOnline: false,
      }));
      this.updateOnlineStatus();
    } catch {
      // Ignore initial error
    }
  }

  private setupWebSocketListeners(): void {
    const unsubOnline = wsClient.on('users.online', (data: OnlineUserPayload[]) => {
      this.lastOnlinePayload = data || [];
      this.updateOnlineStatus();
    });

    const unsubUserUpdate = wsClient.on('user.updated', (user: FullUser) => {
      const idx = this.players.findIndex(p => p.id === user.id);
      if (idx !== -1) {
        this.players[idx].name = user.name;
        this.players[idx].role = user.role;
        this.players[idx].color = user.color;
        this.players[idx].avatarUrl = user.avatarUrl;
        this.render();
      }
    });

    this.unsubscribe = () => {
      unsubOnline();
      unsubUserUpdate();
    };
  }

  private updateOnlineStatus(): void {
    if (this.players.length === 0 && this.lastOnlinePayload.length > 0) {
      this.players = this.lastOnlinePayload.map((u) => ({
        id: u.userId,
        name: u.userName,
        role: u.userRole,
        color: u.userColor,
        isOnline: true,
      }));
    } else {
      const onlineIds = new Set(this.lastOnlinePayload.map((u) => u.userId));
      for (const p of this.players) {
        p.isOnline = onlineIds.has(p.id);
      }
      this.players.sort((a, b) => {
        if (a.isOnline === b.isOnline) return a.name.localeCompare(b.name);
        return a.isOnline ? -1 : 1;
      });
    }
    this.render();
  }

  // ── Performance monitors (local FPS + latency via WS ping/pong) ───────────
  private startPerfMonitors(): void {
    this.lastFpsTime = performance.now();
    const tick = () => {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
        this.frameCount = 0;
        this.lastFpsTime = now;
        this.updateStatusBar();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    this.pongUnsub = wsClient.on('pong', (d: { t?: number }) => {
      if (typeof d?.t === 'number') {
        this.latency = Math.round(performance.now() - d.t);
        this.updateStatusBar();
      }
    });
    // No immediate ping: PlayersList is built in mountSubcomponents() (synchronous),
    // before wsClient.connect() runs in bootstrap() — sending immediately always hits
    // "Not connected, dropping message" on the first tick.
    const sendPing = () => wsClient.send('ping', { t: performance.now() });
    this.pingTimer = setInterval(sendPing, 5000);
  }

  private isExpanded = false;

  private getFpsColor(fps: number): string {
    if (fps >= 45) return '#2ecc71';
    if (fps >= 30) return '#f1c40f';
    return '#e74c3c';
  }

  private getPingColor(ping: number): string {
    if (ping < 100) return '#2ecc71';
    if (ping < 200) return '#f1c40f';
    return '#e74c3c';
  }

  private updateStatusBar(): void {
    const fpsEl = this.element.querySelector('.players-status-fps') as HTMLElement;
    const latEl = this.element.querySelector('.players-status-latency') as HTMLElement;
    if (fpsEl) {
      fpsEl.textContent = `${this.fps}`;
      fpsEl.style.color = this.getFpsColor(this.fps);
    }
    if (latEl) {
      latEl.textContent = `${this.latency}ms`;
      latEl.style.color = this.getPingColor(this.latency);
    }
  }

  protected template(): string {
    const currentUserId = gameContext.session?.userId;
    let currentUser = this.players.find(p => p.id === currentUserId);
    const otherPlayers = this.players.filter(p => p.id !== currentUserId);
    const onlineOthers = otherPlayers.filter(p => p.isOnline);

    // If current user is not in the list yet (before fetch resolves), create a placeholder
    if (!currentUser && currentUserId) {
      currentUser = {
        id: currentUserId,
        name: gameContext.session?.userName || 'Gamemaster',
        role: gameContext.session?.userRole || 0,
        isOnline: true
      };
    }

    const isGM = (gameContext.session?.userRole ?? 0) >= 4;

    const shortRoleBadge = (role: number): string => {
      if (role >= 4) return 'GM';
      if (role >= 2) return 'ASSIST';
      return 'JOGADOR';
    };

    const renderPlayerRow = (player: Player) => {
      const dotColor = player.isOnline ? '#2ecc71' : '#64748b';
      const shadow = player.isOnline ? '0 0 6px rgba(46, 204, 113, 0.5)' : 'none';
      return `
        <div class="players-popover-item ${player.isOnline ? '' : 'offline'}" data-user-id="${this.escapeHtml(player.id)}">
          <span class="players-popover-avatar" style="position: relative; width: 24px; height: 24px; flex-shrink: 0;">
            <img src="${this.escapeHtml(player.avatarUrl || DEFAULT_PORTRAIT_URL)}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; display: block;" />
            <span class="players-popover-dot" style="position: absolute; bottom: -1px; right: -1px; width: 7px; height: 7px; border-radius: 50%; background-color: ${dotColor}; box-shadow: ${shadow}; border: 1.5px solid #0f1219;"></span>
          </span>
          <div class="players-popover-name" style="${player.color ? `color: ${player.color};` : ''} flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;">
            ${this.escapeHtml(player.name)}
            <span class="players-popover-role" style="font-size: 0.65rem; color: #94a3b8; margin-left: 4px;">[${shortRoleBadge(player.role)}]</span>
          </div>
          ${isGM ? `
            <button type="button" class="players-popover-action-btn" data-action="player-menu" data-id="${this.escapeHtml(player.id)}" title="${t('playersList.configureUser')}" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 2px 4px;">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
          ` : ''}
        </div>
      `;
    };

    const allOnline: Player[] = [];
    if (currentUser) allOnline.push(currentUser);
    allOnline.push(...onlineOthers);

    const onlineAvatarsHtml = allOnline.map(player => {
      const isSelf = player.id === currentUserId;
      const borderColor = player.color || 'rgba(255, 255, 255, 0.25)';
      return `
        <div class="hud-player-avatar-item"
             data-action="${isSelf ? 'toggle-list' : 'player-menu'}"
             data-id="${this.escapeHtml(player.id)}"
             title="${this.escapeHtml(player.name)} (${shortRoleBadge(player.role)})">
          <div class="hud-player-avatar-circle" style="border-color: ${borderColor};">
            <img src="${this.escapeHtml(player.avatarUrl || DEFAULT_PORTRAIT_URL)}" alt="" class="hud-player-avatar-img" />
            <span class="hud-player-online-dot"></span>
          </div>
        </div>
      `;
    }).join('');

    const popoverHtml = this.isExpanded ? `
      <div class="players-popover-dropdown players-popover-upward">
        <div class="players-popover-header">
          <span>Participantes (${this.players.filter(p => p.isOnline).length} online)</span>
          <button type="button" class="players-popover-close-btn" data-action="toggle-list">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="players-popover-list">
          ${renderPlayerRow(currentUser || { id: '', name: '...', role: 0, isOnline: true })}
          ${otherPlayers.map(renderPlayerRow).join('')}
        </div>
        <div class="players-popover-footer">
          <button type="button" class="players-popover-self-btn" data-action="edit-self" data-id="${this.escapeHtml(currentUser?.id || '')}">
            <i class="fa-solid fa-gear"></i> Configurar Perfil
          </button>
          <div class="players-popover-perf">
            <span>Ping <strong class="players-status-latency" style="color: ${this.getPingColor(this.latency)};">${this.latency}ms</strong></span>
            <span>•</span>
            <span>FPS <strong class="players-status-fps" style="color: ${this.getFpsColor(this.fps)};">${this.fps}</strong></span>
          </div>
        </div>
      </div>
    ` : '';

    return `
      <div class="hud-player-avatars-container">
        ${popoverHtml}
        <div class="hud-player-avatars-row">
          ${onlineAvatarsHtml}
          <button type="button" class="hud-player-toggle-btn" data-action="toggle-list" title="Participantes e Desempenho">
            <i class="fa-solid fa-chevron-${this.isExpanded ? 'down' : 'up'}"></i>
          </button>
        </div>
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'toggle-list') {
      this.isExpanded = !this.isExpanded;
      this.render();
    } else if (action === 'edit-self') {
      const currentUserId = id || gameContext.session?.userId;
      if (currentUserId) {
        void this.openUserConfig(currentUserId);
      }
    } else if (action === 'player-menu' && id) {
      const player = this.players.find((p) => p.id === id);
      if (!player) return;
      const rect = target.getBoundingClientRect();
      const items: ContextMenuItem[] = [
        { icon: '<i class="fa-solid fa-gear"></i>', label: t('playersList.configureUser'), action: () => void this.openUserConfig(player.id) },
        { icon: '<i class="fa-solid fa-key"></i>', label: t('playersList.changePassword'), action: () => void this.changePassword(player) },
      ];
      showContextMenu(new MouseEvent('contextmenu', { clientX: rect.left, clientY: rect.bottom }), items);
    }
  }

  // ── Context menu (right click) — GM configures any player, player configures self ──
  private onContextMenu = (event: MouseEvent): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-user-id]');
    if (!row) return;
    const userId = row.getAttribute('data-user-id');
    const player = this.players.find((p) => p.id === userId);
    if (!player) return;

    const isGM = (gameContext.session?.userRole ?? 0) >= 4;
    const isSelf = player.id === gameContext.session?.userId;
    if (!isGM && !isSelf) return;

    const items: ContextMenuItem[] = [
      { icon: '<i class="fa-solid fa-gear"></i>', label: t('playersList.configureUser'), action: () => void this.openUserConfig(player.id) },
      { icon: '<i class="fa-solid fa-key"></i>', label: t('playersList.changePassword'), action: () => void this.changePassword(player) },
    ];
    showContextMenu(event, items);
  };

  private async loadUser(id: string): Promise<FullUser | null> {
    try {
      const users = await api.get<FullUser[]>(`/worlds/${this.worldId}/users`);
      return users.find((u) => u.id === id) ?? null;
    } catch {
      showToast(t('playersList.userLoadError'), 'error');
      return null;
    }
  }

  private async openUserConfig(id: string): Promise<void> {
    const user = await this.loadUser(id);
    if (!user) return;

    const isGM = (gameContext.session?.userRole ?? 0) >= 4;
    let actors = actorsCollection.contents;
    if (actors.length === 0) {
      try {
        const fetched = await api.get<any[]>(`/actors?worldId=${this.worldId}`);
        if (Array.isArray(fetched)) {
          actors = fetched;
        }
      } catch { }
    }

    const myActors = isGM
      ? actors
      : actors.filter(a => {
          const ownership: Record<string,number> = (a as any).ownership || {};
          return (ownership[id] ?? ownership['default'] ?? 0) >= 2;
        });
    const actorOptions = [
      `<option value="">-- No character --</option>`,
      ...myActors.map(a => `<option value="${a.id}" ${user.actorId === a.id ? 'selected' : ''}>${a.name}</option>`)
    ].join('');

    const contentEl = document.createElement('div');
    contentEl.innerHTML = `
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: flex-end; margin-bottom: 1rem;">
          <button type="button" id="pick-avatar-btn" title="${t('playersList.fieldAvatar')}"
            style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; padding: 0; border: 2px solid var(--color-border, #444); cursor: pointer; flex: 0 0 auto; background: none;">
            <img id="avatar-preview" src="${this.escapeHtml(user.avatarUrl || DEFAULT_PORTRAIT_URL)}" alt=""
              style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </button>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>${t('playersList.fieldName')}</label>
            <input type="text" name="name" value="${this.escapeHtml(user.name)}" />
          </div>
          <input type="hidden" name="avatarUrl" value="${this.escapeHtml(user.avatarUrl || '')}" />
        </div>
        <div class="form-group">
          <label>${t('playersList.fieldColor')}</label>
          <div class="color-input-group">
            <input type="color" name="color" value="${user.color || '#4f46e5'}" oninput="this.nextElementSibling.value = this.value" />
            <input type="text" value="${user.color || '#4f46e5'}" oninput="this.previousElementSibling.value = this.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Pronouns</label>
          <input type="text" name="pronouns" value="${this.escapeHtml(user.pronouns || '')}" placeholder="e.g. he/him, she/her" />
        </div>
        <div class="form-group">
          <label>Main Character</label>
          <select name="actorId" style="width: 100%;">${actorOptions}</select>
        </div>
        <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="change-password-btn" style="font-size: 0.8rem; padding: 4px 10px;">
            <i class="fa-solid fa-key"></i> ${t('playersList.changePassword')}
          </button>
        </div>`;

    const changePassBtn = contentEl.querySelector('#change-password-btn');
    if (changePassBtn) {
      changePassBtn.addEventListener('click', () => {
        void this.changePassword({ id: user.id, name: user.name, role: user.role });
      });
    }

    const pickBtn = contentEl.querySelector('#pick-avatar-btn');
    const input = contentEl.querySelector('input[name="avatarUrl"]') as HTMLInputElement;
    const preview = contentEl.querySelector('#avatar-preview') as HTMLImageElement;
    if (pickBtn && input) {
      pickBtn.addEventListener('click', () => {
        windowManager.open('file-picker', FilePickerWindow, {
          onSelect: (path: string) => {
            input.value = path;
            if (preview) preview.src = path;
          }
        });
      });
    }

    const result = await LoomDialog.input({
      window: { title: t('playersList.configureUser') },
      content: contentEl,
    });
    if (!result) return;

    await this.saveUser(id, {
      name: (result.name ?? user.name) || user.name,
      role: user.role,
      color: result.color ?? user.color,
      avatarUrl: result.avatarUrl ?? user.avatarUrl ?? '',
      pronouns: result.pronouns ?? user.pronouns ?? '',
      actorId: result.actorId ?? user.actorId ?? '',
    });
  }

  private async changePassword(player: Player): Promise<void> {
    const user = await this.loadUser(player.id);
    if (!user) return;

    const result = await LoomDialog.input({
      window: { title: t('playersList.changePasswordFor', { name: player.name }) },
      content: `
        <div class="form-group">
          <label>${t('playersList.newPassword')}</label>
          <input type="password" name="password" placeholder="${t('playersList.passwordPlaceholder')}" />
        </div>`,
    });
    if (!result || result.password === undefined) return;

    await this.saveUser(player.id, {
      name: user.name,
      role: user.role,
      color: user.color,
      avatarUrl: user.avatarUrl ?? '',
      password: result.password,
    });
  }

  private async saveUser(id: string, update: Record<string, unknown>): Promise<void> {
    try {
      await api.put(`/worlds/${this.worldId}/users/${id}`, update);
      showToast(t('playersList.userUpdated'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('playersList.userUpdateError'), 'error');
    }
  }



  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.pongUnsub?.();
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    super.destroy();
  }
}
