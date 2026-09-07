import { wsClient } from '../core/ws-client.js';
import { windowManager } from '../core/window-manager.js';
import { resolveSheetClass } from '../core/sheet-resolver.js';
import { actorsCollection } from '../core/actors-collection.js';
import { runScriptMacro } from './script-macro-runner.js';
import { dispatchRoll } from '../screens/game-hud/roll-dispatch.js';
import { showToast } from '../components/toast.js';

export interface RunnableMacro {
  id: string;
  name: string;
  type: string;
  command: string;
}

/**
 * Macro execution shared between the hotbar (clicking on a slot) and the context
 * menu of the macro list in the sidebar ("Execute Macro") — previously, only the
 * hotbar knew how to run a macro, so executing from the sidebar required dragging
 * to an empty slot first.
 */
export async function executeMacro(macro: RunnableMacro, worldId: string): Promise<void> {
  const session = wsClient.session;
  const userId = session?.userId || '';
  const userName = session?.userName || 'Anonymous';
  const userColor = session?.userColor || '#888';

  if (macro.type === 'chat') {
    if (macro.command.startsWith('/r ')) {
      dispatchRoll({ worldId, userId, userName, userColor, formula: macro.command.slice(3).trim() });
    } else {
      wsClient.send('chat.message', { worldId, content: macro.command, userId });
    }
    showToast(`Executed macro: ${macro.name}`, 'success');
  } else if (macro.type === 'open-actor') {
    const typeName = actorsCollection.get(macro.command)?.type || '*';
    const { ActorSheetWindow } = await import('../windows/actor-sheet-window.js');
    const SheetClass = resolveSheetClass('actor', typeName, ActorSheetWindow);
    windowManager.open(`actor-sheet-${macro.command}`, SheetClass, { actorId: macro.command });
    showToast(`Opened actor sheet: ${macro.name}`, 'success');
  } else if (macro.type === 'script') {
    runScriptMacro(macro.command, {
      onRoll: (formula) => dispatchRoll({ worldId, userId, userName, userColor, formula }),
      onChat: (content) => wsClient.send('chat.message', { worldId, content, userId }),
      onError: (message) => showToast(`Macro error: ${message}`, 'error'),
    });
  } else {
    showToast('Macro type not supported', 'error');
  }
}
