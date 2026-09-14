/*******************************************************************************
 * LoomVTT
 * client/core/compendium-entry-dispatch.ts
 * 
 * 
 * Dispatcher for compendium entry interactions.
 ******************************************************************************/

import { resolveSheetClass } from './sheet-resolver.js';
import { windowManager } from './window-manager.js';
import { api } from './api.js';
import { ActorSheetWindow } from '../windows/actor-sheet-window.js';
import { ItemSheetWindow } from '../windows/item-sheet-window.js';
import { JournalWindow } from '../windows/journal-window.js';
import { StageConfigWindow } from '../windows/stage-config-window.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/dialog.js';

interface PackInfo {
  id: string;
  type: string;
  worldId: string;
  /** Sobrescreve a rota de leitura/gravação da ficha (default:
   * `/compendium/${pack.id}/entries`, o pack materializado no mundo). Usado
   * pra ligar a MESMA ficha real a um compendium source de addon/ruleset
   * (`/compendium/sources/:sourceId/entries`), sem duplicar nenhuma lógica de
   * abertura — só troca de onde ela lê/grava. */
  apiRoute?: string;
}

interface EntryInfo {
  id: string;
  type: string;
}

const PACK_TYPE_MAP: Record<string, { docType: string, idProp: string, Default: any }> = {
  Actor: { docType: 'actor', idProp: 'actorId', Default: ActorSheetWindow },
  Item: { docType: 'item', idProp: 'itemId', Default: ItemSheetWindow },
  JournalEntry: { docType: 'journal', idProp: 'journalId', Default: JournalWindow },
  Journal: { docType: 'journal', idProp: 'journalId', Default: JournalWindow },
  Scene: { docType: 'scene', idProp: 'stageId', Default: StageConfigWindow },
};

export function openCompendiumEntrySheet(pack: PackInfo, entry: EntryInfo): any {
  const mapping = PACK_TYPE_MAP[pack.type];
  if (!mapping) {
    showToast(`O tipo de documento '${pack.type}' ainda não possui um editor no compêndio.`, 'info');
    return null;
  }

  // Scene entries: open StageConfigWindow with data from compendium (no import)
  if (pack.type === 'Scene') {
    void openSceneEntryFromCompendium(pack, entry);
    return null;
  }

  // `any` bypasses the generic LoomDocumentSheet contract, accommodating concretized
  // abstract members present in the actual system-specific SheetClass.
  const SheetClass = resolveSheetClass(mapping.docType, entry.type, mapping.Default) as any;

  const id = `compendium-entry-${pack.id}-${entry.id}`;
  const apiRoute = pack.apiRoute ?? `/compendium/${pack.id}/entries`;

  class CompendiumBoundSheet extends SheetClass {
    constructor(...args: any[]) {
      super(...args);
      (this as any).options.id = id;
      (this as any)._apiRouteOverride = apiRoute;
    }
  }

  return windowManager.open(id, CompendiumBoundSheet as any, {
    [mapping.idProp]: entry.id,
    worldId: pack.worldId,
  });
}

async function openSceneEntryFromCompendium(pack: PackInfo, entry: EntryInfo): Promise<void> {
  try {
    const apiRoute = pack.apiRoute ?? `/compendium/${pack.id}/entries`;
    const entryData = await api.get<any>(`${apiRoute}/${entry.id}`);
    const d = entryData.data || {};
    const bg = d.backgroundUrl || entryData.imgUrl || '';
    const lines = [
      `<b>${entryData.name}</b>`,
      bg ? `<div style="margin:8px 0;max-height:120px;overflow:hidden;border-radius:4px"><img src="${bg}" style="width:100%;object-fit:cover" /></div>` : '',
      `Grid: ${d.gridSize || 50}px · ${d.gridType || 'square'} · ${d.gridStyle || 'solid'}`,
      `Dimensões: ${d.width || 3000}×${d.height || 3000}`,
      `Clima: ${d.weatherEffect || 'nenhum'}`,
      `Visão: ${d.tokenVision !== false ? 'sim' : 'não'}`,
    ].filter(Boolean).join('<br>');
    showConfirm('Preview da Cena', lines);
  } catch (e: any) {
    showToast(e?.message || 'Erro ao abrir cena do compêndio', 'error');
  }
}
