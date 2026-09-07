/*******************************************************************************
 * LoomVTT
 * client/windows/item-create-window.ts
 * 
 * 
 * Window for creating new items.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { systemRegistry } from '../core/system-registry.js';

const FALLBACK_ITEM_TYPES = [
  { value: 'equipment', label: t('itemCreate.typeEquipment') },
  { value: 'weapon', label: t('itemCreate.typeWeapon') },
  { value: 'spell', label: t('itemCreate.typeSpell') },
  { value: 'feat', label: t('itemCreate.typeFeat') },
];

export class ItemCreateWindow extends BaseWindow {
  constructor(private props: { title?: string; actorId?: string; onCreated?: () => void; onSubmit?: (data: { name: string, type: string }) => Promise<void> }) {
    super({
      id: props.actorId ? `item-create-${props.actorId}` : `item-create-${crypto.randomUUID()}`,
      title: props.title || t('itemCreate.title'),
      icon: '<i class="fa-solid fa-khanda"></i>',
      width: 400,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    const activeSystem = systemRegistry.getActive();
    const itemTypes = activeSystem?.itemTypes?.length
      ? activeSystem.itemTypes.map((type) => ({
        value: type,
        label: type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      }))
      : FALLBACK_ITEM_TYPES;

    return `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem; box-sizing: border-box;">
        <div class="field-stack">
          <label style="color: var(--color-text-secondary); font-size: 0.95rem; font-weight: 500;">${t('itemCreate.nameLabel')}</label>
          <input type="text" name="itemName" placeholder="${t('itemCreate.namePlaceholder')}" class="field-input" />
        </div>
        <div class="field-stack">
          <label style="color: var(--color-text-secondary); font-size: 0.95rem; font-weight: 500;">${t('itemCreate.typeLabel')}</label>
          <select name="itemType" class="field-input">
            ${itemTypes.map((it) => `<option value="${it.value}">${it.label}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }

  protected onRender(): void {
    // Focus the item name input
    const input = this.element.querySelector<HTMLInputElement>('[name="itemName"]');
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }

  protected async _onBeforeSubmit(): Promise<boolean> {
    const nameInput = this.element.querySelector<HTMLInputElement>('[name="itemName"]');
    const name = nameInput?.value.trim() ?? '';
    if (!name) {
      if (nameInput) nameInput.style.borderColor = '#ff5252';
      showToast(t('itemCreate.nameRequired'), 'error');
      return false;
    }
    return true;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      void this.createItem();
    }
  }

  private async createItem(): Promise<void> {
    const nameInput = this.element.querySelector<HTMLInputElement>('[name="itemName"]');
    const typeSelect = this.element.querySelector<HTMLSelectElement>('[name="itemType"]');
    const name = nameInput?.value.trim() ?? '';
    const type = typeSelect?.value ?? 'equipment';

    try {
      const activeSystem = systemRegistry.getActive();
      const defaultData = activeSystem?.getDefaultData?.(type) ?? {};

      if (this.props.onSubmit) {
        await this.props.onSubmit({ name, type });
        showToast(t('itemCreate.created'), 'success');
        this.props.onCreated?.();
        windowManager.close(this.options.id);
      } else if (this.props.actorId) {
        await api.post(`/actors/${this.props.actorId}/items`, {
          name,
          type,
          data: defaultData,
          imgUrl: '',
        });
        showToast(t('itemCreate.created'), 'success');
        this.props.onCreated?.();
        windowManager.close(this.options.id);
      }
    } catch (e: any) {
      showToast(e?.message || t('itemCreate.createError'), 'error');
    }
  }
}
