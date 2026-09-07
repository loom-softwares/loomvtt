/*******************************************************************************
 * LoomVTT
 * client/core/sheet-catalog.ts
 * 
 * 
 * Catalog of available document sheets.
 ******************************************************************************/

import type { LoomDocumentSheet } from '../windows/document-sheet.js';

type SheetConstructor = new (props: any) => LoomDocumentSheet;

class SheetCatalog {
  private registry = new Map<string, Map<string, SheetConstructor>>();

  catalog(docType: string, typeName: string, SheetClass: SheetConstructor): void {
    if (!this.registry.has(docType)) {
      this.registry.set(docType, new Map());
    }
    this.registry.get(docType)!.set(typeName, SheetClass);
  }

  get(docType: string, typeName?: string): SheetConstructor | undefined {
    const byDoc = this.registry.get(docType);
    if (!byDoc) return undefined;
    if (typeName && byDoc.has(typeName)) return byDoc.get(typeName);
    return byDoc.get('*');
  }

  /** Amount of sheets registered for this docType — used to detect systems that load but register no sheets. */
  count(docType: string): number {
    return this.registry.get(docType)?.size ?? 0;
  }
}

export const sheetCatalog = new SheetCatalog();
