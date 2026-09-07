/*******************************************************************************
 * LoomVTT
 * client/core/game-context.ts
 * 
 * 
 * Global game context and state management.
 ******************************************************************************/

export interface GameSession {
  userId: string;
  userName: string;
  userColor: string;
  userRole: number;
}

/** Global active game session state — mirrors the session pattern of converted systems, but actually populated by GameHudScreen upon world entry. */
class GameContext {
  private _worldId: string | null = null;
  private _session: GameSession | null = null;
  private _cast: any[] = [];

  set(worldId: string, session: GameSession): void {
    this._worldId = worldId;
    this._session = session;
  }

  clear(): void {
    this._worldId = null;
    this._session = null;
    this._cast = [];
  }

  get worldId(): string | null {
    return this._worldId;
  }

  get session(): GameSession | null {
    return this._session;
  }

  get isGM(): boolean {
    return (this._session?.userRole ?? 0) >= 4;
  }

  /** Mantido em dia pelo GameHudScreen a cada create/update/delete de cast. */
  setCast(cast: any[]): void {
    this._cast = cast;
  }

  get cast(): any[] {
    return this._cast;
  }
}

export const gameContext = new GameContext();
