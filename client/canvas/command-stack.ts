/**
 * Local per-client undo/redo, only for the user's OWN actions.
 * Never undoes another user's action — WS events received from other
 * clients never enter this stack, only actions triggered by the client
 * itself (see `client/screens/game-hud/game-hud.ts`, where commands
 * are pushed the moment the local action happens).
 *
 * Zero backend changes: `undo()`/`redo()` of each command reuse the
 * same API/WS calls that the original action already used — the server
 * rebroadcasts it like any normal edit.
 */

export interface Command {
  /** Short label for debug/toast (ex: "Move token"). */
  label: string;
  undo(): Promise<void>;
  redo(): Promise<void>;
}

const MAX_COMMANDS = 30;

export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  push(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > MAX_COMMANDS) this.undoStack.shift();
    // Any new action invalidates the redo history. 
    this.redoStack = [];
  }

  /** Returns false if there was nothing to undo. Throws if the command fails (e.g. 404 — object modified by another user). */
  async undo(): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) return false;
    await command.undo();
    this.redoStack.push(command);
    return true;
  }

  async redo(): Promise<boolean> {
    const command = this.redoStack.pop();
    if (!command) return false;
    await command.redo();
    this.undoStack.push(command);
    return true;
  }

  /** Stage change invalidates coordinate/id references — clear everything. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}

/**
 * Groups N commands into one — 1 undo undoes all (reverse order), 1 redo
 * redoes all (original order). Used by composite actions (delete multiple
 * selection, paste multiple objects).    
 * 
 * @param label - Short label for the composite action (e.g. "Delete objects")
 * @param commands - Array of commands to group
 * @returns A single command that delegates to all underlying commands
 */
export function compositeCommand(label: string, commands: Command[]): Command {
  return {
    label,
    undo: async () => {
      for (const c of [...commands].reverse()) await c.undo();
    },
    redo: async () => {
      for (const c of commands) await c.redo();
    },
  };
}
