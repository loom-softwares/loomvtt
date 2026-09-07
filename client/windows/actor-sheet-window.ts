/*******************************************************************************
 * LoomVTT
 * client/windows/actor-sheet-window.ts
 * 
 * 
 * Window wrapper for rendering Actor sheets.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { DEFAULT_PORTRAIT_URL } from '../lib/default-portrait.js';
import { clog } from '../lib/client-logger.js';
import { LoomDocumentSheet } from './document-sheet.js';
import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { resolveSheetClass } from '../core/sheet-resolver.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { wsClient } from '../core/ws-client.js';
import { SheetSchema, dynamicSheetBodyTemplate, handleDotsClick, handleSquareCounterClick } from '../components/sheet-schema.js';
import { Tabs } from '../components/tabs.js';
import { ItemSheetWindow } from './item-sheet-window.js';
import { showConfirm, showPrompt, showAlert } from '../components/dialog.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { TokenConfigWindow } from './token-config-window.js';
import { FilePickerWindow } from './file-picker-window.js';
import { ItemCreateWindow } from './item-create-window.js';
import { OwnershipConfigWindow } from './ownership-config-window.js';
import type { ContextMenuItem } from '../components/context-menu.js';
import { resolveFormula } from '../core/resolve-formula.js';
import { dispatchRoll } from '../screens/game-hud/roll-dispatch.js';
import { systemRegistry } from '../core/system-registry.js';

interface Actor {
  id: string;
  name: string;
  type: string;
  avatarUrl?: string;
  worldId?: string;
  systemData: Record<string, any>;
  ownership?: Record<string, number>;
}

interface Item {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
  imgUrl?: string;
}

interface Buff {
  id: string;
  worldId: string;
  actorId: string;
  name: string;
  icon?: string;
  origin?: string;
  duration: number;
  disabled: boolean;
  changes: Array<{ key: string; mode: 'add' | 'multiply' | 'override'; value: number | string }>;
}

export class ActorSheetWindow extends LoomDocumentSheet<Actor> {
  protected get documentName(): string { return 'actor'; }
  protected get apiRoute(): string { return '/actors'; }

  get actor(): Actor | null { return this.document; }
  set actor(val: Actor | null) { this.document = val; }

  private schema: SheetSchema | null = null;
  private activeTabId: string | null = null;
  private loading = true;
  private items: Item[] = [];
  private itemsLoading = false;
  private itemsTabs: Tabs | null = null;
  private buffs: Buff[] = [];
  private buffsLoading = false;

  constructor(private props: { actorId: string; worldId?: string }) {
    super({ id: `actor-sheet-${props.actorId}`, title: t('actorSheet.title'), icon: '🎭', width: 480, height: 'auto', submitOnChange: true, documentId: props.actorId });
  }

  async mount(): Promise<void> {
    await super.mount();
    await this.load();

    // Delegated (runs once, `mount()` does not repeat on re-render — unlike
    // `onRender()`) for `roll-sheet-field` buttons, which are
    // recreated on every `rerenderBody()`. Formula resolved (@variables
    // swapped) at the MOMENT of drag: the macro created in the hotbar keeps a
    // fixed value, it doesn't recalculate if the sheet changes later — same trade-off
    // that other macro types (chat, script) already have.
    this.element.addEventListener('dragstart', (e: Event) => {
      const dragEvent = e as DragEvent;
      const btn = (dragEvent.target as HTMLElement).closest<HTMLElement>('[data-action="roll-sheet-field"]');
      if (!btn || !dragEvent.dataTransfer || !this.actor || !this.schema) return;
      const key = btn.dataset.key;
      const field = this.schema.tabs.flatMap((tb) => tb.fields).find((f) => f.key === key);
      if (!field?.formula) return;
      const resolved = resolveFormula(field.formula, this.actor.systemData || {});
      const payload = { type: 'RollableField', label: field.label, formula: resolved };
      dragEvent.dataTransfer.setData('text/plain', JSON.stringify(payload));
      dragEvent.dataTransfer.effectAllowed = 'copyMove';
    });
  }

  protected onClose(): void {
    super.onClose();
  }

  private async load(): Promise<void> {
    try {
      this.actor = this._withUpdateMethod(await api.get<Actor>(`/actors/${this.props.actorId}`));
      // Schema comes from client-side registry (Loom.systems) — the system runs
      // 100% in the browser by security decision, the server never knows
      // the sheet schema of any third-party ruleset.
      this.schema = systemRegistry.getActive()?.getSheetSchema?.(this.actor.type) ?? null;
      this.activeTabId = this.schema?.tabs[0]?.id ?? null;
      // Update title with actor name after loading. `name` truthy but equal to the
      // literal string "undefined"/"null" happens when the document was
      // created with an interpolated undefined value without checking (e.g. system
      // doing `name: \`${x}\`` with x undefined) — in this case it's better for the
      // window to keep the generic label than to display this broken text.
      if (this.actor?.name && this.actor.name !== 'undefined' && this.actor.name !== 'null') {
        this.options.title = this.actor.name;
        // Update the title in the DOM
        const titleEl = this.element?.querySelector('.loom-window-title-text');
        if (titleEl) {
          titleEl.textContent = this.actor.name;
        }
      } else if (this.actor?.name === 'undefined' || this.actor?.name === 'null') {
        clog.warn(`[ACTOR-SHEET] Actor "${this.props.actorId}" tem name === "${this.actor.name}" (string literal) salvo no documento — provável bug de criação no sistema/addon que criou esse actor.`);
      }
      await this.loadItems();
      await this.loadBuffs();
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.loadError'), 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  private async loadItems(): Promise<void> {
    try {
      this.itemsLoading = true;
      this.items = await api.get<Item[]>(`/actors/${this.props.actorId}/items`);
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.loadItemsError'), 'error');
      this.items = [];
    } finally {
      this.itemsLoading = false;
      this.rerenderBody();
    }
  }

  private async loadBuffs(): Promise<void> {
    try {
      this.buffsLoading = true;
      this.buffs = await api.get<Buff[]>(`/buffs/actor/${this.props.actorId}`);
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.loadEffectsError'), 'error');
      this.buffs = [];
    } finally {
      this.buffsLoading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('actorSheet.loading')}</p></div>`;
    }
    if (!this.actor) {
      return `<div class="empty-state"><p>${t('actorSheet.notFound')}</p></div>`;
    }
    return this.schema ? this.dynamicSheetTemplate() : this.basicSheetTemplate();
  }

  private itemsTabTemplate(): string {
    return `
      <div class="actor-sheet-items">
        <div class="items-header">
          <h3>${t('actorSheet.items')}</h3>
          ${this.isEditable ? `<button class="btn btn-primary" data-action="add-item">+ ${t('actorSheet.addItem')}</button>` : ''}
        </div>
        ${this.itemsListTemplate()}
      </div>
    `;
  }

  private effectsTabTemplate(): string {
    return `
      <div class="actor-sheet-effects">
        <div class="effects-header">
          <h3>${t('actorSheet.effects')}</h3>
          ${this.isEditable ? `<button class="btn btn-primary" data-action="add-effect">+ ${t('actorSheet.addEffect')}</button>` : ''}
        </div>
        ${this.effectsListTemplate()}
      </div>
    `;
  }

  private itemsListTemplate(): string {
    if (this.itemsLoading) {
      return `<div class="empty-state"><p>${t('actorSheet.loadingItems')}</p></div>`;
    }
    if (this.items.length === 0) {
      return `<div class="empty-state"><p>${t('actorSheet.noItems')}</p></div>`;
    }
    return `
      <div class="items-list">
        ${this.items.map(item => this.itemTemplate(item)).join('')}
      </div>
    `;
  }

  private effectsListTemplate(): string {
    if (this.buffsLoading) {
      return `<div class="empty-state"><p>${t('actorSheet.loadingEffects')}</p></div>`;
    }
    if (this.buffs.length === 0) {
      return `<div class="empty-state"><p>${t('actorSheet.noEffects')}</p></div>`;
    }
    return `
      <div class="effects-list">
        ${this.buffs.map(buff => this.effectTemplate(buff)).join('')}
      </div>
    `;
  }

  private itemTemplate(item: Item): string {
    const itemActions = item.data?.actions || item.data?.systemData?.actions || [];
    const actionButtons = Array.isArray(itemActions) && itemActions.length > 0
      ? `<div class="item-action-buttons">${itemActions.map((a: any) => `
           <button class="btn btn-small btn-action" data-action="run-item-action" data-item-id="${item.id}" data-action-id="${this.esc(a.id)}">${this.esc(a.label || a.id)}</button>
         `).join('')}</div>`
      : '';
    const editActions = this.isEditable
      ? `<button class="btn btn-secondary" data-action="edit-item" data-id="${item.id}">${t('actorSheet.edit')}</button>
         <button class="btn btn-danger" data-action="remove-item" data-id="${item.id}">${t('actorSheet.remove')}</button>`
      : `<button class="btn btn-secondary" data-action="edit-item" data-id="${item.id}">${t('actorSheet.view')}</button>`;
    return `
      <div class="item-row" draggable="true" data-id="${item.id}">
        <div class="item-info">
          <div class="item-name">${this.esc(item.name)}</div>
          <div class="item-type">${this.esc(item.type)}</div>
        </div>
        <div class="item-actions">${actionButtons}${editActions}</div>
      </div>
    `;
  }

  private effectTemplate(buff: Buff): string {
    const icon = buff.icon ? `<img src="${this.esc(buff.icon)}" class="effect-icon" alt="${this.esc(buff.name)}" />` : '✨';
    const statusBadge = buff.disabled
      ? `<span class="status-badge disabled">${t('actorSheet.disabled')}</span>`
      : `<span class="status-badge active">${t('actorSheet.active')}</span>`;

    const actions = this.isEditable
      ? `<button class="btn btn-secondary" data-action="edit-effect" data-id="${buff.id}">${t('actorSheet.edit')}</button>
         <button class="btn ${buff.disabled ? 'btn-warning' : 'btn-secondary'}" data-action="toggle-effect" data-id="${buff.id}">
           ${buff.disabled ? t('actorSheet.activate') : t('actorSheet.deactivate')}
         </button>
         <button class="btn btn-danger" data-action="remove-effect" data-id="${buff.id}">${t('actorSheet.remove')}</button>`
      : '';
    return `
      <div class="effect-row" data-id="${buff.id}">
        <div class="effect-info">
          <div class="effect-header">
            <div class="effect-name">${icon} ${this.esc(buff.name)}</div>
            ${statusBadge}
          </div>
          ${buff.origin ? `<div class="effect-origin">${this.esc(buff.origin)}</div>` : ''}
        </div>
        <div class="effect-actions">${actions}</div>
      </div>
    `;
  }

  private portraitTemplate(): string {
    const a = this.actor!;
    const action = this.isEditable ? 'data-action="pick-portrait"' : '';
    const inner = `<img src="${this.esc(a.avatarUrl || DEFAULT_PORTRAIT_URL)}" class="actor-portrait-img" alt="${this.esc(a.name)}" />`;
    return `
      <div class="actor-sheet-portrait" ${action}>
        ${inner}
      </div>
      <input type="file" name="portraitFile" accept="image/*" class="input-file-hidden" />
    `;
  }

  private basicSheetTemplate(): string {
    const a = this.actor!;
    return `
      <div class="actor-sheet-basic">
        <div class="actor-sheet-header" title="Arraste para a cena para criar token">
          ${this.portraitTemplate()}
          <input type="text" name="name" value="${this.esc(a.name)}" class="actor-sheet-name-input" ${this.isEditable ? '' : 'readonly'} />
          <span class="drag-handle" style="cursor: grab; opacity: 0.5; margin-left: 0.5rem;">⋮⋮</span>
        </div>
        <p class="actor-sheet-hint">${t('actorSheet.noSheetDefined', { type: this.esc(a.type) })}</p>
      </div>
    `;
  }

  private dynamicSheetTemplate(): string {
    const a = this.actor!;
    const allTabs = [
      ...(this.schema?.tabs.map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon })) || []),
      { id: 'items', label: t('actorSheet.items') },
      { id: 'effects', label: t('actorSheet.effects') }
    ];
    this.itemsTabs = new Tabs(allTabs, this.activeTabId ?? undefined);

    return `
      <div class="actor-sheet-header" title="Arraste para a cena para criar token">
        ${this.portraitTemplate()}
        <input type="text" name="name" value="${this.esc(a.name)}" class="actor-sheet-name-input" ${this.isEditable ? '' : 'readonly'} />
        <span class="drag-handle" style="cursor: grab; opacity: 0.5; margin-left: 0.5rem;">⋮⋮</span>
      </div>
      <div class="actor-sheet-tabs">
        ${this.itemsTabs.navTemplate()}
      </div>
      <div class="actor-sheet-content">
        ${this.itemsTabs.contentWrapper('items', this.itemsTabTemplate())}
        ${this.itemsTabs.contentWrapper('effects', this.effectsTabTemplate())}
        ${this.schema && !this.itemsTabs.isActive('items') && !this.itemsTabs.isActive('effects') ? this.itemsTabs.contentWrapper(this.activeTabId!, dynamicSheetBodyTemplate(this.schema!, a.systemData, this.activeTabId, this.props.actorId, 'actor', false)) : ''}
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (this.itemsTabs?.handleAction(action)) {
      this.activeTabId = this.itemsTabs.active === 'items' ? null : this.itemsTabs.active;
      this.rerenderBody();
      return;
    }

    if (action === 'switch-tab' && id) {
      this.activeTabId = id;
      this.rerenderBody();
    } else if (action === 'set-dots') {
      const key = target.dataset.key;
      const value = Number(target.dataset.value);
      if (key) handleDotsClick(this.element, key, value);
    } else if (action === 'roll-sheet-field') {
      void this.rollSheetField(target.dataset.key);
    } else if (action === 'pick-sheet-image') {
      const key = target.dataset.key;
      if (!key) return;
      windowManager.open('file-picker', FilePickerWindow, {
        onSelect: (path: string) => {
          const input = this.element.querySelector<HTMLInputElement>(`input[name="sd:${key}"]`);
          if (input) input.value = path;
        },
      });
    } else if (action === 'cycle-square') {
      const key = target.dataset.key;
      const index = Number(target.dataset.index);
      if (key) handleSquareCounterClick(this.element, key, index);
    } else if (action === 'pick-portrait') {
      windowManager.open('file-picker', FilePickerWindow, {
        onSelect: async (path: string) => {
          if (!this.actor) return;
          this.actor.avatarUrl = path;
          this.rerenderBody();
          try {
            await api.put(`/actors/${this.props.actorId}`, { avatarUrl: path });
          } catch (e: any) {
            showToast(e?.message || t('actorSheet.imageUploadError'), 'error');
          }
        },
      });
    } else if (action === 'add-item') {
      this.addItem();
    } else if (action === 'edit-item' && id) {
      this.editItem(id);
    } else if (action === 'remove-item' && id) {
      this.removeItem(id);
    } else if (action === 'run-item-action') {
      const itemId = target.dataset.itemId;
      const actionId = target.dataset.actionId;
      if (itemId && actionId) this.runItemAction(itemId, actionId);
    } else if (action === 'add-effect') {
      this.addEffect();
    } else if (action === 'edit-effect' && id) {
      this.editEffect(id);
    } else if (action === 'toggle-effect' && id) {
      this.toggleEffect(id);
    } else if (action === 'remove-effect' && id) {
      this.removeEffect(id);
    } else if (typeof super.onAction === 'function') {
      // `LoomDocumentSheet` (pai direto desta classe) TEM onAction real —
      // handles real 'save'/'auto-save' (submit/_debouncedAutoSave). It's only
      // unsafe to call super.onAction when the immediate parent is pure BaseWindow
      // (onAction there is just the hook signature, without body).
      super.onAction(action, id, target);
    } else {
      clog.warn(`[ACTOR-SHEET] Ação "${action}" não reconhecida — botão não faz nada.`);
    }
  }

  /** Attribute/skill roll directly from the sheet — field declared with `rollable: true` in the schema. */
  private async rollSheetField(key: string | undefined): Promise<void> {
    if (!key || !this.schema) return;
    const field = this.schema.tabs.flatMap((tb) => tb.fields).find((f) => f.key === key);
    if (!field?.formula) {
      clog.error(`[ACTOR-SHEET] Campo "${key}" tem rollable: true mas não declara "formula" no schema — nada pra rolar.`);
      return;
    }
    const session = wsClient.session;
    if (!session) {
      showToast(t('actorSheet.sessionUnavailable'), 'error');
      return;
    }
    const dispatch = (formula: string) => {
      dispatchRoll({
        worldId: session.worldId || '',
        userId: session.userId || '',
        userName: session.userName || 'Anonymous',
        userColor: session.userColor || '#888',
        formula,
        actorId: this.props.actorId,
        meta: { fieldKey: key, fieldLabel: field.label },
      });
    };
    // System with custom mechanics (dice pool, difficulty prompt, etc.)
    // handles the entire roll here — without this every system gets stuck on the
    // generic formula "1d10 + @attribute", which doesn't work for dice pools.
    const activeSystem = systemRegistry.getActive();
    if (activeSystem?.rollField) {
      const handled = await activeSystem.rollField(field, this.actor, dispatch);
      if (handled) return;
    }
    const actorSystemData = this.actor?.systemData || {};
    const resolved = resolveFormula(field.formula, actorSystemData);
    dispatch(resolved);
  }

  private async runItemAction(itemId: string, actionId: string): Promise<void> {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;
    const actions = item.data?.actions || item.data?.systemData?.actions || [];
    const action = Array.isArray(actions) ? actions.find((a: any) => a.id === actionId) : null;
    if (!action) {
      showToast(t('actorSheet.actionNotFound', { actionId }), 'error');
      return;
    }
    const session = wsClient.session;
    if (!session) {
      showToast(t('actorSheet.sessionUnavailable'), 'error');
      return;
    }
    const actorSystemData = this.actor?.systemData || {};
    const resolved = resolveFormula(action.formula || '', actorSystemData);
    const targets: string[] = [];
    if (action.target === 'selected') {
      const castMembers = await api.get<any[]>(`/actors/${this.props.actorId}/cast-members`);
      if (castMembers) {
        const userId = session.userId || '';
        for (const cm of castMembers) {
          const tBy: string[] = cm.targetedBy || [];
          if (tBy.includes(userId)) targets.push(cm.id);
        }
      }
    }
    dispatchRoll({
      worldId: session.worldId || '',
      userId: session.userId || '',
      userName: session.userName || 'Anonymous',
      userColor: session.userColor || '#888',
      formula: resolved,
      actorId: this.props.actorId,
      meta: {
        itemId,
        actionId,
        targets,
        applyTo: action.applyTo || undefined,
      }
    });
  }

  private async addItem(): Promise<void> {
    void windowManager.open(`item-create-${this.props.actorId}`, ItemCreateWindow, {
      actorId: this.props.actorId,
      onCreated: () => {
        void this.loadItems();
      }
    });
  }

  private async addEffect(): Promise<void> {
    const name = nextDefaultName(t('actorSheet.newEffect'), this.buffs.map(b => b.name));

    try {
      const worldId = this.actor?.worldId || this.props.worldId;
      await api.post('/buffs', {
        worldId,
        actorId: this.props.actorId,
        name,
        icon: '',
        origin: '',
        duration: -1,
        disabled: false,
        changes: []
      });
      await this.loadBuffs();
      showToast(t('actorSheet.effectAdded'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.effectAddError'), 'error');
    }
  }

  private editItem(itemId: string): void {
    const item = this.items.find(i => i.id === itemId);
    const typeName = item?.type || '*';
    const SheetClass = resolveSheetClass('item', typeName, ItemSheetWindow);
    windowManager.open(`item-sheet-${itemId}`, SheetClass, { itemId });
  }

  private async editEffect(buffId: string): Promise<void> {
    const buff = this.buffs.find(b => b.id === buffId);
    if (!buff) return;

    const name = await showPrompt(t('actorSheet.editEffect'), t('actorSheet.effectNamePrompt'), buff.name);
    if (!name) return;

    const icon = await showPrompt(t('actorSheet.editEffect'), t('actorSheet.effectIconPrompt'), buff.icon || '') || '';
    const origin = await showPrompt(t('actorSheet.editEffect'), t('actorSheet.effectOriginPrompt'), buff.origin || '') || '';

    try {
      await api.put(`/buffs/${buffId}`, {
        name: name.trim(),
        icon: icon.trim(),
        origin: origin.trim()
      });
      await this.loadBuffs();
      showToast(t('actorSheet.effectUpdated'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.effectUpdateError'), 'error');
    }
  }

  private async removeItem(itemId: string): Promise<void> {
    const confirmed = await showConfirm(t('actorSheet.removeItem'), t('actorSheet.removeItemConfirm'));
    if (!confirmed) return;

    try {
      await api.delete(`/actors/${this.props.actorId}/items/${itemId}`);
      await this.loadItems();
      showToast(t('actorSheet.itemRemoved'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.itemRemoveError'), 'error');
    }
  }

  private async toggleEffect(buffId: string): Promise<void> {
    const buff = this.buffs.find(b => b.id === buffId);
    if (!buff) return;

    try {
      await api.put(`/buffs/${buffId}`, {
        disabled: !buff.disabled
      });
      await this.loadBuffs();
      showToast(buff.disabled ? t('actorSheet.effectActivated') : t('actorSheet.effectDeactivated'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.effectToggleError'), 'error');
    }
  }

  private async removeEffect(buffId: string): Promise<void> {
    const confirmed = await showConfirm(t('actorSheet.removeEffect'), t('actorSheet.removeEffectConfirm'));
    if (!confirmed) return;

    try {
      await api.delete(`/buffs/${buffId}`);
      await this.loadBuffs();
      showToast(t('actorSheet.effectRemoved'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.effectRemoveError'), 'error');
    }
  }

  private async uploadPortrait(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file || !this.actor) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const worldId = this.props.worldId || (wsClient.session as any)?.worldId || '';
      const qs = worldId ? `?worldId=${worldId}` : '';
      const res = await fetch(`/api/assets/upload${qs}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('actorSheet.uploadFailed'));
      this.actor.avatarUrl = data.path.startsWith('http') || data.path.startsWith('/') ? data.path : `/${data.path}`;
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || t('actorSheet.imageUploadError'), 'error');
    }
  }

  protected _processFormData(formData: Record<string, any>): Record<string, any> {
    const data = super._processFormData(formData);
    if (this.actor) {
      data.avatarUrl = this.actor.avatarUrl || '';
    }
    return data;
  }

  protected onRender(): void {
    const itemsList = this.element.querySelector('.items-list');
    if (!itemsList) return;

    this.clearDragDrop();
    this.registerDragDrop({
      dragSelector: '.item-row',
      dropSelector: '.items-list',
      getDragData: (el) => {
        const id = el.dataset.id;
        return id ? { type: 'item', id } : null;
      },
      onDrop: (data, targetEl, event) => {
        if (data.type !== 'item') return;
        const dragged = this.element.querySelector<HTMLElement>(`.item-row[data-id="${data.id}"]`);
        if (!dragged || dragged.parentElement !== targetEl) return;

        const rows = [...targetEl.querySelectorAll<HTMLElement>('.item-row')];
        const insertBefore = rows.find(r => {
          const rect = r.getBoundingClientRect();
          return event.clientY < rect.top + rect.height / 2;
        });
        if (insertBefore && insertBefore !== dragged) {
          targetEl.insertBefore(dragged, insertBefore);
        } else if (!insertBefore) {
          targetEl.appendChild(dragged);
        }
      },
    });

    // Add drag support for actor header to create tokens on canvas
    const header = this.element?.querySelector('.actor-sheet-header');
    if (header) {
      header.setAttribute('draggable', 'true');
      header.addEventListener('dragstart', (e: Event) => {
        const dragEvent = e as DragEvent;
        if (!this.actor || !dragEvent.dataTransfer) return;
        const payload = {
          type: 'Actor',
          id: this.actor.id,
          uuid: `Actor.${this.actor.id}`,
        };
        dragEvent.dataTransfer.setData('text/plain', JSON.stringify(payload));
        dragEvent.dataTransfer.effectAllowed = 'copyMove';
      });
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  private get isGM(): boolean {
    return (wsClient.session?.userRole ?? 1) >= 4;
  }

  protected getOptionsMenuItems(): ContextMenuItem[] {
    const items = super.getOptionsMenuItems();
    items.push(
      {
        icon: '<i class="fa-solid fa-gear"></i>',
        label: t('actorSheet.configureSheet'),
        action: () => {
          void showAlert(t('actorSheet.sheetConfigTitle'), t('actorSheet.sheetConfigMessage'));
        }
      },
    );
    if (this.isGM) {
      items.push({
        icon: '<i class="fa-solid fa-users"></i>',
        label: t('actorSheet.configureOwnership'),
        action: () => {
          if (!this.actor) return;
          windowManager.open(`ownership-config-${this.actor.id}`, OwnershipConfigWindow, {
            worldId: this.actor.worldId || this.props.worldId || 'world-1',
            documentId: this.actor.id,
            apiRoute: '/actors',
            ownership: this.actor.ownership || {},
            onSaved: (ownership: Record<string, number>) => {
              if (this.actor) this.actor.ownership = ownership;
            },
          });
        }
      });
    }
    if (this.isGM) {
      items.push({
        icon: '<i class="fa-solid fa-user"></i>',
        label: t('actorSheet.tokenPrototype'),
        action: () => {
          const proto = this.actor?.systemData?.prototypeToken || {};
          const castMember: any = {
            id: this.actor?.id || this.props.actorId,
            name: this.actor?.name || 'Protótipo',
            avatarUrl: this.actor?.avatarUrl || '',
            colorHex: proto.colorHex || '#e74c3c',
            ringColor: proto.ringColor || '#e74c3c',
            ringUrl: proto.ringUrl || '',
            ringEffect: proto.ringEffect || 'none',
            ringScale: proto.ringScale,
            shape: proto.shape || 'circle',
            tintColor: proto.tintColor || '#ffffff',
            opacity: proto.opacity ?? 1,
            rotation: proto.rotation ?? 0,
            scale: proto.scale ?? 1,
            sightEnabled: proto.sightEnabled ?? true,
            sightRange: proto.sightRange ?? 0,
            sightAngle: proto.sightAngle ?? 360,
            sightMode: proto.sightMode || 'basic',
            detectionModes: proto.detectionModes ?? [],
            lightDimRange: proto.lightDimRange ?? 0,
            lightBrightRange: proto.lightBrightRange ?? 0,
            lightColor: proto.lightColor || '#ffffff',
            lightAnimation: proto.lightAnimation || 'none',
            barGridSize: proto.barGridSize ?? 1,
            movementAction: proto.movementAction || 'walk',
            elevation: proto.elevation ?? 0,
            x: 0,
            y: 0,
          };
          windowManager.open(`token-config-${castMember.id}`, TokenConfigWindow, {
            castMember,
            isPrototype: true,
            onUpdated: async (updated: any) => {
              try {
                const prototypeToken = {
                  colorHex: updated.colorHex,
                  ringColor: updated.ringColor,
                  ringUrl: updated.ringUrl,
                  ringEffect: updated.ringEffect,
                  ringScale: updated.ringScale,
                  shape: updated.shape,
                  tintColor: updated.tintColor,
                  opacity: updated.opacity,
                  rotation: updated.rotation,
                  scale: updated.scale,
                  sightEnabled: updated.sightEnabled,
                  sightRange: updated.sightRange,
                  sightAngle: updated.sightAngle,
                  sightMode: updated.sightMode,
                  detectionModes: updated.detectionModes,
                  lightDimRange: updated.lightDimRange,
                  lightBrightRange: updated.lightBrightRange,
                  lightColor: updated.lightColor,
                  lightAnimation: updated.lightAnimation,
                  barGridSize: updated.barGridSize,
                  movementAction: updated.movementAction,
                };
                const nextSystemData = {
                  ...(this.actor?.systemData || {}),
                  prototypeToken,
                };
                await api.put(`/actors/${this.props.actorId}`, {
                  name: updated.name,
                  avatarUrl: updated.avatarUrl,
                  systemData: nextSystemData,
                });
                if (this.actor) {
                  this.actor.name = updated.name;
                  this.actor.avatarUrl = updated.avatarUrl;
                  this.actor.systemData = nextSystemData;
                }
                showToast(t('actorSheet.tokenPrototypeUpdated'), 'success');
                await this.load();
              } catch (e: any) {
                showToast(t('actorSheet.tokenPrototypeUpdateError'), 'error');
              }
            }
          });
        }
      });
    }
    items.push(
      {
        icon: '<i class="fa-solid fa-image"></i>',
        label: t('actorSheet.viewCharacterArt'),
        action: () => {
          if (this.actor?.avatarUrl) {
            windowManager.open(`art-viewer-${this.actor.id}-char`, ArtViewerWindow, {
              id: `art-viewer-${this.actor.id}-char`,
              title: `${t('actorSheet.art')}: ${this.actor.name}`,
              imgUrl: this.actor.avatarUrl
            });
          } else {
            showToast(t('actorSheet.noImageConfigured'), 'info');
          }
        }
      },
      {
        icon: '<i class="fa-solid fa-coins"></i>',
        label: t('actorSheet.viewTokenArt'),
        action: () => {
          if (this.actor?.avatarUrl) {
            windowManager.open(`art-viewer-${this.actor.id}-token`, ArtViewerWindow, {
              id: `art-viewer-${this.actor.id}-token`,
              title: `${t('actorSheet.token')}: ${this.actor.name}`,
              imgUrl: this.actor.avatarUrl
            });
          } else {
            showToast(t('actorSheet.noTokenImageConfigured'), 'info');
          }
        }
      }
    );
    return items;
  }

  protected async _onDropItem(event: DragEvent, data: any): Promise<void> {
    if (!this.actor || !this.isEditable) return;

    let itemPayload: any = null;

    if (data.uuid?.startsWith('Compendium.') && data.data) {
      itemPayload = data.data;
    } else if (data.id) {
      try {
        itemPayload = await api.get(`/items/${data.id}`);
      } catch (err) {
        console.error('LoomVTT | Failed to fetch dropped item', err);
        return;
      }
    }

    if (!itemPayload) return;

    try {
      await api.post(`/actors/${this.props.actorId}/items`, {
        name: itemPayload.name,
        type: itemPayload.type || 'equipment',
        data: itemPayload.data || itemPayload.systemData || {},
        imgUrl: itemPayload.imgUrl || itemPayload.img || ''
      });
      void this.loadItems();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao anexar item', 'error');
    }
  }
}

class ArtViewerWindow extends BaseWindow {
  private imgUrl: string;
  constructor(props: { id: string; title: string; imgUrl: string }) {
    super({
      id: props.id,
      title: props.title,
      icon: '<i class="fa-solid fa-image"></i>',
      width: 450,
      height: 450,
    });
    this.imgUrl = props.imgUrl;
  }
  bodyTemplate(): string {
    return `
      <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 0.5rem; background: var(--color-bg-deep);">
        <img src="${this.imgUrl || ''}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; border: 1px solid var(--color-border);" />
      </div>
    `;
  }
  protected onAction() { }
}
