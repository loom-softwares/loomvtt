import { CanvasManager } from './canvas-manager.js';
import { TileTriggerEngine, TileTriggerConfig } from './tile-trigger-engine.js';
import { Sprite, FederatedPointerEvent } from 'pixi.js';

/**
 * Integration of TileTriggerEngine with CanvasManager
 * Provides methods to configure and control tile triggers
 */
export class TileTriggerIntegration {
  private canvasManager: CanvasManager;
  private triggerEngine: TileTriggerEngine;

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
    this.triggerEngine = new TileTriggerEngine(canvasManager);
  }

  /**
   * Starts the tile trigger system
   */
  start(): void {
    this.triggerEngine.start();
  }

  /**
   * Stops the tile trigger system
   */
  stop(): void {
    this.triggerEngine.stop();
  }

  /**
   * Configures tiles with triggers
   */
  setupTileTriggers(tiles: TileTriggerConfig[]): void {
    this.triggerEngine.setActiveTiles(tiles);
  }

  /**
   * Updates tiles with triggers (called when tiles change)
   */
  updateTileTriggers(tiles: TileTriggerConfig[]): void {
    this.setupTileTriggers(tiles);
  }

  /**
   * Executes triggers manually (for testing)
   */
  executeTriggersManually(tileId: string, event: string, tokenId?: string): void {
    this.triggerEngine.executeTriggersPublic(tileId, event, tokenId);
  }

  /**
   * Gets the trigger engine for direct access (if needed)
   */
  getTriggerEngine(): TileTriggerEngine {
    return this.triggerEngine;
  }
}

/**
 * Extends CanvasManager to include tile trigger support
 */
export class CanvasManagerWithTileTriggers extends CanvasManager {
  private tileTriggerIntegration: TileTriggerIntegration | null = null;

  constructor() {
    super();
    // Initialize trigger integration
    this.tileTriggerIntegration = new TileTriggerIntegration(this);
  }

  /**
   * Starts the tile trigger system
   */
  startTileTriggers(): void {
    if (this.tileTriggerIntegration) {
      this.tileTriggerIntegration.start();
    }
  }

  /**
   * Stops the tile trigger system
   */
  stopTileTriggers(): void {
    if (this.tileTriggerIntegration) {
      this.tileTriggerIntegration.stop();
    }
  }

  /**
   * Configures tiles with triggers
   */
  setupTileTriggers(tiles: any[]): void {
    if (this.tileTriggerIntegration) {
      // Convert tile format to trigger format
      const triggerConfigs = this.convertTilesToTriggerConfigs(tiles);
      this.tileTriggerIntegration.setupTileTriggers(triggerConfigs);
    }
  }

  /**
   * Converts tiles to trigger format
   */
  private convertTilesToTriggerConfigs(tiles: any[]): TileTriggerConfig[] {
    return tiles
      .filter(tile => tile.isActive && (tile.triggers || tile.conditions || tile.actions))
      .map(tile => ({
        id: tile.id,
        triggers: tile.triggers || [],
        conditions: tile.conditions || [],
        actions: tile.actions || []
      }));
  }

  /**
   * Updates tiles with triggers
   */
  updateTileTriggers(tiles: any[]): void {
    if (this.tileTriggerIntegration) {
      const triggerConfigs = this.convertTilesToTriggerConfigs(tiles);
      this.tileTriggerIntegration.updateTileTriggers(triggerConfigs);
    }
  }

  /**
   * Executes triggers manually (for debugging/testing)
   */
  executeTileTriggersManually(tileId: string, event: string, tokenId?: string): void {
    if (this.tileTriggerIntegration) {
      this.tileTriggerIntegration.executeTriggersManually(tileId, event, tokenId);
    }
  }

  /**
   * Gets the trigger integration
   */
  getTileTriggerIntegration(): TileTriggerIntegration | null {
    return this.tileTriggerIntegration;
  }
}