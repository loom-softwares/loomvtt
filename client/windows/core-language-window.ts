/*******************************************************************************
 * LoomVTT
 * client/windows/core-language-window.ts
 * 
 * 
 * Window for configuring the core language.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { t, setLocale, getLocale } from '../lib/i18n.js';
import { settingsRegistry } from '../core/settings-registry.js';
import { showToast } from '../components/toast.js';

const LOCALES: { value: string; label: string }[] = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
];

/**
 * CORE language configuration (interface + ruleset bundles).
 * Persists in `core.language` (read by the addon loader on boot) and in
 * `loom_locale` (the real engine locale). The page reloads to re-render
 * the entire UI, which is translated at build time.
 */
export class CoreLanguageWindow extends BaseWindow {
  constructor() {
    super({
      id: 'core-language',
      title: t('gameSettings.language'),
      icon: '<i class="fa-solid fa-language"></i>',
      width: 420,
      height: 'auto',
    });
  }

  bodyTemplate(): string {
    const current = settingsRegistry.get('core', 'language') || getLocale();
    const options = LOCALES.map((l) =>
      `<option value="${l.value}" ${l.value === current ? 'selected' : ''}>${l.label}</option>`
    ).join('');
    return `
      <div style="padding:1rem">
        <p style="margin-bottom:1rem;color:var(--color-text-secondary);font-size:0.9rem">${t('gameSettings.languageHint')}</p>
        <select id="core-lang-select" class="settings-select" style="width:100%;box-sizing:border-box;padding:0.5rem;">
          ${options}
        </select>
        <p style="margin-top:0.75rem;color:var(--color-text-secondary);font-size:0.85rem">${t('gameSettings.languageReloadNote')}</p>
      </div>`;
  }

  protected onAction(action: string): void {
    if (action === 'save') {
      const select = this.element.querySelector<HTMLSelectElement>('#core-lang-select');
      const value = select?.value || getLocale();
      void settingsRegistry.set('core', 'language', value);
      setLocale(value as 'en' | 'pt-BR');
      showToast(t('gameSettings.languageSaved'), 'success');
      window.location.reload();
    }
  }
}