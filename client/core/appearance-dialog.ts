/*******************************************************************************
 * LoomVTT
 * client/core/appearance-dialog.ts
 * 
 * 
 * Dialog for managing token and actor appearance.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { windowManager } from './window-manager.js';
import { showToast } from '../components/toast.js';
import { LoomDialog } from '../windows/loom-dialog.js';
import {
  getCurrentTheme, getCurrentPalette, setTheme, setPalette,
  listCustomPalettes, installCustomPalette, deleteCustomPalette,
  type ThemeMode,
} from './theme-manager.js';

/** Theme/palette dialog — shared between Game Config (inside world) and App Config (Setup Hub).
 * Theme is a `localStorage` preference applied globally to `<html>` by `theme-manager`. */
export function openAppearanceDialog(): void {
  const theme = getCurrentTheme();
  const palette = getCurrentPalette();
  const customPalettes = listCustomPalettes();
  const builtin = [
    { id: 'default', label: t('gameSettings.paletteDefault') },
    { id: 'ember', label: t('gameSettings.paletteEmber') },
    { id: 'frost', label: t('gameSettings.paletteFrost') },
    { id: 'violet', label: t('gameSettings.paletteViolet') },
  ];

  const content = `
    <div class="form-group">
      <label>${t('gameSettings.theme')}</label>
      <select data-field="theme">
        <option value="dark" ${theme === 'dark' ? 'selected' : ''}>${t('gameSettings.themeDark')}</option>
        <option value="light" ${theme === 'light' ? 'selected' : ''}>${t('gameSettings.themeLight')}</option>
      </select>
    </div>
    <div class="form-group">
      <label>${t('gameSettings.palette')}</label>
      <select data-field="palette">
        ${builtin.map(p => `<option value="${p.id}" ${palette === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
        ${customPalettes.map(p => `<option value="${p.name}" ${palette === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
    </div>
    ${customPalettes.length > 0 ? `
      <div class="form-group appearance-custom-list">
        ${customPalettes.map(p => `
          <div class="appearance-custom-row">
            <span>${p.name}</span>
            <button type="button" class="btn-icon" data-action="delete-custom-palette" data-name="${p.name}" title="${t('gameSettings.paletteDelete')}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="form-group">
      <label>${t('gameSettings.paletteInstall')}</label>
      <input type="text" data-field="custom-name" placeholder="${t('gameSettings.paletteInstallName')}">
      <input type="file" accept=".json,application/json" data-field="install-file">
    </div>
  `;

  const dialog = new LoomDialog({
    window: { title: t('gameSettings.appearance') },
    content,
    width: 420,
    buttons: [{ action: 'close', label: t('gameSettings.close'), default: true }],
    actions: {
      'delete-custom-palette': (_e, target) => {
        const name = target.dataset.name!;
        deleteCustomPalette(name);
        windowManager.close(dialog.id);
        openAppearanceDialog();
      },
    },
    render: (_e, dlg) => {
      const el = document.getElementById(dlg.id)!;
      const themeSelect = el.querySelector<HTMLSelectElement>('[data-field="theme"]');
      const paletteSelect = el.querySelector<HTMLSelectElement>('[data-field="palette"]');
      const nameInput = el.querySelector<HTMLInputElement>('[data-field="custom-name"]');
      const fileInput = el.querySelector<HTMLInputElement>('[data-field="install-file"]');

      themeSelect?.addEventListener('change', () => setTheme(themeSelect.value as ThemeMode));
      paletteSelect?.addEventListener('change', () => setPalette(paletteSelect.value));

      fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const name = nameInput?.value.trim() || file.name.replace(/\.json$/i, '');
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const vars = parsed.vars ?? parsed;
          installCustomPalette(name, vars);
          setPalette(name);
          showToast(t('gameSettings.paletteInstalled'), 'success');
          windowManager.close(dialog.id);
          openAppearanceDialog();
        } catch {
          showToast(t('gameSettings.paletteInstallError'), 'error');
        }
      });
    },
  });
  dialog.render(true);
}
