import { t } from '../../lib/i18n.js';

export const SETUP_TABS = [
  { id: 'worlds', label: t('setupHub.nav.worlds'), icon: '🌍' },
  { id: 'systems', label: t('setupHub.nav.systems'), icon: '<i class="fa-solid fa-gear"></i>' },
  { id: 'modules', label: t('setupHub.nav.modules'), icon: '<i class="fa-solid fa-cube"></i>' },
] as const;

export type SetupTabId = (typeof SETUP_TABS)[number]['id'];

/** Navigation between sections has moved to the side rail of the Setup Hub
 * (`#setup-rail`, in `setup-hub.ts`). This function still exists because the three
 * tabs still call it at the top of their own template — returning empty avoids editing the
 * six call sites just to remove a bar that moved. */
export function renderSetupTabsNav(_active: SetupTabId): string {
  return '';
}
