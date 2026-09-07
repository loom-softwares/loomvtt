/*******************************************************************************
 * LoomVTT
 * client/core/sheet-resolver.ts
 * 
 * 
 * Resolver for determining which sheet to render.
 ******************************************************************************/

import type { LoomDocumentSheet } from '../windows/document-sheet.js';
import { sheetCatalog } from './sheet-catalog.js';
import { systemLoadStatus } from './addon-client-loader.js';
import { showToast } from '../components/toast.js';

type SheetConstructor = new (props: any) => LoomDocumentSheet;

/** Prevents stacking the same toast for each sheet opened in the same session. */
let warnedSystemLoadFailure = false;

/**
 * Resolves the sheet class to open, using the same fallback cascade.
 * If the world's active system failed to load, the catalog was never populated
 * by it — but the correct behavior (similar to origin systems) is to open the
 * generic sheet anyway, warning once that it is not the actual sheet.
 *
 * Returns `null` (instead of silently falling back to `DefaultClass`) while the
 * system is still MID-LOAD (`attempted === false`, not failed yet) — a sheet
 * opened in that window races `sheetCatalog` registration and always loses,
 * permanently showing the generic editor for a system that actually loaded fine
 * moments later. Callers must treat `null` as "refuse to open" (`window-manager.ts`'s
 * `open()` already does this centrally), not fall back on their own.
 */
export function resolveSheetClass(docType: string, typeName: string, DefaultClass: SheetConstructor): SheetConstructor | null {
  const custom = sheetCatalog.get(docType, typeName) || sheetCatalog.get(docType, '*');
  if (custom) return custom;

  if (!systemLoadStatus.attempted && !systemLoadStatus.failed) {
    showToast('O sistema ainda está carregando — aguarde um instante e tente de novo.', 'info');
    return null;
  }

  if (systemLoadStatus.attempted && systemLoadStatus.failed && !warnedSystemLoadFailure) {
    warnedSystemLoadFailure = true;
    showToast(
      `System "${systemLoadStatus.failed}" failed to load — opening generic sheet until the error is fixed.`,
      'error',
    );
  }

  return DefaultClass;
}
