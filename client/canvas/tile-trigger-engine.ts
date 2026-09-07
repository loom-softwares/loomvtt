import { type CanvasManager, TOKEN_RADIUS } from './canvas-manager.js';
import { FederatedPointerEvent } from 'pixi.js';
import { raySegmentIntersection } from './fov-engine.js';
import { CombatAnimation } from './combat-animation.js';
import { gameContext } from '../core/game-context.js';
import { api } from '../core/api.js';
import { LoomDialog } from '../windows/loom-dialog.js';
import { JournalWindow } from '../windows/journal-window.js';
import { windowManager } from '../core/window-manager.js';
import { showToast } from '../components/toast.js';
import { wsClient } from '../core/ws-client.js';

export interface TileTrigger {
  event: 'token-enter' | 'token-exit' | 'token-move-inside' | 'click';
}

export interface TileCondition {
  type: 'user-role-gte' | 'flag-equals';
  value: any;
}

export interface TileAction {
  type: 'teleport' | 'toggle-visibility' | 'play-sound' | 'show-dialog' | 'pause-game' | 'toggle-lock' | 'run-animation' | 'activate-tile' | 'show-notification' | 'chat-message' | 'floating-text';
  config: Record<string, any>;
}

export interface TileTriggerConfig {
  id: string;
  triggers: TileTrigger[];
  conditions: TileCondition[];
  actions: TileAction[];
}

/**
 * Tile trigger engine
 * Monitors token movement and executes actions when conditions are met
 */
export class TileTriggerEngine {
  private canvasManager: CanvasManager;
  private activeTiles: Map<string, TileTriggerConfig> = new Map();
  private tokenPositions: Map<string, Set<string>> = new Map(); // tokenId -> Set<tileId>
  private isRunning = false;

  private tileTriggeredUnsub?: () => void;
  private moveUnsub?: () => void;

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
  }

  /**
   * Starts the trigger engine
   *
   * NOTE: onMove is only called for LOCAL movement (drag via pointermove or
   * moveTokenBy/moveTokenTo). REMOTE movement arrives via updateToken, which
   * does NOT call this.onMove - therefore the client receiving movement via WS
   * never evaluates triggers. If updateToken ever calls onMove, every client
   * reavaliaria triggers simultaneamente, duplicando ações. Mantenha essa
   * separação.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.moveUnsub = this.canvasManager.setOnMove((tokenId, x, y) => {
      this.checkTokenMovement(tokenId, x, y);
    });
    // Tile click: the engine only listened to movement, so the `click` trigger existed
    // in the UI and never fired. executeTriggersPublic already existed exactly for this.
    this.canvasManager.setOnTileClick((tileId: string, event: FederatedPointerEvent) => {
      this.executeTriggersPublic(tileId, 'click');
    });
    this.tileTriggeredUnsub = wsClient.on('tile.triggered', (data: any) => {
      const { action, tokenId } = data;
      this.executeSingleAction(action, tokenId);
    });
  }

  /**
   * Stops the trigger engine
   */
  stop(): void {
    this.isRunning = false;
    this.moveUnsub?.();
    this.moveUnsub = undefined;
    if (this.tileTriggeredUnsub) {
      this.tileTriggeredUnsub();
      this.tileTriggeredUnsub = undefined;
    }
    this.canvasManager.setOnTileClick(null);
  }

  /**
   * Executes triggers publicly (for integration)
   */
  public async executeTriggersPublic(tileId: string, event: string, tokenId?: string): Promise<void> {
    const tileData = this.canvasManager.getTileData().get(tileId);
    if (tileData && tileData.isActive === false) return;
    await this.executeTriggers(tileId, event, tokenId);
  }

  /**
   * Defines active tiles with triggers
   */
  setActiveTiles(tiles: TileTriggerConfig[]): void {
    this.activeTiles.clear();
    tiles.forEach(tile => {
      if (tile.triggers && tile.triggers.length > 0) {
        this.activeTiles.set(tile.id, tile);
      }
    });
    // Do not clear the entire tokenPositions: this method now runs for each tile
    // created/edited (and no longer just once at boot), and clearing the history would
    // cause a token standing inside a trap to fire `token-enter` again in the
    // next step. Eg: `activate-tile` action saves the tile -> `tile.updated` arrives
    // -> re-sync -> re-trigger. Pruning only what disappeared solves it.
    for (const [tokenId, tileIds] of this.tokenPositions) {
      for (const tileId of tileIds) {
        if (!this.activeTiles.has(tileId)) tileIds.delete(tileId);
      }
      if (tileIds.size === 0) this.tokenPositions.delete(tokenId);
    }
  }

  /**
   * Checks token movement and executes triggers
   */
  private async checkTokenMovement(tokenId: string, x: number, y: number): Promise<void> {
    if (!this.isRunning) return;

    const tiles = this.canvasManager.getTileData();
    const tokenRadius = TOKEN_RADIUS;

    const overlappingTileIds: string[] = [];

    for (const [tileId, tileData] of tiles) {
      if (!tileData.isActive) continue;

      if (this.isTokenOverlappingTile(x, y, tokenRadius, tileData)) {
        overlappingTileIds.push(tileId);
      }
    }

    await this.checkTokenEnterExit(tokenId, overlappingTileIds);
    await this.checkTokenMoveInside(tokenId, overlappingTileIds);
  }

  /**
   * Checks if a token is overlapping a tile
   */
  private isTokenOverlappingTile(
    tokenX: number,
    tokenY: number,
    tokenRadius: number,
    tile: any
  ): boolean {
    // Finds the point on the tile closest to the token's center
    const closestX = Math.max(tile.x, Math.min(tokenX, tile.x + tile.width));
    const closestY = Math.max(tile.y, Math.min(tokenY, tile.y + tile.height));

    // Calculates the distance between the closest point and the token's center
    const distance = Math.hypot(tokenX - closestX, tokenY - closestY);

    return distance <= tokenRadius;
  }

  /**
   * Checks token enter and exit triggers
   */
  private async checkTokenEnterExit(tokenId: string, currentOverlappingTileIds: string[]): Promise<void> {
    const previousTileIds = this.tokenPositions.get(tokenId) || new Set();
    const currentTileIds = new Set(currentOverlappingTileIds);

    // Records the current overlap BEFORE executing triggers. An action like
    // `activate-tile` deactivates the tile itself during the api.put await; the
    // tile.updated -> re-sync -> setActiveTiles() prunes the tile from tokenPositions
    // in the meantime. If the recording were at the end, the re-set would overwrite
    // the prune and revive the "token inside trap" entry even with the tile
    // inactive — once reactivated in the configs, the trap would never fire again
    // for that token (previousTileIds already contained the tile, so token-enter
    // would not run).
    this.tokenPositions.set(tokenId, currentTileIds);

    for (const tileId of currentOverlappingTileIds) {
      if (!previousTileIds.has(tileId)) {
        await this.executeTriggers(tileId, 'token-enter', tokenId);
      }
    }

    for (const tileId of previousTileIds) {
      if (!currentTileIds.has(tileId)) {
        await this.executeTriggers(tileId, 'token-exit', tokenId);
      }
    }
  }

  /**
   * Checks token move-inside triggers
   */
  private async checkTokenMoveInside(tokenId: string, overlappingTileIds: string[]): Promise<void> {
    for (const tileId of overlappingTileIds) {
      const tileConfig = this.activeTiles.get(tileId);
      if (tileConfig) {
        const hasMoveInsideTrigger = tileConfig.triggers.some(
          trigger => trigger.event === 'token-move-inside'
        );

        if (hasMoveInsideTrigger) {
          const now = Date.now();
          const lastExecution = this.getLastExecutionTime(tokenId, tileId, 'token-move-inside');

          if (!lastExecution || now - lastExecution > 1000) {
            await this.executeTriggers(tileId, 'token-move-inside', tokenId);
            this.setLastExecutionTime(tokenId, tileId, 'token-move-inside', now);
          }
        }
      }
    }
  }

  /**
   * Executes triggers for a tile
   */
  private async executeTriggers(tileId: string, event: string, tokenId?: string): Promise<void> {
    const tileConfig = this.activeTiles.get(tileId);
    if (!tileConfig) return;

    const relevantTriggers = tileConfig.triggers.filter(trigger => trigger.event === event);
    if (relevantTriggers.length === 0) return;

    for (const trigger of relevantTriggers) {
      if (this.checkConditions(tileConfig.conditions, tokenId)) {
        await this.executeActions(tileConfig.actions, tokenId, tileId);
        break;
      }
    }
  }

  /**
   * Checks if all conditions are met
   */
  private checkConditions(conditions: TileCondition[], tokenId?: string): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      switch (condition.type) {
        case 'user-role-gte':
          return this.checkUserRoleGte(condition.value);

        case 'flag-equals':
          return this.checkFlagEquals(condition.value, tokenId);

        default:
          console.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    });
  }

  /**
   * Checks user role condition
   */
  private checkUserRoleGte(requiredRole: number): boolean {
    return gameContext.isGM || (gameContext.session?.userRole ?? 0) >= requiredRole;
  }

  /**
   * Checks flag condition
   */
  private checkFlagEquals(flagConfig: any, tokenId?: string): boolean {
    if (!flagConfig || !tokenId) return false;
    const { flag, expectedValue } = flagConfig;
    if (!flag) return false;

    const tokenData = this.canvasManager.getTokenData().get(tokenId);
    if (!tokenData) return false;

    const actualValue = (tokenData as Record<string, any>)[flag];
    return actualValue === expectedValue;
  }

  private static readonly LOCAL_EFFECT_TYPES = new Set(['show-dialog', 'show-notification', 'play-sound']);
  private static readonly MAX_TELEPORT_CHAIN = 3;
  private teleportDepth = 0;

  private shouldExecuteLocally(recipient: string): boolean {
    if (!recipient || recipient === 'trigger' || recipient === 'trigger+gm') return true;
    if (recipient === 'gm') return gameContext.isGM;
    return true;
  }

  private shouldBroadcast(recipient: string): boolean {
    if (recipient === 'all') return true;
    if (recipient === 'trigger+gm') return true;
    if (recipient === 'gm') return !gameContext.isGM;
    return false;
  }

  private sendTileEffect(tileId: string, actionIndex: number, tokenId?: string): void {
    wsClient.send('tile.effect', { tileId, actionIndex, tokenId });
  }

  /**
   * Executes tile actions, with broadcast support for local effects
   */
  private async executeActions(actions: TileAction[], tokenId?: string, sourceTileId?: string): Promise<void> {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      try {
        const isLocalEffect = TileTriggerEngine.LOCAL_EFFECT_TYPES.has(action.type);
        if (isLocalEffect && sourceTileId) {
          const recipient = action.config?.recipient || 'trigger';
          if (this.shouldExecuteLocally(recipient)) {
            await this.executeSingleAction(action, tokenId, sourceTileId);
          }
          if (this.shouldBroadcast(recipient)) {
            this.sendTileEffect(sourceTileId, i, tokenId);
          }
        } else {
          await this.executeSingleAction(action, tokenId, sourceTileId);
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
      }
    }
  }

  private async executeSingleAction(action: TileAction, tokenId?: string, tileId?: string): Promise<void> {
    switch (action.type) {
      case 'teleport':
        await this.executeTeleport(action.config, tokenId);
        break;
      case 'toggle-visibility':
        await this.executeToggleVisibility(action.config, tokenId);
        break;
      case 'play-sound':
        this.executePlaySound(action.config);
        break;
      case 'show-dialog':
        await this.executeShowDialog(action.config);
        break;
      case 'pause-game':
        await this.executePauseGame(action.config);
        break;
      case 'toggle-lock':
        await this.executeToggleLock(action.config);
        break;
      case 'activate-tile':
        await this.executeActivateTile(action.config, tileId);
        break;
      case 'show-notification':
        this.executeShowNotification(action.config);
        break;
      case 'chat-message':
        await this.executeChatMessage(action.config);
        break;
      case 'run-animation':
        this.executeRunAnimation(action.config);
        break;
      case 'floating-text':
        this.executeFloatingText(action.config, tileId);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Executes teleport action with free cell search
   *
   * Re-entry guard: moveTokenTo fires onMove, which re-evaluates triggers.
   * If the token falls inside the same tile (or another tile with a trigger),
   * this prevents infinite chaining. MAX_TELEPORT_CHAIN = 3 allows intentional
   * cascades (eg: two sequential portals) without locking up.
   */
  private async executeTeleport(config: any, tokenId?: string): Promise<void> {
    if (!tokenId) return;
    if (this.teleportDepth >= TileTriggerEngine.MAX_TELEPORT_CHAIN) return;

    const { targetX, targetY, targetTokenId, stageId } = config;

    if (stageId && stageId !== this.canvasManager.getCurrentStageId()) {
      // Takes destination with it: without this, the token would arrive at the
      // new stage at the old position, which is rarely where the passage should
      // empty out.
      const tx = typeof targetX === 'number' ? targetX - TOKEN_RADIUS : undefined;
      const ty = typeof targetY === 'number' ? targetY - TOKEN_RADIUS : undefined;
      await this.canvasManager.changeTokenStage(tokenId, stageId, tx, ty);
      return;
    }

    let destX: number, destY: number;

    if (targetTokenId) {
      const targetToken = this.canvasManager.getTokens().get(targetTokenId);
      if (!targetToken) return;
      destX = (targetToken.x as number) - TOKEN_RADIUS;
      destY = (targetToken.y as number) - TOKEN_RADIUS;
    } else if (targetX !== undefined && targetY !== undefined) {
      destX = (targetX as number) - TOKEN_RADIUS;
      destY = (targetY as number) - TOKEN_RADIUS;
    } else {
      return;
    }

    this.teleportDepth++;
    try {
      const freePos = this.findFreeCellNear(tokenId, destX, destY);
      this.canvasManager.moveTokenTo(tokenId, freePos.x, freePos.y);
    } finally {
      this.teleportDepth--;
    }
  }

  /**
   * Finds the nearest free cell near the destination.
   * Searches in growing rings starting from (x, y) using the stage's gridSize.
   * If the original cell is free, it returns it. Otherwise, it searches the grid.
   */
  private findFreeCellNear(
    tokenId: string,
    x: number,
    y: number,
  ): { x: number; y: number } {
    const occupied = new Set<string>();
    const tokenData = this.canvasManager.getTokenData();
    for (const [id, t] of tokenData) {
      if (id !== tokenId) {
        occupied.add(`${Math.round((t.x + TOKEN_RADIUS) / 2) * 2},${Math.round((t.y + TOKEN_RADIUS) / 2) * 2}`);
      }
    }

    const cellKey = `${Math.round(x / 2) * 2},${Math.round(y / 2) * 2}`;
    if (!occupied.has(cellKey)) {
      return { x, y };
    }

    // Searches in growing rings
    const gridSize = this.canvasManager.getGridSize() || 50;
    const walls = this.canvasManager.getWalls?.() ?? [];
    const cx = x + TOKEN_RADIUS;
    const cy = y + TOKEN_RADIUS;

    for (let ring = 1; ring <= 8; ring++) {
      const step = gridSize * ring;
      const candidates = [
        { x: cx - step, y },
        { x: cx + step, y },
        { x, y: cy - step },
        { x, y: cy + step },
        { x: cx - step, y: cy - step },
        { x: cx + step, y: cy - step },
        { x: cx - step, y: cy + step },
        { x: cx + step, y: cy + step },
      ];

      for (const c of candidates) {
        const ck = `${Math.round(c.x / 2) * 2},${Math.round(c.y / 2) * 2}`;
        if (occupied.has(ck)) continue;

        // Wall check — ensure no wall blocks line from target to candidate
        const blocked = walls.some((w) => {
          const hit = raySegmentIntersection(cx, cy, c.x, c.y, w.x1, w.y1, w.x2, w.y2);
          return hit !== null;
        });
        if (blocked) continue;

        return { x: c.x - TOKEN_RADIUS, y: c.y - TOKEN_RADIUS };
      }
    }

    // Fallback: original position
    return { x, y };
  }

  /**
   * Executes visibility toggle action
   */
  private async executeToggleVisibility(config: any, tokenId?: string): Promise<void> {
    if (!tokenId) return;

    const { targetTokenId, visible } = config;
    const targetId = targetTokenId || tokenId;

    try {
      if (visible !== undefined) {
        await api.put(`/cast/${targetId}`, { hidden: !visible });
      } else {
        const tokenData = this.canvasManager.getTokenData().get(targetId);
        if (tokenData) {
          await api.put(`/cast/${targetId}`, { hidden: !tokenData.hidden });
        }
      }
    } catch (e) {
      console.error('toggle-visibility failed:', e);
    }
  }

  /**
   * Executes play sound action
   */
  private executePlaySound(config: any): void {
    const { soundUrl, volume = 1, recipient } = config;

    // Verify recipient - only execute locally if it's the correct recipient
    if (!this.shouldExecuteLocally(recipient)) {
      return;
    }

    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.volume = volume;
      audio.play().catch(error => {
        console.error('Error playing sound:', error);
      });
    }
  }

  /**
   * Executes show dialog action
   */
  private async executeShowDialog(config: any): Promise<void> {
    const { journalId, pageId, title, content, imageUrl, recipient } = config;

    // Verify recipient - only execute locally if it's the correct recipient
    if (!this.shouldExecuteLocally(recipient)) {
      return;
    }

    // Journal mode
    if (journalId) {
      windowManager.open(`journal-${journalId}`, JournalWindow, {
        journalId,
        pageId: pageId || undefined,
      });
      return;
    }

    // Text mode
    const sanitizedTitle = title ? String(title) : '';
    const sanitizedContent = content ? String(content) : '';

    const contentEl = document.createElement('div');
    const titleEl = document.createElement('h3');
    titleEl.textContent = sanitizedTitle;
    contentEl.appendChild(titleEl);

    const msgEl = document.createElement('p');
    msgEl.textContent = sanitizedContent;
    contentEl.appendChild(msgEl);

    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.style.maxWidth = '100%';
      img.alt = sanitizedTitle || 'Dialog image';
      contentEl.appendChild(img);
    }

    LoomDialog.prompt({
      window: { title: sanitizedTitle || 'Message' },
      content: contentEl,
    });
  }

  /**
   * Text that rises from the tile's position and disappears. Different from show-dialog (modal,
   * interrupts) and chat-message (leaves the map): it happens where the player is looking
   * and doesn't require any click.
   */
  private executeFloatingText(config: any, tileId?: string): void {
    const { text, color } = config;
    if (!text || !tileId) return;

    const tile = this.canvasManager.getTileData().get(tileId);
    if (!tile) return;

    // Tile center in world coordinates -> screen coordinates.
    const worldX = tile.x + tile.width / 2;
    const worldY = tile.y;
    this.canvasManager.showFloatingText(worldX, worldY, String(text), color);
  }

  /**
   * Executes pause game action
   */
  private async executePauseGame(config: any): Promise<void> {
    const { duration } = config;
    const worldId = gameContext.worldId;
    if (!worldId) return;

    try {
      await api.post(`/worlds/${worldId}/pause`);

      if (duration) {
        setTimeout(async () => {
          try {
            await api.post(`/worlds/${worldId}/resume`);
          } catch (e) {
            console.error('auto-resume failed:', e);
          }
        }, duration * 1000);
      }
    } catch (e) {
      console.error('pause-game failed:', e);
    }
  }

  /**
   * Executes lock toggle action
   */
  private async executeToggleLock(config: any): Promise<void> {
    const { targetTileId, locked } = config;
    if (!targetTileId) return;

    try {
      if (locked !== undefined) {
        await api.put(`/tiles/${targetTileId}`, { locked });
      } else {
        const tile = this.canvasManager.getTileData().get(targetTileId);
        if (tile) {
          await api.put(`/tiles/${targetTileId}`, { locked: !tile.locked });
        }
      }
    } catch (e) {
      console.error('toggle-lock failed:', e);
    }
  }

  private async executeActivateTile(config: any, sourceTileId?: string): Promise<void> {
    const { targetTileId, active } = config;
    const tileId = targetTileId || sourceTileId;  // without explicit target = this tile
    if (!tileId) return;

    try {
      if (active !== undefined) {
        await api.put(`/tiles/${tileId}`, { isActive: active === true || active === 'true' });
      } else {
        const tile = this.canvasManager.getTileData().get(tileId);
        if (tile) {
          await api.put(`/tiles/${tileId}`, { isActive: !tile.isActive });
        }
      }
    } catch (e) {
      console.error('activate-tile failed:', e);
    }
  }

  private executeShowNotification(config: any): void {
    const { message, type = 'info', duration, recipient } = config;

    // Verify recipient - only execute locally if it's the correct recipient
    if (!this.shouldExecuteLocally(recipient)) {
      return;
    }

    if (!message) return;
    const sanitized = String(message);
    const toastType = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
    showToast(sanitized, toastType as any, duration || 4000);
  }

  private async executeChatMessage(config: any): Promise<void> {
    const { content, speaker } = config;
    if (!content) return;

    const speakerData = speaker === 'gm'
      ? { name: gameContext.session?.userName || 'GM', icon: 'fas fa-crown' }
      : speaker === 'narrator'
        ? { name: 'Narrator', icon: 'fas fa-book' }
        : {};

    wsClient.send('chat.message', {
      content: String(content),
      speaker: speakerData,
    });
  }

  /**
   * Executes run animation sequence action
   */
  private executeRunAnimation(config: any): void {
    const { payload } = config;
    if (payload && payload.steps) {
      CombatAnimation.fromPayload(payload).play(true);
    }
  }

  /**
   * Execution control methods (simple cache)
   */
  private executionTimes: Map<string, number> = new Map();

  private getLastExecutionTime(tokenId: string, tileId: string, event: string): number | null {
    const key = `${tokenId}-${tileId}-${event}`;
    return this.executionTimes.get(key) || null;
  }

  private setLastExecutionTime(tokenId: string, tileId: string, event: string, time: number): void {
    const key = `${tokenId}-${tileId}-${event}`;
    this.executionTimes.set(key, time);
  }
}