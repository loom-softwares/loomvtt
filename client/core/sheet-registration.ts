/*******************************************************************************
 * LoomVTT
 * client/core/sheet-registration.ts
 * 
 * 
 * Sheet class registration by document type, exposed globally (`Actors`/`Items`/`DocumentSheetConfig`).
 ******************************************************************************/

import { sheetCatalog } from './sheet-catalog.js';

interface RegisterSheetOptions {
  types?: string[];
  makeDefault?: boolean;
  label?: string;
}

function registerInCatalog(docType: string, SheetClass: any, options: RegisterSheetOptions): void {
  const types = options.types?.length ? options.types : ['*'];
  for (const typeName of types) {
    sheetCatalog.catalog(docType, typeName, SheetClass);
  }
}

function resolveDocType(documentClass: any): string | null {
  const ActorClass = (window as any).Actor;
  const ItemClass = (window as any).Item;
  if (documentClass === ActorClass) return 'actor';
  if (documentClass === ItemClass) return 'item';
  if (typeof documentClass === 'function') {
    const name = documentClass.name?.toLowerCase();
    if (name === 'actor') return 'actor';
    if (name === 'item') return 'item';
  }
  return null;
}

export const Actors = {
  registerSheet(_scope: string, SheetClass: any, options: RegisterSheetOptions = {}): void {
    registerInCatalog('actor', SheetClass, options);
  },
};

export const Items = {
  registerSheet(_scope: string, SheetClass: any, options: RegisterSheetOptions = {}): void {
    registerInCatalog('item', SheetClass, options);
  },
};

export const DocumentSheetConfig = {
  registerSheet(documentClass: any, _scope: string, SheetClass: any, options: RegisterSheetOptions = {}): void {
    const docType = resolveDocType(documentClass);
    if (!docType) {
      console.warn(`LoomVTT: DocumentSheetConfig.registerSheet chamado com classe desconhecida`, documentClass);
      return;
    }
    registerInCatalog(docType, SheetClass, options);
  },
};

(window as any).Actors = Actors;
(window as any).Items = Items;
(window as any).DocumentSheetConfig = DocumentSheetConfig;
