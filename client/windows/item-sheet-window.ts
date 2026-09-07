/*******************************************************************************
 * LoomVTT
 * client/windows/item-sheet-window.ts
 * 
 * 
 * Window wrapper for rendering Item sheets.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { clog } from '../lib/client-logger.js';
import { LoomDocumentSheet } from './document-sheet.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { wsClient } from '../core/ws-client.js';
import { SheetSchema, dynamicSheetBodyTemplate, handleDotsClick, handleSquareCounterClick } from '../components/sheet-schema.js';
import { Tabs } from '../components/tabs.js';
import { showConfirm, showPrompt } from '../components/dialog.js';
import { nextDefaultName } from '../lib/unique-name.js';
import { FilePickerWindow } from './file-picker-window.js';
import { resolveFormula } from '../core/resolve-formula.js';
import { dispatchRoll } from '../screens/game-hud/roll-dispatch.js';


interface Item {
  id: string;
  name: string;
  type: string;
  imgUrl?: string;
  data: Record<string, any>;
  ownership?: Record<string, number>;
  suppressed?: boolean;
}

interface Buff {
  id: string;
  worldId: string;
  actorId: string | null;
  itemId: string | null;
  name: string;
  icon?: string;
  origin?: string;
  duration: number;
  disabled: boolean;
  changes: Array<{ key: string; mode: 'add' | 'multiply' | 'override'; value: number | string }>;
}

export class ItemSheetWindow extends LoomDocumentSheet<Item> {
  protected get documentName(): string { return 'item'; }
  protected _apiRouteOverride: string | undefined;
  protected get apiRoute(): string { return this._apiRouteOverride ?? '/items'; }

  get item(): Item | null { return this.document; }
  set item(val: Item | null) { this.document = val; }

  private schema: SheetSchema | null = null;
  private activeTabId: string | null = null;
  private loading = true;
  private buffs: Buff[] = [];
  private buffsLoading = false;
  private itemsTabs: Tabs | null = null;

  constructor(private props: { itemId: string }) {
    super({ id: `item-sheet-${props.itemId}`, title: t('itemSheet.title'), icon: '🎒', width: 460, height: 'auto', submitOnChange: true, documentId: props.itemId });
  }

  async mount(): Promise<void> {
    await super.mount();
    await this.load();
  }

  protected onClose(): void {
    super.onClose();
  }

  private async load(): Promise<void> {
    try {
      this.item = await api.get<Item>(`${this.apiRoute}/${this.props.itemId}`);
      try {
        this.schema = await api.get<SheetSchema>(`/systems/active/item-sheet?type=${encodeURIComponent(this.item.type)}`);
      } catch {
        this.schema = null;
      }
      this.activeTabId = this.schema?.tabs[0]?.id ?? null;
      // Update title with real item name
      if (this.item?.name) {
        this.options.title = this.item.name;
        const titleEl = this.element?.querySelector('.loom-window-title-text');
        if (titleEl) titleEl.textContent = this.item.name;
      }
      await this.loadBuffs();
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.loadError'), 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  private async loadBuffs(): Promise<void> {
    try {
      this.buffsLoading = true;
      this.buffs = await api.get<Buff[]>(`/buffs/item/${this.props.itemId}`);
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.loadEffectsError'), 'error');
      this.buffs = [];
    } finally {
      this.buffsLoading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('itemSheet.loading')}</p></div>`;
    }
    if (!this.item) {
      return `<div class="empty-state"><p>${t('itemSheet.notFound')}</p></div>`;
    }
    return this.schema ? this.dynamicSheetTemplate() : this.basicSheetTemplate();
  }

  private effectsTabTemplate(): string {
    return `
      <div class="actor-sheet-effects">
        <div class="effects-header">
          <h3>${t('itemSheet.effects')}</h3>
          <button class="btn btn-primary" data-action="add-effect">+ ${t('itemSheet.addEffect')}</button>
        </div>
        ${this.effectsListTemplate()}
      </div>
    `;
  }

  private effectsListTemplate(): string {
    if (this.buffsLoading) {
      return `<div class="empty-state"><p>${t('itemSheet.loadingEffects')}</p></div>`;
    }
    if (this.buffs.length === 0) {
      return `<div class="empty-state"><p>${t('itemSheet.noEffects')}</p></div>`;
    }
    return `
      <div class="effects-list">
        ${this.buffs.map(buff => this.effectTemplate(buff)).join('')}
      </div>
    `;
  }

  private effectTemplate(buff: Buff): string {
    const icon = buff.icon ? `<img src="${this.esc(buff.icon)}" class="effect-icon" alt="${this.esc(buff.name)}" />` : '✨';
    const statusBadge = buff.disabled
      ? `<span class="status-badge disabled">${t('itemSheet.disabled')}</span>`
      : `<span class="status-badge active">${t('itemSheet.active')}</span>`;

    return `
      <div class="effect-row" data-id="${buff.id}">
        <div class="effect-info">
          <div class="effect-header">
            <div class="effect-name">${icon} ${this.esc(buff.name)}</div>
            ${statusBadge}
          </div>
          ${buff.origin ? `<div class="effect-origin">${this.esc(buff.origin)}</div>` : ''}
        </div>
        <div class="effect-actions">
          <button class="btn btn-secondary" data-action="edit-effect" data-id="${buff.id}">${t('itemSheet.edit')}</button>
          <button class="btn ${buff.disabled ? 'btn-warning' : 'btn-secondary'}" data-action="toggle-effect" data-id="${buff.id}">
            ${buff.disabled ? t('itemSheet.activate') : t('itemSheet.deactivate')}
          </button>
          <button class="btn btn-danger" data-action="remove-effect" data-id="${buff.id}">${t('itemSheet.remove')}</button>
        </div>
      </div>
    `;
  }

  private iconTemplate(): string {
    const it = this.item!;
    const inner = it.imgUrl
      ? `<img src="${this.esc(it.imgUrl)}" class="actor-portrait-img" alt="${this.esc(it.name)}" />`
      : `<span>🎒</span>`;
    return `
      <div class="actor-sheet-portrait ${it.imgUrl ? '' : 'has-no-image'}" data-action="pick-icon">
        ${inner}
      </div>
    `;
  }

  private basicSheetTemplate(): string {
    const it = this.item!;
    this.itemsTabs = new Tabs(
      [{ id: 'effects', label: t('itemSheet.effects') }],
      'effects'
    );
    return `
      <div class="actor-sheet-basic">
        <div class="actor-sheet-header">
          ${this.iconTemplate()}
          <input type="text" name="name" value="${this.esc(it.name)}" class="actor-sheet-name-input" ${this.isEditable ? '' : 'readonly'} />
        </div>
        <p class="actor-sheet-hint">${t('itemSheet.noSheetDefined', { type: this.esc(it.type) })}</p>
        <div class="actor-sheet-tabs">${this.itemsTabs.navTemplate()}</div>
        <div class="actor-sheet-content">
          ${this.itemsTabs.contentWrapper('effects', this.effectsTabTemplate())}
        </div>
      </div>
    `;
  }

  private dynamicSheetTemplate(): string {
    const it = this.item!;
    const allTabs = [
      ...(this.schema?.tabs.map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon })) || []),
      { id: 'effects', label: t('itemSheet.effects') }
    ];
    this.itemsTabs = new Tabs(allTabs, this.activeTabId ?? undefined);

    return `
      <div class="actor-sheet-header">
        ${this.iconTemplate()}
        <input type="text" name="name" value="${this.esc(it.name)}" class="actor-sheet-name-input" />
        <div class="form-group form-group-checkbox" style="margin:0;">
          <label><input type="checkbox" name="suppressed" ${it.suppressed ? 'checked' : ''} /> ${t('itemSheet.suppressed')}</label>
        </div>
      </div>
      <div class="actor-sheet-tabs">
        ${this.itemsTabs.navTemplate()}
      </div>
      <div class="actor-sheet-content">
        ${this.itemsTabs.contentWrapper('effects', this.effectsTabTemplate())}
        ${this.schema && !this.itemsTabs.isActive('effects') ? this.itemsTabs.contentWrapper(this.activeTabId!, dynamicSheetBodyTemplate(this.schema!, it.data, this.activeTabId, this.props.itemId, 'item', false)) : ''}
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (this.itemsTabs?.handleAction(action)) {
      this.activeTabId = this.itemsTabs.active === 'effects' ? null : this.itemsTabs.active;
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
    } else if (action === 'pick-icon') {
      windowManager.open('file-picker', FilePickerWindow, {
        onSelect: async (path: string) => {
          if (!this.item) return;
          this.item.imgUrl = path;
          this.rerenderBody();
          try {
            await api.put(`${this.apiRoute}/${this.props.itemId}`, { imgUrl: path });
          } catch (e: any) {
            showToast(e?.message || t('itemSheet.imageUploadError'), 'error');
          }
        },
      });
    } else if (action === 'add-effect') {
      this.addEffect();
    } else if (action === 'edit-effect' && id) {
      this.editEffect(id);
    } else if (action === 'toggle-effect' && id) {
      this.toggleEffect(id);
    } else if (action === 'remove-effect' && id) {
      this.removeEffect(id);
    } else if (action === 'run-item-action') {
      const actionId = target.dataset.actionId;
      if (actionId) this.runItemAction(actionId);
    } else if (typeof super.onAction === 'function') {
      // LoomDocumentSheet (direct parent) handles real 'save'/'auto-save'.
      super.onAction(action, id, target);
    } else {
      clog.warn(`[ITEM-SHEET] Ação "${action}" não reconhecida — botão não faz nada.`);
    }
  }

  private async runItemAction(actionId: string): Promise<void> {
    if (!this.item) return;
    const actorId = (this.item as any).actorId;
    if (!actorId) {
      showToast(t('itemSheet.noActorAssociated'), 'error');
      return;
    }
    const actions = this.item.data?.actions || this.item.data?.systemData?.actions || [];
    const action = Array.isArray(actions) ? actions.find((a: any) => a.id === actionId) : null;
    if (!action) {
      showToast(t('itemSheet.actionNotFound', { actionId }), 'error');
      return;
    }
    const session = wsClient.session;
    if (!session) {
      showToast(t('itemSheet.sessionUnavailable'), 'error');
      return;
    }
    try {
      const actor = await api.get<any>(`/actors/${actorId}`);
      if (!actor) {
        showToast(t('itemSheet.ownerActorNotFound'), 'error');
        return;
      }
      const actorSystemData = actor.systemData || {};
      const resolved = resolveFormula(action.formula || '', actorSystemData);
      const targets: string[] = [];
      if (action.target === 'selected') {
        const castMembers = await api.get<any[]>(`/actors/${actorId}/cast-members`);
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
        actorId,
        meta: {
          itemId: this.props.itemId,
          actionId,
          targets,
          applyTo: action.applyTo || undefined,
        }
      });
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.rollActionError'), 'error');
    }
  }

  private async addEffect(): Promise<void> {
    const name = nextDefaultName(t('itemSheet.newEffect'), this.buffs.map(b => b.name));

    try {
      const item = this.item;
      if (!item) return;
      await api.post('/buffs', {
        worldId: '',
        itemId: this.props.itemId,
        name,
        icon: '',
        origin: '',
        duration: -1,
        disabled: false,
        changes: []
      });
      await this.loadBuffs();
      showToast(t('itemSheet.effectAdded'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.effectAddError'), 'error');
    }
  }

  private async editEffect(buffId: string): Promise<void> {
    const buff = this.buffs.find(b => b.id === buffId);
    if (!buff) return;

    const name = await showPrompt(t('itemSheet.editEffect'), t('itemSheet.effectNamePrompt'), buff.name);
    if (!name) return;

    const icon = await showPrompt(t('itemSheet.editEffect'), t('itemSheet.effectIconPrompt'), buff.icon || '') || '';
    const origin = await showPrompt(t('itemSheet.editEffect'), t('itemSheet.effectOriginPrompt'), buff.origin || '') || '';

    try {
      await api.put(`/buffs/${buffId}`, {
        name: name.trim(),
        icon: icon.trim(),
        origin: origin.trim()
      });
      await this.loadBuffs();
      showToast(t('itemSheet.effectUpdated'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.effectUpdateError'), 'error');
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
      showToast(buff.disabled ? t('itemSheet.effectActivated') : t('itemSheet.effectDeactivated'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.effectToggleError'), 'error');
    }
  }

  private async removeEffect(buffId: string): Promise<void> {
    const confirmed = await showConfirm(t('itemSheet.removeEffect'), t('itemSheet.removeEffectConfirm'));
    if (!confirmed) return;

    try {
      await api.delete(`/buffs/${buffId}`);
      await this.loadBuffs();
      showToast(t('itemSheet.effectRemoved'), 'success');
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.effectRemoveError'), 'error');
    }
  }

  private async uploadIcon(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file || !this.item) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const worldId = (wsClient.session as any)?.worldId || '';
      const qs = worldId ? `?worldId=${worldId}` : '';
      const res = await fetch(`/api/assets/upload${qs}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('itemSheet.uploadFailed'));
      this.item.imgUrl = data.path;
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || t('itemSheet.imageUploadError'), 'error');
    }
  }

  protected _processFormData(formData: Record<string, any>): Record<string, any> {
    const data = super._processFormData(formData);
    if (this.item) {
      data.imgUrl = this.item.imgUrl || '';
      data.suppressed = !!formData.suppressed;
    }
    return data;
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
