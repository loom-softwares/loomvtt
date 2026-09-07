import { BaseComponent } from '../../components/base-component.js';
import { wsClient } from '../../core/ws-client.js';
import { api } from '../../core/api.js';
import { windowManager } from '../../core/window-manager.js';
import { StageConfigWindow } from '../../windows/stage-config-window.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';
import { t } from '../../lib/i18n.js';
import { applyUiOverride } from '../../core/ui-override.js';

interface OnlineUserPresence {
  userId: string;
  userName: string;
  userColor?: string;
  currentStageId?: string | null;
}

export class StageNav extends BaseComponent {
  private stages: any[] = [];
  private activeStageId: string | null = null;
  private isCollapsed: boolean = false;
  private onlineUsers: OnlineUserPresence[] = [];
  private unsubOnline: (() => void) | null = null;

  /** Decorates the native template with a registered `CONFIG.ui.nav` class, if any — never replaces it. */
  render(): void {
    super.render();
    applyUiOverride('nav', this.element, { scenes: this.stages, options: { worldId: this.worldId } });
  }

  constructor(
    container: HTMLElement,
    private worldId: string,
    private isGM: boolean = false,
  ) {
    super(container);
    this.unsubOnline = wsClient.on('users.online', (data: OnlineUserPresence[]) => {
      this.onlineUsers = data || [];
      this.render();
    });
    this.element.addEventListener('contextmenu', (e: MouseEvent) => {
      if (!this.isGM) return;
      e.preventDefault();

      const levelBtn = (e.target as HTMLElement).closest<HTMLElement>('.level-tab-btn');
      if (levelBtn) {
        const stageId = levelBtn.dataset.stageId;
        const levelId = levelBtn.dataset.levelId;
        if (stageId && levelId) this.showLevelContextMenu(stageId, levelId, levelBtn);
        return;
      }

      const stageBtn = (e.target as HTMLElement).closest<HTMLElement>('.stage-tab-btn');
      if (stageBtn) {
        const stageId = stageBtn.dataset.stageId || stageBtn.dataset.id;
        if (stageId) this.showStageContextMenu(stageId, stageBtn);
        return;
      }
    });
    this.render();
  }

  setStages(stages: any[], activeStageId: string | null): void {
    this.stages = stages || [];
    this.activeStageId = activeStageId;
    this.render();
  }

  protected template(): string {
    if (!this.stages.length) return '';

    // Main horizontal container
    let html = `<div class="stage-nav-container ${this.isCollapsed ? 'collapsed' : ''}">`;

    // The collapse/expand toggle button goes at the START (left side)
    html += `
      <button class="stage-nav-toggle-btn" data-action="toggle-nav" title="Recolher/Expandir Cenas">
        <i class="fa-solid fa-caret-${this.isCollapsed ? 'right' : 'left'}"></i>
      </button>
    `;

    this.stages.forEach((s) => {
      const isActive = s.id === this.activeStageId;
      
      // If collapsed, we ONLY render the active scene
      if (this.isCollapsed && !isActive) return;

      const hasLevels = s.levels && s.levels.length > 0;
      const viewers = this.onlineUsers.filter((u) => u.currentStageId === s.id);

      // Scene Tab Button
      html += `
        <div class="stage-nav-item ${isActive ? 'active' : ''}">
          <button class="stage-tab-btn"
                  data-action="preview-stage"
                  data-id="${s.id}" data-stage-id="${s.id}"
                  title="${t('stageNav.clickToView')}">
            ${isActive ? '<i class="fa-solid fa-map-pin"></i>' : '<i class="fa-solid fa-map"></i>'}
            <span class="stage-name">${this.escapeHtml(s.name)}</span>
            ${hasLevels ? '<i class="fa-solid fa-caret-down level-caret"></i>' : ''}
          </button>
          ${viewers.length > 0 ? `
            <span class="stage-nav-viewers">
              ${viewers.slice(0, 3).map((u) => `
                <span class="stage-nav-viewer-badge" style="background-color: ${u.userColor || '#888'};" title="${this.escapeHtml(u.userName)}">
                  ${this.escapeHtml((u.userName || '?').charAt(0).toUpperCase())}
                </span>
              `).join('')}
              ${viewers.length > 3 ? `<span class="stage-nav-viewer-badge stage-nav-viewer-overflow">+${viewers.length - 3}</span>` : ''}
            </span>
          ` : ''}

          <!-- Dropdown for Levels (appears on hover) -->
          ${hasLevels ? `
            <div class="stage-levels-dropdown">
              ${s.levels.map((l: any) => `
                <button class="level-tab-btn" data-action="switch-level" data-level-id="${l.id}" data-stage-id="${s.id}">
                  <span class="level-name">${this.escapeHtml(l.name)}</span>
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'toggle-nav') {
      this.isCollapsed = !this.isCollapsed;
      this.render();
    } else if (action === 'preview-stage' && id) {
      // There is no "main scene": the Stage is a group, what is a place is the level.
      // Clicking the group name leads to the MAIN LEVEL (the one with lowest elevation),
      // explicitly. Without this, the click loaded the stage without specifying the level, and
      // the canvas resolved it on its own — giving the impression of a scene existing
      // behind the levels.
      const stage = this.stages.find((s: any) => s.id === id);
      const base = (stage?.levels || []).length
        ? [...stage.levels].sort(
            (a: any, b: any) => (a.bottomElevation ?? 0) - (b.bottomElevation ?? 0),
          )[0]
        : null;

      window.dispatchEvent(new CustomEvent('preview-stage', { detail: { stageId: id } }));
      if (base) {
        window.dispatchEvent(
          new CustomEvent('switch-level', { detail: { stageId: id, levelId: base.id } }),
        );
      }
      this.render();
    } else if (action === 'switch-level') {
      const levelId = target.dataset.levelId;
      const stageId = target.dataset.stageId;
      if (levelId && stageId) {
        window.dispatchEvent(new CustomEvent('switch-level', { detail: { stageId, levelId } }));
      }
    } else if (action === 'activate-stage') {
      const stageId = target.dataset.stageId || target.dataset.id;
      if (stageId) {
        wsClient.send('stage.activate', { stageId, worldId: this.worldId });
      }
    }
  }

  private async showStageContextMenu(stageId: string, target: HTMLElement): Promise<void> {
    try {
      const stage = await api.get(`/stages/${stageId}`);
      if (!stage) return;

      const items: ContextMenuItem[] = [
        {
          icon: '<i class="fa-solid fa-play"></i>',
          label: t('stageNav.activateAll'),
          action: () => {
            wsClient.send('stage.activate', { stageId, worldId: this.worldId });
          },
        },
        {
          icon: '<i class="fa-solid fa-eye"></i>',
          label: t('stageNav.previewGM'),
          action: () => {
            window.dispatchEvent(new CustomEvent('preview-stage', { detail: { stageId } }));
          },
        },
        {
          icon: '<i class="fa-solid fa-gear"></i>',
          label: t('stageNav.configStage'),
          action: () => this.openStageConfig(stage),
        },
      ];

      const rect = target.getBoundingClientRect();
      showContextMenu(
        new MouseEvent('contextmenu', {
          clientX: rect.left,
          clientY: rect.bottom,
          bubbles: true,
          cancelable: true,
        }),
        items
      );
    } catch (e) {
      console.error('Failed to load stage for context menu:', e);
    }
  }

  private showLevelContextMenu(stageId: string, levelId: string, target: HTMLElement): void {
    const items: ContextMenuItem[] = [
      {
        icon: '<i class="fa-solid fa-magnet"></i>',
        label: t('stageNav.pullPlayers'),
        action: () => {
          wsClient.send('stage.activate', { stageId, levelId, worldId: this.worldId });
        },
      }
    ];

    const rect = target.getBoundingClientRect();
    showContextMenu(
      new MouseEvent('contextmenu', {
        clientX: rect.left,
        clientY: rect.bottom,
        bubbles: true,
        cancelable: true,
      }),
      items
    );
  }

  private openStageConfig(stage: any): void {
    windowManager.open(`stage-config-${stage.id}`, StageConfigWindow, {
      stage,
      onSaved: () => {
        wsClient.send('stages.list', { worldId: this.worldId });
      },
      worldId: this.worldId,
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.unsubOnline?.();
    this.unsubOnline = null;
    super.destroy();
  }
}
