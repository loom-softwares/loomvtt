import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';
import { showConfirm } from '../../components/dialog.js';
import { MacroEditorWindow } from '../../windows/macro-editor-window.js';
import { windowManager } from '../../core/window-manager.js';
import { executeMacro } from '../../lib/macro-runner.js';
import { renderMacroIconWrap } from './macro-icon.js';
import { applyUiOverride } from '../../core/ui-override.js';
import { mainMenuRegistry } from '../../core/main-menu-registry.js';

interface Macro {
  id: string;
  worldId: string;
  name: string;
  type: string;
  command: string;
  imgUrl: string;
  slot: number;
  ownership: any;
  folderId: string;
}

export class MacroHotbar extends BaseComponent {
  /** Decorates the native template with a registered `CONFIG.ui.hotbar` class, if any — never replaces it. */
  render(): void {
    super.render();
    applyUiOverride('hotbar', this.element, { macros: this.macros, options: { worldId: this.worldId } });
  }

  private worldId: string;
  private session: any;
  private macros: Macro[] = [];
  private currentPage = 1;
  private isMuted = false;
  private isLocked = false;
  private keydownHandler = this.handleKeydown.bind(this);

  constructor(container: HTMLElement, worldId: string, session: any) {
    super(container);
    this.worldId = worldId;
    this.session = session;
    this.loadMacros();
    this.render();

    // Click is already handled by onAction() via data-action (Rule 3). Only needs its own listener for contextmenu.
    this.element.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    
    // Drag and drop for Actors
    this.element.addEventListener('dragover', this.handleDragOver.bind(this));
    this.element.addEventListener('drop', this.handleDrop.bind(this));
    this.element.addEventListener('dragleave', this.handleDragLeave.bind(this));
    
    document.addEventListener('keydown', this.keydownHandler);
  }

  private handleContextMenu(e: MouseEvent): void {
    if (this.isLocked) return;
    const target = e.target as HTMLElement;
    const slot = target.closest<HTMLElement>('.macro-slot');
    if (!slot) return;
    e.preventDefault();

    const macroId = slot.getAttribute('data-id');
    if (macroId) {
      this.showMacroMenu(macroId, parseInt(slot.getAttribute('data-slot') || '0'), slot);
    }
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    const slot = (e.target as HTMLElement).closest('.macro-slot');
    if (slot && !slot.getAttribute('data-id')) {
      slot.classList.add('drag-over');
    }
  }

  private handleDrop(e: DragEvent): void {
    if (this.isLocked) return;
    e.preventDefault();
    const slot = (e.target as HTMLElement).closest('.macro-slot');
    if (!slot || slot.getAttribute('data-id')) return; // Only empty slots receive drops

    slot.classList.remove('drag-over');
    const rawText = e.dataTransfer?.getData('text/plain');
    if (!rawText) return;

    try {
      const data = JSON.parse(rawText);
      const slotNumber = parseInt(slot.getAttribute('data-slot') || '0');
      if (data.type === 'Actor') {
        this.createActorMacro(data.id, slotNumber);
      } else if (data.type === 'Macro') {
        // Dragged from the macros list in the sidebar — just reposition to the slot.
        this.moveMacroToSlot(data.id, slotNumber);
      } else if (data.type === 'RollableField') {
        // Dragged from a rollable field in the sheet (skill/attribute). The formula
        // is already resolved (@variables substituted) at the time of drag — the
        // macro gets a fixed value, it doesn't recalculate if the sheet changes later.
        this.createRollFieldMacro(data.label, data.formula, slotNumber);
      }
    } catch (err) {
      console.warn('LoomVTT | Dropped invalid JSON data on macro hotbar', err);
    }
  }

  private async moveMacroToSlot(macroId: string, slot: number): Promise<void> {
    try {
      await api.put(`/macros/${macroId}`, { slot });
      this.loadMacros();
    } catch (e: any) {
      showToast(e?.message || 'Error moving macro to slot', 'error');
    }
  }

  private async createRollFieldMacro(label: string, formula: string, slot: number): Promise<void> {
    try {
      await api.post('/macros', {
        worldId: this.worldId,
        name: label,
        type: 'chat',
        command: `/r ${formula}`,
        imgUrl: '',
        slot,
      });
      this.loadMacros();
      showToast(`Macro created: ${label}`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error creating macro', 'error');
    }
  }

  private handleDragLeave(e: DragEvent): void {
    const slot = (e.target as HTMLElement).closest('.macro-slot');
    if (slot) {
      slot.classList.remove('drag-over');
    }
  }

  private async loadMacros(): Promise<void> {
    try {
      const response = await api.get<Macro[]>(`/macros?worldId=${this.worldId}`);
      this.macros = response;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error loading macros', 'error');
    }
  }

  private getMacroForSlot(slot: number): Macro | null {
    return this.macros.find(m => m.slot === slot) || null;
  }

  protected template(): string {
    let html = `
      <div class="hotbar-controls hotbar-left-controls">
        <button class="macro-btn" data-action="toggle-menu" title="Main Menu"><i class="fa-solid fa-bars"></i></button>
        <button class="macro-btn" data-action="toggle-mute" title="Mute Volume">
          <i class="fa-solid ${this.isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
        </button>
      </div>
      <div class="macro-slots-container">
    `;
    const startSlot = (this.currentPage - 1) * 10;
    for (let i = startSlot; i < startSlot + 10; i++) {
      const macro = this.getMacroForSlot(i);
      const displayNum = (i % 10) === 9 ? '0' : ((i % 10) + 1).toString();
      html += `
        <div class="macro-slot" data-action="macro-slot-click" data-slot="${i}" data-id="${macro?.id || ''}" 
             title="${macro ? macro.name : `Slot ${i + 1}`}" 
             draggable="${!macro}" 
             ondragover="return false">
          ${macro ? renderMacroIconWrap(macro) : `<span class="slot-number">${displayNum}</span>`}
        </div>
      `;
    }
    html += `
      </div>
      <div class="hotbar-controls hotbar-right-controls">
        <div class="page-controls">
          <button class="macro-page-btn" data-action="page-up"><i class="fa-solid fa-caret-up"></i></button>
          <span class="macro-page-indicator">${this.currentPage}</span>
          <button class="macro-page-btn" data-action="page-down"><i class="fa-solid fa-caret-down"></i></button>
        </div>
        <div class="hotbar-action-controls">
          <button class="macro-btn" data-action="toggle-lock" title="${this.isLocked ? 'Unlock Hotbar' : 'Lock Hotbar'}">
            <i class="fa-solid ${this.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
          </button>
          <button class="macro-btn" data-action="clear-page" title="Clear Page">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    return html;
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'page-up') {
      this.currentPage = this.currentPage === 5 ? 1 : this.currentPage + 1;
      this.render();
      return;
    } else if (action === 'page-down') {
      this.currentPage = this.currentPage === 1 ? 5 : this.currentPage - 1;
      this.render();
      return;
    } else if (action === 'toggle-mute') {
      this.toggleMute();
      return;
    } else if (action === 'toggle-menu') {
      this.toggleMenu();
      return;
    } else if (action === 'toggle-lock') {
      this.isLocked = !this.isLocked;
      this.render();
      showToast(this.isLocked ? 'Hotbar locked' : 'Hotbar unlocked', 'info');
      return;
    } else if (action === 'clear-page') {
      if (this.isLocked) return;
      void this.clearCurrentPage();
      return;
    }

    const slot = target.closest('.macro-slot')?.getAttribute('data-slot');
    const macroId = target.closest('.macro-slot')?.getAttribute('data-id');

    if (!slot) return;

    if (action === 'macro-slot-click') {
      if (macroId) {
        this.executeMacro(macroId);
      } else if (!this.isLocked) {
        this.createMacro(parseInt(slot));
      }
    } else if (action === 'macro-slot-context') {
      if (macroId) {
        this.showMacroMenu(macroId, parseInt(slot), target);
      }
    }
  }

  private async executeMacro(macroId: string): Promise<void> {
    const macro = this.macros.find(m => m.id === macroId);
    if (!macro) return;
    await executeMacro(macro, this.worldId);
  }

  private createMacro(slot: number): void {
    windowManager.open(`macro-editor-${slot}`, MacroEditorWindow, {
      worldId: this.worldId,
      slot,
      onSaved: () => this.loadMacros(),
      userRole: this.session.userRole ?? 1,
    });
  }

  private async createActorMacro(actorId: string, slot: number): Promise<void> {
    try {
      // Fetch actor
      const actor = await api.get<{ name: string; avatarUrl?: string }>(`/actors/${actorId}`);
      if (!actor) {
        showToast('Actor not found', 'error');
        return;
      }

      // Create macro to open actor sheet
      const macroData = {
        worldId: this.worldId,
        name: actor.name,
        type: 'open-actor',
        command: actorId,
        imgUrl: actor.avatarUrl || '',
        slot,
      };

      await api.post('/macros', macroData);
      this.loadMacros();
      showToast(`Macro created for actor: ${actor.name}`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error creating actor macro', 'error');
    }
  }

  private showMacroMenu(macroId: string, slot: number, target: HTMLElement): void {
    const menu = document.createElement('div');
    menu.className = 'macro-context-menu';
    menu.innerHTML = `
      <div class="macro-menu-item" data-action="edit-macro">Edit</div>
      <div class="macro-menu-item" data-action="remove-from-slot">Remove from slot</div>
      <div class="macro-menu-item" data-action="delete-macro">Delete</div>
    `;

    const rect = target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.right + 5}px`;
    menu.style.top = `${rect.top}px`;
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    const handleClick = (e: MouseEvent) => {
      const action = (e.target as HTMLElement).getAttribute('data-action');
      const macro = this.macros.find(m => m.id === macroId);
      
      if (action === 'edit-macro' && macro) {
        windowManager.open(`macro-editor-${macroId}`, MacroEditorWindow, {
          worldId: this.worldId,
          slot: macro.slot,
          macro,
          onSaved: () => this.loadMacros(),
          userRole: this.session.userRole ?? 1,
        });
      } else if (action === 'remove-from-slot') {
        api.put(`/macros/${macroId}`, { slot: -1 })
          .then(() => {
            this.loadMacros();
            showToast('Macro removed from slot', 'success');
          })
          .catch((e: any) => {
            showToast(e?.message || 'Error removing macro from slot', 'error');
          });
      } else if (action === 'delete-macro') {
        void showConfirm('Delete Macro', 'Are you sure you want to delete this macro?').then((confirmed) => {
          if (confirmed) {
            api.delete(`/macros/${macroId}`)
              .then(() => {
                this.loadMacros();
                showToast('Macro deleted', 'success');
              })
              .catch((e: any) => {
                showToast(e?.message || 'Error deleting macro', 'error');
              });
          }
        });
      }
      menu.remove();
      document.removeEventListener('click', handleClick);
    };

    document.addEventListener('click', handleClick);
  }

  private async clearCurrentPage(): Promise<void> {
    const confirmed = await showConfirm('Clear Page', `Are you sure you want to remove all macros from page ${this.currentPage}?`);
    if (!confirmed) return;

    const startSlot = (this.currentPage - 1) * 10;
    const endSlot = startSlot + 9;
    const macrosToClear = this.macros.filter(m => m.slot >= startSlot && m.slot <= endSlot);

    if (macrosToClear.length === 0) return;

    try {
      await Promise.all(macrosToClear.map(m => api.put(`/macros/${m.id}`, { slot: -1 })));
      await this.loadMacros();
      showToast(`Page ${this.currentPage} cleared`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error clearing page', 'error');
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const keyNum = parseInt(e.key);
    if (e.key === '0' || (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9)) {
      e.preventDefault();
      const localSlot = e.key === '0' ? 9 : keyNum - 1;
      const absoluteSlot = localSlot + (this.currentPage - 1) * 10;
      const macroId = this.getMacroForSlot(absoluteSlot)?.id;
      if (macroId) {
        this.executeMacro(macroId);
      }
    }
  }

  private toggleMute(): void {
    this.isMuted = !this.isMuted;
    document.querySelectorAll('audio, video').forEach((el: any) => el.muted = this.isMuted);
    // Persist mute state across renders
    this.render();
    showToast(this.isMuted ? 'Audio muted' : 'Audio enabled', 'info');
  }

  /** Renders from `mainMenuRegistry` — any addon/system can add an
   * item via `mainMenuRegistry.register(...)` without editing this file (see comment in
   * main-menu-registry.ts). */
  private toggleMenu(): void {
    const existing = document.getElementById('main-menu-modal');
    if (existing) {
      existing.remove();
      return;
    }
    const menu = document.createElement('div');
    menu.id = 'main-menu-modal';
    menu.className = 'main-menu-modal';

    const itemsHtml = mainMenuRegistry.getAll().map(item => `
      <button class="menu-btn" data-menu-item="${item.id}"${item.danger ? ' style="color: #ff6b6b;"' : ''}>
        ${item.icon ? `<i class="${item.icon}"></i>` : ''} ${item.label}
      </button>
    `).join('');

    menu.innerHTML = `
      <div class="main-menu-overlay" data-action="menu-close"></div>
      <div class="main-menu-content">
        <h3 style="margin-bottom: 1rem; color: var(--color-accent); text-align: center;">Main Menu</h3>
        ${itemsHtml}
      </div>
    `;
    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');
      if (action === 'menu-close') {
        menu.remove();
        return;
      }
      const itemId = target.closest<HTMLElement>('[data-menu-item]')?.dataset.menuItem;
      if (!itemId) return;
      const item = mainMenuRegistry.getAll().find(i => i.id === itemId);
      item?.onClick({ worldId: this.worldId });
      menu.remove();
    });
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keydownHandler);
    super.destroy();
  }
}
