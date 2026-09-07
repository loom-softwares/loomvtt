import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';
import { windowManager } from '../../core/window-manager.js';
import { TokenConfigWindow } from '../../windows/token-config-window.js';
import type { CanvasManager } from '../../canvas/canvas-manager.js';

interface CastMember {
  id: string;
  name: string;
  x: number;
  y: number;
  actorId?: string;
  avatarUrl?: string;
  systemData?: any;
  statusMarkers?: string[];
  elevation?: number;
  locked?: boolean;
  hidden?: boolean;
  movementAction?: string;
  targetedBy?: string[];
  colorHex?: string;
  ringColor?: string;
  shape?: string;
}

const STATUS_OPTIONS = [
  { value: 'blinded', label: 'Blinded', emoji: '👁️' },
  { value: 'poisoned', label: 'Poisoned', emoji: '☠️' },
  { value: 'stunned', label: 'Stunned', emoji: '⭐' },
  { value: 'prone', label: 'Prone', emoji: '🛏️' },
  { value: 'invisible', label: 'Invisible', emoji: '👻' },
  { value: 'restrained', label: 'Restrained', emoji: '🕸️' },
  { value: 'frightened', label: 'Frightened', emoji: '😱' },
  { value: 'grappled', label: 'Grappled', emoji: '🤼' },
  { value: 'unconscious', label: 'Unconscious', emoji: '💤' },
  { value: 'burning', label: 'Burning', emoji: '🔥' },
];

const MOVEMENT_OPTIONS = [
  { value: 'walk', label: 'Walk', icon: '<i class="fas fa-walking"></i>' },
  { value: 'fly', label: 'Fly', icon: '<i class="fas fa-crow"></i>' },
  { value: 'swim', label: 'Swim', icon: '<i class="fas fa-water"></i>' },
  { value: 'burrow', label: 'Burrow', icon: '<i class="fas fa-mountain"></i>' },
  { value: 'crawl', label: 'Crawl', icon: '<i class="fas fa-spider"></i>' },
  { value: 'climb', label: 'Climb', icon: '<i class="fas fa-hiking"></i>' },
  { value: 'jump', label: 'Jump', icon: '<i class="fas fa-running"></i>' },
  { value: 'blink', label: 'Teleport (Blink)', icon: '<i class="fas fa-bolt"></i>' },
];

export class TokenHud {
  private el: HTMLElement;
  private current: CastMember | null = null;
  private rafId: number | null = null;
  private userId: string;
  private worldId: string;
  private isGM: boolean;

  constructor(
    private container: HTMLElement,
    private canvasManager: CanvasManager,
    opts: { userId: string; worldId: string; isGM: boolean },
    private onUpdated: (member: CastMember) => void,
    private onDelete?: (id: string, name: string) => void,
  ) {
    this.userId = opts.userId;
    this.worldId = opts.worldId;
    this.isGM = opts.isGM;
    this.el = document.createElement('div');
    this.el.className = 'token-hud';
    this.el.style.display = 'none';
    this.container.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.handleClick(e));
    this.el.addEventListener('contextmenu', (e) => this.handleRightClick(e));
  }

  show(member: CastMember): void {
    this.current = member;
    this.el.style.display = 'flex';
    this.render();
    this.startTracking();
  }

  hide(): void {
    this.current = null;
    this.el.style.display = 'none';
    this.stopTracking();
  }

  isShowingId(id: string): boolean {
    return this.current?.id === id;
  }

  updateMember(member: CastMember): void {
    if (!this.current || this.current.id !== member.id) return;
    this.current = member;
    this.render();
  }

  private startTracking(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      if (!this.current) return;
      const rect = this.canvasManager.getTokenScreenRect(this.current.id);
      if (rect) {
        this.el.style.left = `${Math.round(rect.x + rect.width / 2)}px`;
        this.el.style.top = `${Math.round(rect.y + rect.height / 2)}px`;
        // HUD designed for a 96px reference token — scales along
        // with the token's actual size on screen, doesn't get bigger than it.
        const scale = Math.max(0.15, Math.min(1.3, rect.width / 96));
        this.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTracking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private render(): void {
    const m = this.current;
    if (!m) return;
    const isTargetedByMe = (m.targetedBy || []).includes(this.userId);
    const hp = m.systemData?.hp?.value ?? m.systemData?.hp ?? null;
    const maxHp = m.systemData?.hp?.max ?? null;
    const hpPct = hp !== null && maxHp ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : null;

    this.el.innerHTML = `
      <div class="token-hud-col left">
        <div class="token-hud-btn" data-action="duplicate" title="Duplicate Token"><i class="fas fa-clone"></i></div>
        <div class="token-hud-btn ${m.locked ? 'active' : ''}" data-action="lock" title="${m.locked ? 'Unlock' : 'Lock'} Token"><i class="fas fa-${m.locked ? 'lock' : 'lock-open'}"></i></div>
        <div class="token-hud-btn" data-action="config" title="Configure Token"><i class="fas fa-cog"></i></div>
        <div class="token-hud-btn danger" data-action="delete" title="Delete Token"><i class="fas fa-trash"></i></div>
      </div>
      <div class="token-hud-elevation" data-action="elevation-up" title="Elevation (click=+1, right click=-1)">
        <i class="fas fa-chevron-up"></i>
        <span>${m.elevation ?? 0}</span>
      </div>
      <div class="token-hud-portrait">
        ${hpPct !== null ? `<div class="token-hud-hp"><div class="token-hud-hp-fill" style="width:${hpPct}%"></div></div>` : ''}
      </div>
      <div class="token-hud-col right">
        <div class="token-hud-btn ${m.hidden ? 'active' : ''}" data-action="visibility" title="${m.hidden ? 'Show' : 'Hide'} Token"><i class="fas fa-eye${m.hidden ? '-slash' : ''}"></i></div>
        <div class="token-hud-btn" data-action="status" title="Assign Status Effects"><i class="fas fa-user-injured"></i></div>
        <div class="token-hud-btn" data-action="movement" title="Select Movement Action"><i class="fas fa-walking"></i></div>
        <div class="token-hud-btn ${isTargetedByMe ? 'active' : ''}" data-action="target" title="${isTargetedByMe ? 'Remove Target' : 'Set Target'}"><i class="fas fa-bullseye"></i></div>
        <div class="token-hud-btn combat" data-action="combat" title="Toggle Combat">⚔️</div>
      </div>
      ${maxHp !== null ? `<div class="token-hud-hp-badge">${hp}/${maxHp}</div>` : ''}
    `;
  }

  private handleRightClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest('[data-action]');
    if (!btn || btn.getAttribute('data-action') !== 'elevation-up') return;
    e.preventDefault();
    this.adjustElevation(-1);
  }

  private handleClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn || !this.current) return;
    const action = btn.getAttribute('data-action');

    switch (action) {
      case 'duplicate':
        void this.duplicate();
        break;
      case 'lock':
        void this.toggleField('locked', !this.current.locked);
        break;
      case 'config': {
        const m = this.current;
        void windowManager.open(`token-config-${m.id}`, TokenConfigWindow, {
          castMember: {
            id: m.id,
            name: m.name,
            avatarUrl: m.avatarUrl || '',
            colorHex: m.colorHex || '#e74c3c',
            ringColor: m.ringColor || m.colorHex || '#e74c3c',
            ringUrl: (m as any).ringUrl || '',
            ringEffect: (m as any).ringEffect || 'none',
            ringScale: (m as any).ringScale,
            shape: m.shape || 'circle',
            x: m.x,
            y: m.y,
            actorId: m.actorId,
            kind: (m as any).kind || 'adventurer',
            tintColor: (m as any).tintColor || '#ffffff',
            opacity: (m as any).opacity ?? 1,
            rotation: (m as any).rotation ?? 0,
            scale: (m as any).scale ?? 1,
            sightEnabled: (m as any).sightEnabled ?? true,
            sightRange: (m as any).sightRange ?? 0,
            sightAngle: (m as any).sightAngle ?? 360,
            sightMode: (m as any).sightMode || 'basic',
            detectionModes: (m as any).detectionModes ?? [],
            lightDimRange: (m as any).lightDimRange ?? 0,
            lightBrightRange: (m as any).lightBrightRange ?? 0,
            lightColor: (m as any).lightColor || '#ffffff',
            lightAnimation: (m as any).lightAnimation || 'none',
            systemData: (m as any).systemData ?? {},
            barGridSize: (m as any).barGridSize ?? 1,
            movementAction: (m as any).movementAction || 'walk',
            elevation: (m as any).elevation ?? 0,
            locked: !!m.locked,
            hidden: !!m.hidden,
            ownership: (m as any).ownership ?? {},
          },
          onUpdated: (updated: CastMember) => this.onUpdated(updated),
        });
        break;
      }
      case 'visibility':
        void this.toggleField('hidden', !this.current.hidden);
        break;
      case 'status':
        this.openStatusFlyout(btn);
        break;
      case 'movement':
        this.openMovementFlyout(btn);
        break;
      case 'target':
        void this.toggleTarget();
        break;
      case 'combat':
        void this.toggleCombat();
        break;
      case 'elevation-up':
        this.adjustElevation(1);
        break;
      case 'delete': {
        const m = this.current;
        this.onDelete?.(m.id, m.name);
        this.hide();
        break;
      }
    }
  }

  private async adjustElevation(delta: number): Promise<void> {
    if (!this.current) return;
    const next = (this.current.elevation ?? 0) + delta;
    await this.toggleField('elevation', next);
  }

  private async toggleField(field: string, value: unknown): Promise<void> {
    if (!this.current) return;
    try {
      const updated = await api.put<CastMember>(`/cast/${this.current.id}/token`, { [field]: value });
      this.current = { ...this.current, ...updated };
      this.onUpdated(this.current);
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error updating token', 'error');
    }
  }

  private async duplicate(): Promise<void> {
    if (!this.current) return;
    try {
      await api.post('/cast', {
        name: this.current.name,
        x: this.current.x + 40,
        y: this.current.y + 40,
        actorId: this.current.actorId,
        avatarUrl: this.current.avatarUrl,
        systemData: this.current.systemData,
        worldId: this.worldId,
      });
      showToast('Token duplicated', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error duplicating token', 'error');
    }
  }

  private async toggleTarget(): Promise<void> {
    if (!this.current) return;
    const targetedBy = this.current.targetedBy || [];
    const next = targetedBy.includes(this.userId)
      ? targetedBy.filter((id) => id !== this.userId)
      : [...targetedBy, this.userId];
    // Dedicated endpoint: toggle target doesn't require token edit permission
    // (any player can target any visible token).
    try {
      const updated = await api.put<CastMember>(`/cast/${this.current.id}/target`, { targetedBy: next });
      this.current = { ...this.current, ...updated };
      this.onUpdated(this.current);
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error toggling target', 'error');
    }
  }

  private async toggleCombat(): Promise<void> {
    if (!this.current) return;
    try {
      const combat = await api.get<any>(`/combat/${this.worldId}`);
      const inCombat = combat?.combatants?.some((c: any) => c.id === this.current!.id);
      if (inCombat) {
        await api.delete(`/combat/${this.worldId}/combatant/${this.current.id}`);
        showToast('Removed from combat', 'info');
      } else {
        await api.post(`/combat/${this.worldId}/combatant`, { castId: this.current.id });
        showToast('Added to combat', 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error toggling combat', 'error');
    }
  }

  private openStatusFlyout(anchor: HTMLElement): void {
    if (!this.current) return;
    const member = this.current;
    const current = member.statusMarkers || [];
    this.openFlyout(anchor, 'status-flyout', STATUS_OPTIONS.map((opt) => `
      <div class="flyout-status-item ${current.includes(opt.value) ? 'active' : ''}" data-status="${opt.value}" title="${opt.label}">
        <span>${opt.emoji}</span>
      </div>
    `).join(''), (flyoutEl) => {
      flyoutEl.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.flyout-status-item');
        if (!item) return;
        const value = item.getAttribute('data-status');
        if (!value) return;
        const list = member.statusMarkers || [];
        const next = list.includes(value) ? list.filter((s) => s !== value) : [...list, value];
        item.classList.toggle('active');
        void this.toggleField('statusMarkers', next);
      });
    });
  }

  private openMovementFlyout(anchor: HTMLElement): void {
    if (!this.current) return;
    const active = this.current.movementAction || 'walk';
    this.openFlyout(anchor, 'movement-flyout', MOVEMENT_OPTIONS.map((opt) => `
      <div class="flyout-list-item ${opt.value === active ? 'active' : ''}" data-movement="${opt.value}">
        ${opt.icon}<span>${opt.label}</span>
      </div>
    `).join(''), (flyoutEl) => {
      flyoutEl.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.flyout-list-item');
        if (!item) return;
        const value = item.getAttribute('data-movement');
        if (!value) return;
        void this.toggleField('movementAction', value);
        this.closeFlyouts();
      });
    });
  }

  private openFlyout(anchor: HTMLElement, className: string, innerHtml: string, bind: (el: HTMLElement) => void): void {
    this.closeFlyouts();
    const rect = anchor.getBoundingClientRect();
    const flyoutEl = document.createElement('div');
    flyoutEl.className = `token-hud-flyout ${className}`;
    flyoutEl.style.left = `${rect.right + 8}px`;
    flyoutEl.style.top = `${rect.top}px`;
    flyoutEl.innerHTML = innerHtml;
    document.body.appendChild(flyoutEl);
    bind(flyoutEl);

    const closeHandler = (e: MouseEvent) => {
      if (flyoutEl.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      this.closeFlyouts();
    };
    setTimeout(() => document.addEventListener('click', closeHandler, { once: true, capture: true }), 0);
    this.activeFlyout = flyoutEl;
  }

  private activeFlyout: HTMLElement | null = null;

  private closeFlyouts(): void {
    this.activeFlyout?.remove();
    this.activeFlyout = null;
  }

  destroy(): void {
    this.stopTracking();
    this.closeFlyouts();
    this.el.remove();
  }
}
