import { CanvasManager } from '../../canvas/canvas-manager.js';
import { CanvasManagerWithTileTriggers } from '../../canvas/tile-trigger-integration.js';
import type { WallSegment } from '../../canvas/fov-engine.js';
import { wsClient } from '../../core/ws-client.js';
import { LoomHooks } from '../../core/hooks.js';
import { api, API_PATHS } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { windowManager } from '../../core/window-manager.js';
import { resolveSheetClass } from '../../core/sheet-resolver.js';
import { applyUiOverride } from '../../core/ui-override.js';
import { LoadingProgress } from '../../components/loading-progress.js';
import { keybindManager, type KeybindAction } from '../../core/keybinds.js';
import { JournalWindow } from '../../windows/journal-window.js';
import { ActorSheetWindow } from '../../windows/actor-sheet-window.js';
import { TokenConfigWindow } from '../../windows/token-config-window.js';
import { showConfirm, showPrompt } from '../../components/dialog.js';
import { LoomDialog } from '../../windows/loom-dialog.js';
import { copyTextToClipboard } from '../../lib/clipboard.js';
import { mediaHtml } from '../../core/media-helper.js';
import { theaterSkins, DEFAULT_THEATER_SKIN } from '../../core/theater-skins.js';
import { TheaterFog } from './theater-fog.js';
import { WallConfigWindow } from '../../windows/wall-config-window.js';
import { DrawingConfigWindow } from '../../windows/drawing-config-window.js';
import { NoiseConfigWindow } from '../../windows/noise-config-window.js';
import { LightConfigWindow } from '../../windows/light-config-window.js';
import { TileConfigWindow } from '../../windows/tile-config-window.js';
import { SaveTileToolWindow } from '../../windows/save-tile-tool-window.js';
import { StageConfigWindow } from '../../windows/stage-config-window.js';
import { FilePickerWindow } from '../../windows/file-picker-window.js';
import { soundManager } from '../../canvas/sound-manager.js';
import { StageNav } from './stage-nav.js';
import { Toolbox, type ToolItem } from './toolbox.js';
import { Sidebar } from './sidebar.js';
import { MacroHotbar } from './macro-hotbar.js';
import { PlayersList } from './players-list.js';
import { TourManager } from '../../core/tour-manager.js';
import { loadClientAddons, systemLoadStatus } from '../../core/addon-client-loader.js';
import { sheetCatalog } from '../../core/sheet-catalog.js';
import { systemRegistry } from '../../core/system-registry.js';
import { clog } from '../../lib/client-logger.js';
import { setLocale, t } from '../../lib/i18n.js';
import { showContextMenu } from '../../components/context-menu.js';
import { showToast } from '../../components/toast.js';
import { TokenHud } from './token-hud.js';
import { CommandStack, compositeCommand, type Command } from '../../canvas/command-stack.js';
import { canvasClipboard, type ClipboardEntry } from '../../canvas/canvas-clipboard.js';
import { gameContext } from '../../core/game-context.js';
import { actorsCollection } from '../../core/actors-collection.js';
import { scenesCollection } from '../../core/scenes-collection.js';
import { itemsCollection } from '../../core/items-collection.js';
import { modulesCollection } from '../../core/modules-collection.js';
import { usersCollection } from '../../core/users-collection.js';
import { messagesCollection } from '../../core/messages-collection.js';
import { macrosCollection } from '../../core/macros-collection.js';
import { packsCollection } from '../../core/packs-collection.js';
import { combatsCollection } from '../../core/combats-collection.js';
import { journalCollection } from '../../core/journal-collection.js';
import { foldersCollection } from '../../core/folders-collection.js';
import { rollTablesCollection } from '../../core/roll-tables-collection.js';
import { playlistsCollection } from '../../core/playlists-collection.js';

export interface GameInitState {
  cast: any[];
  stages: any[];
  activeStage: any | null;
  system?: { id: string; title: string; version: string; changelogUrl?: string; wikiUrl?: string; bugsUrl?: string };
  modules: any[];
}

/** Ownership level (LoomDocument ownership levels): 0=None 1=Limited 2=Observer 3=Owner */
const OWNERSHIP_OWNER = 3;

/** CSS filters applied only to `#theater-bg` (the cinematic background) — a system
 * entirely separate from CanvasManager's tactical weather, so the two can never mix. */
const TheaterEffectFilters: Record<string, string> = {
  none: '',
  noir: 'grayscale(100%) contrast(1.3) brightness(0.92)',
  blood: 'saturate(2) contrast(1.15) hue-rotate(-20deg)',
  fog: 'contrast(0.94) brightness(0.95)',
};

export class GameHudScreen {
  public static activeInstance: GameHudScreen | null = null;
  private theaterFogAnim: TheaterFog | null = null;
  private loadingProgress = new LoadingProgress();
  private canvasManager: CanvasManager | null = null;
  private tokenHud: TokenHud | null = null;
  private playersListResizeObserver: ResizeObserver | null = null;
  private subcomponents: {
    stageNav?: StageNav;
    toolbox?: Toolbox;
    sidebar?: Sidebar;
    macroHotbar?: MacroHotbar;
    playersList?: PlayersList;
  } = {};
  public initState: GameInitState = { cast: [], stages: [], activeStage: null, system: undefined, modules: [] };
  private unsubscribeInit: (() => void) | null = null;
  private unsubscribeStageActivated: (() => void) | null = null;
  private applyingStageId: string | null = null;
  private wallCreateQueue: Promise<void> = Promise.resolve();
  private commandStack = new CommandStack();
  private tileSnapToGrid = true;
  private tileBrowseImg = '';
  private tileTintColor = '';
  private currentInteractionTool = '';
  private currentCustomToolId = '';
  private pendingTeleportDest: { x: number; y: number } | null = null;
  private unsubscribeStageUpdated: (() => void) | null = null;
  private unsubscribeStageCreated: (() => void) | null = null;
  private unsubscribeStageDeleted: (() => void) | null = null;
  private unsubscribeCastCreated: (() => void) | null = null;
  private unsubscribeCastUpdated: (() => void) | null = null;
  private unsubscribeCastDeleted: (() => void) | null = null;
  private unsubscribeDrawingCreated: (() => void) | null = null;
  private unsubscribeDrawingUpdated: (() => void) | null = null;
  private unsubscribeDrawingDeleted: (() => void) | null = null;
  private unsubscribeDrawingCleared: (() => void) | null = null;
  private unsubscribeWallCreated: (() => void) | null = null;
  private unsubscribeWallUpdated: (() => void) | null = null;
  private unsubscribeWallDeleted: (() => void) | null = null;
  private unsubscribeTemplateCreated: (() => void) | null = null;
  private unsubscribeTemplateUpdated: (() => void) | null = null;
  private unsubscribeTemplateDeleted: (() => void) | null = null;
  private unsubscribeDoorState: (() => void) | null = null;
  private isPaused = false;
  private unsubscribeWorldPaused: (() => void) | null = null;
  private unsubscribeWorldResumed: (() => void) | null = null;
  private unsubscribeLightCreated: (() => void) | null = null;
  private unsubscribeLightUpdated: (() => void) | null = null;
  private unsubscribeLightDeleted: (() => void) | null = null;
  private unsubscribeNoteCreated: (() => void) | null = null;
  private unsubscribeNoteUpdated: (() => void) | null = null;
  private unsubscribeNoteDeleted: (() => void) | null = null;
  private unsubscribeNoiseCreated: (() => void) | null = null;
  private unsubscribeNoiseUpdated: (() => void) | null = null;
  private unsubscribeNoiseDeleted: (() => void) | null = null;
  private unsubscribeTileCreated: (() => void) | null = null;
  private unsubscribeCanvasPing?: () => void;
  private unsubscribeTileUpdated: (() => void) | null = null;
  private unsubscribeTileDeleted: (() => void) | null = null;
  private unsubscribeItemCreated: (() => void) | null = null;
  private unsubscribeItemUpdated: (() => void) | null = null;
  private unsubscribeItemDeleted: (() => void) | null = null;
  private unsubscribeTimeUpdated: (() => void) | null = null;
  private unsubscribeTokenTarget: (() => void) | null = null;
  private tourManager: TourManager | null = null;

  constructor(
    private container: HTMLElement,
    private props: { session: any; worldId: string },
  ) {
    GameHudScreen.activeInstance = this;
    // Populates the global context BEFORE any system script runs (bootstrap() loads
    // the addons/rulesets right below) — without this `Loom.user`/`Loom.settings` (world scope) had
    // no way of knowing which world/session they were in.
    gameContext.set(this.props.worldId, this.props.session);
    this.render();
  }

  public isTheaterActive(): boolean {
    return this.theaterActive;
  }

  /** Keeps gameContext.cast up to date — that's where `Loom.user.targets` (main.ts) reads from,
   * without needing to import GameHudScreen (which would pull the entire game bundle into
   * screens that never enter a session, like login/setup). */
  private syncCastContext(): void {
    gameContext.setCast(this.initState.cast);
  }

  /** `?capture=canvas` or `?capture=chat` — OBS Browser Source views (see
   * server/applications/api/stream.ts for how the session gets there without a
   * login form). Reuses the exact same authenticated GameHudScreen instead of a
   * parallel renderer, just hides everything but the one element via CSS. */
  private captureMode: 'canvas' | 'chat' | null = null;

  private render(): void {
    this.container.classList.add('game-hud');
    const captureParam = new URLSearchParams(window.location.search).get('capture');
    if (captureParam === 'canvas' || captureParam === 'chat') {
      this.captureMode = captureParam;
      this.container.classList.add(`capture-${captureParam}`);
    }
    this.container.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <canvas id="stage-transition-overlay" class="stage-transition-overlay"></canvas>
      <svg width="0" height="0" style="position:absolute">
        <filter id="stage-swirl-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap id="stage-swirl-displace" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div id="hud-pause-overlay" class="hud-pause-overlay" style="display:none">
        <div class="hud-pause-icon">⏳</div>
      </div>
      <div id="theater-layer" class="theater-layer">
        <div id="theater-bg" class="theater-bg"></div>
        <div id="theater-fog" class="theater-fog" hidden></div>
        <div id="theater-fx-overlay" class="theater-fx-overlay"></div>
        <div id="theater-portraits" class="theater-portraits"></div>
        <div class="theater-bar theater-bar-top"></div>
        <div class="theater-bar theater-bar-bottom"></div>
      </div>
      <div id="theater-controls" class="theater-controls">
        <button id="theater-toggle-btn" class="theater-control-btn" style="display:none" title="${t('gameHud.theaterToggle')}">
          <i class="fa-solid fa-masks-theater"></i>
        </button>
        <select id="theater-skin-select" class="theater-control-select" style="display:none" title="${t('gameHud.theaterSkinSelect')}">
          ${theaterSkins.list().map((s) => `<option value="${s.id}">${s.nameKey ? t(s.nameKey) : s.name}</option>`).join('')}
        </select>
        <select id="theater-effect-select" class="theater-control-select" style="display:none" title="${t('gameHud.theaterEffectSelect')}">
          <option value="none">${t('stageConfig.theaterEffectNone') || 'Nenhum'}</option>
          <option value="fog">${t('stageConfig.theaterEffectFog') || 'Neblina'}</option>
          <option value="noir">${t('stageConfig.theaterEffectNoir') || 'Noir'}</option>
          <option value="blood">${t('stageConfig.theaterEffectBlood') || 'Sangue'}</option>
        </select>
        <button id="cast-tray-btn" class="theater-control-btn" style="display:none" title="${t('gameHud.castTray')}">
          <i class="fa-solid fa-people-group"></i>
        </button>
        <button id="stream-link-btn" class="theater-control-btn" style="display:none" title="${t('gameHud.streamLinkBtn')}">
          <i class="fa-solid fa-satellite-dish"></i>
        </button>
      </div>
      <div id="cast-tray" class="cast-tray" hidden></div>
      <div class="hud-layer">
        <div class="hud-top-nav" id="hud-top-nav"></div>
        <div class="hud-toolbox" id="hud-toolbox"></div>
        <div class="hud-sidebar" id="hud-sidebar"></div>
        <div class="hud-hotbar" id="hud-hotbar"></div>
        <div class="hud-players-list" id="hud-players-list"></div>
        <div id="hud-token-hud"></div>
      </div>
    `;

    this.mountSubcomponents();
    this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    clog.info('Game HUD | Initializing canvas...');
    await this.initializeCanvas();
    clog.success('Game HUD | Canvas initialized (PixiJS v8 WebGL/WebGPU)');

    clog.info('Game HUD | Connecting to server socket...');
    await this.initializeWebSocket();
    // Makes `Loom.combats`/`Loom.combat` reactive to live combat.* WS events
    // (was a one-time snapshot before — see combats-collection.ts).
    combatsCollection.bindWebSocket();

    clog.info('Game HUD | Loading world actors and scenes...');
    // Preloads the actual collections (Loom.actors/Loom.scenes) before system scripts
    // run — parity with `Loom.actors`/`Loom.stages`, which already arrive ready
    // when the init hooks fire.
    await Promise.all([
      api.get(`/worlds/${this.props.worldId}`).then(w => (window as any)._loomWorldInfo = w).catch(() => clog.warn('Failed to preload world info')),
      actorsCollection.load(this.props.worldId),
      scenesCollection.load(this.props.worldId),
      itemsCollection.load(this.props.worldId),
      modulesCollection.load(this.props.worldId),
      usersCollection.load(this.props.worldId),
      macrosCollection.load(this.props.worldId),
      packsCollection.load(this.props.worldId),
      combatsCollection.load(this.props.worldId),
      journalCollection.load(this.props.worldId),
      foldersCollection.load(this.props.worldId),
      rollTablesCollection.load(this.props.worldId),
      playlistsCollection.load(this.props.worldId),
    ]);

    // `stage.activated`/the WS `init` payload can (and often does) arrive and
    // call applyTheaterState() BEFORE this Promise.all resolves — actorsCollection
    // isn't loaded yet, so paintCastPortraits() silently drops every card
    // (`actorsCollection.get(id)` returns undefined). Repaint now that actors
    // are actually available, so a scene that opens straight into theater mode
    // with a cast already on stage doesn't come up empty.
    if (this.theaterActive) this.paintCastPortraits();

    clog.info('Game HUD | Loading client addons and rulesets...');
    // Only the world's ruleset (world.system) is loaded — loading every
    // installed ruleset caused more than one to register in window.Loom.systems
    // at the same time (actual bug: wrong actor type appeared when creating).
    await loadClientAddons(this.initState.system?.id, this.props.worldId);

    // Fires global hooks (simulates VTT lifecycle)
    // This is essential so systems loaded via addon-client-loader
    // execute their Hooks.once('init', ...) blocks where sheets and HBS are registered.
    clog.info('Game HUD | Disparando Hooks de inicialização (init, setup, ready)...');
    LoomHooks.callAll('init');
    LoomHooks.callAll('setup');
    LoomHooks.callAll('ready');

    // `setActive()` only after `Hooks.callAll('init')` above — it is INSIDE that hook that a
    // converted system calls `systemRegistry.register(...)` (same pattern as the legacy
    // `sheetCatalog.catalog()`, which also only runs in the hook callback). Calling `setActive()`
    // before the hook fires is always a silent no-op, since the registry doesn't exist yet.
    if (this.initState.system?.id) systemRegistry.setActive(this.initState.system.id);

    this.container.querySelector('#hud-sidebar')?.classList.remove('sidebar-loading-lock');

    // System can "load" without throwing an exception (import ok) and still not
    // register any actor sheet — silent bug in the system itself.
    // There are TWO valid registration paths (it's not a bug to use only one of them):
    // (1) legacy — Hooks.once('init', () => sheetCatalog.catalog(docType, typeName, SheetClass))
    // (2) declarative — SystemRegistry.register(defineSystem({ getSheetSchema, ... }))
    // It's only an actual bug when NEITHER was used — checking only (1)
    // (as the first version of this warning did) gave a false positive in every
    // system that uses the declarative path, like rpg-generic itself.
    if (systemLoadStatus.loaded && sheetCatalog.count('actor') === 0 && !systemRegistry.getActive()?.getSheetSchema) {
      clog.error(`[SISTEMA] "${systemLoadStatus.loaded}" carregou sem erros mas não registrou ficha de actor por nenhum dos dois caminhos válidos (sheetCatalog.catalog() nem getSheetSchema()) — provável bug no próprio sistema. Fichas vão abrir genéricas.`);
    }

    await this.logCompendiumIndex();

    keybindManager.load();
    this.registerCoreKeybinds();
    this.initializeTour();

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="sidebar-toggle"]')) {
        this.canvasManager?.resize();
        setTimeout(() => {
          this.canvasManager?.resize();
        }, 350);
      }
    });

    this.container.ownerDocument.addEventListener('keydown', this.handleKeyDown);

    window.addEventListener('preview-stage', (e: any) => {
      const stageId = e.detail?.stageId;
      if (stageId) void this.previewStage(stageId);
    });

    // Emitted by StageConfigWindow when a level is created, edited or
    // deleted. Without this the scenes bar only saw the new level after F5:
    // `stage.updated` doesn't carry the levels, and the config window only
    // updated its own list.
    window.addEventListener('levels-changed', (e: any) => {
      void this.refreshStageLevels(e.detail?.stageId);
    });
    // The window event above only covers the GM who made the edit. This covers
    // everyone: the server now emits `levels.changed` on create/update/delete.
    wsClient.on('levels.changed', (data: any) => {
      void this.refreshStageLevels(data?.stageId);
    });

    window.addEventListener('switch-level', async (e: any) => {
      const { stageId, levelId } = e.detail;
      const stage = this.initState.stages.find((s: any) => s.id === stageId);
      if (!stage || !stage.levels) return;
      const level = stage.levels.find((l: any) => l.id === levelId);
      if (!level) return;

      try {
        if (stageId !== this.initState.activeStage?.id) {
          // `previewStage` already loads the entire scene (incl. the base level). Waits
          // for it to truly finish before overwriting with the requested level —
          // before this it was a guessed `setTimeout(500ms)` that raced against the
          // loading and, if it took longer, the wrong image (base level)
          // won the race and got stuck on the screen.
          await this.previewStage(stageId);
          if (this.canvasManager) {
            (this.canvasManager as any).setBgImage(level.backgroundUrl || '');
            if (level.backgroundColor) {
              (this.canvasManager as any).app.renderer.background.color = level.backgroundColor;
            }
            this.canvasManager.setLevel(level.id, level.bottomElevation ?? 0, level.topElevation ?? 20);
          }
        } else {
          if (this.canvasManager) {
            // Access via casting, since setBgImage is private in CanvasManager
            await (this.canvasManager as any).setBgImage(level.backgroundUrl || '');
            if (level.backgroundColor) {
              (this.canvasManager as any).app.renderer.background.color = level.backgroundColor;
            }
            this.canvasManager.setLevel(level.id, level.bottomElevation ?? 0, level.topElevation ?? 20);
            showToast(`Andar alterado para: ${level.name}`, 'info');
          }
        }
      } catch (err) {
        clog.error('Falha ao trocar de andar', err);
      }
    });
  }

  private initializeTour(): void {
    this.tourManager = TourManager.getInstance();
    // Start tour after a short delay to ensure UI is fully rendered
    setTimeout(() => {
      void this.tourManager?.startGameHudTour();
    }, 1000);
  }

  private async initializeCanvas(): Promise<void> {
    const canvas = this.container.querySelector<HTMLCanvasElement>(
      '#game-canvas',
    );
    if (!canvas) return;

    this.canvasManager = new CanvasManagerWithTileTriggers();
    this.canvasManager.setCurrentUserId(this.props.session?.userId || null);
    this.canvasManager.setOnPingSend((x, y) => {
      wsClient.send('canvas.ping', { x, y, worldId: this.props.worldId });
    });
    await this.canvasManager.init(canvas);
    this.canvasManager.setInitState({ cast: this.initState.cast });
    this.canvasManager.setOnMove((id, x, y) => {
      // Snapshot of the position BEFORE sending the move — `initState.cast` is only
      // updated when the echo `cast.updated` comes back from the server, so
      // at this point it still reflects the old position.
      const member = this.initState.cast.find((c) => c.id === id);
      const from = member ? { x: member.x, y: member.y } : null;

      wsClient.send('token.move', { id, x, y });
      const positions = this.canvasManager?.getAllTokenPositions();
      if (positions) {
        soundManager.updateTokenPositions(positions);
        this.updateNoiseListenerPosition();
      }

      if (from && (from.x !== x || from.y !== y)) {
        this.commandStack.push({
          label: 'Mover token',
          undo: async () => { wsClient.send('token.move', { id, x: from.x, y: from.y }); },
          redo: async () => { wsClient.send('token.move', { id, x, y }); },
        });
      }
    });
    this.canvasManager.setOnTemplateCreate((data) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      void api.post(`/stages/${stageId}/templates`, data).catch((e) => clog.error('Falha ao criar template', e));
    });
    this.canvasManager.setOnTemplateDelete((id) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      void api.delete(`/stages/${stageId}/templates/${id}`).catch((e) => clog.error('Falha ao remover template', e));
    });
    this.canvasManager.setOnDrawingCreate((data) => {
      void this.createDrawing(data as unknown as Record<string, unknown>);
    });
    this.canvasManager.setOnDrawingMove((id, payload) => {
      void api.put(`/drawings/${id}`, payload).catch((e) => clog.error('Falha ao mover desenho', e));
    });
    this.canvasManager.setOnWallCreate((data) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      const darknessLevel = this.initState.activeStage?.darknessLevel;
      // Serialized: chaining walls with shift triggers create+reload in quick succession;
      // without this queue, two concurrent cycles of loadStageWallsAndFOV corrupt
      // wallShapes (one clearWalls() in the middle of another still drawing).
      this.wallCreateQueue = this.wallCreateQueue
        .then(async () => {
          await api.post(`/walls/stage/${stageId}`, data);
          await this.loadStageWallsAndFOV(stageId, darknessLevel);
        })
        .catch((e) => clog.error('Falha ao criar parede', e));
    });
    this.canvasManager.setOnWallDoorStateChange(async (wallId, newState) => {
      try {
        await api.put(`/walls/${wallId}/state`, { doorState: newState });
      } catch (e) {
        clog.error('Falha ao alterar estado da porta', e);
      }
    });
    this.canvasManager.setOnWallDoubleClick((wallId) => {
      const wall = this.canvasManager?.getWallById(wallId);
      if (!wall) return;
      windowManager.open(`wall-config-${wallId}`, WallConfigWindow, {
        wall: wall as any, wallId, onSaved: () => {
          const activeStage = this.initState.activeStage;
          if (activeStage) void this.loadStageWallsAndFOV(activeStage.id, activeStage.darknessLevel);
        }
      });
    });
    this.canvasManager.setOnWallDelete(async (wallId) => {
      try {
        await api.delete(`/walls/${wallId}`);
        this.canvasManager?.removeWall(wallId);
      } catch (e) {
        clog.error('Falha ao excluir parede', e);
      }
    });
    this.canvasManager.setOnWallUpdate(async (wallId, data) => {
      try {
        await api.put(`/walls/${wallId}`, data);
      } catch (e) {
        clog.error('Falha ao atualizar parede', e);
      }
    });
    this.canvasManager.setOnNoiseCreate(async (data) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      try {
        const created = await api.post<any>(`/noises`, { ...data, stageId, src: '', volume: 1, easing: true });
        if (created?.id) {
          this.canvasManager?.updateSound(created);
          this.canvasManager?.selectSound(created.id); // Seleciona automaticamente para aparecer o controle de redimensionamento
          windowManager.open(`noise-config-${created.id}`, NoiseConfigWindow, {
            noise: created, noiseId: created.id, onSaved: () => {
              if (stageId) void this.loadStageNoises(stageId);
            }
          });
        }
      } catch (e) {
        clog.error('Falha ao criar som', e);
      }
    });
    this.canvasManager.setOnNoiseDoubleClick((noiseId) => {
      const noise = this.canvasManager?.getNoiseById(noiseId);
      if (!noise) return;
      windowManager.open(`noise-config-${noiseId}`, NoiseConfigWindow, {
        noise, noiseId,
        onSaved: () => {
          const activeStage = this.initState.activeStage;
          if (activeStage) void this.loadStageNoises(activeStage.id);
        }
      });
    });
    this.canvasManager.setOnSoundMove(async (noiseId, x, y) => {
      try {
        await api.put(`/noises/${noiseId}`, { x: Math.round(x), y: Math.round(y) });
      } catch (e) {
        clog.error('Falha ao mover som', e);
      }
    });
    this.canvasManager.setOnSoundResize(async (noiseId, radius) => {
      try {
        await api.put(`/noises/${noiseId}`, { radius: Math.round(radius) });
      } catch (e) {
        clog.error('Falha ao redimensionar som', e);
      }
    });
    this.canvasManager.enableWallDoorInteraction();
    this.canvasManager.setOnLightCreate(async (data) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      try {
        const created = await api.post<any>(`/stages/${stageId}/lights`, data);
        // Light added via WS 'light.created' event — double-click handle to configure
        if (created?.id) {
          let currentId = created.id;
          this.commandStack.push({
            label: 'Criar luz',
            undo: async () => { await api.delete(`/stages/${stageId}/lights/${currentId}`); },
            redo: async () => {
              const recreated = await api.post<any>(`/stages/${stageId}/lights`, data);
              currentId = recreated.id;
            },
          });
        }
      } catch (e) {
        clog.error('Falha a criar luz', e);
      }
    });
    this.canvasManager.setOnLightDoubleClick((lightId) => {
      const light = this.canvasManager?.getLightById(lightId);
      if (!light) return;
      windowManager.open(`light-config-${lightId}`, LightConfigWindow, { light, lightId });
    });
    this.canvasManager.setOnLightToggle(async (lightId) => {
      const stageId = this.initState.activeStage?.id;
      const light = this.canvasManager?.getLightById(lightId);
      if (!stageId || !light) return;
      try {
        await api.put(`/stages/${stageId}/lights/${lightId}`, { isHidden: !light.isHidden });
      } catch (e: any) {
        showToast(e?.message || 'Erro ao alternar iluminação', 'error');
      }
    });
    this.canvasManager.enableNoiseDoubleClickInteraction();
    this.canvasManager.enableLightDoubleClickInteraction();
    this.canvasManager.setOnTileCreate(async (data) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      try {
        const imgUrl = data.imgUrl || this.tileBrowseImg || '';
        const intent = this.currentInteractionTool;
        const baseName = intent ? this.getIntentName(intent) : (imgUrl ? imgUrl.split('/').pop()?.split('.').shift() || 'Novo Tile' : 'Novo Tile');
        const payload: Record<string, any> = {
          stageId,
          name: baseName,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          imgUrl,
          tintColor: this.tileTintColor,
        };

        if (intent) {
          const trigCfg = this.buildIntentConfig(intent, data);
          payload.triggers = trigCfg.triggers;
          payload.conditions = trigCfg.conditions;
          payload.actions = trigCfg.actions;
        }

        (payload as any).levelId = this.activeLevelId;

        const created = await api.post<any>(`/tiles`, payload);
        this.tileBrowseImg = '';
        this.tileTintColor = '';

        if (intent) {
          this.currentInteractionTool = '';
          showToast(`${baseName} criado. Duplo clique para ajustar.`, 'success');
          if (intent === 'int-teleport') {
            const x = await showPrompt('Destino do Teleporte', 'Coordenada X:');
            const y = x === null ? null : await showPrompt('Destino do Teleporte', 'Coordenada Y:');
            if (x !== null && y !== null) {
              await api.put(`/tiles/${created.id}`, {
                actions: [{
                  type: 'teleport',
                  config: { targetX: parseInt(x) || 0, targetY: parseInt(y) || 0 },
                }],
              });
            }
          }
        } else {
          windowManager.open(`tile-config-${created.id}`, TileConfigWindow, { id: `tile-config-${created.id}`, tileId: created.id });
        }

        this.canvasManager?.setActiveTool('select-tile');
        this.canvasManager?.selectTile(created.id);

        let currentId = created.id;
        this.commandStack.push({
          label: baseName,
          undo: async () => { await api.delete(`/tiles/${currentId}`); },
          redo: async () => {
            (payload as any).levelId = this.activeLevelId;
            const recreated = await api.post<any>(`/tiles`, payload);
            currentId = recreated.id;
          },
        });
      } catch (e) {
        clog.error('Falha ao criar tile', e);
      }
    });
    this.canvasManager.setOnNoteClick((note) => {
      if (note.targetStageId) {
        wsClient.send('stage.activate', { stageId: note.targetStageId, worldId: this.props.worldId });
      } else if (note.journalId) {
        void windowManager.open('journal', JournalWindow, { journalId: note.journalId });
      }
    });
    this.canvasManager.setOnNoteCreate(async (position) => {
      const stageId = this.initState.activeStage?.id;
      if (!stageId) return;
      try {
        await api.post('/notes', {
          stageId,
          x: position.x,
          y: position.y,
          visibleToPlayers: true,
          levelId: position.levelId ?? this.activeLevelId,
          elevation: (this.canvasManager as any)?.currentLevelBounds?.bottom ?? 0,
        });
      } catch (err) {
        clog.error('Falha ao criar nota', err);
      }
    });

    this.canvasManager.setOnTileMove(async (id, x, y) => {
      try {
        await api.put(`/tiles/${id}`, { x, y });
      } catch (err) {
        clog.error('Falha ao atualizar posição do tile', err);
      }
    });

    this.canvasManager.setOnTileResize(async (id, x, y, width, height) => {
      try {
        await api.put(`/tiles/${id}`, { x, y, width, height });
      } catch (err) {
        clog.error('Falha ao redimensionar tile', err);
      }
    });

    this.canvasManager.setOnTileContextMenu((tile, event) => {
      showContextMenu(
        new MouseEvent('contextmenu', {
          clientX: (event as any).clientX ?? (event as any).global?.x ?? 0,
          clientY: (event as any).clientY ?? (event as any).global?.y ?? 0,
          bubbles: true,
        }),
        [
          {
            icon: tile.locked ? '<i class="fa-solid fa-lock-open"></i>' : '<i class="fa-solid fa-lock"></i>',
            label: tile.locked ? 'Desbloquear Tile' : 'Bloquear Tile',
            action: () => void api.put(`/tiles/${tile.id}`, { locked: !tile.locked }),
          },
          {
            icon: tile.isActive ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>',
            label: tile.isActive ? 'Ocultar Tile' : 'Mostrar Tile',
            action: () => void api.put(`/tiles/${tile.id}`, { isActive: !tile.isActive }),
          },
          {
            icon: '<i class="fa-solid fa-floppy-disk"></i>',
            label: 'Salvar como Ferramenta',
            action: () => this.saveTileAsTool(tile),
          },
          { divider: true, label: '' },
          {
            icon: '<i class="fa-solid fa-trash"></i>',
            label: 'Excluir Tile',
            danger: true,
            action: () => void this.deleteTile(tile.id, tile.name),
          },
        ],
      );
    });

    // Set up and start tile triggers system
    this.setupTileTriggers();

    this.setupTokenStatusHandler();
    this.setupTheaterMode();

    // Listener for actor drops from canvas-manager.ts
    const mgr = this.canvasManager;
    mgr?.canvasEl?.addEventListener('canvas-actor-drop', (e: Event) => {
      const ce = e as CustomEvent;
      const { data, clientX, clientY } = ce.detail;
      if (!mgr?.canvasEl) return;
      const rect = mgr.canvasEl.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const worldPos = mgr.toWorldCoordinates(screenX, screenY) || { x: screenX, y: screenY };
      const { x, y } = worldPos;

      if (data.type === 'Actor') {
        void this.dropActorToken(data.id, x, y);
      } else if (data.type === 'Card') {
        void this.dropCardAsTile(JSON.stringify(data), x, y);
      } else if (data.type === 'Journal') {
        void this.dropJournalAsNote(data.id, x, y);
      }
    });
  }

  /** Creates a Cast (token) linked to the Actor dropped on the canvas via drag-and-drop. */
  private async dropActorToken(actorId: string, x: number, y: number): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    const grid = this.canvasManager?.getGridSize() || 50;
    const snappedX = Math.floor(x / grid) * grid + grid / 2;
    const snappedY = Math.floor(y / grid) * grid + grid / 2;
    try {
      await api.post('/cast', {
        levelId: this.activeLevelId,
        actorId,
        isLinked: true,
        name: 'Token',
        x: snappedX,
        y: snappedY,
        stageId,
        worldId: this.props.worldId,
        elevation: (this.canvasManager as any)?.currentLevelBounds?.bottom ?? 0,
      });
    } catch (err) {
      clog.error('Falha ao soltar token', err);
    }
  }

  /** Creates a map Note linked to the Journal dropped on the canvas via drag-and-drop. */
  private async dropJournalAsNote(journalId: string, x: number, y: number): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    try {
      await api.post('/notes', {
        stageId,
        journalId,
        x: Math.round(x),
        y: Math.round(y),
        visibleToPlayers: true,
        levelId: this.activeLevelId,
      });
    } catch (err) {
      clog.error('Falha ao soltar diário como nota', err);
    }
  }

  private theaterActive = false;

  private setupTheaterMode(): void {
    const isGM = (this.props.session.userRole ?? 1) >= 4;
    const btn = this.container.querySelector<HTMLButtonElement>('#theater-toggle-btn');
    if (btn) {
      btn.style.display = isGM ? '' : 'none';
      btn.addEventListener('click', () => {
        const stageId = this.initState.activeStage?.id;
        if (!stageId) return;
        wsClient.send('stage.theater', { stageId, active: !this.theaterActive, worldId: this.props.worldId });
      });
    }

    wsClient.on('stage.theaterToggled', (data: { stageId: string; active: boolean }) => {
      if (data.stageId !== this.initState.activeStage?.id) return;
      this.applyTheaterState(data.active);
    });

    const skinSelect = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    if (skinSelect) {
      skinSelect.addEventListener('change', () => {
        const stageId = this.initState.activeStage?.id;
        if (!stageId) return;
        wsClient.send('stage.theaterSkin', { stageId, skinId: skinSelect.value, worldId: this.props.worldId });
      });
    }

    wsClient.on('stage.theaterSkinChanged', (data: { stageId: string; skinId: string }) => {
      const stage = this.initState.activeStage;
      if (!stage || data.stageId !== stage.id) return;
      // Grava na cópia em memória pra um toggle posterior já abrir com a skin nova.
      const flags = typeof stage.flags === 'string' ? JSON.parse(stage.flags) : (stage.flags ?? {});
      stage.flags = { ...flags, theaterSkin: data.skinId };
      if (this.theaterActive) this.paintTheaterSkin();
    });

    const effectSelect = this.container.querySelector<HTMLSelectElement>('#theater-effect-select');
    if (effectSelect) {
      effectSelect.addEventListener('change', () => {
        const stageId = this.initState.activeStage?.id;
        if (!stageId) return;
        wsClient.send('stage.theaterEffect', { stageId, effect: effectSelect.value, worldId: this.props.worldId });
      });
    }

    wsClient.on('stage.theaterEffectChanged', (data: { stageId: string; effect: string }) => {
      const stage = this.initState.activeStage;
      if (!stage || data.stageId !== stage.id) return;
      const flags = typeof stage.flags === 'string' ? JSON.parse(stage.flags) : (stage.flags ?? {});
      stage.flags = { ...flags, theaterEffect: data.effect };
      if (this.theaterActive) this.paintTheaterSkin();
    });

    const streamBtn = this.container.querySelector<HTMLButtonElement>('#stream-link-btn');
    if (streamBtn) {
      streamBtn.style.display = isGM ? '' : 'none';
      streamBtn.addEventListener('click', () => void this.generateStreamLinks());
    }

    this.setupCinemaTray();
  }

  /** GM-only floating tray listing the scene's cast roster (actors added via
   * "Adicionar ao Elenco" in the sidebar's actor context menu — see
   * showEntityContextMenu in sidebar.ts). Clicking an icon toggles that
   * actor's portrait card on/off for everyone (`flags.activeCast`); the
   * eraser clears the stage without touching the roster itself. The tray
   * is a movable piece — drag it anywhere by its label. */
  private setupCinemaTray(): void {
    const trayBtn = this.container.querySelector<HTMLButtonElement>('#cast-tray-btn');
    const tray = this.container.querySelector<HTMLElement>('#cast-tray');
    if (trayBtn) {
      trayBtn.addEventListener('click', () => {
        if (!tray) return;
        tray.hidden = !tray.hidden;
        if (!tray.hidden) this.renderCastTray();
      });
    }
    if (tray) {
      this.makeDraggable(tray, '.cast-tray-label');
      tray.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement;
        const stageId = this.initState.activeStage?.id;
        if (!stageId) return;
        const flags = (this.initState.activeStage?.flags ?? {}) as { activeCast?: string[] };
        const current = flags.activeCast ?? [];

        if (target.closest('[data-action="clear-cast"]')) {
          if (current.length === 0) return;
          wsClient.send('stage.cast', { stageId, activeCast: [], worldId: this.props.worldId });
          return;
        }

        const chip = target.closest<HTMLElement>('[data-actor-id]');
        if (!chip) return;
        const actorId = chip.dataset.actorId!;
        const next = current.includes(actorId) ? current.filter((id) => id !== actorId) : [...current, actorId];
        wsClient.send('stage.cast', { stageId, activeCast: next, worldId: this.props.worldId });
      });
    }

    wsClient.on('stage.castChanged', (data: { stageId: string; activeCast: string[] }) => {
      const stage = this.initState.activeStage;
      if (!stage || data.stageId !== stage.id) return;
      stage.flags = { ...((stage.flags ?? {}) as Record<string, any>), activeCast: data.activeCast };
      this.paintCastPortraits();
      if (tray && !tray.hidden) this.renderCastTray();
    });

    wsClient.on('stage.castRosterChanged', (data: { stageId: string; castRoster: string[]; activeCast: string[] }) => {
      const stage = this.initState.activeStage;
      if (!stage || data.stageId !== stage.id) return;
      stage.flags = { ...((stage.flags ?? {}) as Record<string, any>), castRoster: data.castRoster, activeCast: data.activeCast };
      this.paintCastPortraits();
      if (tray && !tray.hidden) this.renderCastTray();
    });
  }

  /** Rebuilds the GM tray's roster icons, marking who is currently on stage. */
  private renderCastTray(): void {
    const tray = this.container.querySelector<HTMLElement>('#cast-tray');
    if (!tray) return;
    const flags = (this.initState.activeStage?.flags ?? {}) as { castRoster?: string[]; activeCast?: string[] };
    const roster = flags.castRoster ?? [];
    const active = new Set(flags.activeCast ?? []);

    if (roster.length === 0) {
      tray.innerHTML = `
        <div class="cast-tray-label">Elenco em Cena</div>
        <div class="cast-tray-empty">Botão direito num ator na barra lateral → Adicionar ao Elenco.</div>
      `;
      return;
    }

    const actors = roster.map((id) => actorsCollection.get(id)).filter((a): a is NonNullable<typeof a> => !!a);
    tray.innerHTML = `
      <div class="cast-tray-label">Elenco em Cena</div>
      <div class="cast-tray-row">
        ${actors.map((a) => `
          <button type="button" class="cast-chip ${active.has(a.id) ? 'active' : ''}" data-actor-id="${a.id}" title="${a.name}">
            <span class="cast-chip-avatar" style="background-image:url('${(a as any).avatarUrl || ''}')"></span>
          </button>
        `).join('')}
        <button type="button" class="cast-chip cast-chip-clear" data-action="clear-cast" title="Tirar todos do palco">
          <i class="fa-solid fa-eraser"></i>
        </button>
      </div>
    `;
  }

  /** Minimal drag-to-reposition for a small floating panel — mousedown on
   * `handleSelector` moves the whole element, clamped to the viewport. */
  private makeDraggable(el: HTMLElement, handleSelector: string): void {
    const handle = el.querySelector<HTMLElement>(handleSelector);
    if (!handle) return;
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (downEv: MouseEvent) => {
      downEv.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = downEv.clientX - rect.left;
      const offY = downEv.clientY - rect.top;
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.right = 'auto';
      el.style.transform = 'none';
      const onMove = (moveEv: MouseEvent) => {
        const x = Math.min(Math.max(0, moveEv.clientX - offX), window.innerWidth - rect.width);
        const y = Math.min(Math.max(0, moveEv.clientY - offY), window.innerHeight - rect.height);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  /** Renders the portrait cards visible to everyone in the theater overlay —
   * one per actor id in `flags.activeCast`, framed with the active skin's
   * portrait border asset when it has one. The skin's filter (e.g. noir's
   * grayscale) applies to the cards too, not just the background — a noir
   * scene should be black-and-white everywhere, not half-colored. Called
   * whenever the skin repaints (border/filter may change) and whenever the
   * cast list itself changes. */
  private paintCastPortraits(): void {
    const container = this.container.querySelector<HTMLElement>('#theater-portraits');
    if (!container) return;
    const flags = (this.initState.activeStage?.flags ?? {}) as { activeCast?: string[]; theaterSkin?: string };
    const activeCast = flags.activeCast ?? [];
    const skin = theaterSkins.get(flags.theaterSkin || DEFAULT_THEATER_SKIN);
    const borderUrl = skin?.assets.portraitBorder || '';
    const filterVar = skin?.filter ? `--portrait-filter:${skin.filter};` : '';

    container.innerHTML = activeCast.map((actorId) => {
      const actor = actorsCollection.get(actorId);
      if (!actor) return '';
      const img = (actor as any).avatarUrl || '';
      const borderVar = borderUrl ? `--portrait-border-url:url('${borderUrl}');` : '';
      return `
        <div class="theater-portrait-card">
          <div class="theater-portrait-image" style="background-image:url('${img}');${borderVar}${filterVar}"></div>
          <div class="theater-portrait-name">${actor.name}</div>
        </div>
      `;
    }).join('');
  }

  /** GM-only: mints two one-time codes and builds the OBS Browser Source URLs
   * (canvas view + chat view) — see server/applications/api/stream.ts for how
   * a code turns into a session the first time each URL loads. Each link gets
   * its own labeled row + copy button instead of a wall of text with the URLs
   * run together. */
  private streamLinksDialogOpen = false;

  private async generateStreamLinks(): Promise<void> {
    // `LoomDialog.wait` doesn't go through `windowManager` (no deterministic id to
    // dedupe on), so nothing stopped a double-click — or clicking again before
    // closing the first — from minting a fresh pair of one-time codes and stacking
    // another copy of this same dialog on top.
    if (this.streamLinksDialogOpen) return;
    this.streamLinksDialogOpen = true;
    try {
      const { canvasCode, chatCode } = await api.post<{ canvasCode: string; chatCode: string }>('/stream/link', {});
      const base = `${window.location.origin}${window.location.pathname}`;
      const canvasUrl = `${base}?capture=canvas&setup=${canvasCode}`;
      const chatUrl = `${base}?capture=chat&setup=${chatCode}`;

      const row = (label: string, url: string, key: string) => `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
          <label style="color:var(--color-text-secondary);font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</label>
          <div style="display:flex;gap:0.4rem;">
            <input type="text" readonly value="${url}" data-stream-url="${key}"
              style="flex:1;min-width:0;box-sizing:border-box;background:var(--color-bg-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:4px;padding:0.4rem 0.6rem;font-size:0.8rem;font-family:monospace;" />
            <button type="button" data-copy="${key}" class="icon-button" title="${t('gameHud.streamLinksCopy')}">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
      `;

      const container = document.createElement('div');
      container.style.cssText = 'display:flex;flex-direction:column;gap:0.85rem;box-sizing:border-box;width:100%;';
      container.innerHTML = `
        <p style="margin:0;color:var(--color-text-secondary);font-size:0.85rem;line-height:1.4;">
          ${t('gameHud.streamLinksDesc')}
        </p>
        ${row(t('gameHud.streamLinksCanvas'), canvasUrl, 'canvas')}
        ${row(t('gameHud.streamLinksChat'), chatUrl, 'chat')}
      `;

      container.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.copy!;
          const input = container.querySelector<HTMLInputElement>(`[data-stream-url="${key}"]`)!;
          copyTextToClipboard(input.value);
          const icon = btn.querySelector('i')!;
          icon.className = 'fa-solid fa-check';
          setTimeout(() => { icon.className = 'fa-solid fa-copy'; }, 1200);
        });
      });

      await LoomDialog.wait({
        window: { title: t('gameHud.streamLinksTitle') },
        content: container,
        width: 480,
        buttons: [{ action: 'confirm', label: t('gameHud.streamLinksClose'), variant: 'primary', callback: () => {} }],
      });
    } catch (err: any) {
      showToast(err?.message || t('gameHud.streamLinksError'), 'error');
    } finally {
      this.streamLinksDialogOpen = false;
    }
  }

  /** Toggles the theater overlay for everyone — hides tactical canvas layers,
   * shows the letterbox bars, and auto-collapses the sidebar for immersion
   * (the collapse button stays reachable, so a sheet/item is never out of reach).
   *
   * Skin and effect are a completely separate system from the tactical
   * weather (CanvasManager's particle layer) — they only ever touch
   * `#theater-bg`/`#theater-fog`, never CanvasManager, so the two can never
   * bleed into each other. */
  private applyTheaterState(active: boolean): void {
    this.theaterActive = active;
    this.container.classList.toggle('theater-mode', active);
    // .sidebar-collapsed-chat vive fora de .game-hud (appendChild direto em
    // document.body — ver setupCollapsedOverlay em sidebar.ts), então uma
    // regra CSS restrita ao teatro precisa desse gatilho em <body>, não dá
    // pra usar `.game-hud.theater-mode` como ancestral.
    document.body.classList.toggle('theater-mode-active', active);
    this.canvasManager?.setTheaterActive(active);
    // Só colapsa AO ENTRAR no teatro (pra não brigar com a moldura/cards).
    // Ao sair, não força expandir de volta — se o jogador colapsou por
    // conta própria antes ou durante, isso é escolha dele, não do teatro.
    if (active) this.subcomponents.sidebar?.setCollapsed(true);

    const select = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    const effectSelect = this.container.querySelector<HTMLSelectElement>('#theater-effect-select');
    const isGM = (this.props.session.userRole ?? 1) >= 4;
    if (select) select.style.display = active && isGM ? '' : 'none';
    if (effectSelect) effectSelect.style.display = active && isGM ? '' : 'none';

    const trayBtn = this.container.querySelector<HTMLButtonElement>('#cast-tray-btn');
    if (trayBtn) trayBtn.style.display = active && isGM ? '' : 'none';
    if (!active) {
      const tray = this.container.querySelector<HTMLElement>('#cast-tray');
      if (tray) tray.hidden = true;
      this.theaterFogAnim?.stop();
    }

    if (!active) return;
    this.paintTheaterSkin();
  }

  /** Repinta a moldura/fundo do teatro a partir das flags da cena ativa.
   * Separado de `applyTheaterState` porque a troca de skin ao vivo precisa
   * repintar sem religar o modo. */
  private paintTheaterSkin(): void {
    const rawFlags = this.initState.activeStage?.flags;
    const flags = (typeof rawFlags === 'string'
      ? (() => { try { return JSON.parse(rawFlags); } catch { return {}; } })()
      : (rawFlags ?? {})) as {
      cinematicBg?: string;
      theaterSkin?: string;
      theaterEffect?: string;
    };
    const effectId = flags.theaterEffect || 'none';
    const bgUrl = flags.cinematicBg || this.canvasManager?.getCurrentBackgroundUrl?.() || '';
    const skinId = flags.theaterSkin || DEFAULT_THEATER_SKIN;
    const skin = theaterSkins.get(skinId);

    const select = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    if (select && select.value !== skinId) select.value = skinId;

    const effectSelect = this.container.querySelector<HTMLSelectElement>('#theater-effect-select');
    if (effectSelect && effectSelect.value !== effectId) effectSelect.value = effectId;

    const layer = this.container.querySelector<HTMLElement>('#theater-layer');
    const bgEl = this.container.querySelector<HTMLElement>('#theater-bg');
    const fogEl = this.container.querySelector<HTMLElement>('#theater-fog');
    const topBar = this.container.querySelector<HTMLElement>('.theater-bar-top');
    const bottomBar = this.container.querySelector<HTMLElement>('.theater-bar-bottom');

    if (bgEl) {
      bgEl.innerHTML = bgUrl ? mediaHtml(bgUrl, { className: 'theater-bg-media' }) : '';
      const effectFilter = TheaterEffectFilters[effectId] || '';
      const skinFilter = skin?.filter || '';
      bgEl.style.filter = [skinFilter, effectFilter].filter(Boolean).join(' ');
    }

    if (fogEl) {
      const isFog = effectId === 'fog';
      fogEl.hidden = !isFog;
      if (isFog) {
        if (!this.theaterFogAnim) {
          this.theaterFogAnim = new TheaterFog(fogEl);
        }
        this.theaterFogAnim.start();
      } else {
        this.theaterFogAnim?.stop();
      }
    }

    if (layer) {
      layer.setAttribute('data-effect', effectId);
      // Limpa as vars da skin anterior antes de aplicar as novas — senão uma skin
      // sem `--cinematic-bar-border` herdaria a borda da skin anterior.
      for (const s of theaterSkins.list()) {
        for (const prop of Object.keys(s.styles)) layer.style.removeProperty(prop);
      }
      if (skin) {
        for (const [prop, value] of Object.entries(skin.styles)) {
          layer.style.setProperty(prop, value);
        }
      }
    }
    if (topBar) topBar.style.backgroundImage = skin?.assets.topBar ? `url('${skin.assets.topBar}')` : '';
    if (bottomBar) bottomBar.style.backgroundImage = skin?.assets.bottomBar ? `url('${skin.assets.bottomBar}')` : '';

    this.paintCastPortraits();
  }

  /** Creates an Actor/Item from a compendium entry dragged onto the canvas. */
  private async dropFromCompendium(json: string, x: number, y: number): Promise<void> {
    let payload: { entry: Record<string, unknown>; packType: string };
    try {
      payload = JSON.parse(json);
    } catch {
      return;
    }
    const { entry, packType } = payload;
    const name = entry.name as string | undefined;
    if (!name) return;
    const worldId = this.props.worldId;

    try {
      if (packType === 'Actor') {
        const type = (entry.type as string) || 'character';
        const actor = await api.post<{ id: string }>('/actors', {
          worldId,
          name,
          type,
          avatarUrl: (entry.avatarUrl as string) || (entry.img as string) || '',
          systemData: (entry.systemData as Record<string, unknown>) || {},
        });
        const stageId = this.initState.activeStage?.id;
        if (stageId && actor.id) {
          const grid = this.canvasManager?.getGridSize() || 50;
          await api.post('/cast', {
            levelId: this.activeLevelId,
            actorId: actor.id,
            isLinked: true,
            name: 'Token',
            x: Math.floor(x / grid) * grid + grid / 2,
            y: Math.floor(y / grid) * grid + grid / 2,
            stageId,
            worldId,
            elevation: (this.canvasManager as any)?.currentLevelBounds?.bottom ?? 0,
          });
        }
      } else if (packType === 'Item') {
        await api.post('/items', {
          worldId,
          name,
          type: (entry.type as string) || 'equipment',
          data: (entry.data as Record<string, unknown>) || (entry.systemData as Record<string, unknown>) || {},
          imgUrl: (entry.imgUrl as string) || (entry.img as string) || '',
        });
      } else if (packType === 'Scene') {
        const entryData = (entry.data as Record<string, unknown>) || {};
        const stagePayload: Record<string, any> = {
          worldId,
          name,
          bgUrl: (entryData.backgroundUrl as string) || (entry.imgUrl as string) || (entry.img as string) || '',
          gridSize: (entryData.gridSize as number) || 50,
          gridColor: (entryData.gridColor as string) || '#ffffff',
          gridType: (entryData.gridType as string) || 'square',
          gridStyle: (entryData.gridStyle as string) || 'solid',
          gridOpacity: (entryData.gridOpacity as number) ?? 0.4,
          gridDistance: (entryData.gridDistance as number) || 5,
          gridUnit: (entryData.gridUnit as string) || 'ft',
          width: (entryData.width as number) || 3000,
          height: (entryData.height as number) || 3000,
          padding: (entryData.padding as number) || 0,
          offsetX: (entryData.offsetX as number) || 0,
          offsetY: (entryData.offsetY as number) || 0,
          weatherEffect: (entryData.weatherEffect as string) || 'none',
          tokenVision: (entryData.tokenVision as boolean) ?? true,
          fogExplorationMode: (entryData.fogExplorationMode as string) || 'individual',
          fogExploredColor: (entryData.fogExploredColor as string) || '#000000',
          fogUnexploredColor: (entryData.fogUnexploredColor as string) || '#000000',
          globalLight: !!entryData.globalLight,
          globalLightThreshold: (entryData.globalLightThreshold as number) ?? 1,
          flags: (entryData.flags as Record<string, any>) || {},
        };
        await api.post('/stages', stagePayload);
        showToast(`Cena "${name}" importada do compêndio!`, 'success');
      }
    } catch (err) {
      clog.error('Falha ao soltar entrada do compêndio', err);
    }
  }

  /** POSTs a recently finished drawing on the canvas. The actual render happens
   * when the echo `drawing.created` comes back through the WebSocket (same flow for
   * other connected clients). */
  private async createDrawing(data: Record<string, unknown>): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    try {
      const payload = { ...data, stageId };
      const created = await api.post<{ id?: string }>('/drawings', payload);
      // Text: opens the config right after creating (drag only defined the area; content/font come from the window)
      if (data.type === 'text' && created?.id) {
        windowManager.open(`drawing-config-${created.id}`, DrawingConfigWindow, {
          id: `drawing-config-${created.id}`,
          drawingId: created.id,
        });
      }
      if (created?.id) {
        let currentId = created.id;
        this.commandStack.push({
          label: 'Criar desenho',
          undo: async () => { await api.delete(`/drawings/${currentId}`); },
          redo: async () => {
            const recreated = await api.post<{ id: string }>('/drawings', payload);
            currentId = recreated.id;
          },
        });
      }
    } catch (e) {
      clog.error('Falha ao criar desenho', e);
    }
  }

  private async loadStageTiles(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const tiles = await api.get<any[]>(`/tiles?stageId=${stageId}`);
      if (stageId !== this.initState.activeStage?.id) return;
      this.canvasManager?.setTiles(tiles || []);
    } catch (e) {
      clog.error('Falha ao carregar tiles', e);
    }
  }

  private async deleteTile(id: string, name: string): Promise<void> {
    const confirmed = await showConfirm('Excluir Tile', `Remover o tile "${name}" da cena?`);
    if (!confirmed) return;
    try {
      await api.delete(`/tiles/${id}`);
      showToast('Tile removido', 'success');
    } catch (err) {
      clog.error('Falha ao excluir tile', err);
      showToast('Erro ao remover tile', 'error');
    }
  }

  /**
   * Level the GM is currently on. Every created tile/token is born stamped with
   * it — without this the record becomes orphaned and the level filter hides it.
   */
  private get activeLevelId(): string {
    return this.canvasManager?.currentLevelId ?? '';
  }

  /**
   * Re-fetches the levels of a scene and reapplies to the stages bar.
   * `GET /stages/:id` already returns `levels`, so one call resolves it.
   */
  private async refreshStageLevels(stageId?: string): Promise<void> {
    if (!stageId) return;
    try {
      const fresh: any = await api.get(`/stages/${stageId}`);
      const levels = fresh.levels ?? [];
      const idx = this.initState.stages.findIndex((s: any) => s.id === stageId);
      if (idx !== -1) this.initState.stages[idx].levels = levels;
      if (this.initState.activeStage?.id === stageId) {
        this.initState.activeStage.levels = levels;
        // `applyStage` keeps the levels in its own private field (`this.levels`
        // inside CanvasManager) — updating only `initState` doesn't reach the
        // canvas. Without this, editing a level (background, elevation) never appeared on the
        // map until an F5: the form/stage-nav updated, the canvas didn't.
        // `ignoreCamera: true` because this is a data refresh, not a scene change.
        // `skipTransition: true` — this runs RIGHT AFTER an applyStage that already played the
        // transition (or a change that didn't even need a rebuild); without the flag,
        // every level sync repeated the entire transition animation on top
        // of the one that had just played — "opens image, fades, opens again".
        if (this.canvasManager) {
          void this.canvasManager.applyStage(this.initState.activeStage, true, true);
        }
      }
      this.subcomponents.stageNav?.setStages(
        this.initState.stages,
        this.initState.activeStage?.id ?? null,
      );
    } catch (err) {
      clog.error('Falha ao recarregar andares da cena', err);
    }
  }

  private saveTileAsTool(tile: any): void {
    windowManager.open('save-tile-tool', SaveTileToolWindow, {
      defaultName: tile.name || 'Minha Ferramenta',
      onConfirm: (name: string, icon: string) => this.persistTileTool(tile, name, icon),
    });
  }

  private persistTileTool(tile: any, name: string, icon: string): void {
    const tool = {
      name,
      icon,
      worldId: this.props.worldId,
      ownerId: this.props.session.userId,
      config: {
        triggers: tile.triggers || [],
        conditions: tile.conditions || [],
        actions: tile.actions || [],
      },
    };

    try {
      const existing = JSON.parse(localStorage.getItem('loom_custom_tools') || '[]');
      existing.push({ id: `tool-${Date.now()}`, ...tool });
      localStorage.setItem('loom_custom_tools', JSON.stringify(existing));
      this.subcomponents.toolbox?.setCustomTools(this.loadCustomTools());
      showToast(`Ferramenta "${name}" salva!`, 'success');
    } catch (e) {
      clog.error('Falha ao salvar ferramenta', e);
      showToast('Erro ao salvar ferramenta', 'error');
    }
  }

  private loadCustomTools(): ToolItem[] {
    try {
      const raw = localStorage.getItem('loom_custom_tools');
      if (!raw) return [];
      const tools = JSON.parse(raw);
      // `saveTileAsTool` always saved `worldId`, but here nobody read it: a
      // tool created in one world appeared in the toolbox of all others.
      // Old records don't have `worldId` — those keep showing up
      // everywhere on purpose, so they don't disappear from sight for those who already saved them.
      return tools
        .filter((t: any) => !t.worldId || t.worldId === this.props.worldId)
        .map((t: any) => ({
          icon: t.icon || '<i class="fa-solid fa-bolt"></i>',
          label: t.name || 'Ferramenta',
          id: t.id,
        }));
    } catch {
      return [];
    }
  }

  private async createTileFromImage(imgUrl: string): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    try {
      const name = imgUrl.split('/').pop()?.split('.').shift() || 'Novo Tile';
      const defaultSize = 200;
      const created = await api.post<any>(`/tiles`, {
        levelId: this.activeLevelId,
        stageId,
        name,
        x: 100,
        y: 100,
        width: defaultSize,
        height: defaultSize,
        imgUrl,
        tintColor: this.tileTintColor,
      });
      this.tileTintColor = '';
      windowManager.open(`tile-config-${created.id}`, TileConfigWindow, { id: `tile-config-${created.id}`, tileId: created.id });
      this.canvasManager?.setActiveTool('select-tile');
      this.canvasManager?.selectTile(created.id);
    } catch (e) {
      clog.error('Falha ao criar tile a partir de imagem', e);
      showToast('Erro ao criar tile', 'error');
    }
  }

  private async dropCardAsTile(cardJson: string, x: number, y: number): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    try {
      const card = JSON.parse(cardJson);
      const grid = this.canvasManager?.getGridSize() || 50;
      const width = grid * 2;
      const height = grid * 3;
      await api.post('/tiles', {
        levelId: this.activeLevelId,
        stageId,
        name: card.name,
        x: Math.floor(x - width / 2),
        y: Math.floor(y - height / 2),
        width,
        height,
        imgUrl: card.img || '',
        isActive: true,
        elevation: (this.canvasManager as any)?.currentLevelBounds?.bottom ?? 0,
      });
      showToast('Carta colocada no mapa', 'success');
    } catch (err) {
      clog.error('Falha ao soltar carta como tile', err);
    }
  }

  private async uploadAndDropImageAsTile(file: File, x: number, y: number): Promise<void> {
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const qs = this.props.worldId ? `?worldId=${this.props.worldId}` : '';
      const response = await fetch(`/api/assets/upload${qs}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const result = await response.json();
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }

      const imgUrl = result.path;

      // Get the natural/original dimensions of the loaded image
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      const width = img.naturalWidth || 100;
      const height = img.naturalHeight || 100;

      await api.post('/tiles', {
        levelId: this.activeLevelId,
        stageId,
        name: file.name,
        x: Math.floor(x - width / 2),
        y: Math.floor(y - height / 2),
        width,
        height,
        imgUrl,
        isActive: true,
        elevation: (this.canvasManager as any)?.currentLevelBounds?.bottom ?? 0,
      });
      showToast('Imagem colocada no mapa', 'success');
    } catch (err) {
      clog.error('Falha ao fazer upload e soltar imagem', err);
      showToast('Erro ao carregar imagem', 'error');
    }
  }

  private async loadDrawingsForStage(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const drawings = await api.get<any[]>(`/drawings/stage/${stageId}`);
      if (stageId !== this.initState.activeStage?.id) return;
      this.canvasManager?.loadDrawings(drawings || []);
    } catch (e) {
      clog.error('Falha ao carregar desenhos', e);
    }
  }

  /** Fetches the ambient lights of the stage (GET /api/stages/:stageId/lights) and applies to the canvas */
  private async loadStageLights(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const lights = await api.get<any[]>(`/stages/${stageId}/lights`);
      if (stageId !== this.initState.activeStage?.id) return;
      this.canvasManager?.setLights(lights || []);
    } catch (e) {
      clog.error('Falha ao carregar iluminação', e);
    }
  }

  /** Fetches the notes of the stage (GET /api/notes/stage/:stageId) and applies to the canvas */
  private async loadStageNotes(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const notes = await api.get<any[]>(`/notes/stage/${stageId}`);
      if (stageId !== this.initState.activeStage?.id) return;
      this.canvasManager?.setNotes(notes || []);
    } catch (e) {
      clog.error('Falha ao carregar notas', e);
    }
  }

  /** Fetches the templates of the stage (GET /api/stages/:stageId/templates) and applies to the canvas */
  private async loadStageTemplates(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const templates = await api.get<any[]>(`/stages/${stageId}/templates`);
      if (stageId !== this.initState.activeStage?.id) return;
      this.canvasManager?.setTemplates(templates || []);
    } catch (e) {
      clog.error('Falha ao carregar templates', e);
    }
  }

  /** Fetches the noises of the stage (GET /api/noises/stage/:stageId) and applies to the canvas */
  private async loadStageNoises(stageId: string | null | undefined): Promise<void> {
    if (!stageId) return;
    try {
      const noises = await api.get<any[]>(`/noises/stage/${stageId}`);
      if (stageId !== this.initState.activeStage?.id) return;
      const soundClass = (window as any).Loom?.config?.Noise?.documentClass;
      if (soundClass?.prototype?.prepareDerivedData) {
        for (const noise of noises || []) soundClass.prototype.prepareDerivedData.call(noise);
      }
      this.canvasManager?.setSounds(noises || []);
      soundManager.setNoises(noises || []);
      const positions = this.canvasManager?.getAllTokenPositions();
      if (positions) {
        soundManager.updateTokenPositions(positions);
        this.updateNoiseListenerPosition();
      }
    } catch (e) {
      clog.error('Falha ao carregar sons', e);
    }
  }

  private async initializeWebSocket(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        this.unsubscribeInit = wsClient.on('init', async (data) => {
          try {
            await this.handleInit(data);

            // INJECT INITIAL SOCKET.IO CONTEXT
            // Tells the server which world and scene this client is in, to join
            // the right rooms (world:<id> + stage:<id>) and receive broadcasts.
            wsClient.updateContext(this.props.worldId, this.initState.activeStage?.id);

            resolve();
          } catch (err) {
            reject(err);
          }
        });
        this.unsubscribeTimeUpdated = wsClient.on('time.updated', (data) => {
          if (data.worldId === this.props.worldId) {
            (window as any)._loomWorldTime = data.worldTime;
            LoomHooks.callAll('updateWorldTime', data.worldTime);
          }
        });
        this.unsubscribeStageCreated = wsClient.on('stage.created', (data) => {
          this.initState.stages.push(data);
          this.subcomponents.stageNav?.setStages(this.initState.stages, this.initState.activeStage?.id || null);
          this.subcomponents.sidebar?.addStage(data);
        });
        this.unsubscribeStageDeleted = wsClient.on('stage.deleted', (data) => {
          this.initState.stages = this.initState.stages.filter(s => s.id !== data.id);
          this.subcomponents.stageNav?.setStages(this.initState.stages, this.initState.activeStage?.id || null);
          this.subcomponents.sidebar?.removeStage(data.id);
        });
        this.unsubscribeStageUpdated = wsClient.on('stage.updated', async (data) => {
          LoomHooks.callAll('stage.updated', data);
          LoomHooks.callAll('updateScene', data);
          LoomHooks.callAll('updateDocument', 'Scene', data);
          // Update stage in local state list
          const idx = this.initState.stages.findIndex((s) => s.id === data.id);
          if (idx !== -1) {
            this.initState.stages[idx] = { ...this.initState.stages[idx], ...data };
          }

          // Update stage in sidebar list
          this.subcomponents.sidebar?.updateStage(data);

          // `stage.activated` already covers this same stage — activating a scene writes
          // `isActive` to the db, and that write fires this VERY SAME `stage.updated` in
          // parallel. Without this lock the two converged in applyStage() almost together:
          // the real activation's transition covered the screen, and this call applied the
          // content underneath with no cover (reentrancy in runTransition),
          // making the new image "pop in" before the animation finished.
          if (this.applyingStageId === data.id) return;

          // If this is the active stage, apply updates to canvas and navigation
          if (this.initState.activeStage?.id === data.id) {
            // Saved BEFORE the merge: the test below compares what arrived with
            // what was already there. After the merge the two would always be equal.
            const prevStage: any = { ...this.initState.activeStage };
            this.initState.activeStage = { ...this.initState.activeStage, ...data };
            if (data.flags) {
              const parsedFlags = typeof data.flags === 'string'
                ? (() => { try { return JSON.parse(data.flags); } catch { return {}; } })()
                : data.flags;
              this.initState.activeStage.flags = parsedFlags;
            }
            try {
              // `applyStage` is a COMPLETE reconstruction of the scene: reloads levels,
              // remakes layers, redraws everything and reevaluates which level is active.
              //
              // Calling this on every `stage.updated` was the root cause of a whole family
              // of bugs: tweaking the darkness control — a number from 0 to 1 —
              // knocked the GM back to the ground floor and vanished the tokens,
              // because the reconstruction reevaluated the level from a partial payload
              // that didn't carry `levels`.
              //
              // It only reconstructs when something that actually changes the geometry or
              // the drawing of the scene comes in the payload. Darkness, name, navigation and
              // such are applied directly, without rebuild.
              const REBUILD_KEYS = [
                'levels', 'backgroundUrl', 'width', 'height', 'padding',
                'gridSize', 'gridType', 'gridColor', 'gridStyle', 'gridOpacity',
                'gridDistance', 'gridUnit',
              ];
              // Compares VALUE, not key presence. The server emits the ENTIRE
              // stage ROW in `stages.updated`, so `gridSize`,
              // `backgroundUrl` and `width` always come in the payload — testing
              // `k in data` always returned true, and darkness kept
              // reconstructing the scene and knocking down the active level.
              const changed = (k: string) => {
                const a = (data as any)[k];
                const b = prevStage[k];
                if (a === undefined) return false;
                if (k === 'levels') return Array.isArray(a) && a.length > 0;
                return a !== b;
              };
              const needsRebuild = REBUILD_KEYS.some(changed);
              if (needsRebuild) {
                await this.canvasManager?.applyStage(this.initState.activeStage, true); // ignoreCamera = true so zoom isn't reset
                this.syncTileTriggers();
              }
              this.canvasManager?.setDarkness(this.initState.activeStage.darknessLevel ?? 0);
              soundManager.setDarkness(this.initState.activeStage.darknessLevel ?? 0);
              // Re-fetches the levels instead of just re-rendering: the payload of
              // `stage.updated` is the `stages` table row, which DOES NOT carry
              // `levels`. Any merge of it into local state leaves the nav without
              // levels — the bar was left with only the scene name after tweaking
              // the darkness. `refreshStageLevels` already calls setStages at the end.
              await this.refreshStageLevels(this.initState.activeStage.id);
            } catch (err) {
              clog.error('Falha ao aplicar cena atualizada', err);
            }

            // Atualiza o modo teatro (skin, efeito, neblina, fundo) ao vivo sem precisar de reload
            if (this.theaterActive) {
              this.paintTheaterSkin();
            }
          }
        });
        this.unsubscribeStageActivated = wsClient.on('stage.activated', async (data) => {
          const newStageId = data.id ?? data.stageId;

          // Dedupe: the server delivers the same `stage.activated` to the world room AND the
          // stage room (broadcastToAll), and every GameHud client is in both rooms.
          // If the same stage is still being applied, ignore the second arrival.
          if (this.applyingStageId === newStageId) return;
          this.applyingStageId = newStageId;

          const stageName = this.initState.stages.find(s => s.id === newStageId)?.name || 'Nova Cena';

          // UPDATE SOCKET.IO ROOM CONTEXT
          // Leaves the old stage rooms and joins the new map's room.
          wsClient.updateContext(this.props.worldId, newStageId);

          this.initState.activeStage = this.initState.stages.find((s) => s.id === newStageId) || data;
          // Stack coordinate/id references are no longer valid in the new scene.
          this.commandStack.clear();

          // With transition configured, it is the ONLY visual indicator — showing the
          // "Loading Scene" screen (gray fade) on top at the same time competed with
          // it and blocked the real effect. It only falls back to the generic spinner when there's
          // no transition configured (transitionType 'none').
          const stageForTransition = this.initState.activeStage;
          const hasCustomTransition = !!stageForTransition?.transitionType && stageForTransition.transitionType !== 'none';
          if (!hasCustomTransition) this.loadingProgress.show('Carregando Cena', stageName);

          try {
            // Everything (background, tokens, assets) runs INSIDE the same cover — covers once,
            // does everything underneath, reveals when it's done. `applyStage(..., true)`
            // in the middle skips its own transition (we're already covered out here).
            await this.canvasManager?.runStageTransition(stageForTransition, async () => {
              await this.canvasManager?.applyStage(data, false, true);
              this.syncTileTriggers();
              this.canvasManager?.setDarkness(data.darknessLevel ?? 0);
              soundManager.setDarkness(data.darknessLevel ?? 0);
              const isGM = (this.props.session.userRole ?? 1) >= 4;
              this.canvasManager?.setGM(isGM);
              // `theaterActive` (live toggle) wins once it's been set; before that,
              // `theaterDefault` (the scene-config checkbox) decides what a fresh
              // activation opens with — joining/reconnecting mid-scene lands correctly either way.
              const theaterFlags = (data.flags ?? {}) as { theaterActive?: boolean; theaterDefault?: boolean };
              this.applyTheaterState(theaterFlags.theaterActive ?? theaterFlags.theaterDefault ?? false);
              this.subcomponents.stageNav?.setStages(this.initState.stages, data.stageId);
              this.canvasManager?.clearTokens();

              for (const member of this.initState.cast) {
                if (member.stageId === newStageId) this.canvasManager?.updateToken(member);
              }
              this.updateControlledTokens();

              await this.loadStageAssetsWithProgress(newStageId, data.darknessLevel);
            });
          } catch (err) {
            clog.error('Falha ao carregar assets da cena', err);
          } finally {
            if (this.applyingStageId === newStageId) this.applyingStageId = null;
            if (!hasCustomTransition) {
              setTimeout(() => {
                this.loadingProgress.hide();
              }, 300);
            }
          }
        });
        this.unsubscribeCanvasPing = wsClient.on('canvas.ping', (data: any) => {
          this.canvasManager?.showPing(data.x, data.y, data.userColor);
        });
        this.unsubscribeTileCreated = wsClient.on('tile.created', (data) => {
          this.canvasManager?.updateTile(data);
          this.syncTileTriggers();
        });
        this.unsubscribeTileUpdated = wsClient.on('tile.updated', (data) => {
          this.canvasManager?.updateTile(data);
          this.syncTileTriggers();
        });
        this.unsubscribeTileDeleted = wsClient.on('tile.deleted', (data) => {
          this.canvasManager?.removeTile(data.id);
          this.syncTileTriggers();
        });
        this.unsubscribeLightCreated = wsClient.on('light.created', (data) => {
          this.canvasManager?.updateLight(data);
        });
        this.unsubscribeLightUpdated = wsClient.on('light.updated', (data) => {
          this.canvasManager?.updateLight(data);
        });
        this.unsubscribeLightDeleted = wsClient.on('light.deleted', (data) => {
          this.canvasManager?.removeLight(data.id);
        });
        this.unsubscribeNoteCreated = wsClient.on('note.created', (data) => {
          this.canvasManager?.updateNote(data);
        });
        this.unsubscribeNoteUpdated = wsClient.on('note.updated', (data) => {
          this.canvasManager?.updateNote(data);
        });
        this.unsubscribeNoteDeleted = wsClient.on('note.deleted', (data) => {
          this.canvasManager?.removeNote(data.id);
        });
        this.unsubscribeNoiseCreated = wsClient.on('noise.created', (data) => {
          this.canvasManager?.updateSound(data);
          soundManager.addNoise(data);
        });
        this.unsubscribeNoiseUpdated = wsClient.on('noise.updated', (data) => {
          this.canvasManager?.updateSound(data);
          soundManager.updateNoise(data);
        });
        this.unsubscribeNoiseDeleted = wsClient.on('noise.deleted', (data) => {
          this.canvasManager?.removeSound(data.id);
          soundManager.removeNoise(data.id);
        });
        this.unsubscribeDrawingCreated = wsClient.on('drawing.created', (data) => {
          this.canvasManager?.renderDrawing(data);
        });
        this.unsubscribeDrawingUpdated = wsClient.on('drawing.updated', (data) => {
          this.canvasManager?.renderDrawing(data);
        });
        this.unsubscribeDrawingDeleted = wsClient.on('drawing.deleted', (data) => {
          this.canvasManager?.removeDrawing(data.id);
        });
        this.unsubscribeDrawingCleared = wsClient.on('drawing.cleared', () => {
          this.canvasManager?.clearDrawings();
        });
        this.unsubscribeTemplateCreated = wsClient.on('template.created', (data) => {
          this.canvasManager?.renderTemplate(data);
        });
        this.unsubscribeTemplateUpdated = wsClient.on('template.updated', (data) => {
          this.canvasManager?.renderTemplate(data);
        });
        this.unsubscribeTemplateDeleted = wsClient.on('template.deleted', (data) => {
          this.canvasManager?.removeTemplate(data.id);
        });
        this.unsubscribeWallCreated = wsClient.on('wall.created', (data) => {
          this.canvasManager?.renderWall(data);
        });
        this.unsubscribeWallUpdated = wsClient.on('wall.updated', (data) => {
          this.canvasManager?.renderWall(data);
        });
        this.unsubscribeWallDeleted = wsClient.on('wall.deleted', (data) => {
          this.canvasManager?.removeWall(data.id);
        });
        this.unsubscribeDoorState = wsClient.on('door.state', () => {
          const activeStage = this.initState.activeStage;
          if (activeStage) void this.loadStageWallsAndFOV(activeStage.id, activeStage.darknessLevel);
        });
        this.unsubscribeWorldPaused = wsClient.on('world.paused', () => {
          this.isPaused = true;
          this.showPauseBanner();
        });
        this.unsubscribeWorldResumed = wsClient.on('world.resumed', () => {
          this.isPaused = false;
          this.hidePauseBanner();
        });
        this.unsubscribeCastCreated = wsClient.on('cast.created', (data) => {
          const parsed = this.parseCastMember(data);
          this.canvasManager?.updateToken(parsed);
          this.upsertCastMember(parsed);
        });
        this.unsubscribeCastUpdated = wsClient.on('cast.updated', (data) => {
          const parsed = this.parseCastMember(data);
          this.canvasManager?.updateToken(parsed, true);
          this.upsertCastMember(parsed);
        });
        this.unsubscribeCastDeleted = wsClient.on('cast.deleted', (data) => {
          if (!data?.id) return;
          this.canvasManager?.removeToken(data.id);
          this.initState.cast = this.initState.cast.filter((c) => c.id !== data.id);
          this.updateControlledTokens();
          this.syncCastContext();
        });
        // targetToken: no code listened to this event before — systems had no
        // way to react to target changes (e.g. pre-fill roll difficulty
        // based on the targeted NPC). cast.updated already updates initState.cast (used by
        // Loom.user.targets), so this hook only needs to notify, not synchronize.
        this.unsubscribeTokenTarget = wsClient.on('token.target', (data: { castId?: string; targetedBy?: string[] }) => {
          LoomHooks.callAll('targetToken', data);
          if (data?.castId) {
            const member = this.initState.cast.find((c) => c.id === data.castId);
            if (member) {
              member.targetedBy = data.targetedBy || [];
              this.canvasManager?.updateToken(member, true);
              this.tokenHud?.updateMember(member);
              this.syncCastContext();
            }
          }
        });
        this.unsubscribeItemCreated = wsClient.on('item.created', (data) => {
          LoomHooks.callAll('item.created', data);
          LoomHooks.callAll('createItem', data);
          LoomHooks.callAll('createDocument', 'item', data);
        });
        this.unsubscribeItemUpdated = wsClient.on('item.updated', (data) => {
          LoomHooks.callAll('item.updated', data);
          LoomHooks.callAll('updateItem', data);
          LoomHooks.callAll('updateDocument', 'item', data);
        });
        this.unsubscribeItemDeleted = wsClient.on('item.deleted', (data) => {
          LoomHooks.callAll('item.deleted', data);
          LoomHooks.callAll('deleteItem', data);
          LoomHooks.callAll('deleteDocument', 'item', data);
        });
        await wsClient.connect();
        wsClient.identify(
          this.props.worldId,
          this.props.session.userId || 'unknown',
          this.props.session.userName || 'Player',
          this.props.session.userColor || '#CCCCCC',
          this.props.session.userRole || 1,
        );
      } catch (e) {
        clog.error('Game HUD | Failed to connect to WebSocket:', e as Error);
        reject(e);
      }
    });
  }

  /** Deserializes JSON fields that arrive as string from SQLite (JSONField) */
  private parseCastMember(member: any): any {
    const parseField = (v: any, fallback: any) => {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return fallback; }
      }
      return v;
    };
    return {
      ...member,
      statusMarkers: parseField(member.statusMarkers, []),
      targetedBy: parseField(member.targetedBy, []),
      effects: parseField(member.effects, []),
      traits: parseField(member.traits, {}),
      ownership: parseField(member.ownership, {}),
      systemData: parseField(member.systemData, {}),
      bar1: parseField(member.bar1, null),
      bar2: parseField(member.bar2, null),
      displayBars: member.displayBars !== undefined && member.displayBars !== null ? Number(member.displayBars) : 20,
    };
  }

  private async handleInit(data: any): Promise<void> {
    const stages: any[] = data.stages || [];
    const rawCast: any[] = data.cast || [];
    const cast = rawCast.map((m) => this.parseCastMember(m));
    const activeStage = stages.find((s: any) => s.isActive) || null;

    if (activeStage) {
      wsClient.updateContext(this.props.worldId, activeStage.id);
    }
    this.initState = {
      cast,
      stages,
      activeStage,
      system: data.system,
      modules: data.modules || []
    };
    this.syncCastContext();

    if (data.isPaused) {
      this.isPaused = true;
      this.showPauseBanner();
    }
    this.subcomponents.sidebar?.setSystemData(data.system, data.modules);
    if (data.permissions) {
      this.subcomponents.sidebar?.setPermissions(data.permissions);
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  LOOMVTT — BOOT SEQUENCE REPORT                                  ║
    // ╚══════════════════════════════════════════════════════════════════╝

    // ── RPG System ───────────────────────────────────────────────────────
    if (data.system) {
      const sys = data.system;
      clog.success(`System | ${sys.title ?? sys.id}  v${sys.version ?? '?'}  [${sys.id}]`);
    } else {
      clog.warn('System | No active system detected — using bare-bones fallback');
    }

    // ── Rulesets ─────────────────────────────────────────────────────────
    const rulesets: Array<{ name: string; version: string | null }> = data.rulesets || [];
    if (rulesets.length) {
      rulesets.forEach((r) =>
        clog.success(`Ruleset | "${r.name}"${r.version ? `  v${r.version}` : ''}  — loaded OK`),
      );
    } else {
      clog.info('Ruleset | No rulesets loaded (generic fallback active)');
    }

    // ── Modules ──────────────────────────────────────────────────────────
    const modules: Array<{ name: string; version: string | null }> = data.modules || [];
    if (modules.length) {
      modules.forEach((m) =>
        clog.success(`Module | "${m.name}"${m.version ? `  v${m.version}` : ''}  — loaded OK`),
      );
    } else {
      clog.info('Module | No modules loaded');
    }

    // ── World State ──────────────────────────────────────────────────────
    clog.success(
      `World  | ${stages.length} stage(s) · active: "${activeStage?.name ?? '—'}" ` +
      `· ${cast.length} token(s) on stage`,
    );
    const actorCount: number = (data.actors ?? []).length;
    const itemCount: number = (data.items ?? []).length;
    clog.info(`World  | ${actorCount} actor(s) · ${itemCount} item(s) in world`);

    // ─────────────────────────────────────────────────────────────────────

    this.subcomponents.stageNav?.setStages(stages, activeStage?.id ?? null);

    if (activeStage) {
      const hasCustomTransition = !!activeStage.transitionType && activeStage.transitionType !== 'none';
      if (!hasCustomTransition) this.loadingProgress.show('Carregando Cena', activeStage.name || 'Cena');

      try {
        await this.canvasManager?.runStageTransition(activeStage, async () => {
          await this.canvasManager?.applyStage(activeStage, false, true);
          this.syncTileTriggers();
          this.canvasManager?.setDarkness(activeStage.darknessLevel ?? 0);
          soundManager.setDarkness(activeStage.darknessLevel ?? 0);
          const isGM = (this.props.session.userRole ?? 1) >= 4;
          this.canvasManager?.setGM(isGM);
          const initTheaterFlags = (activeStage.flags ?? {}) as { theaterActive?: boolean; theaterDefault?: boolean };
          this.applyTheaterState(initTheaterFlags.theaterActive ?? initTheaterFlags.theaterDefault ?? false);

          for (const member of cast) {
            if (member.stageId !== activeStage.id) continue;
            this.canvasManager?.updateToken(member);
          }
          this.updateControlledTokens();

          await this.loadStageAssetsWithProgress(activeStage.id, activeStage.darknessLevel);
          clog.success(`Mundo carregado: ${actorCount} atores, ${stages.length} cenas, ${itemCount} itens`);
        });
      } catch (err) {
        clog.error('Falha ao carregar assets da cena', err);
        clog.error('Falha ao carregar assets da cena na inicialização', err);
      } finally {
        if (!hasCustomTransition) setTimeout(() => this.loadingProgress.hide(), 300);
      }
    } else {
      for (const member of cast) {
        this.canvasManager?.updateToken(member);
      }
      this.updateControlledTokens();
    }

    if (data.chatHistory?.length) {
      messagesCollection.load(data.chatHistory);
      this.subcomponents.sidebar?.loadChatHistory(data.chatHistory);
    }
  }

  /** Fetches stage walls via API and enables/disables FOV according to the scene's tokenVision.
   * Used to use `darknessLevel > 0` — same bug already fixed in fog-layer.ts (08/21/2026):
   * token vision is independent of the scene being light or dark. In a daylight scene
   * (darknessLevel=0, default for new scenes), this would turn off `canvasManager.fovEnabled`
   * and zero the token's FOV origin even before reaching fog-layer.ts — no
   * fix there resolved it, because the gate that blocked it was here. */
  private async loadStageWallsAndFOV(
    stageId: string | null | undefined,
    darknessLevel: number | undefined,
  ): Promise<void> {
    if (!stageId) return;
    try {
      const raw = await api.get<any[]>(`/walls/stage/${stageId}`);
      if (stageId !== this.initState.activeStage?.id) return;
      const walls: WallSegment[] = (raw || []).map((w: any) => ({
        id: w.id,
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        sight: w.sight ?? true,
        light: w.light ?? true,
        movement: w.movement ?? true,
        sound: w.sound ?? true,
        direction: w.direction ?? 0,
        door: w.door ?? 0,
        doorState: w.doorState ?? 0,
        wallType: w.wallType || 'normal',
      }));
      this.canvasManager?.setWalls(walls);
      soundManager.setWalls(walls);
    } catch (e) {
      clog.error('Game HUD | Failed to load walls:', e as Error);
    }
    this.canvasManager?.setFOVEnabled(this.initState.activeStage?.tokenVision ?? true);
  }

  /** Keeps initState.cast synchronized and recalculates which tokens are "controlled" */
  private upsertCastMember(data: any): void {
    const idx = this.initState.cast.findIndex((c) => c.id === data.id);
    if (idx >= 0) {
      this.initState.cast[idx] = data;
    } else {
      this.initState.cast.push(data);
    }
    // Without this, the person saving the edit gets stuck seeing the old FOV until the
    // WebSocket echo of their own change returns — refreshTokenVision() only
    // updates the vision cache (sightRange/sightEnabled) without touching visual/
    // position/visibility (updateToken() does that and caused a regression here).
    this.canvasManager?.refreshTokenVision(data);
    this.updateControlledTokens();
    this.tokenHud?.updateMember(data);
    this.syncCastContext();
  }

  /**
   * Simplification: without a token selection UI yet, "controlled" tokens for
   * FOV purposes are the ones the current user owns (ownership >= OWNER).
   */
  private updateControlledTokens(): void {
    const userId = this.props.session?.userId;
    if (!userId) return;
    const ids = this.initState.cast
      .filter((c) => (c.ownership?.[userId] ?? 0) >= OWNERSHIP_OWNER)
      .map((c) => c.id);
    this.canvasManager?.setControlledTokens(ids);
    this.updateNoiseListenerPosition();
  }

  private updateNoiseListenerPosition(): void {
    const userId = this.props.session?.userId;
    if (!userId) {
      soundManager.setListenerPosition(null);
      return;
    }
    const controlled = this.initState.cast
      .filter((c) => (c.ownership?.[userId] ?? 0) >= OWNERSHIP_OWNER);
    if (controlled.length > 0) {
      soundManager.setListenerPosition({ x: controlled[0].x, y: controlled[0].y });
    } else {
      soundManager.setListenerPosition(null);
    }
  }

  private getIntentName(intent: string): string {
    if (intent === 'custom') {
      const tool = this.findCustomTool(this.currentCustomToolId);
      return tool?.name || 'Ferramenta';
    }
    const names: Record<string, string> = {
      'int-trap': 'Armadilha',
      'int-teleport': 'Teleporte',
      'int-door': 'Porta Secreta',
      'int-sign': 'Placa',
      'int-ambush': 'Emboscada',
    };
    return names[intent] || 'Interacao';
  }

  private findCustomTool(id: string): any | null {
    try {
      const raw = localStorage.getItem('loom_custom_tools');
      if (!raw) return null;
      const tools = JSON.parse(raw);
      return tools.find((t: any) => t.id === id) || null;
    } catch {
      return null;
    }
  }

  private buildIntentConfig(intent: string, data: any): { triggers: any[]; conditions: any[]; actions: any[] } {
    const baseX = data.x;
    const baseY = data.y;

    if (intent === 'custom') {
      const tool = this.findCustomTool(this.currentCustomToolId);
      if (tool?.config) {
        return {
          triggers: tool.config.triggers || [],
          conditions: tool.config.conditions || [],
          actions: tool.config.actions || [],
        };
      }
      return { triggers: [], conditions: [], actions: [] };
    }

    switch (intent) {
      case 'int-trap':
        return {
          triggers: [{ event: 'token-enter' }],
          conditions: [{ type: 'user-role-gte', value: 1 }],
          actions: [
            { type: 'show-dialog', config: { title: 'Armadilha!', content: 'Uma armadilha foi ativada!' } },
            { type: 'activate-tile', config: { active: false } },
          ],
        };
      case 'int-teleport':
        return {
          triggers: [{ event: 'token-enter' }],
          conditions: [],
          actions: [
            { type: 'teleport', config: { targetX: baseX + 200, targetY: baseY, stageId: '' } },
          ],
        };
      case 'int-door':
        return {
          triggers: [{ event: 'token-enter' }],
          conditions: [],
          actions: [
            { type: 'toggle-visibility', config: {} },
            { type: 'show-dialog', config: { title: 'Porta Secreta', content: 'Uma passagem foi revelada!' } },
            { type: 'activate-tile', config: { active: false } },
          ],
        };
      case 'int-sign':
        return {
          triggers: [{ event: 'token-enter' }],
          conditions: [],
          actions: [
            { type: 'show-dialog', config: { title: 'Placa', content: 'Texto da placa (editar na configuracao)' } },
          ],
        };
      case 'int-ambush':
        return {
          triggers: [{ event: 'token-enter' }],
          conditions: [{ type: 'user-role-gte', value: 1 }],
          actions: [
            { type: 'toggle-visibility', config: {} },
            { type: 'show-dialog', config: { title: 'Emboscada!', content: 'Uma emboscada foi revelada!' } },
          ],
        };
      default:
        return { triggers: [], conditions: [], actions: [] };
    }
  }

  private mountSubcomponents(): void {
    const isGMForToolbox = (this.props.session.userRole ?? 1) >= 4;
    const stageNavContainer = this.container.querySelector('#hud-top-nav') as HTMLElement;
    this.subcomponents.stageNav = new StageNav(stageNavContainer, this.props.worldId, isGMForToolbox);

    const toolboxContainer = this.container.querySelector('#hud-toolbox') as HTMLElement;
    this.subcomponents.toolbox = new Toolbox(toolboxContainer, async (tool) => {
      const activeStage = this.initState.activeStage;

      if (tool === 'tile-snap') {
        this.tileSnapToGrid = !this.tileSnapToGrid;
        showToast(this.tileSnapToGrid ? 'Encaixe: Ativado' : 'Encaixe: Desativado', 'info');
        return;
      }
      if (tool === 'tile-palette') {
        this.canvasManager?.setActiveTool('select-tile');
        void showPrompt('Cor do Tile', 'Hex (ex: #ff8800). Deixe vazio para nenhuma.').then((q) => {
          if (q === null) return;
          this.tileTintColor = q.trim();
          showToast(this.tileTintColor ? `Tile tint: ${this.tileTintColor}` : 'Tile tint removido', 'info');
        });
        return;
      }
      if (tool === 'tile-browse') {
        windowManager.open('file-picker', FilePickerWindow, {
          onSelect: (path: string) => {
            this.tileBrowseImg = path;
            this.canvasManager?.setActiveTool('place-tile');
            showToast('Arraste no canvas para criar o tile', 'info');
          },
          onDoubleClick: (path: string) => {
            windowManager.close('file-picker');
            this.createTileFromImage(path);
          },
          worldId: this.props.worldId,
        });
        return;
      }

      if (tool.startsWith('int-')) {
        this.currentInteractionTool = tool;
        this.currentCustomToolId = '';
        this.canvasManager?.setActiveTool('place-tile');
        const labels: Record<string, string> = {
          'int-trap': 'Arraste a area da armadilha',
          'int-teleport': 'Arraste a area de entrada do teleporte',
          'int-door': 'Arraste a area da porta secreta',
          'int-sign': 'Arraste a area da placa',
          'int-ambush': 'Arraste a area da emboscada',
        };
        showToast(labels[tool] || 'Arraste no canvas para criar', 'info');
        return;
      }
      if (tool.startsWith('tool-')) {
        this.currentInteractionTool = 'custom';
        this.currentCustomToolId = tool;
        this.canvasManager?.setActiveTool('place-tile');
        showToast('Arraste no canvas para criar', 'info');
        return;
      }
      if (tool === 'tile-clear') {
        const confirmed = await showConfirm('Limpar Tiles', 'Limpar todos os tiles desta cena?');
        if (confirmed && activeStage) {
          try {
            // Delete via API
            const response = await api.get<any[]>(`/tiles?stageId=${activeStage.id}`);
            for (const tile of response || []) {
              await api.delete(`/tiles/${tile.id}`);
              this.canvasManager?.removeTile(tile.id);
            }
            showToast('Todos os tiles foram removidos', 'success');
          } catch (err) {
            clog.error('Falha ao limpar tiles', err);
          }
        }
        return;
      }
      if (tool === 'light-daylight') {
        if (activeStage) {
          try {
            await api.put(`/stages/${activeStage.id}`, { darknessLevel: 0 });
            showToast('Transição para o Dia', 'success');
            activeStage.darknessLevel = 0;
            this.canvasManager?.setDarkness(0);
            soundManager.setDarkness(0);
            this.canvasManager?.setFOVEnabled(false);
          } catch (err) {
            clog.error('Falha ao alternar para o dia', err);
          }
        }
        return;
      }
      if (tool === 'light-darkness') {
        if (activeStage) {
          try {
            await api.put(`/stages/${activeStage.id}`, { darknessLevel: 1 });
            showToast('Transição para a Noite', 'success');
            activeStage.darknessLevel = 1;
            this.canvasManager?.setDarkness(1);
            soundManager.setDarkness(1);
            this.canvasManager?.setFOVEnabled(true);
          } catch (err) {
            clog.error('Falha ao alternar para a noite', err);
          }
        }
        return;
      }
      if (tool === 'light-clear') {
        const confirmed = await showConfirm('Limpar Luzes', 'Remover todas as luzes desta cena?');
        if (confirmed && activeStage) {
          try {
            const lights = (this.canvasManager as any).allLights || [];
            for (const l of [...lights]) {
              if (l.stageId === activeStage.id) {
                await api.delete(`/stages/${activeStage.id}/lights/${l.id}`);
                this.canvasManager?.removeLight(l.id);
              }
            }
            showToast('Todas as iluminações foram removidas', 'success');
          } catch (err) {
            clog.error('Falha ao alternar para a noite', err);
          }
        }
        return;
      }
      if (tool === 'wall-close-doors') {
        if (activeStage) {
          try {
            const walls = (this.canvasManager as any).walls || [];
            let closedCount = 0;
            for (const w of walls) {
              if (w.door > 0 && w.doorState !== 0) {
                await api.put(`/walls/${w.id}/state`, { doorState: 0 });
                w.doorState = 0;
                this.canvasManager?.renderWall(w);
                closedCount++;
              }
            }
            if (closedCount > 0) {
              this.canvasManager?.syncLights();
            }
            showToast('Todas as portas foram fechadas', 'success');
          } catch (err) {
            clog.error('Falha ao fechar portas', err);
          }
        }
        return;
      }
      if (tool === 'wall-clear') {
        const confirmed = await showConfirm('Limpar Paredes', 'Remover todas as paredes desta cena?');
        if (confirmed && activeStage) {
          try {
            const walls = (this.canvasManager as any).walls || [];
            for (const w of [...walls]) {
              await api.delete(`/walls/${w.id}`);
              this.canvasManager?.removeWall(w.id);
            }
            showToast('Todas as paredes foram removidas', 'success');
          } catch (err) {
            clog.error('Falha ao limpar paredes', err);
          }
        }
        return;
      }
      if (tool === 'sound-clear') {
        const confirmed = await showConfirm('Limpar Sons', 'Remover todos os sons desta cena?');
        if (confirmed && activeStage) {
          try {
            const noises = (this.canvasManager as any).allNoises || [];
            for (const n of [...noises]) {
              if (n.stageId === activeStage.id) {
                await api.delete(`/noises/${n.id}`);
                this.canvasManager?.removeSound(n.id);
              }
            }
            showToast('Todos os sons foram removidos', 'success');
          } catch (err) {
            clog.error('Falha ao limpar sons', err);
          }
        }
        return;
      }
      this.canvasManager?.setActiveTool(tool);
    }, (val) => {
      this.canvasManager?.setUnrestrictedMovement(val);
    }, (val) => {
      this.canvasManager?.setNotesVisible(val);
    }, isGMForToolbox);

    const savedTools = this.loadCustomTools();
    if (savedTools.length > 0) {
      this.subcomponents.toolbox?.setCustomTools(savedTools);
    }

    const sidebarContainer = this.container.querySelector('#hud-sidebar') as HTMLElement;
    // Locked until `bootstrap()` finishes loading the system (removed right after
    // `LoomHooks.callAll('ready')`) — visible all the time, just unclickable in the meantime.
    sidebarContainer.classList.add('sidebar-loading-lock');
    this.subcomponents.sidebar = new Sidebar(
      sidebarContainer,
      this.props.worldId,
      this.props.session,
      this.initState.system,
      this.initState.modules,
      (val) => {
        this.canvasManager?.setLiveVisionOnDrag(val);
      },
      (val) => {
        this.canvasManager?.setLightAnimationsEnabled(val);
      },
      (val) => {
        setLocale(val as any);
      },
      (val) => {
        localStorage.setItem('loom_hide_canvas', String(val));
        this.canvasManager?.setCanvasVisible?.(!val);
      },
      (val) => {
        localStorage.setItem('loom_left_click_deselect', String(val));
        this.canvasManager?.setLeftClickDeselect?.(val);
      },
      (val) => {
        localStorage.setItem('loom_max_fps', val);
        this.canvasManager?.setMaxFps?.(val);
      },
      (val) => {
        localStorage.setItem('loom_show_tooltips', String(val));
        this.subcomponents.toolbox?.setTooltipsVisible?.(val);
      },
      (val) => {
        localStorage.setItem('loom_autosave_interval', val);
      },
      (val) => {
        localStorage.setItem('loom_universal_keys', String(val));
      },
      this,
    );

    // Exposes the Sidebar (chat/actors/items/combat/etc panels) in the namespace
    // `window.ui.sidebar`. LoomVTT
    // implements all panels inside the `Sidebar` class (internal tabs),
    // not as separate objects — so only the aggregate instance is exposed.
    (window as any).ui = (window as any).ui || {};
    (window as any).ui.sidebar = this.subcomponents.sidebar;

    if (this.captureMode === 'chat') {
      this.subcomponents.sidebar.setCollapsed(false);
      this.subcomponents.sidebar.openTab('chat');
    }

    const hotbarContainer = this.container.querySelector('#hud-hotbar') as HTMLElement;
    this.subcomponents.macroHotbar = new MacroHotbar(hotbarContainer, this.props.worldId, this.props.session);

    const playersContainer = this.container.querySelector('#hud-players-list') as HTMLElement;
    this.subcomponents.playersList = new PlayersList(playersContainer, this.props.worldId);

    // The hotbar reserves horizontal space on its left so its own centering
    // box never reaches under the players-list card (same corner, same row).
    // A fixed guess either overlaps (too small) or drags the hotbar visibly
    // off-center whenever there's only one player online (too big) — so this
    // measures the card's REAL rendered width live and feeds it to the CSS
    // via --players-list-clearance, instead of guessing a constant.
    const layerEl = this.container.querySelector('.hud-layer') as HTMLElement;
    if (layerEl) {
      const updateClearance = () => {
        const w = playersContainer.offsetWidth;
        layerEl.style.setProperty('--players-list-clearance', `${w + 20}px`);
      };
      updateClearance();
      const playersResizeObserver = new ResizeObserver(updateClearance);
      playersResizeObserver.observe(playersContainer);
      this.playersListResizeObserver = playersResizeObserver;
    }
  }

  private setupTokenStatusHandler(): void {
    this.canvasManager?.setOnTokenClick((castMember) => {
      if (castMember.actorId) {
        const typeName = actorsCollection.get(castMember.actorId)?.type || '*';
        const SheetClass = resolveSheetClass('actor', typeName, ActorSheetWindow);
        void windowManager.open(`actor-sheet-${castMember.actorId}`, SheetClass, { actorId: castMember.actorId, worldId: this.props.worldId });
      }
      // Tokens not linked to an Actor: select (already handles TokenHud via
      // setOnTokenSelectionChange) instead of opening a status window.
    });

    this.canvasManager?.setOnTokenContextMenu((castMember) => {
      // Right button opens the full radial HUD; right-clicking again on the
      // same token closes the HUD (toggle).
      if (this.tokenHud?.isShowingId(castMember.id)) {
        this.tokenHud.hide();
      } else {
        this.tokenHud?.show(castMember);
      }
    });

    const tokenHudContainer = this.container.querySelector('#hud-token-hud') as HTMLElement;
    if (tokenHudContainer && this.canvasManager) {
      this.tokenHud = new TokenHud(
        tokenHudContainer,
        this.canvasManager,
        {
          userId: this.props.session.userId || 'unknown',
          worldId: this.props.worldId,
          isGM: (this.props.session.userRole ?? 1) >= 4,
        },
        (updated) => this.upsertCastMember(updated),
        (id, name) => void this.deleteToken(id, name),
      );
      // Left click only selects (visual ring) — the radial HUD opens only on
      // right click (setOnTokenContextMenu above). Here we only hide the HUD
      // if the selection changes to another token or is undone.
      this.canvasManager.setOnTokenSelectionChange((ids) => {
        if (ids.length !== 1 || !this.tokenHud?.isShowingId(ids[0])) {
          this.tokenHud?.hide();
        }
        if (ids.length === 1) {
          try {
            if (!localStorage.getItem('loom_token_hud_hint_seen')) {
              localStorage.setItem('loom_token_hud_hint_seen', 'true');
              showToast('Dica: clique com o botão direito no token para abrir o HUD rápido', 'info');
            }
          } catch { }
        }
      });
    }
  }

  private setupTileTriggers(): void {
    // The engine ALWAYS has to turn on, not only when the scene already opens with
    // configured tiles: it is `start()` that registers the movement callback
    // (setOnMove). While start stayed inside an `if (tiles.length > 0)`,
    // creating the first trap in a clean scene never worked without
    // reloading the page — the engine stayed with isRunning=false the whole session.
    this.canvasManager?.startTileTriggers();
    this.syncTileTriggers();
  }

  /**
   * Re-synchronizes the triggers engine with the tiles the canvas already knows.
   *
   * Needs to run on every tile created/edited/removed and on every scene change.
   * `TileTriggerEngine.executeTriggers()` does `activeTiles.get(tileId)` and
   * silently returns if the tile isn't there. Since `tile.created`/
   * `tile.updated` only fed `canvasManager.updateTile()` — which touches the
   * sprite, not the engine — every trap created during the session stayed
   * invisible to the trigger engine: the token walked over it, nothing happened and
   * no error came out in the console.
   *
   * Reads from `getTileData()` instead of redoing GET /tiles because this Map is already
   * kept up to date by updateTile/removeTile/applyStage, and brings the complete
   * record (triggers, conditions, actions).
   */
  private syncTileTriggers(): void {
    const tiles = Array.from(this.canvasManager?.getTileData().values() ?? []);
    this.canvasManager?.setupTileTriggers(tiles);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.hasAttribute('contenteditable'))
    ) {
      return;
    }

    const useCode = localStorage.getItem('loom_universal_keys') === 'true';
    let key = useCode ? event.code : event.key;
    if (useCode && key.startsWith('Key')) key = key.slice(3).toLowerCase();
    else if (useCode && key.startsWith('Digit')) key = key.slice(5);
    if (key === ' ') key = 'Space';

    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    const label = key.length === 1 ? key.toUpperCase() : key;
    const composite = ctrl && shift ? `Ctrl+Shift+${label}`
      : ctrl ? `Ctrl+${label}`
        : shift ? `Shift+${label}`
          : label;

    let action = keybindManager.getAction(composite);
    if (!action && !ctrl && !shift) {
      action = keybindManager.getAction(key);
      if (!action && key.length === 1) {
        action = keybindManager.getAction(key.toLowerCase());
      }
    }

    if (!action) return;

    // Copy/cut only intercepts if there is a selected canvas object — otherwise let it
    // pass without preventDefault (e.g. copying selected text in chat).
    if ((action === 'copy' || action === 'cut') && !this.hasCanvasSelection()) return;
    // Paste only intercepts if the canvas clipboard has something — otherwise let it
    // pass (pasting normal text in some input, although inputs already return before this).
    if (action === 'paste' && !canvasClipboard.hasItems) return;

    event.preventDefault();

    const actionObj = keybindManager.getActionObject(action);
    if (actionObj?.onPress) {
      actionObj.onPress();
    }
  };

  private async handleDeleteSelected(): Promise<void> {
    const selectedDrawingId = this.canvasManager?.getSelectedDrawingId();
    const selectedTileId = this.canvasManager?.getSelectedTileId();

    if (selectedDrawingId) {
      const confirmed = await showConfirm(
        'Excluir Desenho',
        'Deseja remover o desenho selecionado do mapa?'
      );
      if (!confirmed) return;
      try {
        const snapshot = await api.get<any>(`/drawings/${selectedDrawingId}`).catch(() => null);
        await api.delete(`/drawings/${selectedDrawingId}`);
        this.canvasManager?.selectDrawing(null);
        showToast('Desenho removido', 'success');
        if (snapshot) {
          const { id: _omit, ...payload } = snapshot;
          let currentId = selectedDrawingId;
          this.commandStack.push({
            label: 'Excluir desenho',
            undo: async () => {
              const created = await api.post<{ id: string }>('/drawings', payload);
              currentId = created.id;
            },
            redo: async () => { await api.delete(`/drawings/${currentId}`); },
          });
        }
      } catch (err: any) {
        showToast(err?.message || 'Erro ao remover desenho', 'error');
      }
      return;
    }

    if (selectedTileId) {
      const confirmed = await showConfirm(
        'Excluir Tile',
        'Deseja remover o tile selecionado do mapa?'
      );
      if (!confirmed) return;
      try {
        const snapshot = await api.get<any>(`/tiles/${selectedTileId}`).catch(() => null);
        await api.delete(`/tiles/${selectedTileId}`);
        this.canvasManager?.selectTile(null);
        showToast('Tile removido', 'success');
        if (snapshot) {
          const { id: _omit, ...payload } = snapshot;
          let currentId = selectedTileId;
          this.commandStack.push({
            label: 'Excluir tile',
            undo: async () => {
              const created = await api.post<{ id: string }>('/tiles', payload);
              currentId = created.id;
            },
            redo: async () => { await api.delete(`/tiles/${currentId}`); },
          });
        }
      } catch (err: any) {
        showToast(err?.message || 'Erro ao remover tile', 'error');
      }
      return;
    }

    const selectedLightId = this.canvasManager?.getSelectedLightId();
    if (selectedLightId) {
      const confirmed = await showConfirm(
        t('gameHud.deleteLighting'),
        t('gameHud.deleteLightingConfirm')
      );
      if (!confirmed) return;
      try {
        const stageId = this.initState.activeStage?.id;
        const snapshot = this.canvasManager?.getLightById(selectedLightId);
        await api.delete(`/stages/${stageId}/lights/${selectedLightId}`);
        this.canvasManager?.selectLight(null);
        showToast(t('gameHud.lightingRemoved'), 'success');
        if (snapshot && stageId) {
          const { id: _omit, ...payload } = snapshot as any;
          let currentId = selectedLightId;
          this.commandStack.push({
            label: t('gameHud.deleteLightCommand'),
            undo: async () => {
              const created = await api.post<any>(`/stages/${stageId}/lights`, payload);
              currentId = created.id;
            },
            redo: async () => { await api.delete(`/stages/${stageId}/lights/${currentId}`); },
          });
        }
      } catch (err: any) {
        showToast(err?.message || t('gameHud.lightingRemoveError'), 'error');
      }
      return;
    }

    const selectedIds = this.canvasManager?.getSelectedTokenIds();
    if (!selectedIds || selectedIds.size === 0) return;

    const confirmed = await showConfirm(
      'Excluir Tokens',
      `Deseja remover os ${selectedIds.size} tokens selecionados do mapa?`
    );
    if (!confirmed) return;

    try {
      const commands: Command[] = [];
      for (const id of selectedIds) {
        const snapshot = this.initState.cast.find((c) => c.id === id);
        await api.delete(`/cast/${id}`);
        if (!snapshot) continue;
        const { id: _omit, ...payload } = snapshot as any;
        let currentId = id;
        commands.push({
          label: 'Excluir token',
          undo: async () => {
            const created = await api.post<{ id: string }>('/cast', payload);
            currentId = created.id;
          },
          redo: async () => { await api.delete(`/cast/${currentId}`); },
        });
      }
      if (commands.length > 0) {
        this.commandStack.push(compositeCommand('Excluir tokens', commands));
      }
      this.canvasManager?.clearSelection();
      showToast('Tokens removidos', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao remover tokens', 'error');
    }
  }

  /** Registers core shortcuts in KeybindManager */
  private registerCoreKeybinds(): void {
    const reg = (action: KeybindAction) => keybindManager.register(action);

    const coreCategory = t('keybinds.core.category');
    reg({ id: 'target-token', label: t('keybinds.core.targetToken.label'), description: t('keybinds.core.targetToken.description'), defaultKey: 't', category: coreCategory, onPress: () => void this.handleTargetToken() });
    reg({ id: 'delete-selected', label: t('keybinds.core.deleteSelected.label'), description: t('keybinds.core.deleteSelected.description'), defaultKey: 'Delete', category: coreCategory, onPress: () => void this.handleDeleteSelected() });
    reg({ id: 'cancel-or-close', label: t('keybinds.core.cancelOrClose.label'), description: t('keybinds.core.cancelOrClose.description'), defaultKey: 'Escape', category: coreCategory, onPress: () => this.handleCancelOrClose() });
    reg({ id: 'select-all', label: t('keybinds.core.selectAll.label'), description: t('keybinds.core.selectAll.description'), defaultKey: 'Ctrl+A', category: coreCategory, onPress: () => this.canvasManager?.selectAllTokens() });
    reg({ id: 'focus-chat', label: t('keybinds.core.focusChat.label'), description: t('keybinds.core.focusChat.description'), defaultKey: 'Shift+C', category: coreCategory, onPress: () => this.handleFocusChat() });
    reg({ id: 'zoom-in', label: t('keybinds.core.zoomIn.label'), description: t('keybinds.core.zoomIn.description'), defaultKey: 'PageUp', category: coreCategory, onPress: () => this.canvasManager?.adjustZoom(0.2) });
    reg({ id: 'zoom-out', label: t('keybinds.core.zoomOut.label'), description: t('keybinds.core.zoomOut.description'), defaultKey: 'PageDown', category: coreCategory, onPress: () => this.canvasManager?.adjustZoom(-0.2) });
    reg({ id: 'pan-up', label: t('keybinds.core.panUp.label'), description: t('keybinds.core.panUp.description'), defaultKey: 'Ctrl+ArrowUp', category: coreCategory, onPress: () => this.canvasManager?.panBy(0, 50) });
    reg({ id: 'pan-down', label: t('keybinds.core.panDown.label'), description: t('keybinds.core.panDown.description'), defaultKey: 'Ctrl+ArrowDown', category: coreCategory, onPress: () => this.canvasManager?.panBy(0, -50) });
    reg({ id: 'pan-left', label: t('keybinds.core.panLeft.label'), description: t('keybinds.core.panLeft.description'), defaultKey: 'Ctrl+ArrowLeft', category: coreCategory, onPress: () => this.canvasManager?.panBy(50, 0) });
    reg({ id: 'pan-right', label: t('keybinds.core.panRight.label'), description: t('keybinds.core.panRight.description'), defaultKey: 'Ctrl+ArrowRight', category: coreCategory, onPress: () => this.canvasManager?.panBy(-50, 0) });
    reg({ id: 'move-up', label: t('keybinds.core.moveUp.label'), description: t('keybinds.core.moveUp.description'), defaultKey: 'ArrowUp', category: coreCategory, onPress: () => void this.handleMoveTokens(0, -1) });
    reg({ id: 'move-down', label: t('keybinds.core.moveDown.label'), description: t('keybinds.core.moveDown.description'), defaultKey: 'ArrowDown', category: coreCategory, onPress: () => void this.handleMoveTokens(0, 1) });
    reg({ id: 'move-left', label: t('keybinds.core.moveLeft.label'), description: t('keybinds.core.moveLeft.description'), defaultKey: 'ArrowLeft', category: coreCategory, onPress: () => void this.handleMoveTokens(-1, 0) });
    reg({ id: 'move-right', label: t('keybinds.core.moveRight.label'), description: t('keybinds.core.moveRight.description'), defaultKey: 'ArrowRight', category: coreCategory, onPress: () => void this.handleMoveTokens(1, 0) });
    reg({ id: 'rotate-cw', label: t('keybinds.core.rotateCw.label'), description: t('keybinds.core.rotateCw.description'), defaultKey: 'E', category: coreCategory, onPress: () => void this.handleRotateToken(45) });
    reg({ id: 'rotate-ccw', label: t('keybinds.core.rotateCcw.label'), description: t('keybinds.core.rotateCcw.description'), defaultKey: 'Q', category: coreCategory, onPress: () => void this.handleRotateToken(-45) });
    reg({ id: 'toggle-pause', label: t('keybinds.core.togglePause.label'), description: t('keybinds.core.togglePause.description'), defaultKey: 'Space', category: coreCategory, onPress: () => void this.handleTogglePause() });
    reg({ id: 'undo', label: t('keybinds.core.undo.label'), description: t('keybinds.core.undo.description'), defaultKey: 'Ctrl+Z', category: coreCategory, onPress: () => void this.handleUndo() });
    reg({ id: 'redo', label: t('keybinds.core.redo.label'), description: t('keybinds.core.redo.description'), defaultKey: 'Ctrl+Shift+Z', category: coreCategory, onPress: () => void this.handleRedo() });
    reg({ id: 'copy', label: t('keybinds.core.copy.label'), description: t('keybinds.core.copy.description'), defaultKey: 'Ctrl+C', category: coreCategory, onPress: () => void this.handleCopySelection() });
    reg({ id: 'cut', label: t('keybinds.core.cut.label'), description: t('keybinds.core.cut.description'), defaultKey: 'Ctrl+X', category: coreCategory, onPress: () => void this.handleCutSelection() });
    reg({ id: 'paste', label: t('keybinds.core.paste.label'), description: t('keybinds.core.paste.description'), defaultKey: 'Ctrl+V', category: coreCategory, onPress: () => void this.handlePasteFromClipboard() });
  }

  private hasCanvasSelection(): boolean {
    if (!this.canvasManager) return false;
    return this.canvasManager.getSelectedTokenIds().size > 0
      || !!this.canvasManager.getSelectedDrawingId()
      || !!this.canvasManager.getSelectedTileId()
      || !!this.canvasManager.getSelectedLightId();
  }

  private async handleCopySelection(): Promise<void> {
    const entries: ClipboardEntry[] = [];

    const tokenIds = this.canvasManager?.getSelectedTokenIds();
    if (tokenIds) {
      for (const id of tokenIds) {
        const member = this.initState.cast.find((c) => c.id === id);
        if (member) {
          const { id: _omit, ...data } = member as any;
          entries.push({ kind: 'cast', data });
        }
      }
    }

    const tileId = this.canvasManager?.getSelectedTileId();
    if (tileId) {
      const tile = await api.get<any>(`/tiles/${tileId}`).catch(() => null);
      if (tile) {
        const { id: _omit, ...data } = tile;
        entries.push({ kind: 'tile', data });
      }
    }

    const drawingId = this.canvasManager?.getSelectedDrawingId();
    if (drawingId) {
      const drawing = await api.get<any>(`/drawings/${drawingId}`).catch(() => null);
      if (drawing) {
        const { id: _omit, ...data } = drawing;
        entries.push({ kind: 'drawing', data });
      }
    }

    const lightId = this.canvasManager?.getSelectedLightId();
    if (lightId) {
      const light = this.canvasManager?.getLightById(lightId);
      if (light) {
        const { id: _omit, ...data } = light as any;
        entries.push({ kind: 'light', data });
      }
    }

    if (entries.length > 0) {
      canvasClipboard.set(entries);
      showToast(`${entries.length} objeto(s) copiado(s)`, 'success');
    }
  }

  private async handleCutSelection(): Promise<void> {
    await this.handleCopySelection();
    if (canvasClipboard.hasItems) {
      await this.handleDeleteSelected();
    }
  }

  private async handlePasteFromClipboard(): Promise<void> {
    const entries = canvasClipboard.get();
    if (entries.length === 0) return;
    const stageId = this.initState.activeStage?.id;
    if (!stageId) return;

    const gridSize = (this.initState.activeStage as any)?.gridSize ?? 50;
    const commands: Command[] = [];

    for (const entry of entries) {
      const offsetData = { ...entry.data, x: (entry.data.x ?? 0) + gridSize, y: (entry.data.y ?? 0) + gridSize };

      try {
        if (entry.kind === 'cast') {
          const payload = { ...offsetData, stageId, worldId: this.props.worldId };
          const created = await api.post<{ id: string }>('/cast', payload);
          let currentId = created.id;
          commands.push({
            label: 'Colar token',
            undo: async () => { await api.delete(`/cast/${currentId}`); },
            redo: async () => { const r = await api.post<{ id: string }>('/cast', payload); currentId = r.id; },
          });
        } else if (entry.kind === 'tile') {
          const payload = { ...offsetData, stageId };
          const created = await api.post<{ id: string }>('/tiles', payload);
          let currentId = created.id;
          commands.push({
            label: 'Colar tile',
            undo: async () => { await api.delete(`/tiles/${currentId}`); },
            redo: async () => { const r = await api.post<{ id: string }>('/tiles', payload); currentId = r.id; },
          });
        } else if (entry.kind === 'drawing') {
          const payload = { ...offsetData, stageId };
          const created = await api.post<{ id: string }>('/drawings', payload);
          let currentId = created.id;
          commands.push({
            label: 'Colar desenho',
            undo: async () => { await api.delete(`/drawings/${currentId}`); },
            redo: async () => { const r = await api.post<{ id: string }>('/drawings', payload); currentId = r.id; },
          });
        } else if (entry.kind === 'light') {
          const payload = offsetData;
          const created = await api.post<{ id: string }>(`/stages/${stageId}/lights`, payload);
          let currentId = created.id;
          commands.push({
            label: 'Colar luz',
            undo: async () => { await api.delete(`/stages/${stageId}/lights/${currentId}`); },
            redo: async () => { const r = await api.post<{ id: string }>(`/stages/${stageId}/lights`, payload); currentId = r.id; },
          });
        }
      } catch (e) {
        clog.error(`Falha ao colar ${entry.kind}`, e);
      }
    }

    if (commands.length > 0) {
      this.commandStack.push(compositeCommand('Colar', commands));
      showToast(`${commands.length} objeto(s) colado(s)`, 'success');
    }
  }

  private async handleUndo(): Promise<void> {
    try {
      const did = await this.commandStack.undo();
      if (did) showToast('Ação desfeita', 'success');
    } catch (err: any) {
      showToast('Não foi possível desfazer (objeto alterado por outro usuário)', 'error');
    }
  }

  private async handleRedo(): Promise<void> {
    try {
      const did = await this.commandStack.redo();
      if (did) showToast('Ação refeita', 'success');
    } catch (err: any) {
      showToast('Não foi possível refazer (objeto alterado por outro usuário)', 'error');
    }
  }

  private showPauseBanner(): void {
    const overlay = this.container.querySelector('#hud-pause-overlay') as HTMLElement;
    if (!overlay) return;
    overlay.style.display = '';
    const isGM = (this.props.session.userRole ?? 1) >= 4;
    overlay.style.pointerEvents = isGM ? 'none' : 'auto';
    applyUiOverride('pause', overlay, { options: { isGM } });
  }

  private hidePauseBanner(): void {
    const overlay = this.container.querySelector('#hud-pause-overlay') as HTMLElement;
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  /** Space: only GM can pause/resume. If not GM, ignore silently. */
  private async handleTogglePause(): Promise<void> {
    if ((this.props.session.userRole ?? 1) < 4) return;
    const worldId = this.props.worldId;
    try {
      if (this.isPaused) {
        await api.post(`/worlds/${worldId}/resume`);
        this.isPaused = false;
        this.hidePauseBanner();
      } else {
        await api.post(`/worlds/${worldId}/pause`);
        this.isPaused = true;
        this.showPauseBanner();
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alternar pausa', 'error');
    }
  }

  private handleCancelOrClose(): void {
    if (this.canvasManager?.isDrawingActive) {
      this.canvasManager.cancelDrawing();
    } else {
      windowManager.closeTopmost();
    }
  }

  private handleFocusChat(): void {
    const input = document.querySelector<HTMLTextAreaElement>('[name="chat-input"]');
    if (input) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }

  /**
   * Move tokens by grid cells. Applies to ALL selected tokens
   * (moves multiples together, doesn't ignore).
   *
   * Usa o MESMO caminho do arrasto com mouse: mexe a sprite pelo canvasManager,
   * que dispara `onMove` -> `wsClient.send('token.move')` (ver initializeCanvas).
   *
   * Antes a seta persistia por `PUT /api/cast/:id` (REST) e o mouse por WS —
   * dois canais e duas fontes de verdade pro mesmo dado:
   *   - a seta lia a posicao base de `initState.cast`, que so' atualiza quando o
   *     eco WS volta, entao mover com o mouse e depois com a seta partia da
   *     posicao ANTIGA e o token "voltava pro lugar" (nos dois sentidos);
   *   - so' o caminho REST passa pelo mutation-loop-guard (3 req/1000ms), entao
   *     so' a seta estourava 429, e request bloqueada nao atualiza estado
   *     nenhum — desalinhando cliente e servidor de vez.
   * Passando pelo canvas, a base e' sempre a posicao real da sprite e nao
   * precisa de throttle nenhum (o WS nao tem rate guard).
   */
  private handleMoveTokens(gridDx: number, gridDy: number): void {
    const cm = this.canvasManager;
    if (!cm) return;
    const selectedIds = cm.getSelectedTokenIds();
    if (selectedIds.size === 0) return;
    const gridSize = cm.getGridSize();
    for (const id of selectedIds) {
      // moveTokenBy ja' checa parede, prende o token dentro da cena e dispara
      // onMove (que persiste no WS, comita a fog e empilha o undo) — o mesmo
      // que o fim de arrasto faz.
      cm.moveTokenBy(id, gridDx * gridSize, gridDy * gridSize);
    }
  }

  /**
   * Rotates selected token(s) by degrees. Applies to ALL selected tokens.
   * Rotation already exists in the cast schema (rotation: NumberField).
   */
  private async handleRotateToken(degrees: number): Promise<void> {
    const cm = this.canvasManager;
    if (!cm) return;
    const selectedIds = cm.getSelectedTokenIds();
    if (selectedIds.size === 0) return;
    const promises: Promise<void>[] = [];
    for (const id of selectedIds) {
      const member = this.initState.cast.find(c => c.id === id);
      if (!member) continue;
      const newRotation = ((member.rotation ?? 0) + degrees) % 360;
      promises.push(
        (async () => {
          try {
            const updated = await api.put(`/cast/${id}`, { rotation: newRotation });
            this.upsertCastMember(updated);
          } catch (err: any) {
            showToast(err?.message || 'Erro ao girar token', 'error');
          }
        })(),
      );
    }
    await Promise.all(promises);
  }

  /** Handler: target-token */
  private async handleTargetToken(): Promise<void> {
    const hoveredId = this.canvasManager?.getHoveredTokenId();
    const selectedIds = this.canvasManager?.getSelectedTokenIds();
    const targetTokenIds = hoveredId ? [hoveredId] : Array.from(selectedIds ?? []);
    if (targetTokenIds.length === 0) return;
    const userId = this.props.session.userId || 'unknown';
    for (const tokenId of targetTokenIds) {
      const member = this.initState.cast.find((c) => c.id === tokenId);
      if (!member) continue;
      const targetedBy: string[] = Array.isArray(member.targetedBy) ? member.targetedBy : [];
      const next = targetedBy.includes(userId)
        ? targetedBy.filter((u: string) => u !== userId)
        : [...targetedBy, userId];
      try {
        const updated = await api.put(`/cast/${tokenId}/target`, { targetedBy: next });
        const parsed = this.parseCastMember(updated);
        this.canvasManager?.updateToken(parsed, true);
        this.upsertCastMember(parsed);
      } catch (err: any) {
        showToast(err?.message || 'Erro ao marcar alvo', 'error');
      }
    }
  }

  private async deleteToken(id: string, name: string): Promise<void> {
    const confirmed = await showConfirm('Excluir Token', `Remover o token "${name}" da cena?`);
    if (!confirmed) return;
    try {
      await api.delete(`/cast/${id}`);
      showToast('Token removido', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover token', 'error');
    }
  }

  private async exitWorld(): Promise<void> {
    this.destroy();
    try {
      const verify = await api.get<{ valid: boolean; admin: boolean }>(API_PATHS.SETUP_VERIFY);
      if (verify.valid && verify.admin) {
        setTimeout(() => window.location.reload(), 200);
        return;
      }
    } catch {
      // fall through to admin-login
    }
    setTimeout(() => window.location.reload(), 200);
  }

  /**
   * GM's local view of a scene (not active for anyone else). Extracted from
   * `preview-stage` listener so that `switch-level` can wait for this
   * promise to truly finish, instead of a guessed `setTimeout` that raced
   * against the loading and sometimes overwrote with the wrong image.
   */
  private async previewStage(stageId: string): Promise<void> {
    const stageData = this.initState.stages.find(s => s.id === stageId);
    if (!stageData) return;

    try {
      // Fetch full stage details from API (walls, dimensions, etc.)
      const fullStage = await api.get<any>(`/stages/${stageId}`);
      this.initState.activeStage = fullStage;

      const hasCustomTransition = !!fullStage.transitionType && fullStage.transitionType !== 'none';
      if (!hasCustomTransition) this.loadingProgress.show('Carregando Cena', stageData.name || 'Visualizando Cena');

      await this.canvasManager?.runStageTransition(fullStage, async () => {
        await this.canvasManager?.applyStage(fullStage, false, true);
        this.syncTileTriggers();
        this.canvasManager?.setDarkness(fullStage.darknessLevel ?? 0);
        soundManager.setDarkness(fullStage.darknessLevel ?? 0);

        const isGM = (this.props.session.userRole ?? 1) >= 4;
        this.canvasManager?.setGM(isGM);

        // Update stage indicators locally — only top-nav reflects "what the GM is seeing right now";
        // sidebar MUST NOT mark isActive here, that's reserved for real activation (all players).
        this.subcomponents.stageNav?.setStages(this.initState.stages, stageId);

        // Clean and place only tokens that belong to this previewed stage
        this.canvasManager?.clearTokens();
        for (const member of this.initState.cast) {
          if (member.stageId === stageId) this.canvasManager?.updateToken(member);
        }
        this.updateControlledTokens();

        await this.loadStageAssetsWithProgress(stageId, fullStage.darknessLevel);
        showToast(`Visualizando "${stageData.name}" (GM local)`, 'info');
      });
    } catch (err) {
      clog.error('Falha ao carregar preview de cena', err);
    } finally {
      this.loadingProgress.hide();
    }
  }

  /** Loads walls/drawings/lights/notes/sounds/tiles of a stage, advancing the loading bar as each step completes */
  private async loadStageAssetsWithProgress(
    stageId: string,
    darknessLevel: number | undefined,
  ): Promise<void> {
    const steps: { label: string; run: () => Promise<void> }[] = [
      { label: 'Paredes', run: () => this.loadStageWallsAndFOV(stageId, darknessLevel) },
      { label: 'Desenhos', run: () => this.loadDrawingsForStage(stageId) },
      { label: 'Iluminação', run: () => this.loadStageLights(stageId) },
      { label: 'Notas', run: () => this.loadStageNotes(stageId) },
      { label: 'Templates', run: () => this.loadStageTemplates(stageId) },
      { label: 'Sons', run: () => this.loadStageNoises(stageId) },
      { label: 'Tiles', run: () => this.loadStageTiles(stageId) },
    ];
    let done = 0;
    this.loadingProgress.update(steps[0].label, 0, steps.length);
    await Promise.all(
      steps.map((step) =>
        step.run().finally(() => {
          done++;
          this.loadingProgress.update(step.label, done, steps.length);
        }),
      ),
    );
  }

  /** Indexes the world's compendiums on boot. */
  private async logCompendiumIndex(): Promise<void> {
    try {
      const packs = await api.get<{ id: string; name: string; type: string; entryCount: number }[]>(
        `/compendium?worldId=${this.props.worldId}`,
      );
      if (!packs.length) {
        clog.info('[COMPENDIUM] Nenhum compêndio neste mundo');
        return;
      }
      for (const pack of packs) {
        clog.success(`[COMPENDIUM] Índice de "${pack.name}" (${pack.type}) construído — ${pack.entryCount} entrada(s)`);
      }
    } catch (err) {
      clog.error(`[COMPENDIUM] Falha ao indexar compêndios do mundo: ${err instanceof Error ? (err.stack || err.message) : String(err)}`);
    }
  }

  private showTileColorPalette(): void {
    showToast('Paleta de cores para Tiles (Em breve)', 'info');
  }

  private openTileBrowser(): void {
    const activeStage = this.initState.activeStage;
    if (!activeStage) return;
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: async (path: string) => {
        try {
          const created = await api.post<any>('/tiles', {
            levelId: this.activeLevelId,
            stageId: activeStage.id,
            name: 'Novo Tile',
            x: 400,
            y: 400,
            imgUrl: path,
          });
          showToast('Tile colocado no mapa', 'success');
          if (this.canvasManager) {
            this.canvasManager.selectTile(created.id);
          }
        } catch (err: any) {
          showToast(err?.message || 'Erro ao colocar tile', 'error');
        }
      },
      worldId: this.props.worldId,
    });
  }

  destroy(): void {
    this.playersListResizeObserver?.disconnect();
    this.canvasManager?.destroy();
    this.tourManager?.destroy();
    this.unsubscribeInit?.();
    if (this.unsubscribeStageUpdated) this.unsubscribeStageUpdated();
    if (this.unsubscribeStageCreated) this.unsubscribeStageCreated();
    if (this.unsubscribeStageDeleted) this.unsubscribeStageDeleted();
    this.unsubscribeStageActivated?.();
    if (this.unsubscribeCastCreated) this.unsubscribeCastCreated();
    this.unsubscribeCastDeleted?.();
    this.unsubscribeDrawingCreated?.();
    this.unsubscribeDrawingUpdated?.();
    this.unsubscribeDrawingDeleted?.();
    this.unsubscribeDrawingCleared?.();
    this.unsubscribeTemplateCreated?.();
    this.unsubscribeTemplateUpdated?.();
    this.unsubscribeTemplateDeleted?.();
    this.unsubscribeWallCreated?.();
    this.unsubscribeWallUpdated?.();
    this.unsubscribeWallDeleted?.();
    this.unsubscribeDoorState?.();
    this.unsubscribeWorldPaused?.();
    this.unsubscribeWorldResumed?.();
    this.unsubscribeNoiseCreated?.();
    this.unsubscribeNoiseUpdated?.();
    this.unsubscribeNoiseDeleted?.();
    this.unsubscribeLightCreated?.();
    this.unsubscribeLightUpdated?.();
    this.unsubscribeLightDeleted?.();
    this.unsubscribeCanvasPing?.();
    this.unsubscribeTileCreated?.();
    this.unsubscribeTileUpdated?.();
    this.unsubscribeTileDeleted?.();
    this.unsubscribeItemCreated?.();
    this.unsubscribeItemUpdated?.();
    this.unsubscribeItemDeleted?.();
    this.unsubscribeTimeUpdated?.();
    this.unsubscribeTokenTarget?.();
    wsClient.disconnect?.();
    this.subcomponents.stageNav?.destroy();
    this.subcomponents.toolbox?.destroy();
    this.subcomponents.sidebar?.destroy();
    this.subcomponents.macroHotbar?.destroy();
    this.subcomponents.playersList?.destroy();
    this.container.ownerDocument.removeEventListener('keydown', this.handleKeyDown);
    this.container.innerHTML = '';
    gameContext.clear();
    actorsCollection.clear();
    scenesCollection.clear();
    itemsCollection.clear();
    modulesCollection.clear();
    usersCollection.clear();
    messagesCollection.clear();
    macrosCollection.clear();
    packsCollection.clear();
  }
}
