/*******************************************************************************
 * LoomVTT
 * client/windows/font-settings-window.ts
 * 
 * 
 * Window for configuring custom fonts.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { getFontCatalog, FONT_SLOTS, applyFontSlot } from '../core/font-loader.js';
import { t } from '../lib/i18n.js';
import { showToast } from '../components/toast.js';

const STORAGE_KEY = 'loom:font-prefs';

export class FontSettingsWindow extends BaseWindow {
  private catalog: any[] = [];

  constructor() {
    super({
      id: 'font-settings',
      title: t('fontSettings.title'),
      icon: 'Aa',
      width: 520,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    const rows = FONT_SLOTS.map((slot) => {
      const saved = this.loadPref(slot.variable);
      const current = saved || slot.currentFamily;
      const options = this.catalog
        .filter((f: any) => f.source === 'core')
        .filter((f: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.family === f.family) === i)
        .map((f: any) => `<option value="${f.family}" ${f.family === current ? 'selected' : ''}>${f.family}</option>`)
        .join('');
      return `
        <div class="font-slot-row" style="display:flex;align-items:center;gap:1rem;padding:0.75rem 0;border-bottom:1px solid var(--color-border-glass)">
          <label style="width:140px;flex-shrink:0;font-family:var(${slot.variable});font-weight:600">${t(slot.label)}</label>
          <select data-slot="${slot.variable}" style="flex:1;padding:0.4rem 0.5rem;background:var(--color-bg-medium);color:var(--color-text-primary);border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-ui)">
            ${options}
          </select>
          <span style="font-family:var(${slot.variable});font-size:1.2rem;width:2rem;text-align:center">Aa</span>
        </div>`;
    }).join('');

    return `
      <div style="padding:1rem">
        <p style="margin-bottom:1rem;color:var(--color-text-secondary);font-size:0.9rem">${t('fontSettings.hint')}</p>
        ${rows}
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.5rem">
          <button class="btn" data-action="reset-fonts">${t('fontSettings.reset')}</button>
        </div>
      </div>`;
  }

  protected async _preFirstRender(): Promise<void> {
    this.catalog = await getFontCatalog();
  }

  protected onAction(action: string): void {
    // 'save' is the standard BaseWindow footer button. Before this, this window
    // drew its own "Save" button in the body, so two would appear.
    if (action === 'save') {
      const selects = this.element.querySelectorAll('select[data-slot]');
      selects.forEach((sel) => {
        const slot = (sel as HTMLSelectElement).dataset.slot;
        const family = (sel as HTMLSelectElement).value;
        if (slot && family) {
          applyFontSlot(slot, family);
          this.savePref(slot, family);
        }
      });
      showToast(t('fontSettings.saved'), 'success');
    } else if (action === 'reset-fonts') {
      FONT_SLOTS.forEach((slot) => {
        document.documentElement.style.removeProperty(slot.variable);
        localStorage.removeItem(`${STORAGE_KEY}:${slot.variable}`);
      });
      this.rerenderBody();
      showToast(t('fontSettings.resetDone'), 'info');
    }
  }

  private loadPref(slot: string): string | null {
    return localStorage.getItem(`${STORAGE_KEY}:${slot}`);
  }

  private savePref(slot: string, family: string): void {
    localStorage.setItem(`${STORAGE_KEY}:${slot}`, family);
  }
}
