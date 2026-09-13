import { Application, Container, Graphics, Sprite, Texture, Assets, FederatedPointerEvent, Text, Circle, Rectangle, BlurFilter } from 'pixi.js';
import { FogLayer } from './fog-layer.js';
import { DEFAULT_PORTRAIT_URL } from '../lib/default-portrait.js';
import { statusEffectRegistry } from '../core/status-effect-registry.js';
import type { WallSegment } from './fov-engine.js';
import { computeFOV, raySegmentIntersection } from './fov-engine.js';
import { DrawingConfigWindow } from '../windows/drawing-config-window.js';
import { TileConfigWindow } from '../windows/tile-config-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { createWrappable } from '../core/wrappable.js';
import type { Wrappable } from '../core/wrappable.js';
import { gameContext } from '../core/game-context.js';
import { wsClient } from '../core/ws-client.js';
import { actorsCollection } from '../core/actors-collection.js';
import { throttle } from '../core/utils.js';
import { transitionEffectRegistry } from './transition-effect-registry.js';

// `feDisplacementMap[scale]` (filtro SVG oculto em game-hud.ts) não é propriedade CSS —
// Web Animations API não anima atributo de elemento SVG, por isso rAF manual em vez de
// `.animate()`. Pico de distorção no meio da revelação, zero nas pontas (seno). Registrado
// no transitionEffectRegistry pelo nome ('swirl-displacement') em vez de hardcoded no
// runTransitionAnimated — um addon podia registrar seu próprio animador do mesmo jeito.
transitionEffectRegistry.registerAnimator('swirl-displacement', (duration) => {
  const displace = document.getElementById('stage-swirl-displace');
  if (!displace) return Promise.resolve();
  const maxScale = 80;
  const start = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      displace.setAttribute('scale', String(maxScale * Math.sin(t * Math.PI)));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        displace.setAttribute('scale', '0');
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
});

/** Alcance de visao "ilimitado" — cobre qualquer cena. */
const MAX_SIGHT = 100000;

export interface CanvasLayers {
  background: Container;
  tile: Container;
  wall: Container;
  drawings: Container;
  cast: Container;
  fog: Container;
  lighting: Container;
  weather: Container;
  overhead: Container;
  effects: Container;
  interface: Container;
}

export interface DrawingData {
  id?: string;
  stageId?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  z?: number;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  rotation?: number;
  levelId?: string;
  points?: { x: number; y: number }[] | string;
}

export type DrawingCreateCallback = (data: DrawingData) => void;

export interface TemplateData {
  id?: string;
  stageId?: string;
  userId?: string;
  type: 'cone' | 'rect' | 'circle' | 'ray';
  x: number;
  y: number;
  rotation?: number;
  radius?: number;
  width?: number;
  height?: number;
  angle?: number;
  distance?: number;
  fillColor?: string;
  strokeColor?: string;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
  config?: any;
  levelId?: string;
}

export type TemplateCreateCallback = (data: TemplateData) => void;

const DRAWING_TOOLS = ['draw-freehand', 'draw-rectangle', 'draw-circle', 'draw-line', 'draw-polygon', 'draw-text', 'template-cone', 'template-rect'];

export interface TileData {
  id: string;
  stageId: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imgUrl: string;
  isActive?: boolean;
  isOverhead?: boolean;
  isRoof?: boolean;
  rotation?: number;
  tintColor?: string;
  opacity?: number;
  locked?: boolean;
  videoLoop?: boolean;
  videoAutoplay?: boolean;
  videoVolume?: number;
  recipeId?: string;
  occlusion?: { mode: string; radius: number; alpha: number };
  floors?: string[];
  anchorX?: number;
  anchorY?: number;
  triggers?: any[];
  conditions?: any[];
  actions?: any[];
  hidden?: boolean;
  elevation?: number;
}

export interface StageData {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize?: number;
  levels?: any[];
  backgroundUrl?: string;
  bgUrl?: string;
  backgroundColor?: string;
  gridColor?: string;
  gridType?: 'square' | 'hex' | 'gridless';
  bottomElevation?: number;
  topElevation?: number;
  weatherEffect?: string;
  darknessLevel?: number;
  gridDistance?: number;
  gridUnit?: string;
  gridOpacity?: number;
  transitionType?: string;
  transitionDuration?: number;
}

export interface AmbientLightData {
  id: string;
  stageId: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  rotation?: number;
  bright?: number;
  dim?: number;
  angle?: number;
  walls?: boolean;
  levelId?: string;
  vision?: boolean;
  animationSpeed?: number;
  animationIntensity?: number;
  animation?: string;
  isHidden?: boolean;
}

export interface NoteData {
  id: string;
  stageId: string;
  journalId?: string;
  targetStageId?: string;
  x: number;
  y: number;
  visibleToPlayers?: boolean;
  isHidden?: boolean;
  levelId?: string;
}

interface WeatherParticle {
  g: Graphics | Sprite;
  vx: number;
  vy: number;
}

const FOG_TEXTURES = Array.from({ length: 10 }, (_, i) => `/weather/smoke_${String(i + 1).padStart(2, '0')}.png`);
const FLASH_TEXTURE = '/weather/light_01.png';
/** Pinguelas de luz alongadas usadas como gota de chuva/tempestade (em vez de linha vetorial crua). */
const RAIN_TEXTURES = Array.from({ length: 7 }, (_, i) => `/weather/trace_${String(i + 1).padStart(2, '0')}.png`);
/** Glow radial suave usado como floco de neve (em vez de círculo vetorial cru). */
const SNOW_TEXTURES = Array.from({ length: 5 }, (_, i) => `/weather/circle_${String(i + 1).padStart(2, '0')}.png`);

export interface CastMemberData {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  avatarUrl?: string;
  colorHex?: string;
  ringUrl?: string;
  ringEffect?: string;
  ringScale?: number;
  shape?: string;
  statusMarkers?: string[];
  targetedBy?: string[];
  hidden?: boolean;
  movementAction?: string;
  ownership?: Record<string, number>;
  actorId?: string;
  isLinked?: boolean;
  stageId?: string;
  elevation?: number;
  sightEnabled?: boolean;
  sightRange?: number;
  sightAngle?: number;
  sightMode?: string;
  lightDimRange?: number;
  lightBrightRange?: number;
  lightColor?: string;
  systemData?: Record<string, any>;
  bar1?: { attribute: string; color?: string };
  bar2?: { attribute: string; color?: string };
  displayBars?: number;
  /** Timestamp (server) de quando o move foi recebido — usado só pra descartar ecos fora de ordem. */
  movedAt?: number;
}

export interface NoiseData {
  id: string;
  stageId: string;
  src: string;
  x: number;
  y: number;
  radius: number;
  volume: number;
  easing?: boolean;
  hidden?: boolean;
  levelId?: string;
}

export type MoveCallback = (id: string, x: number, y: number) => void;
export type TileClickCallback = (id: string, event: FederatedPointerEvent) => void;

function getHealthColor(pct: number): number {
  const p = Math.max(0, Math.min(1, pct));
  let r: number, g: number, b: number;
  if (p > 0.5) {
    const t = (p - 0.5) * 2;
    r = Math.round(241 + (46 - 241) * t);
    g = Math.round(196 + (204 - 196) * t);
    b = Math.round(15 + (113 - 15) * t);
  } else {
    const t = p * 2;
    r = Math.round(231 + (241 - 231) * t);
    g = Math.round(76 + (196 - 76) * t);
    b = Math.round(60 + (15 - 60) * t);
  }
  return (r << 16) | (g << 8) | b;
}

const HP_RESOURCE_ALIASES = ['resources.health', 'attributes.hp', 'hp', 'health', 'attributes.health', 'attributes.hitPoints'];
const MANA_RESOURCE_ALIASES = ['resources.mana', 'attributes.mana', 'mana', 'attributes.mp', 'mp', 'resources.magic'];

function extractAttrFromObject(obj: any, path: string): { value: number; max: number } | null {
  if (!obj || !path) return null;
  const clean = path.replace(/^system\./, '');
  const parts = clean.split('.');
  let curr: any = obj;
  for (const p of parts) {
    if (curr == null) return null;
    curr = curr[p];
  }
  if (curr == null) return null;
  if (typeof curr === 'number') {
    return { value: curr, max: curr };
  }
  if (typeof curr === 'object') {
    const val = typeof curr.value === 'number' ? curr.value : (typeof curr.current === 'number' ? curr.current : null);
    if (val !== null) {
      const max = typeof curr.max === 'number' ? curr.max : val;
      return { value: val, max };
    }
  }
  return null;
}

function resolveTokenAttribute(data: CastMemberData, attrPath: string): { value: number; max: number } | null {
  if (!attrPath) return null;
  const actor = data.actorId ? (actorsCollection.get ? (actorsCollection.get(data.actorId) as any) : null) : null;
  const sys = actor?.system || actor?.systemData || data.systemData || {};

  const cleanPath = attrPath.replace(/^system\./, '');

  // 1. Direct lookup in sys, actor or token data
  let res = extractAttrFromObject(sys, cleanPath);
  if (res) return res;
  if (actor) {
    res = extractAttrFromObject(actor, cleanPath);
    if (res) return res;
  }
  if (data.systemData) {
    res = extractAttrFromObject(data.systemData, cleanPath);
    if (res) return res;
  }

  // 2. Alias fallback (e.g. attributes.hp <-> resources.health)
  let aliases: string[] = [];
  if (HP_RESOURCE_ALIASES.includes(cleanPath)) {
    aliases = HP_RESOURCE_ALIASES.filter((a) => a !== cleanPath);
  } else if (MANA_RESOURCE_ALIASES.includes(cleanPath)) {
    aliases = MANA_RESOURCE_ALIASES.filter((a) => a !== cleanPath);
  }

  for (const alias of aliases) {
    res = extractAttrFromObject(sys, alias);
    if (res) return res;
    if (actor) {
      res = extractAttrFromObject(actor, alias);
      if (res) return res;
    }
    if (data.systemData) {
      res = extractAttrFromObject(data.systemData, alias);
      if (res) return res;
    }
  }

  return null;
}

const DEFAULT_GRID_SIZE = 50;
const DEFAULT_GRID_COLOR = '#ffffff';
const DEFAULT_SCENE_WIDTH = 3000;
const DEFAULT_SCENE_HEIGHT = 2000;
export const TOKEN_RADIUS = 24;

export function getDefaultRingScale(ringUrl?: string): number {
  if (!ringUrl || ringUrl === 'none') return 1.0;
  if (ringUrl.includes('ring-02')) return 1.50;
  if (ringUrl.includes('ring-04')) return 1.68;
  if (ringUrl.includes('ring-05')) return 1.54;
  if (ringUrl.includes('ring-06')) return 1.62;
  return 1.60;
}

export class CanvasManager {
  static activeInstance: CanvasManager | null = null;

  constructor() {
    CanvasManager.activeInstance = this;
  }

  private app!: Application;
  layers!: CanvasLayers;

  private bgSprite!: Sprite;
  private gridGraphics!: Graphics;
  private tokens: Map<string, Container> = new Map();
  private tokenData: Map<string, CastMemberData> = new Map();

  private currentStageId: string | null = null;
  /** Cursor de outros jogadores na mesma stage — bolinha da cor
   * do usuário seguindo a posição real do mouse dele. Nunca inclui o próprio
   * usuário (servidor exclui o remetente do broadcast). Some sozinho se parar
   * de receber update (usuário saiu da stage/desconectou sem avisar). */
  private remoteCursors: Map<string, { container: Container; dot: Graphics; label: Text; lastSeen: number }> = new Map();
  private unsubCursor: (() => void) | null = null;
  public currentLevelBounds: { top: number; bottom: number } | null = null;
  public currentLevelId: string = '';
  public levels: any[] = [];

  private gridSize = DEFAULT_GRID_SIZE;
  private gridColor = DEFAULT_GRID_COLOR;
  private gridOpacity = 0.4;
  private gridType: 'square' | 'hex' | 'gridless' = 'square';
  private sceneWidth = DEFAULT_SCENE_WIDTH;
  private sceneHeight = DEFAULT_SCENE_HEIGHT;

  private weatherType = 'none';
  private weatherParticles: WeatherParticle[] = [];
  private weatherAnimId: number | null = null;
  private weatherFlashTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private weatherFlashGraphic: Graphics | null = null;
  private weatherGeneration = 0;
  private destroyed = false;

  private lightsContainer!: Container;
  private lightHandlesContainer!: Container;
  private lightGroups: Map<string, Container> = new Map();
  private allLights: AmbientLightData[] = [];

  private notesContainer!: Container;
  private noteGroups: Map<string, Container> = new Map();
  private allNotes: NoteData[] = [];

  private soundsContainer!: Container;
  private soundGroups: Map<string, Container> = new Map();
  private allNoises: NoiseData[] = [];

  private moveCallbacks: Set<MoveCallback> = new Set();

  /**
   * Notifica todos os observadores de movimento.
   *
   * Continua sendo chamado como `this.onMove?.(id, x, y)` nos pontos de arrasto
   * — a assinatura nao mudou, so deixou de ser um slot unico.
   */
  private onMove(id: string, x: number, y: number): void {
    for (const cb of this.moveCallbacks) {
      try {
        cb(id, x, y);
      } catch (e) {
        console.error('onMove subscriber failed:', e);
      }
    }
  }

  private draggedTokenId: string | null = null;
  private tokenLastMovedAt: Map<string, number> = new Map();
  private onNoteClick: ((note: NoteData) => void) | null = null;
  private onTemplateCreate: TemplateCreateCallback | null = null;
  private onNoteCreate: ((position: { x: number; y: number; levelId?: string }) => void) | null = null;
  private onTokenClick: ((castMember: any) => void) | null = null;
  private onTokenContextMenu: ((castMember: any, event: FederatedPointerEvent) => void) | null = null;
  private initState: { cast: any[] } = { cast: [] };
  private isGM = false;
  private userId: string = '';
  private combatantIds: Set<string> = new Set();

  private leftClickDeselect = localStorage.getItem('loom_left_click_deselect') !== 'false';

  /** FOV / Fog of War */
  private fogLayer!: FogLayer;
  private walls: WallSegment[] = [];
  private fovEnabled = false;
  private fovSightRange = 2000;
  private fovDirty = false;
  private controlledTokenIds: Set<string> = new Set();
  /** Preview de visão do GM: quando o GM seleciona um token, o fog mostra só a visão dele. */
  private gmVisionPreview = false;
  private gmVisionPreviewIds: Set<string> = new Set();
  /** Posição override do token durante arraste — usada só pro FOV, sem mover o visual. */
  private fovDragPositions: Map<string, { x: number; y: number }> | null = null;

  /** Resolve as origens de visão dos tokens controlados — ponto de wrap para addons. */
  resolveFOVOrigins: Wrappable<() => { x: number; y: number; range: number; angle?: number; facing?: number; mode?: 'basic' | 'darkvision' | 'monochrome' | 'blindness' | 'tremorsense' | 'lightAmplification' }[]> = createWrappable(() => {
    const origins: { x: number; y: number; range: number; angle?: number; facing?: number; mode?: 'basic' | 'darkvision' | 'monochrome' | 'blindness' | 'tremorsense' | 'lightAmplification' }[] = [];
    const ids = this.gmVisionPreview ? Array.from(this.gmVisionPreviewIds) : Array.from(this.controlledTokenIds);
    for (const id of ids) {
      const token = this.tokens.get(id);
      if (!token) continue;
      const data = this.tokenData.get(id);
      // Token com visão desabilitada não gera origem de FOV
      if (data && data.sightEnabled === false) continue;
      const pos = this.fovDragPositions?.get(id) ?? { x: token.x, y: token.y };
      // `sightRange` e gravado em PES (ft).
      // O motor de FOV trabalha em pixels, entao converte pela escala da cena:
      //   px = ft * (gridSize / gridDistance)
      //
      // 0 NAO e ilimitado: e "nao enxerga nada sem luz". Com 0 o token
      // so ve onde a luz bate. Tratar 0 como ilimitado fazia ele enxergar toda
      // a linha de visao mesmo no escuro, e a escuridao virava decoracao.
      const ftToPx = (this.gridSize || 50) / (this.gridDistance || 5);
      const rawFt = data?.sightRange;
      const range = (typeof rawFt === 'number')
        ? rawFt * ftToPx
        : this.fovSightRange;
      origins.push({
        x: pos.x,
        y: pos.y,
        range,
        angle: data?.sightAngle ?? 360,
        facing: data?.rotation ?? 0,
        mode: (data as { sightMode?: string })?.sightMode as 'basic' | 'darkvision' | 'monochrome' | 'blindness' | 'tremorsense' | 'lightAmplification' | undefined,
      });
    }
    return origins;
  });

  /**
   * Resolve as origens de luz emitida pelo PRÓPRIO token (lightDimRange/lightBrightRange
   * do Cast — `token-config-window.ts`) — TODO token na cena atual, não só os controlados
   * (luz ilumina pra qualquer jogador, igual luz de cena). Mesmo `fovDragPositions` do FOV:
   * sem isso a luz ficava presa na posição salva no servidor enquanto o token já tinha sido
   * arrastado visualmente, dando a impressão de "luz não acompanha o personagem".
   */
  private resolveTokenLightOrigins(): { x: number; y: number; range: number; walls?: boolean }[] {
    const origins: { x: number; y: number; range: number; walls?: boolean }[] = [];
    const ftToPx = (this.gridSize || 50) / (this.gridDistance || 5);
    for (const [id, data] of this.tokenData) {
      if (data.stageId && data.stageId !== this.currentStageId) continue;
      if (data.hidden && !this.isGM) continue;
      const dim = data.lightDimRange || 0;
      const bright = data.lightBrightRange || 0;
      if (dim <= 0 && bright <= 0) continue;
      const token = this.tokens.get(id);
      if (!token) continue;
      const pos = this.fovDragPositions?.get(id) ?? { x: token.x, y: token.y };
      origins.push({
        x: pos.x,
        y: pos.y,
        range: Math.max(dim, bright) * ftToPx,
        walls: true,
      });
    }
    return origins;
  }

  /**
   * Durante o arraste, a régua mostra para onde o token VAI — o token ainda não
   * saiu do lugar. Recalcular o FOV a partir da ponta da régua fazia a visão
   * viajar antes do token. Com `false`, a visão fica parada no token e só
   * acompanha durante a animação do passo (que já atualiza o FOV por conta
   * própria, em outro ponto do código).
   */
  private liveVisionOnDrag = false;

  canvasEl: HTMLCanvasElement | null = null;
  private transitionOverlayEl: HTMLCanvasElement | null = null;
  private drawPreview!: Graphics;
  private drawnShapes: Map<string, Container> = new Map();
  private drawingDataMap: Map<string, DrawingData> = new Map();
  private templates: Map<string, Container> = new Map();
  private templateDataMap: Map<string, TemplateData> = new Map();
  private selectedDrawingId: string | null = null;
  private selectedTileId: string | null = null;
  private tileHoveredId: string | null = null;
  private selectedTemplateId: string | null = null;
  private onTemplateDelete: ((id: string) => void) | null = null;
  private selectedLightId: string | null = null;
  private selectedSoundId: string | null = null;
  private selectionOutline: Graphics | null = null;
  private activeTool = 'token';
  private isDrawing = false;
  private drawType = 'freehand';
  private drawStart: { x: number; y: number } | null = null;
  private drawPoints: { x: number; y: number }[] = [];
  private onDrawingCreate: DrawingCreateCallback | null = null;
  private onDrawingMove: ((id: string, payload: { x: number; y: number; points?: { x: number; y: number }[]; width?: number; height?: number }) => void) | null = null;
  private drawingHandlersAttached = false;

  /** Walls rendering & drawing tool */
  private wallShapes: Map<string, Container> = new Map();
  private wallPreview!: Graphics;
  private isDrawingWall = false;
  private wallStart: { x: number; y: number } | null = null;
  private wallEnd: { x: number; y: number } | null = null;
  private wallHandlersAttached = false;
  private onWallCreate: ((data: { x1: number; y1: number; x2: number; y2: number; sight?: boolean; light?: boolean; movement?: boolean; sound?: boolean; door?: number; doorState?: number; levelId?: string }) => void) | null = null;

  /** Wall selection + delete */
  private selectedWallId: string | null = null;
  private wallSelectionOutline!: Graphics;
  private wallEndpointDots: Map<string, Container> = new Map();
  private onWallDelete: ((wallId: string) => void) | null = null;
  private keyboardHandlerAttached = false;

  /** Endpoint drag (resize wall) */
  private draggingEndpoint: { wallId: string; endpointIndex: 0 | 1; initialX: number; initialY: number } | null = null;
  private onWallUpdate: ((wallId: string, data: { x1?: number; y1?: number; x2?: number; y2?: number }) => void) | null = null;
  private endpointDragPreview!: Graphics;

  /** Sound placement tool */
  private soundPreview!: Graphics;
  private isDrawingSound = false;
  /** True while an existing sound is being moved/resized via Pixi — suppresses the raw-DOM create-tool drag so it doesn't also fire on the same pointer sequence. */
  private suppressSoundCreate = false;
  private soundStart: { x: number; y: number } | null = null;
  private soundCurrent: { x: number; y: number } | null = null;
  private soundHandlersAttached = false;
  private onNoiseCreate: ((data: { x: number; y: number; radius: number; levelId?: string }) => void) | null = null;
  private onNoiseDoubleClick: ((noiseId: string) => void) | null = null;
  private onSoundMove: ((noiseId: string, x: number, y: number) => void) | null = null;
  private onSoundResize: ((noiseId: string, radius: number) => void) | null = null;
  private onLightCreate: ((data: { x: number; y: number; radius?: number; dim?: number; bright?: number; levelId?: string }) => void) | null = null;
  private onTileCreate: ((data: { x: number; y: number; width: number; height: number; imgUrl: string; elevation?: number }) => void) | null = null;
  private wallDoorHandlersAttached = false;
  private lightPreview!: Graphics;
  private isCreatingLight = false;
  private lightDragStart: { x: number; y: number } | null = null;
  private lightDragCurrent: { x: number; y: number } | null = null;
  private lightHandlersAttached = false;
  private tilePreview!: Graphics;
  private isCreatingTile = false;
  private tileDragStart: { x: number; y: number } | null = null;
  private tileDragCurrent: { x: number; y: number } | null = null;
  private tileCreatePendingImgUrl = '';
  private tileCreateHandlersAttached = false;
  private gridDistance = 5;
  private gridUnit = 'ft';
  private dragWaypoints: Array<{ x: number; y: number }> = [];
  private dragRuler!: Graphics;
  private dragRulerLabel!: Text;
  private dragRulerLabels: Text[] = [];
  private unrestrictedMovement = false;
  private notesVisible = true;
  private lightAnimationsEnabled = true;

  /** Tile trigger overlays (GM-only) */
  private tileBadges: Map<string, Container> = new Map();
  private tileTooltip: Container | null = null;
  private tileTooltipBg: Graphics | null = null;
  private teleportArrow: Container | null = null;

  /** Measure / Ruler tool */
  private measurePreview!: Graphics;
  private measureLabel!: Text;
  private isMeasuring = false;
  private measureStart: { x: number; y: number } | null = null;
  private measureHandlersAttached = false;

  private zoomLevel = 1;
  private get MIN_ZOOM(): number {
    if (!this.canvasEl || !this.sceneWidth || !this.sceneHeight) return 0.3;
    const viewWidth = this.canvasEl.clientWidth || window.innerWidth;
    const viewHeight = this.canvasEl.clientHeight || window.innerHeight;
    // Escala para caber a cena inteira na tela
    const fitScale = Math.min(viewWidth / this.sceneWidth, viewHeight / this.sceneHeight);
    // Não permite afastar muito além do tamanho da tela para mapas pequenos.
    // Garante um limite mínimo absoluto de 0.3 para não ficar minúsculo.
    return Math.max(0.3, Math.min(1.0, fitScale * 0.8));
  }

  private readonly MAX_ZOOM = 4;
  private currentUserId: string | null = null;
  private hoveredTokenId: string | null = null;
  private dragStageHandlers: Map<string, { move: (event: FederatedPointerEvent) => void; end: (event: FederatedPointerEvent) => void; escape: (e: KeyboardEvent) => void }> = new Map();
  private selectedTokenIds: Set<string> = new Set();
  private onTokenSelectionChange: ((ids: string[]) => void) | null = null;
  private lastTokenClick: { id: string; time: number } | null = null;
  private tiles: Map<string, Sprite> = new Map();
  private tileData: Map<string, TileData> = new Map();
  private occlusionTickerActive = false;
  private onTileMove: MoveCallback | null = null;
  private onTileResize: ((id: string, x: number, y: number, width: number, height: number) => void) | null = null;
  private onTileContextMenu: ((tile: any, event: FederatedPointerEvent) => void) | null = null;
  private onTileClick: ((tileId: string, event: FederatedPointerEvent) => void) | null = null;
  private selectionBoxGraphics!: Graphics;
  private draggedOriginPos: Map<string, { x: number; y: number }> = new Map();
  private tokenResourceCache: Map<string, { val1?: number; val2?: number }> = new Map();
  private unsubFloatingText: (() => void) | null = null;

  setCurrentUserId(id: string | null): void {
    this.currentUserId = id;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getHoveredTokenId(): string | null {
    return this.hoveredTokenId;
  }

  getSelectedTokenIds(): Set<string> {
    return this.selectedTokenIds;
  }

  /**
   * Registra um observador de movimento de token. Retorna a funcao de baixa.
   *
   * Multi-assinante de proposito: o game-hud usa pra persistir (`token.move`),
   * atualizar o listener de audio e empilhar o undo; o TileTriggerEngine usa
   * pra avaliar gatilhos. Enquanto isto foi um slot unico (`this.onMove = cb`),
   * o `engine.start()` sobrescrevia o handler do game-hud e o movimento de
   * token parava de ser salvo no servidor — sem erro no console, so o token
   * voltando pro lugar antigo depois do F5.
   */
  setOnMove(callback: MoveCallback): () => void {
    this.moveCallbacks.add(callback);
    return () => this.moveCallbacks.delete(callback);
  }

  setOnTileClick(callback: TileClickCallback | null): void {
    this.onTileClick = callback;
  }

  /**
   * Obtém os dados dos tiles (para uso do trigger engine)
   */
  getTileData(): Map<string, TileData> {
    return this.tileData;
  }

  /** Luzes, notas e desenhos da cena atual — mesma finalidade de `getTileData()`
   * acima, exposto pra aba "Elementos" da sidebar listar tudo num lugar só. */
  getLights(): AmbientLightData[] {
    return this.allLights;
  }

  getNotesData(): NoteData[] {
    return this.allNotes;
  }

  getDrawingData(): Map<string, DrawingData> {
    return this.drawingDataMap;
  }

  /**
   * Obtém os tokens (para uso do trigger engine)
   */
  getTokens(): Map<string, Container> {
    return this.tokens;
  }

  /**
   * Obtém os dados dos tokens (para uso do trigger engine)
   */
  getTokenData(): Map<string, CastMemberData> {
    return this.tokenData;
  }

  // ── Métodos de suporte a Tile Triggers ─────────────────────────────────────

  /**
   * Configura tiles com triggers (placeholder para integração)
   */
  setupTileTriggers(tiles: any[]): void {
    console.warn('setupTileTriggers called but tile triggers not initialized');
  }

  /**
   * Inicia o sistema de tile triggers (placeholder para integração)
   */
  startTileTriggers(): void {
    console.warn('startTileTriggers called but tile triggers not initialized');
  }

  /**
   * Executa triggers manualmente (placeholder para integração)
   */
  executeTileTriggersManually(tileId: string, event: string, tokenId?: string): void {
    console.warn(`executeTileTriggersManually called but tile triggers not initialized: ${tileId}, ${event}`);
  }

  showFloatingText(
    targetOrX: number | string | { x: number; y: number },
    yOrText?: number | string,
    textStr?: string,
    color: string = '#ffffff',
    options?: { fontSize?: number; duration?: number; broadcast?: boolean }
  ): void {
    let worldX = 0;
    let worldY = 0;
    let text = '';
    let finalColor = color;
    let finalOptions = options || {};

    if (typeof targetOrX === 'string') {
      const t = this.tokens.get(targetOrX);
      const td = this.tokenData.get(targetOrX);
      worldX = t?.x ?? td?.x ?? 0;
      worldY = (t?.y ?? td?.y ?? 0) - TOKEN_RADIUS;
      text = String(yOrText ?? '');
      if (typeof textStr === 'string') finalColor = textStr;
      if (typeof color === 'object') finalOptions = color as any;
    } else if (typeof targetOrX === 'object' && targetOrX !== null) {
      worldX = targetOrX.x;
      worldY = targetOrX.y;
      text = String(yOrText ?? '');
      if (typeof textStr === 'string') finalColor = textStr;
      if (typeof color === 'object') finalOptions = color as any;
    } else {
      worldX = Number(targetOrX);
      worldY = Number(yOrText ?? 0);
      text = String(textStr ?? '');
    }

    if (!text) return;

    if (finalOptions.broadcast && wsClient) {
      wsClient.send('canvas.floatingText', {
        x: worldX,
        y: worldY,
        text,
        color: finalColor,
        options: { fontSize: finalOptions.fontSize, duration: finalOptions.duration },
      });
    }

    const fontSize = finalOptions.fontSize || 24;
    const duration = finalOptions.duration || 1200; // ~1.2s

    const textObj = new Text({
      text,
      style: {
        fontFamily: 'Arial',
        fontSize,
        fill: finalColor,
        stroke: { color: 0x000000, width: Math.max(3, Math.round(fontSize / 6)) },
        fontWeight: 'bold',
      }
    });

    textObj.anchor.set(0.5, 1);
    textObj.x = worldX;
    textObj.y = worldY;
    textObj.scale.set(1 / this.zoomLevel);

    this.layers.interface.addChild(textObj);

    const startY = worldY;
    const endY = worldY - (40 / this.zoomLevel);
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - (1 - progress) * (1 - progress);

      textObj.y = startY + (endY - startY) * ease;
      textObj.alpha = 1 - ease;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        textObj.destroy();
      }
    };

    requestAnimationFrame(tick);
  }

  setOnTemplateCreate(callback: TemplateCreateCallback): void {
    this.onTemplateCreate = callback;
  }

  setTemplates(data: TemplateData[]): void {
    this.clearTemplates();
    for (const t of data || []) this.renderTemplate(t);
  }

  renderTemplate(data: TemplateData): void {
    if (!data.id) return;
    this.templateDataMap.set(data.id, data);
    let container = this.templates.get(data.id);
    if (!container) {
      container = new Container();
      const templateInteractive = this.activeTool === 'templates' || this.activeTool === 'select-template';
      container.eventMode = templateInteractive ? 'static' : 'none';
      container.cursor = 'pointer';
      container.on('pointerdown', () => this.selectTemplate(data.id!));
      this.layers.interface.addChild(container);
      this.templates.set(data.id, container);
    }
    container.removeChildren().forEach((c) => c.destroy({ children: true, texture: false }));
    container.x = 0;
    container.y = 0;

    const g = new Graphics();
    const t = data.type || 'cone';
    const fillColor = data.fillColor || '#6366f1';
    const strokeColor = data.strokeColor || '#6366f1';
    const opacity = data.opacity ?? 0.3;
    const rot = (data.rotation ?? 0) * (Math.PI / 180);

    g.setStrokeStyle({ width: 2, color: strokeColor, alpha: Math.min(1, opacity + 0.2) });

    if (t === 'cone') {
      const radius = data.radius || 100;
      const angle = (data.angle || 90) * (Math.PI / 180);
      const halfAngle = angle / 2;
      const cx = data.x;
      const cy = data.y;
      const startAngle = -halfAngle + rot;
      const endAngle = halfAngle + rot;
      g.moveTo(cx, cy);
      g.arc(cx, cy, radius, startAngle, endAngle);
      g.lineTo(cx, cy);
      g.closePath();
    } else if (t === 'rect') {
      const w = data.width || 100;
      const h = data.height || 100;
      g.rect(data.x, data.y, w, h);
      if (rot !== 0) {
        g.rotation = rot;
        g.pivot.set(data.x + w / 2, data.y + h / 2);
        g.position.set(data.x + w / 2, data.y + h / 2);
      }
    } else if (t === 'circle') {
      const radius = data.radius || 100;
      g.circle(data.x, data.y, radius);
    } else if (t === 'ray') {
      const dist = data.distance || 100;
      const w = Math.max((data.width || 10) / 2, 1);
      const endX = data.x + Math.cos(rot) * dist;
      const endY = data.y + Math.sin(rot) * dist;
      const perpX = Math.cos(rot + Math.PI / 2) * w;
      const perpY = Math.sin(rot + Math.PI / 2) * w;
      g.moveTo(data.x - perpX, data.y - perpY);
      g.lineTo(endX - perpX, endY - perpY);
      g.lineTo(endX + perpX, endY + perpY);
      g.lineTo(data.x + perpX, data.y + perpY);
      g.closePath();
    }

    g.fill({ color: fillColor, alpha: opacity });
    g.stroke();
    container.addChild(g);
  }

  removeTemplate(id: string): void {
    const container = this.templates.get(id);
    if (container) {
      this.layers.interface.removeChild(container);
      container.destroy({ children: true });
      this.templates.delete(id);
    }
    this.templateDataMap.delete(id);
  }

  clearTemplates(): void {
    this.templates.forEach((c) => {
      this.layers.interface.removeChild(c);
      c.destroy({ children: true });
    });
    this.templates.clear();
    this.templateDataMap.clear();
  }

  selectAllTokens(): void {
    const allIds = Array.from(this.tokens.keys());
    this.setSelection(allIds);
  }

  adjustZoom(delta: number): void {
    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoomLevel + delta));
    this.app.stage.scale.set(this.zoomLevel);
  }

  panBy(dx: number, dy: number): void {
    this.app.stage.x += dx;
    this.app.stage.y += dy;
  }

  moveTokenBy(id: string, dx: number, dy: number): void {
    const token = this.tokens.get(id);
    if (!token) return;
    const from = { x: token.x, y: token.y };

    // Prende dentro da cena e checa parede — as duas coisas que o fim de
    // arrasto ja' fazia (clampToScene/wallCollisionPoint, dentro do handler de
    // drag) e que movimento por delta nunca teve: sem isto, andar de seta
    // empurrava o token pra fora do mapa e atravessava parede.
    const tokenRadius = this.gridType !== 'gridless' ? (this.gridSize || 50) / 2 : TOKEN_RADIUS;
    const clamp = (val: number, max: number) => Math.max(tokenRadius, Math.min(max - tokenRadius, val));
    const newX = clamp(from.x + dx, this.sceneWidth);
    const newY = clamp(from.y + dy, this.sceneHeight);

    if (newX === from.x && newY === from.y) return;
    if (!this.unrestrictedMovement && this.wallCollisionPoint(from, { x: newX, y: newY })) return;

    token.x = newX;
    token.y = newY;
    this.updateFogLightOrigins();
    // Recalcula a visao do proprio token — o fim de arrasto faz isso na mao
    // (mesma dupla fovDirty/updateFOV); sem isto, andar de seta movia a sprite
    // mas o cone de visao ficava parado no lugar antigo.
    if (this.isFOVOrigin(id)) { this.fovDirty = true; this.updateFOV(); }
    this.onMove?.(id, newX, newY);
  }

  /**
   * Move um token para uma posição absoluta (não delta)
   */
  moveTokenTo(id: string, x: number, y: number): void {
    const token = this.tokens.get(id);
    if (!token) return;
    token.x = x;
    token.y = y;
    this.updateFogLightOrigins();
    this.onMove?.(id, x, y);
  }

  /**
   * Obtém o stage atual
   */
  getCurrentStageId(): string | null {
    return this.currentStageId;
  }

  /**
   * Move um token para outra cena.
   *
   * Era um stub que só logava — por isso teleporte entre cenas nunca funcionou. O TODO
   * antigo esperava uma rota `/api/tokens/move-stage` que não precisa existir:
   * `PUT /api/cast/:id` já aceita `stageId` (ver api/cast.ts). O broadcast de
   * `cast.updated` cuida de sincronizar os outros clientes.
   */
  async changeTokenStage(tokenId: string, targetStageId: string, x?: number, y?: number): Promise<void> {
    if (!tokenId || !targetStageId) return;
    try {
      const payload: Record<string, unknown> = { stageId: targetStageId };
      if (typeof x === 'number') payload.x = x;
      if (typeof y === 'number') payload.y = y;
      await api.put(`/cast/${tokenId}`, payload);
      // Não removemos o sprite na mão: o eco de `cast.updated` chega pelo WS e o
      // fluxo normal de re-render tira o token da cena atual. Mexer aqui direto
      // criaria dois caminhos de verdade pro mesmo estado.
    } catch (e) {
      console.error('Falha ao mover token de cena', e);
    }
  }

  setOnDrawingCreate(callback: DrawingCreateCallback): void {
    this.onDrawingCreate = callback;
  }

  setOnDrawingMove(callback: (id: string, payload: { x: number; y: number; points?: { x: number; y: number }[]; width?: number; height?: number }) => void): void {
    this.onDrawingMove = callback;
  }

  setOnWallCreate(callback: (data: { x1: number; y1: number; x2: number; y2: number; sight?: boolean; light?: boolean; movement?: boolean; sound?: boolean; door?: number; doorState?: number; levelId?: string }) => void): void {
    this.onWallCreate = callback;
  }

  setOnWallDelete(callback: (wallId: string) => void): void {
    this.onWallDelete = callback;
  }

  setOnWallUpdate(callback: (wallId: string, data: { x1?: number; y1?: number; x2?: number; y2?: number }) => void): void {
    this.onWallUpdate = callback;
  }

  selectWall(id: string | null): void {
    this.cancelEndpointDrag();
    this.selectedWallId = id;
    this.selectedDrawingId = null;
    this.selectedTileId = null;
    this.setSelection([]);
    this.drawWallSelectionOutline();
  }

  private drawWallSelectionOutline(): void {
    this.wallSelectionOutline.clear();
    this.wallEndpointDots.forEach((c) => { c.destroy({ children: true }); });
    this.wallEndpointDots.clear();

    if (!this.selectedWallId) return;
    const wall = this.walls.find((w) => w.id === this.selectedWallId);
    if (!wall) return;

    const margin = 8;
    const x1 = Math.min(wall.x1, wall.x2) - margin;
    const y1 = Math.min(wall.y1, wall.y2) - margin;
    const x2 = Math.max(wall.x1, wall.x2) + margin;
    const y2 = Math.max(wall.y1, wall.y2) + margin;

    this.wallSelectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
    this.wallSelectionOutline.rect(x1, y1, x2 - x1, y2 - y1);
    this.wallSelectionOutline.stroke();

    const dotR = 5;
    const endpoints: { index: 0 | 1; x: number; y: number }[] = [
      { index: 0, x: wall.x1, y: wall.y1 },
      { index: 1, x: wall.x2, y: wall.y2 },
    ];
    for (const pt of endpoints) {
      const dot = new Graphics();
      dot.circle(0, 0, dotR);
      dot.fill({ color: 0xffa500, alpha: 1 });
      dot.x = pt.x;
      dot.y = pt.y;
      dot.eventMode = 'static';
      dot.cursor = 'grab';

      const key = `${wall.id}-${pt.index}`;
      dot.on('pointerdown', (event: FederatedPointerEvent) => {
        event.stopPropagation();
        this.startEndpointDrag(wall.id, pt.index);
      });

      this.layers.interface.addChild(dot);
      this.wallEndpointDots.set(key, dot);
    }
  }

  private cancelEndpointDrag(): void {
    if (!this.draggingEndpoint) return;
    this.draggingEndpoint = null;
    this.endpointDragPreview.clear();
  }

  private startEndpointDrag(wallId: string, endpointIndex: 0 | 1): void {
    if (this.draggingEndpoint) this.cancelEndpointDrag();
    const wall = this.walls.find((w) => w.id === wallId);
    if (!wall) return;
    this.draggingEndpoint = {
      wallId,
      endpointIndex,
      initialX: endpointIndex === 0 ? wall.x1 : wall.x2,
      initialY: endpointIndex === 0 ? wall.y1 : wall.y2,
    };
  }

  private finalizeEndpointDrag(event: FederatedPointerEvent): void {
    const de = this.draggingEndpoint;
    if (!de) return;
    const local = this.app.stage.toLocal(event.global);
    const snappedX = this.snapToGrid(local.x);
    const snappedY = this.snapToGrid(local.y);
    const wall = this.walls.find((w) => w.id === de.wallId);
    if (!wall) { this.draggingEndpoint = null; return; }

    this.endpointDragPreview.clear();
    const { endpointIndex, initialX, initialY } = de;
    const moved = Math.abs(snappedX - initialX) >= 1 || Math.abs(snappedY - initialY) >= 1;

    if (moved) {
      const updates: { x1?: number; y1?: number; x2?: number; y2?: number } = {};
      if (endpointIndex === 0) {
        updates.x1 = snappedX; updates.y1 = snappedY;
        wall.x1 = snappedX; wall.y1 = snappedY;
      } else {
        updates.x2 = snappedX; updates.y2 = snappedY;
        wall.x2 = snappedX; wall.y2 = snappedY;
      }
      this.renderWall(wall);
      this.drawWallSelectionOutline();
      this.onWallUpdate?.(de.wallId, updates);
    }
    this.draggingEndpoint = null;
  }

  private attachKeyboardHandler(): void {
    if (this.keyboardHandlerAttached) return;
    this.keyboardHandlerAttached = true;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private detachKeyboardHandler(): void {
    if (!this.keyboardHandlerAttached) return;
    this.keyboardHandlerAttached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedWallId) {
      e.preventDefault();
      this.onWallDelete?.(this.selectedWallId);
      this.selectWall(null);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedTemplateId) {
      e.preventDefault();
      this.onTemplateDelete?.(this.selectedTemplateId);
      this.removeTemplate(this.selectedTemplateId);
      this.selectTemplate(null);
      return;
    }
  };

  setOnNoiseCreate(callback: ((data: { x: number; y: number; radius: number }) => void) | null): void {
    this.onNoiseCreate = callback;
  }

  setOnSoundMove(callback: ((noiseId: string, x: number, y: number) => void) | null): void {
    this.onSoundMove = callback;
  }

  setOnSoundResize(callback: ((noiseId: string, radius: number) => void) | null): void {
    this.onSoundResize = callback;
  }

  setOnLightCreate(callback: (data: { x: number; y: number; radius?: number; dim?: number; bright?: number }) => void): void {
    this.onLightCreate = callback;
  }

  setOnTileCreate(callback: (data: { x: number; y: number; width: number; height: number; imgUrl: string }) => void): void {
    this.onTileCreate = callback;
  }

  setOnNoiseDoubleClick(callback: (noiseId: string) => void): void {
    this.onNoiseDoubleClick = callback;
  }

  setOnLightDoubleClick(callback: (lightId: string) => void): void {
    this.onLightDoubleClick = callback;
  }

  setOnLightToggle(callback: (lightId: string) => void): void {
    this.onLightToggle = callback;
  }

  getNoiseById(id: string): NoiseData | undefined {
    return this.allNoises.find((noise) => noise.id === id);
  }

  getLightById(id: string): AmbientLightData | undefined {
    return this.allLights.find((light) => light.id === id);
  }

  setOnNoteClick(callback: (note: NoteData) => void): void {
    this.onNoteClick = callback;
  }

  setOnNoteCreate(callback: (position: { x: number; y: number; levelId?: string }) => void): void {
    this.onNoteCreate = callback;
  }

  setOnTokenClick(callback: (castMember: any) => void): void {
    this.onTokenClick = callback;
  }

  setOnTokenContextMenu(callback: (castMember: any, event: FederatedPointerEvent) => void): void {
    this.onTokenContextMenu = callback;
  }

  setOnTileMove(callback: MoveCallback): void {
    this.onTileMove = callback;
  }

  setOnTileResize(callback: (id: string, x: number, y: number, width: number, height: number) => void): void {
    this.onTileResize = callback;
  }

  setOnTileContextMenu(callback: (tile: any, event: FederatedPointerEvent) => void): void {
    this.onTileContextMenu = callback;
  }



  private onCanvasPick: ((x: number, y: number) => void) | null = null;

  setOnCanvasClickPick(callback: ((x: number, y: number) => void) | null): void {
    if (this.onCanvasPick && callback) {
      // If there's already a pending pick, clear it
      this.onCanvasPick = null;
    }
    this.onCanvasPick = callback;
    if (callback) {
      this.app.stage.eventMode = 'static';
      this.app.stage.cursor = 'crosshair';
    } else {
      this.app.stage.cursor = 'default';
    }
  }

  private setSelection(ids: string[]): void {
    for (const prevId of this.selectedTokenIds) {
      const token = this.tokens.get(prevId);
      const ring = token?.getChildByLabel?.('selection-ring');
      if (ring) ring.visible = false;
      const data = this.tokenData.get(prevId);
      if (data?.displayBars === 10) {
        const bars = token?.getChildByLabel?.('resource-bars');
        if (bars) bars.visible = false;
      }
    }
    this.selectedTokenIds = new Set(ids);
    for (const id of this.selectedTokenIds) {
      const token = this.tokens.get(id);
      const ring = token?.getChildByLabel?.('selection-ring');
      if (ring) ring.visible = true;
      const data = this.tokenData.get(id);
      if (data?.displayBars === 10) {
        const bars = token?.getChildByLabel?.('resource-bars');
        if (bars) bars.visible = true;
      }
    }
    // Preview de visão: GM enxerga o que o token selecionado vê (e nada além disso)
    if (this.isGM) this.setGMVisionPreview(ids);
    this.onTokenSelectionChange?.(Array.from(this.selectedTokenIds));
  }

  setOnTokenSelectionChange(callback: (ids: string[]) => void): void {
    this.onTokenSelectionChange = callback;
  }

  /** Wrapper público de `setSelection` — mesma finalidade de `selectWall`/`selectTile`/
   * `selectLight`/`selectDrawing` (públicos), que faltava só pra token. Usado pela aba
   * "Elementos" da sidebar pra selecionar o token clicado direto no canvas. */
  selectToken(id: string | null): void {
    this.setSelection(id ? [id] : []);
  }

  /** Posição em tela (viewport) do token, considerando pan/zoom da câmera — usada pelo TokenHud pra se posicionar. */
  getZoomLevel(): number {
    return this.zoomLevel;
  }

  getTokenScreenRect(id: string): { x: number; y: number; width: number; height: number } | null {
    const token = this.tokens.get(id);
    if (!token || !this.app) return null;
    // Não usar getBounds(): inclui anel de seleção, brackets de target,
    // ícones de combate/movimento e fileira de status, inflando o tamanho
    // muito além do sprite real do token (raio fixo TOKEN_RADIUS).
    const center = this.app.stage.toGlobal({ x: token.x, y: token.y });
    const size = TOKEN_RADIUS * 2 * this.zoomLevel;
    return {
      x: center.x - size / 2,
      y: center.y - size / 2,
      width: size,
      height: size,
    };
  }

  clearSelection(): void {
    this.setSelection([]);
    this.selectDrawing(null);
    this.selectTile(null);
    this.selectWall(null);
    this.selectedLightId = null;
    this.selectedSoundId = null;
    this.selectedTemplateId = null;
    this.drawSelectionOutline();
  }

  setOnTemplateDelete(callback: ((id: string) => void) | null): void {
    this.onTemplateDelete = callback;
  }

  getSelectedTemplateId(): string | null {
    return this.selectedTemplateId;
  }

  selectTemplate(id: string | null): void {
    this.selectedTemplateId = id;
    this.selectedDrawingId = null;
    this.selectedTileId = null;
    this.selectedLightId = null;
    this.selectedSoundId = null;
    this.setSelection([]);
    this.drawSelectionOutline();
  }

  getSelectedDrawingId(): string | null {
    return this.selectedDrawingId;
  }

  getSelectedTileId(): string | null {
    return this.selectedTileId;
  }

  selectDrawing(id: string | null): void {
    this.selectedDrawingId = id;
    this.selectedTileId = null;
    this.setSelection([]);
    this.drawSelectionOutline();
  }

  selectTile(id: string | null): void {
    this.selectedTileId = id;
    this.selectedDrawingId = null;
    this.selectedLightId = null;
    this.setSelection([]);
    this.drawSelectionOutline();
    this.drawTeleportArrow();
  }

  selectLight(id: string | null): void {
    const prevId = this.selectedLightId;
    this.selectedLightId = id;
    this.selectedDrawingId = null;
    this.selectedTileId = null;
    this.setSelection([]);
    this.drawSelectionOutline();
    // Re-render handles so selection circle/resize handle appears immediately
    if (prevId && prevId !== id) {
      const prev = this.allLights.find(l => l.id === prevId);
      if (prev) this.updateLight(prev);
    }
    if (id) {
      const next = this.allLights.find(l => l.id === id);
      if (next) this.updateLight(next);
    }
  }

  getSelectedLightId(): string | null {
    return this.selectedLightId;
  }

  selectSound(id: string | null): void {
    const prevId = this.selectedSoundId;
    this.selectedSoundId = id;
    this.selectedLightId = null;
    this.selectedDrawingId = null;
    this.selectedTileId = null;
    this.setSelection([]);
    this.drawSelectionOutline();
    if (prevId && prevId !== id) {
      const prev = this.allNoises.find(n => n.id === prevId);
      if (prev) this.updateSound(prev);
    }
    if (id) {
      const next = this.allNoises.find(n => n.id === id);
      if (next) this.updateSound(next);
    }
  }

  getSelectedSoundId(): string | null {
    return this.selectedSoundId;
  }

  private drawSelectionOutline(): void {
    if (!this.selectionOutline) {
      this.selectionOutline = new Graphics();
      this.layers.interface.addChild(this.selectionOutline);
    }
    this.selectionOutline.clear();
    this.selectionOutline.x = 0;
    this.selectionOutline.y = 0;

    if (this.selectedDrawingId) {
      const dataPayload = this.drawingDataMap.get(this.selectedDrawingId);
      if (dataPayload) {
        const x0 = dataPayload.x ?? 0, y0 = dataPayload.y ?? 0, w0 = dataPayload.width ?? 100, h0 = dataPayload.height ?? 100;
        this.selectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
        this.selectionOutline.rect(x0, y0, w0, h0);
        this.selectionOutline.stroke();

        if (['rectangle', 'ellipse', 'circle', 'text'].includes(dataPayload.type || '')) {
          const handleSize = 8;
          const hs = handleSize / 2;
          this.selectionOutline.rect(x0 - hs, y0 - hs, handleSize, handleSize);
          this.selectionOutline.rect(x0 + w0 - hs, y0 - hs, handleSize, handleSize);
          this.selectionOutline.rect(x0 - hs, y0 + h0 - hs, handleSize, handleSize);
          this.selectionOutline.rect(x0 + w0 - hs, y0 + h0 - hs, handleSize, handleSize);
          this.selectionOutline.fill({ color: 0xffffff, alpha: 1 });
        }
      }
    } else if (this.selectedTileId) {
      const sprite = this.tiles.get(this.selectedTileId);
      const dataPayload = this.tileData.get(this.selectedTileId);
      if (sprite && dataPayload) {
        this.selectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
        this.selectionOutline.rect(sprite.x, sprite.y, dataPayload.width, dataPayload.height);
        this.selectionOutline.stroke();

        const handleSize = 8;
        const hs = handleSize / 2;
        this.selectionOutline.rect(sprite.x - hs, sprite.y - hs, handleSize, handleSize);
        this.selectionOutline.rect(sprite.x + dataPayload.width - hs, sprite.y - hs, handleSize, handleSize);
        this.selectionOutline.rect(sprite.x - hs, sprite.y + dataPayload.height - hs, handleSize, handleSize);
        this.selectionOutline.rect(sprite.x + dataPayload.width - hs, sprite.y + dataPayload.height - hs, handleSize, handleSize);
        this.selectionOutline.fill({ color: 0xffffff, alpha: 1 });
      }
    } else if (this.selectedLightId) {
      const light = this.allLights.find((l) => l.id === this.selectedLightId);
      if (light) {
        this.selectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
        this.selectionOutline.circle(light.x, light.y, 14);
        this.selectionOutline.stroke();
      }
    } else if (this.selectedTemplateId) {
      const tpl = this.templateDataMap.get(this.selectedTemplateId);
      if (tpl) {
        this.selectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
        const r = tpl.radius || tpl.distance || 100;
        this.selectionOutline.circle(tpl.x, tpl.y, r);
        this.selectionOutline.stroke();
      }
    } else if (this.selectedSoundId) {
      const noise = this.allNoises.find((n) => n.id === this.selectedSoundId);
      if (noise) {
        this.selectionOutline.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 1 });
        this.selectionOutline.circle(noise.x, noise.y, 10);
        this.selectionOutline.stroke();
        // Raio destacado
        this.selectionOutline.setStrokeStyle({ width: 1, color: 0xffa500, alpha: 0.4, pixelLine: true });
        this.selectionOutline.circle(noise.x, noise.y, noise.radius);
        this.selectionOutline.stroke();
        // Alça de resize no limite do raio
        const handleSize = 7;
        this.selectionOutline.circle(noise.x + noise.radius, noise.y, handleSize);
        this.selectionOutline.fill({ color: 0xffffff, alpha: 1 });
        this.selectionOutline.circle(noise.x + noise.radius, noise.y, handleSize);
        this.selectionOutline.stroke({ color: 0xffa500, width: 2, alpha: 1 });
      }
    }
  }

  getGridSize(): number {
    return this.gridSize || DEFAULT_GRID_SIZE;
  }

  setActiveTool(tool: string): void {
    this.activeTool = tool || 'token';
    this.clearSelection();

    // Tokens só interceptam clique no modo 'token' — em outras ferramentas
    // (select-tile, place-tile, drawings, etc.) o clique deve passar direto
    // pra camada abaixo, senão o token bloqueia a seleção de tile/drawing.
    const tokenInteractive = this.activeTool === 'token' || this.activeTool === 'select-token';
    this.tokens.forEach((t) => { t.eventMode = tokenInteractive ? 'static' : 'none'; });

    const templateInteractive = this.activeTool === 'templates' || this.activeTool === 'select-template';
    this.templates.forEach((t) => { t.eventMode = templateInteractive ? 'static' : 'none'; });

    if (!DRAWING_TOOLS.includes(this.activeTool) && this.isDrawing) {
      this.cancelDrawing();
    }

    this.detachTileCreateHandlers();

    const isWallCreateTool = this.activeTool === 'walls' || this.activeTool.startsWith('wall-') && this.activeTool !== 'select-wall';
    if (isWallCreateTool) {
      this.detachDrawingHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
      this.detachLightHandlers();
      this.attachWallHandlers();
    } else if (this.activeTool === 'select-wall') {
      this.detachWallHandlers();
      this.detachDrawingHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
    } else if (this.activeTool === 'sounds') {
      this.detachWallHandlers();
      this.detachDrawingHandlers();
      this.detachMeasureHandlers();
      this.attachSoundHandlers();
    } else if (this.activeTool === 'create-light') {
      this.detachWallHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
      this.detachDrawingHandlers();
      this.attachLightHandlers();
    } else if (this.activeTool === 'place-tile' || this.activeTool === 'tile-browse' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette') {
      this.detachWallHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
      this.detachDrawingHandlers();
      this.detachLightHandlers();
      if (this.activeTool === 'place-tile') {
        this.attachTileCreateHandlers();
      }
    } else if (DRAWING_TOOLS.includes(this.activeTool)) {
      this.detachWallHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
      this.detachLightHandlers();
      this.attachDrawingHandlers();
    } else if (this.activeTool === 'measure') {
      this.detachWallHandlers();
      this.detachDrawingHandlers();
      this.detachSoundHandlers();
      this.detachLightHandlers();
      this.attachMeasureHandlers();
    } else {
      this.detachWallHandlers();
      this.detachDrawingHandlers();
      this.detachSoundHandlers();
      this.detachMeasureHandlers();
      this.detachLightHandlers();
    }

    // Layer visibility logic - show/hide containers based on active tool
    this.updateLayerVisibility();

    // Clear selections when switching tools
    this.selectedLightId = null;
    this.selectedSoundId = null;
    this.drawSelectionOutline();

    this.updateTilesInteractionState();
    this.updateDrawingsInteractionState();
    this.updateWallsInteractionState();
  }

  getAllTokenPositions(): { id: string; x: number; y: number }[] {
    const positions: { id: string; x: number; y: number }[] = [];
    for (const [id, container] of this.tokens) {
      positions.push({ id, x: container.x, y: container.y });
    }
    return positions;
  }

  /**
   * Update layer visibility based on active tool
   */
  private updateLayerVisibility(): void {
    if (!this.layers) return;

    // Walls layer: always visible so doors can be interacted with, but wall lines visibility is updated in updateWallsInteractionState()
    this.layers.wall.visible = true;
    this.layers.wall.eventMode = 'static';

    // Lighting layer: always visible for lighting effects
    const isLightingTool = this.activeTool === 'create-light' || this.activeTool === 'select-light';
    this.layers.lighting.visible = true;
    this.layers.lighting.eventMode = 'none'; // light beams shouldn't block clicks

    // Light handles layer: visible only during lighting tool
    const wasLightingTool = this.lightHandlesContainer.visible;
    this.lightHandlesContainer.visible = isLightingTool;
    this.lightHandlesContainer.eventMode = isLightingTool ? 'static' : 'none';

    // Re-render all light handles when entering/leaving lighting tool so
    // range circles appear for all lights as soon as the tool is activated
    if (isLightingTool !== wasLightingTool) {
      for (const light of this.allLights) {
        this.updateLight(light);
      }
    }

    // Sounds layer: visible only for sound tools
    const wasSoundTool = this.soundsContainer.visible;
    const isSoundTool = this.activeTool === 'sounds' || this.activeTool === 'select-sound';
    this.soundsContainer.visible = isSoundTool;
    this.soundsContainer.eventMode = isSoundTool ? 'static' : 'none';
    if (isSoundTool !== wasSoundTool) {
      for (const noise of this.allNoises) {
        this.updateSound(noise);
      }
    }

    // Notes layer: visible only for notes tools
    const isNoteTool = this.activeTool === 'notes' || this.activeTool === 'select-note' || this.activeTool === 'create-note' || this.activeTool === 'toggle-notes';
    this.notesContainer.visible = isNoteTool && this.notesVisible;
    this.notesContainer.eventMode = isNoteTool ? 'static' : 'none';

    // Drawings: sempre visíveis pra todos — interação só nas ferramentas de desenho
    const isDrawingTool = DRAWING_TOOLS.includes(this.activeTool) || this.activeTool === 'select-drawing';
    this.layers.drawings.visible = true;
    this.layers.drawings.eventMode = isDrawingTool ? 'static' : 'none';

    // Cast (tokens): sempre visível e interativo — é a ferramenta padrão do VTT.
    this.layers.cast.visible = true;
    this.layers.cast.eventMode = 'static';
    // Tiles: layer sempre visível, mas cada sprite só vira interativo dentro da
    // própria gridtool (isTileTool(), aplicado em updateTilesInteractionState()).
    // Não tratar como exceção igual token — cada elemento só mexe na sua gridtool.
    this.layers.tile.visible = true;
    this.layers.tile.eventMode = 'static';

    // Background, Fog, Weather, Overhead, Interface: always visible
    this.layers.background.visible = true;
    this.layers.fog.visible = true;
    this.layers.weather.visible = true;
    this.layers.overhead.visible = true;
    this.layers.interface.visible = true;
  }

  toWorldCoordinates(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.app) return { x: screenX, y: screenY };
    return {
      x: (screenX - this.app.stage.x) / this.app.stage.scale.x,
      y: (screenY - this.app.stage.y) / this.app.stage.scale.y,
    };
  }

  centerView(): void {
    if (!this.app || !this.canvasEl) return;
    const viewWidth = this.canvasEl.clientWidth || window.innerWidth;
    const viewHeight = this.canvasEl.clientHeight || window.innerHeight;

    const scaleX = viewWidth / (this.sceneWidth + 100);
    const scaleY = viewHeight / (this.sceneHeight + 100);
    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(1, Math.min(scaleX, scaleY)));
    this.app.stage.scale.set(this.zoomLevel);

    this.app.stage.x = (viewWidth - this.sceneWidth * this.zoomLevel) / 2;
    this.app.stage.y = (viewHeight - this.sceneHeight * this.zoomLevel) / 2;
  }

  getCameraView(): { x: number; y: number; zoom: number } {
    if (!this.app || !this.canvasEl) return { x: 0, y: 0, zoom: 1 };
    const zoom = this.zoomLevel;
    const viewWidth = this.canvasEl.clientWidth || window.innerWidth;
    const viewHeight = this.canvasEl.clientHeight || window.innerHeight;
    const worldX = Math.round((viewWidth / 2 - this.app.stage.x) / zoom);
    const worldY = Math.round((viewHeight / 2 - this.app.stage.y) / zoom);
    return { x: worldX, y: worldY, zoom: parseFloat(zoom.toFixed(2)) };
  }

  resize(): void {
    this.app?.resize();
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      canvas,
      resizeTo: window,
      // Cor de limpeza do WebGL — e ISTO que se ve como "fundo do HUD", nao o
      // `background` do `.game-hud`: o canvas e `inset: 0` e cobre a viewport
      // inteira, entao o CSS atras dele nunca aparece. Mantenha em sincronia
      // com `--color-bg-deep` (client/styles/tokens.css); mexer so no CSS nao
      // muda nada na tela.
      backgroundColor: 0x0d0d0f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.layers = {
      background: new Container(),
      tile: new Container(),
      wall: new Container(),
      drawings: new Container(),
      cast: new Container(),
      fog: new Container(),
      lighting: new Container(),
      weather: new Container(),
      overhead: new Container(),
      effects: new Container(),
      interface: new Container(),
    };

    // Desativar interações em camadas que ficam por cima e podem bloquear cliques nos tokens
    this.layers.wall.eventMode = 'none';
    this.layers.fog.eventMode = 'none';
    this.layers.lighting.eventMode = 'none';
    this.layers.weather.eventMode = 'none';

    this.unsubCursor = wsClient.on('user.cursor', (data: { userId: string; userName: string; userColor?: string; x: number; y: number }) => {
      this.updateRemoteCursor(data);
    });
    this.unsubFloatingText = wsClient.on('canvas.floatingText', (data: any) => {
      if (data && typeof data.x === 'number' && typeof data.y === 'number' && data.text) {
        this.showFloatingText(data.x, data.y, data.text, data.color, { ...data.options, broadcast: false });
      }
    });
    this.app.ticker.add(() => this.pruneStaleCursors());

    this.selectionBoxGraphics = new Graphics();
    this.layers.interface.addChild(this.selectionBoxGraphics);

    this.app.stage.cullable = true;
    this.app.stage.cullableChildren = true;
    this.app.stage.eventMode = 'static';
    // Área clicável em coordenadas de MUNDO, não de tela — app.stage tem o transform de
    // câmera (pan/zoom) aplicado nele mesmo, então usar app.screen (tamanho da viewport)
    // aqui limitava cliques a world-x/y 0..larguraDaTela, quebrando tudo à direita/abaixo
    // assim que a câmera panava a cena pra mostrar conteúdo além desse ponto.
    this.app.stage.hitArea = new Rectangle(-100000, -100000, 200000, 200000);

    let panStart: { x: number; y: number; stageX: number; stageY: number } | null = null;
    let selectionStart: { x: number; y: number } | null = null;
    let selectionStartGlobal: { x: number; y: number } | null = null;
    let pingHoldTimer: ReturnType<typeof setTimeout> | null = null;
    let pingHoldStartPos: { x: number; y: number } | null = null;
    let activePingRelease: (() => void) | null = null;

    // Cursor remoto — manda posição pros outros jogadores verem onde eu tô
    // olhando. Throttle pra não virar spam de WS a cada pixel.
    const sendCursorThrottled = throttle((x: number, y: number) => {
      if (!this.currentStageId) return;
      wsClient.send('user.cursor', { stageId: this.currentStageId, x, y });
    }, 80);

    this.app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
      if (event.button === 2 || event.button === 1) {
        panStart = {
          x: event.global.x,
          y: event.global.y,
          stageX: this.app.stage.x,
          stageY: this.app.stage.y,
        };
      } else if (event.target === this.app.stage) {
        if (event.button === 0) {
          const local = this.app.stage.toLocal(event.global);
          pingHoldStartPos = { x: event.global.x, y: event.global.y };
          pingHoldTimer = setTimeout(() => {
            activePingRelease = this.showPing(local.x, local.y, '#ffcc00', true);
            this.onPingSend?.(local.x, local.y);
            pingHoldTimer = null;
            pingHoldStartPos = null;
          }, 500); // 500ms para disparar o ping ao segurar
        }

        // Ctrl+click = ping de gameplay (marcador visual compartilhado)
        if (event.ctrlKey || event.metaKey) {
          if (pingHoldTimer) {
            clearTimeout(pingHoldTimer);
            pingHoldTimer = null;
            pingHoldStartPos = null;
          }
          const local = this.app.stage.toLocal(event.global);
          this.showPing(local.x, local.y, '#ffcc00');
          this.onPingSend?.(local.x, local.y);
          event.stopPropagation();
          return;
        }
        // Map coordinate pick for tile teleport destination
        if (this.onCanvasPick) {
          const local = this.app.stage.toLocal(event.global);
          this.onCanvasPick(Math.round(local.x), Math.round(local.y));
          this.onCanvasPick = null;
          this.app.stage.cursor = 'default';
          event.stopPropagation();
          return;
        }
        if (this.leftClickDeselect) {
          this.clearSelection();
          if (this.activeTool === 'token') {
            selectionStart = this.app.stage.toLocal(event.global);
            selectionStartGlobal = { x: event.global.x, y: event.global.y };
          }
        } else if (this.activeTool === 'select-drawing') {
          this.selectDrawing(null);
        } else if (this.activeTool === 'select-tile') {
          this.selectTile(null);
        } else if (this.activeTool === 'select-light' || this.activeTool === 'create-light') {
          this.selectLight(null);
        } else if (this.activeTool === 'select-wall') {
          this.selectWall(null);
        }
      }
    });

    this.app.stage.on('pointermove', (event: FederatedPointerEvent) => {
      const localCursor = this.app.stage.toLocal(event.global);
      sendCursorThrottled(localCursor.x, localCursor.y);

      if (pingHoldTimer && pingHoldStartPos) {
        // Tolerância de movimento de 5px para não cancelar o ping à toa
        const dist = Math.hypot(event.global.x - pingHoldStartPos.x, event.global.y - pingHoldStartPos.y);
        if (dist > 5) {
          clearTimeout(pingHoldTimer);
          pingHoldTimer = null;
          pingHoldStartPos = null;
        }
      }

      if (panStart) {
        this.app.stage.x = panStart.stageX + (event.global.x - panStart.x);
        this.app.stage.y = panStart.stageY + (event.global.y - panStart.y);
      } else if (selectionStart && selectionStartGlobal) {
        const localCurrent = this.app.stage.toLocal(event.global);
        const x = Math.min(selectionStart.x, localCurrent.x);
        const y = Math.min(selectionStart.y, localCurrent.y);
        const w = Math.abs(selectionStart.x - localCurrent.x);
        const h = Math.abs(selectionStart.y - localCurrent.y);

        this.selectionBoxGraphics.clear();
        this.selectionBoxGraphics.setStrokeStyle({ width: 1.5, color: 0xffa500, alpha: 0.8 });
        this.selectionBoxGraphics.rect(x, y, w, h);
        this.selectionBoxGraphics.fill({ color: 0xffa500, alpha: 0.12 });
        this.selectionBoxGraphics.stroke();
      }
    });

    const endPanOrSelect = (event: FederatedPointerEvent) => {
      if (pingHoldTimer) {
        clearTimeout(pingHoldTimer);
        pingHoldTimer = null;
        pingHoldStartPos = null;
      }
      if (activePingRelease) {
        activePingRelease();
        activePingRelease = null;
      }

      panStart = null;
      if (selectionStart && selectionStartGlobal) {
        const localCurrent = this.app.stage.toLocal(event.global);
        const x1 = Math.min(selectionStart.x, localCurrent.x);
        const y1 = Math.min(selectionStart.y, localCurrent.y);
        const x2 = Math.max(selectionStart.x, localCurrent.x);
        const y2 = Math.max(selectionStart.y, localCurrent.y);

        this.selectionBoxGraphics.clear();

        const dist = Math.hypot(event.global.x - selectionStartGlobal.x, event.global.y - selectionStartGlobal.y);
        if (dist > 5) {
          const selectedIds: string[] = [];
          this.tokens.forEach((token, id) => {
            if (token.x >= x1 && token.x <= x2 && token.y >= y1 && token.y <= y2) {
              selectedIds.push(id);
            }
          });
          this.setSelection(selectedIds);
        }

        selectionStart = null;
        selectionStartGlobal = null;
      }
    };
    this.app.stage.on('pointerup', endPanOrSelect);
    this.app.stage.on('pointerupoutside', endPanOrSelect);

    // Endpoint drag handlers
    this.app.stage.on('pointermove', (event: FederatedPointerEvent) => {
      const de = this.draggingEndpoint;
      if (!de) return;
      const local = this.app.stage.toLocal(event.global);
      const snappedX = this.snapToGrid(local.x);
      const snappedY = this.snapToGrid(local.y);
      const wall = this.walls.find((w) => w.id === de.wallId);
      if (!wall) return;

      this.endpointDragPreview.clear();
      this.endpointDragPreview.setStrokeStyle({ width: 3, color: 0xE8D840, alpha: 0.8 });

      if (de.endpointIndex === 0) {
        this.endpointDragPreview.moveTo(snappedX, snappedY);
        this.endpointDragPreview.lineTo(wall.x2, wall.y2);
      } else {
        this.endpointDragPreview.moveTo(wall.x1, wall.y1);
        this.endpointDragPreview.lineTo(snappedX, snappedY);
      }
      this.endpointDragPreview.stroke();
    });

    this.app.stage.on('pointerup', (event: FederatedPointerEvent) => {
      if (!this.draggingEndpoint) return;
      this.finalizeEndpointDrag(event);
    });

    this.app.stage.on('pointerupoutside', (event: FederatedPointerEvent) => {
      if (!this.draggingEndpoint) return;
      this.finalizeEndpointDrag(event);
    });

    this.app.stage.addChild(
      this.layers.background,
      this.layers.tile,
      this.layers.wall,
      this.layers.drawings,
      // LUZES antes da escuridao. Se o lighting vem depois, a luz renderiza por
      // cima da escuridao e nada apaga — o comodo fechado com luz dentro fica
      // branco para o token de fora. A escuridao (fog) precisa cobrir as luzes,
      // revelando-as apenas onde os furos (cut) permitem.
      this.layers.lighting,
      // O fog vem ANTES do cast de proposito. O revealGraphics usa
      // blendMode 'erase': ele apaga o que ja foi desenhado abaixo dele. Com
      // cast antes, a escuridao renderizava por cima dos tokens e o erase
      // comia o proprio token — ele sumia no escuro e o clique parecia travar.
      this.layers.fog,
      this.layers.cast,
      this.layers.weather,
      this.layers.overhead,
      this.layers.effects,
      this.layers.interface,
    );

    this.fogLayer = new FogLayer();
    this.layers.fog.addChild(this.fogLayer.container);
    // Movemento de token (fim de arrasto) => acumula a exploracao e salva.
    // Subscriber proprio para o fog NAO depender de o game-hud registrar `onMove`.
    this.setOnMove(() => this.commitFogOnMove());

    this.drawPreview = new Graphics();
    this.layers.drawings.addChild(this.drawPreview);

    this.wallPreview = new Graphics();
    this.layers.wall.addChild(this.wallPreview);

    this.wallSelectionOutline = new Graphics();
    this.layers.interface.addChild(this.wallSelectionOutline);

    this.endpointDragPreview = new Graphics();
    this.layers.interface.addChild(this.endpointDragPreview);

    this.soundPreview = new Graphics();
    this.layers.interface.addChild(this.soundPreview);

    this.lightPreview = new Graphics();
    this.layers.interface.addChild(this.lightPreview);

    this.tilePreview = new Graphics();
    this.layers.interface.addChild(this.tilePreview);

    this.measurePreview = new Graphics();
    this.layers.interface.addChild(this.measurePreview);

    this.measureLabel = new Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 13, fill: 0xffffff },
    });
    this.measureLabel.visible = false;
    this.layers.interface.addChild(this.measureLabel);

    this.dragRuler = new Graphics();
    this.layers.interface.addChild(this.dragRuler);

    this.dragRulerLabel = new Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 13, fill: 0x4ade80 },
    });
    this.dragRulerLabel.visible = false;
    this.layers.interface.addChild(this.dragRulerLabel);

    this.canvasEl = canvas;
    this.transitionOverlayEl = document.getElementById('stage-transition-overlay') as HTMLCanvasElement | null;

    this.canvasEl.addEventListener('dragover', this.handleCanvasDragOver);
    this.canvasEl.addEventListener('drop', this.handleCanvasDrop);
    // Registra também no document pois .hud-layer (z-index:1, inset:0) intercepta
    // eventos de drag HTML5 antes de chegarem ao canvas.
    document.addEventListener('dragover', this.handleDocumentDragOver);
    document.addEventListener('drop', this.handleDocumentDrop);

    this.bgSprite = new Sprite();
    this.layers.background.addChild(this.bgSprite);

    this.gridGraphics = new Graphics();
    this.layers.background.addChild(this.gridGraphics);

    this.lightsContainer = new Container();
    this.lightsContainer.blendMode = 'screen';
    this.layers.lighting.addChild(this.lightsContainer);

    this.lightHandlesContainer = new Container();
    this.layers.interface.addChild(this.lightHandlesContainer);

    this.notesContainer = new Container();
    this.layers.interface.addChild(this.notesContainer);

    this.soundsContainer = new Container();
    this.layers.interface.addChild(this.soundsContainer);

    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
    this.attachKeyboardHandler();
    this.app.ticker.add(this.updateAnimations, this);

    // Sincroniza a visibilidade/interatividade das camadas com a ferramenta padrão.
    // Sem isso, containers como lightHandlesContainer nascem com o visible=true padrão
    // do PixiJS e ficam clicáveis/arrastáveis antes do usuário clicar em qualquer tool.
    this.setActiveTool(this.activeTool);
  }

  private handleResize = (): void => {
    if (!this.app) return;
    this.app.resizeTo = window;
    this.drawGrid();
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.app) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoomLevel + delta));
    this.app.stage.scale.set(this.zoomLevel);
  };

  /** `skipTransition` é pra reaplicações internas de sincronização (ex: refreshStageLevels,
   * que só recarrega a lista de andares e roda em CIMA de um applyStage que acabou de rodar
   * com transição) — sem isso, toda re-sincronização repetia a animação inteira por cima da
   * que já tinha acabado de tocar. */
  async applyStage(stage: StageData, ignoreCamera = false, skipTransition = false): Promise<void> {
    if (!stage) return;
    if (skipTransition) {
      await this.applyStageCore(stage, ignoreCamera);
      return;
    }
    await this.runTransition(stage.transitionType || 'none', stage.transitionDuration ?? 0, () =>
      this.applyStageCore(stage, ignoreCamera));
  }

  /** Pra troca de cena de verdade (não um refresh de sincronização): cobre a tela UMA VEZ
   * e roda TUDO (fundo, tokens, assets) por baixo — `work` é responsabilidade de quem
   * chama, não só o applyStageCore. Sem isto, a revelação tocava e SÓ DEPOIS tokens/
   * paredes/assets apareciam surgindo aos poucos por cima da cena já revelada. */
  async runStageTransition(stage: StageData, work: () => Promise<void>): Promise<void> {
    await this.runTransition(stage?.transitionType || 'none', stage?.transitionDuration ?? 0, work);
  }

  /** Cobre a tela (fade/swirl), roda `work` por baixo, e revela — pra troca/atualização de
   * cena não "estourar" na tela crua. `type: 'none'` ou duração 0 pula a animação inteira. */
  // Fila (não flag): chamadas concorrentes (stage.activated + stage.updated chegando quase
  // juntos, por exemplo) esperam a transição anterior terminar de vez (cobrir→aplicar→
  // revelar) antes de começar a própria, em vez de aplicar conteúdo sem cobertura por cima
  // de uma cobertura alheia ainda no meio — era isso que fazia a imagem nova "estourar" antes
  // da animação terminar.
  private transitionChain: Promise<void> = Promise.resolve();

  private async runTransition(type: string, duration: number, work: () => Promise<void>): Promise<void> {
    const run = () => this.runTransitionOnce(type, duration, work);
    const chained = this.transitionChain.then(run, run);
    this.transitionChain = chained.catch(() => { });
    return chained;
  }

  private async runTransitionOnce(type: string, duration: number, work: () => Promise<void>): Promise<void> {
    const overlay = this.transitionOverlayEl;
    if (!overlay || !this.canvasEl || type === 'none' || !duration || duration <= 0) {
      await work();
      return;
    }

    await this.runTransitionAnimated(overlay, this.canvasEl, type, duration, work);
  }

  private async runTransitionAnimated(overlay: HTMLCanvasElement, canvasEl: HTMLCanvasElement, type: string, duration: number, work: () => Promise<void>): Promise<void> {
    const def = transitionEffectRegistry.get(type) ?? transitionEffectRegistry.get('fade')!;
    canvasEl.style.pointerEvents = 'none';
    // Animation com fill:'forwards' que terminou continua aplicando o valor final PRA
    // SEMPRE, mesmo em execuções futuras — cancelar o que sobrou do ciclo anterior antes
    // de começar o próximo evita que uma opacity/máscara presa mascare a nova transição.
    overlay.getAnimations().forEach((a) => a.cancel());

    // Foto da tela AGORA (cena antiga, antes de `work()` trocar o conteúdo por baixo) —
    // é o que fica coberto/visível no overlay até a animação começar a "abrir".
    overlay.width = canvasEl.width;
    overlay.height = canvasEl.height;
    const ctx = overlay.getContext('2d');
    ctx?.drawImage(canvasEl, 0, 0, overlay.width, overlay.height);

    overlay.classList.toggle(`stage-transition-overlay--${def.id}`, def.usesMask);
    overlay.style.opacity = '1';

    try {
      await work();
    } finally {
      const revealAnim = overlay.animate(def.reveal, { duration, easing: 'ease-in-out', fill: 'forwards' });
      const extra = def.extraAnimation ? transitionEffectRegistry.getAnimator(def.extraAnimation) : null;
      await Promise.all([revealAnim.finished, extra?.(duration)]);
      overlay.classList.remove(`stage-transition-overlay--${def.id}`);
      overlay.style.opacity = '0';
      canvasEl.style.pointerEvents = '';
    }
  }

  private async applyStageCore(stage: StageData, ignoreCamera = false): Promise<void> {

    // So substitui a lista se o payload REALMENTE trouxer andares.
    //
    // `stage.updated` (mudar escuridao, grid, clima...) manda um stage PARCIAL,
    // sem `levels`. Com `stage.levels || []` a lista era zerada, o alvo virava
    // nulo, currentLevelId virava '' e o canvas caia no modo "sem andares" —
    // onde isOnCurrentLevel() aceita tudo. Era isso que fazia a transicao de
    // dia/noite despejar os elementos de todos os andares na tela.
    if (Array.isArray(stage.levels) && stage.levels.length) {
      this.levels = stage.levels;
    }

    // Preserva o andar ativo se ele pertence a esta cena; so cai no andar base
    // quando nao ha andar valido (cena diferente, primeira carga).
    //
    // Zerar (`currentLevelId = ''`) punha o canvas no modo "sem andares", onde
    // isOnCurrentLevel() aceita tudo — todo elemento de todo andar aparecia.
    // Mas forcar o andar BASE tambem estava errado: applyStage roda de novo a
    // cada update de cena, entao trocar pro segundo andar e receber qualquer
    // refresh jogava o GM de volta pro terreo e os elementos de baixo voltavam.
    // O andar ativo so pode ser trocado por quem trocou de andar de fato.
    // Precedencia, nesta ordem:
    //  1. andar pedido explicitamente no payload (`stage.levelId`) — e o caso de
    //     "Puxar Jogadores" para um andar especifico e o de ativar cena;
    //  2. andar ativo, se ele pertence a ESTA cena — assim um update qualquer de
    //     cena nao joga o GM de volta pro terreo;
    //  3. andar base (menor elevacao).
    //
    // Faltava o item 1: ao ativar outra cena o `currentLevelId` era o da cena
    // anterior, nao batia com nenhum andar da nova, e caia sempre no base — dai
    // "sempre volta pro primeiro level".
    const wanted = (stage as any).levelId as string | undefined;
    // `explicit` so vale quando NAO e atualizacao da mesma cena. Em
    // `ignoreCamera === true` (transicao dia/noite, qualquer stage.updated) o
    // `activeStage` mergeado carrega um `levelId` residual da ativacao da cena
    // (andar base) que jogava o GM de volta pro primeiro andar em vez de manter
    // o andar que esta na tela.
    const explicit = !ignoreCamera && wanted
      ? (this.levels as any[]).find((l) => l.id === wanted)
      : null;
    const keep = this.currentLevelId
      ? (this.levels as any[]).find((l) => l.id === this.currentLevelId)
      : null;
    const target = explicit ?? keep ?? ([...(this.levels as any[])].sort(
      (a, b) => (a.bottomElevation ?? 0) - (b.bottomElevation ?? 0),
    )[0] ?? null);

    // `setLevel` e quem grava currentLevelId/Bounds e reaplica a visibilidade de
    // paredes, luzes, sons, notas e desenhos.
    //
    // Aqui havia `setLevel('', ...)`: o id vazio punha o canvas no modo "sem
    // andares", onde isOnCurrentLevel() aceita qualquer coisa — e todo elemento
    // de todo andar aparecia junto. As duas linhas que calculavam o alvo logo
    // acima eram descartadas na linha seguinte.
    this.setLevel(
      target?.id ?? '',
      target?.bottomElevation ?? stage.bottomElevation ?? 0,
      target?.topElevation ?? stage.topElevation ?? 20,
    );

    this.clearRemoteCursors();
    this.currentStageId = stage.id;
    this.gridSize = stage.gridSize || DEFAULT_GRID_SIZE;
    this.gridColor = stage.gridColor || DEFAULT_GRID_COLOR;
    this.gridOpacity = typeof stage.gridOpacity === 'number' ? stage.gridOpacity : 0.4;
    this.gridType = stage.gridType || 'square';
    this.gridDistance = stage.gridDistance ?? 5;
    this.gridUnit = stage.gridUnit || 'ft';
    this.sceneWidth = stage.width || DEFAULT_SCENE_WIDTH;
    this.sceneHeight = stage.height || DEFAULT_SCENE_HEIGHT;

    this.drawGrid();

    // O fundo mora no ANDAR, nao na cena. A coluna `backgroundUrl` saiu da
    // tabela `stages` quando os Levels entraram (migration 031), entao
    // `stage.backgroundUrl` e sempre undefined e o `bgUrl` so vem no payload
    // de `stage.activated`. Lendo so da cena, o canvas ficava sem mapa nenhum —
    // e como fog e luz trabalham revelando o que esta embaixo, tudo parecia
    // preto e as luzes viravam manchas flutuando sobre o vazio. Nao era bug do
    // fog: nao havia mapa para revelar.
    const bgUrl = (target as any)?.backgroundUrl || (stage as any).bgUrl || '';
    const bgColor = (target as any)?.backgroundColor || (stage as any).backgroundColor || '#0d0d0f';

    await this.setBgImage(bgUrl);
    this.setWeather(stage.weatherEffect || 'none');
    if (this.app) {
      this.app.renderer.background.color = bgColor;
    }

    this.fogLayer.setStageId(stage.id);
    this.fogLayer.setSceneSize(this.sceneWidth, this.sceneHeight);
    this.fogLayer.setDarkness(stage.darknessLevel ?? 0);
    this.applyFogConfig(stage);
    // Exploração persistida: carrega o que este usuário já explorou nesta cena
    // antes de desenhar o fog do frame seguinte.
    void this.loadFogReveals();
    // So corta a animacao na carga inicial da cena. Em atualizacao
    // (`ignoreCamera === true`) deixa o lerp por frame rodar, senao mudar a
    // escuridao dava um salto seco de dia para noite.
    if (!ignoreCamera) this.fogLayer.snapToTarget();
    this.fogLayer.update();
    this.fovDirty = true;
    this.updateFOV();
    this.syncLights();
    this.syncSounds();

    if (ignoreCamera) return;

    // Posicionar a câmera com base nas flags da cena ou centralizar
    const flags = (stage as any).flags || {};
    const initX = typeof flags.initialX === 'number' ? flags.initialX : 0;
    const initY = typeof flags.initialY === 'number' ? flags.initialY : 0;
    const initZoom = typeof flags.initialZoom === 'number' ? flags.initialZoom : 0;

    if (initZoom > 0 && (initX > 0 || initY > 0)) {
      this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, initZoom));
      this.app.stage.scale.set(this.zoomLevel);
      if (this.canvasEl) {
        const viewWidth = this.canvasEl.clientWidth || window.innerWidth;
        const viewHeight = this.canvasEl.clientHeight || window.innerHeight;
        this.app.stage.x = viewWidth / 2 - initX * this.zoomLevel;
        this.app.stage.y = viewHeight / 2 - initY * this.zoomLevel;
      }
    } else {
      this.centerView();
    }
  }

  /** Define o nível de escuridão da cena (0 = dia, 1 = noite total). */
  setDarkness(level: number, _animate = true): void {
    this.fogLayer.setDarkness(level);
    // Do NOT call fogLayer.update() here — the ticker's updateAnimations
    // calls fogLayer.animate(delta) each frame, which lerps and redraws.
  }

  /** Repassa a configuracao de fog da cena (tokenVision/modo/cores) para o layer. */
  applyFogConfig(stage: unknown): void {
    const s = stage as {
      tokenVision?: boolean;
      fogExplorationMode?: string;
      fogExploredColor?: string;
      fogUnexploredColor?: string;
    };
    const mode = s.fogExplorationMode || 'individual';
    this.fogLayer.setConfig({
      tokenVision: s.tokenVision !== false,
      fogExplorationMode: (mode === 'none' || mode === 'individual' || mode === 'shared') ? mode : 'individual',
      fogExploredColor: s.fogExploredColor || '#000000',
      fogUnexploredColor: s.fogUnexploredColor || '#000000',
    });
    this.fogLayer.update();
  }

  /**
   * Persistencia da exploracao:
   *  - load: ao ativar a cena, traz os polygonos j a explorados deste user.
   *  - save: quando o token LOCAL para de mover, faz merge da visao atual no
   *    explorado e envia `POST /api/fog-reveals` (debounced ~1.5s).
   * O servidor ja expoe GET/POST/DELETE em /api/fog-reveals per (stage,user).
   */
  private fogSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private async loadFogReveals(): Promise<void> {
    const stageId = this.currentStageId;
    const userId = this.userId;
    if (!stageId || !userId) return;
    try {
      const res = await api.get<{ explored: { x: number; y: number }[][] }>(
        `/fog-reveals/stage/${encodeURIComponent(stageId)}/user/${encodeURIComponent(userId)}`,
      );
      const fogClass = (window as any).Loom?.config?.FogReveal?.documentClass;
      if (fogClass?.prototype?.prepareDerivedData) fogClass.prototype.prepareDerivedData.call(res);
      // O fogExplorationMode 'none' desliga a restauro de explorado.
      const mode = (this.fogLayer as unknown as { config?: { fogExplorationMode?: string } }).config;
      const polls = mode?.fogExplorationMode === 'none' ? [] : (res?.explored ?? []);
      this.fogLayer.setExploredPolygons(polls);
      this.fogLayer.update();
    } catch (err) {
      console.warn('[fog] loadFogReveals failed', err);
    }
  }

  /** Merge da visao atual no explorado e agenda POST (debounced ~1.5s). */
  private saveFogReveals(): void {
    const stageId = this.currentStageId;
    const userId = this.userId;
    if (!stageId || !userId) return;
    // O merge roda no timeout (nao agora): durante um arrasto longo ha muitos
    // onMove, e mergear em cada um empilharia poligonos duplicados.
    if (this.fogSaveTimer) clearTimeout(this.fogSaveTimer);
    this.fogSaveTimer = setTimeout(() => {
      this.fogSaveTimer = null;
      this.fogLayer.mergeCurrentIntoExplored();
      this.fogLayer.update();
      const explored = this.fogLayer.getExploredPolygons();
      api.post('/fog-reveals', { stageId, userId, explored }).catch((err) => {
        console.warn('[fog] saveFogReveals failed', err);
      });
    }, 1500);
  }

  /** Reset: apaga a exploracao do usuario neste stage (CLIENT-side). */
  resetFogExploration(): void {
    this.fogLayer.resetExplored();
    this.saveFogReveals();
  }

  setGM(isGM: boolean): void {
    this.isGM = isGM;
    this.fogLayer.setIsGM(isGM);
    this.fogLayer.update();
    this.updateWallsInteractionState();
  }

  setUserId(userId: string): void {
    this.userId = userId;
    // Caso o userId chegue so depois da ativacao da cena, recarrega a
    // exploracao persistida do usuario. Idempotente.
    if (this.currentStageId) void this.loadFogReveals();
  }

  /**
   * Dispara a persistencia no fim de um movimento LOCAL de token controlado.
   * Aplica via setOnMove no game-hud/movement (fim de arrasto). Somente
   * jogador explora (GM têm o fog liberado; persiste nada).
   */
  commitFogOnMove(): void {
    if (this.isGM && !(this.fogLayer as any).gmVisionPreview) return;
    if (!this.fogLayer.getVisible()) return;
    this.saveFogReveals();
  }

  setCombatantIds(ids: string[]): void {
    this.combatantIds = new Set(ids);
    // updateToken() já aplica combat indicator + hidden via buildVisual()
  }

  // ─── Ambient Lights ──────────────────────────────────────────────────────

  setLights(lights: AmbientLightData[]): void {
    this.allLights = lights;
    this.syncLights();
  }

  syncLights(): void {
    this.lightsContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.lightGroups.clear();
    // O glow (lightsContainer) é reconstruído do zero acima, mas os ÍCONES
    // interativos (lightHandlesContainer) são um container separado que
    // updateLight() só some individualmente via removeLight() — sem isso,
    // o ícone da luz de uma cena antiga fica pra sempre visível na cena nova.
    this.lightHandlesContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.currentStageId) return;
    for (const light of this.allLights) {
      if (light.stageId === this.currentStageId && (!light.isHidden || this.isGM)) {
        this.updateLight(light);
      }
    }
    this.updateFogLightOrigins();
  }

  private updateFogLightOrigins(): void {
    if (!this.fogLayer || !this.currentStageId) return;
    const sceneLights = this.allLights
      .filter((l) => l.stageId === this.currentStageId && !l.isHidden)
      .map((l) => ({
        x: l.x,
        y: l.y,
        range: l.radius,
        walls: l.walls
      }));
    const origins = [...sceneLights, ...this.resolveTokenLightOrigins()];
    this.fogLayer.setLightOrigins(origins);
    this.fogLayer.update();
  }

  updateLight(data: AmbientLightData): void {
    if (this.currentStageId && data.stageId !== this.currentStageId) return;
    // Luz apagada: jogadores nunca veem o ícone nem o brilho. O GM continua
    // vendo o ícone (apagado/dimmed) pra poder clicar e reacender — apagar
    // não é o mesmo que deletar.
    if (data.isHidden && !this.isGM) {
      this.removeLight(data.id);
      return;
    }

    // Sync to allLights memory list
    const idx = this.allLights.findIndex((l) => l.id === data.id);
    if (idx >= 0) {
      this.allLights[idx] = data;
    } else {
      this.allLights.push(data);
    }

    let group = this.lightGroups.get(data.id);
    if (!group) {
      group = new Container();
      this.lightsContainer.addChild(group);
      this.lightGroups.set(data.id, group);
    }
    (group as any).__levelId = data.levelId ?? '';
    group.visible = this.isOnCurrentLevel(data.levelId);
    group.removeChildren().forEach((c) => c.destroy({ children: true }));
    group.x = data.x;
    group.y = data.y;

    const g = new Graphics();
    const color = parseInt(data.color.replace('#', '0x'), 16) || 0xffdd88;
    const intensity = data.isHidden ? 0 : Math.max(0, Math.min(1, data.intensity ?? 0.5));

    const bright = data.bright !== undefined ? Math.max(data.bright, 0) : data.radius * 0.5;
    const dim = data.dim !== undefined ? Math.max(data.dim, 0) : data.radius;
    const angle = data.angle !== undefined ? Math.max(10, Math.min(360, data.angle)) : 360;

    const angleRad = (angle * Math.PI) / 180;
    const rotationRad = ((data.rotation || 0) * Math.PI) / 180;
    const isFullCircle = angle >= 360;

    const startAngle = rotationRad - angleRad / 2;
    const endAngle = rotationRad + angleRad / 2;

    // Apply FOV polygon mask if walls block light (with padding range so mask doesn't clip soft blurred edge)
    group.mask = null;
    if (data.walls !== false && this.walls.length > 0 && dim > 0) {
      // Sem folga: a mascara é exatamente o alcance da luz recortado pelas
      // paredes. O `* 1.4` existia para não cortar a borda desfocada do brilho,
      // mas fazia a mascara ultrapassar a parede e a luz vazava do comodo.
      const activeWalls = this.getVisibleWalls().filter(w => w.light && !(w.door > 0 && w.doorState === 1));
      const fov = computeFOV(data.x, data.y, activeWalls, dim, 360, 360, 0, { x0: 0, y0: 0, x1: this.sceneWidth, y1: this.sceneHeight });
      if (fov.hasVision) {
        const maskG = new Graphics();
        maskG.moveTo(fov.polygon[0].x - data.x, fov.polygon[0].y - data.y);
        for (let i = 1; i < fov.polygon.length; i++) {
          maskG.lineTo(fov.polygon[i].x - data.x, fov.polygon[i].y - data.y);
        }
        maskG.closePath();
        maskG.fill({ color: 0xffffff });
        group.addChild(maskG);
        group.mask = maskG;
      }
    }

    const drawArea = (radius: number, alpha: number) => {
      if (radius <= 0) return;
      if (isFullCircle) {
        g.circle(0, 0, radius);
      } else {
        g.moveTo(0, 0);
        g.arc(0, 0, radius, startAngle, endAngle);
        g.lineTo(0, 0);
        g.closePath();
      }
      g.fill({ color, alpha });
    };

    // Desenha a área de brilho central
    drawArea(bright, intensity * 0.45);

    // Desenha a área de atenuação (dim)
    if (dim > bright) {
      drawArea(dim, intensity * 0.22);
    }

    // Ponto focal central (luz direta da lâmpada)
    const sourceRadius = Math.max(bright * 0.08, 4);
    if (isFullCircle) {
      g.circle(0, 0, sourceRadius);
    } else {
      g.moveTo(0, 0);
      g.arc(0, 0, sourceRadius, startAngle, endAngle);
      g.lineTo(0, 0);
      g.closePath();
    }
    g.fill({ color: 0xffffff, alpha: intensity * 0.5 });

    group.addChild(g);

    // Aplica o BlurFilter para mesclar as áreas e fazer o efeito de iluminação esfumaçada ultra-realista
    if (dim > 0) {
      const blur = new BlurFilter();
      blur.strength = dim * 0.18; // nível de desfoque proporcional ao raio da luz
      group.filters = [blur];
    } else {
      group.filters = null;
    }

    // Criar/atualizar o ícone de lâmpada interativo para o mestre
    let handle = this.lightHandlesContainer.children.find((c: any) => c.label === `handle-${data.id}`) as Container;
    if (!handle) {
      handle = new Container();
      handle.label = `handle-${data.id}`;
      this.lightHandlesContainer.addChild(handle);
    }
    handle.removeAllListeners(); // Remove listeners antigos para evitar duplicações e vazamento de requisições API
    handle.removeChildren().forEach((c) => c.destroy({ children: true }));
    handle.x = data.x;
    handle.y = data.y;
    // O handle vive em lightHandlesContainer, SEPARADO de lightGroups — filtrar
    // so o grupo da luz escondia o brilho mas deixava o icone de lampada e o
    // circulo de alcance visiveis no andar errado.
    (handle as any).__levelId = data.levelId ?? '';
    handle.visible = this.isOnCurrentLevel(data.levelId);

    const handleG = new Graphics();

    // Desenha o botão indicador central — cinza/apagado quando isHidden (só o GM vê)
    handleG.circle(0, 0, 10);
    handleG.fill({ color: data.isHidden ? 0x555555 : 0xee9b3a, alpha: data.isHidden ? 0.5 : 0.85 });
    handleG.stroke({ color: 0xffffff, width: 1.5, alpha: data.isHidden ? 0.5 : 0.9 });

    const handleText = new Text({
      text: '\uf0eb',
      style: {
        fontFamily: 'Font Awesome 5 Free',
        fontWeight: '900',
        fontSize: 10,
        fill: 0xffffff,
        align: 'center'
      }
    });
    handleText.anchor.set(0.5);

    handleG.eventMode = 'static';
    handleG.hitArea = new Circle(0, 0, 14); // Hit area on the graphic itself, not the container
    handleG.cursor = 'pointer';

    handle.addChild(handleG, handleText);
    handle.eventMode = 'static';
    // No hitArea on handle container — lets children (handleG, resizeG) define their own click areas

    let lastClick = 0;
    let dragStart: { x: number; y: number; lightX: number; lightY: number } | null = null;
    let draggingLight = false;

    const onLightDragMove = (event: any) => {
      if (!dragStart || !draggingLight) return;
      const localStage = this.app.stage.toLocal(event.global);
      const dx = localStage.x - dragStart.x;
      const dy = localStage.y - dragStart.y;

      const newX = Math.round(dragStart.lightX + dx);
      const newY = Math.round(dragStart.lightY + dy);

      // Temporarily update position in memory and canvas
      const lights = (this as any).allLights;
      const idx = lights.findIndex((l: any) => l.id === data.id);
      if (idx >= 0) {
        lights[idx].x = newX;
        lights[idx].y = newY;
        this.updateLight(lights[idx]);
        this.drawSelectionOutline();
      }
    };

    const onLightDragEnd = async () => {
      if (!draggingLight) return;
      draggingLight = false;
      dragStart = null;
      this.app.stage.off('pointermove', onLightDragMove);
      this.app.stage.off('pointerup', onLightDragEnd);
      this.app.stage.off('pointerupoutside', onLightDragEnd);

      const lights = (this as any).allLights;
      const currentLight = lights.find((l: any) => l.id === data.id);
      if (currentLight) {
        try {
          await api.put(`/stages/${currentLight.stageId}/lights/${currentLight.id}`, {
            x: currentLight.x,
            y: currentLight.y
          });
          showToast('Posição da iluminação salva', 'success');
        } catch (err) {
          console.error('Error saving light position:', err);
        }
      }
    };

    handle.on('pointerdown', (e) => {
      if (e.button === 2) return;
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClick < 300) {
        this.onLightDoubleClick?.(data.id);
      } else {
        this.selectLight(data.id);

        // Start dragging
        draggingLight = true;
        const localStage = this.app.stage.toLocal(e.global);
        dragStart = {
          x: localStage.x,
          y: localStage.y,
          lightX: data.x,
          lightY: data.y
        };
        this.app.stage.on('pointermove', onLightDragMove);
        this.app.stage.on('pointerup', onLightDragEnd);
        this.app.stage.on('pointerupoutside', onLightDragEnd);
      }
      lastClick = now;
    });

    handle.on('rightdown', (e) => {
      e.preventDefault?.();
      e.stopPropagation();
      this.onLightToggle?.(data.id);
    });

    // Mostra círculo de raio para TODAS as luzes quando a lighting tool está ativa
    const isSelected = this.selectedLightId === data.id;
    const isLightingToolActive = this.activeTool === 'create-light' || this.activeTool === 'select-light';

    if (isLightingToolActive) {
      // 1. Círculo do raio — mais visível se selecionado, suave se não
      const rangeCircle = new Graphics();
      rangeCircle.circle(0, 0, dim);
      rangeCircle.stroke({
        width: isSelected ? 2 : 1,
        color: 0xee9b3a,
        alpha: isSelected ? 0.6 : 0.25,
      });
      if (isSelected) {
        rangeCircle.circle(0, 0, dim);
        rangeCircle.fill({ color: 0xee9b3a, alpha: 0.04 });
      }
      rangeCircle.eventMode = 'none'; // Prevent this large circle from absorbing mouse events
      handle.addChild(rangeCircle);

      // 2. Alça de resize — só quando selecionado
      if (isSelected) {
        const resizeG = new Graphics();
        resizeG.circle(dim, 0, 7);
        resizeG.fill({ color: 0xffffff, alpha: 1 });
        resizeG.stroke({ color: 0xee9b3a, width: 2, alpha: 1 });

        resizeG.eventMode = 'static';
        resizeG.cursor = 'ew-resize';

        let dragging = false;

        const onDragMove = (event: any) => {
          if (!dragging) return;
          const localPos = handle.toLocal(event.global);
          const newDim = Math.max(20, Math.round(Math.hypot(localPos.x, localPos.y)));

          const lights = (this as any).allLights;
          const idx = lights.findIndex((l: any) => l.id === data.id);
          if (idx >= 0) {
            lights[idx].dim = newDim;
            lights[idx].bright = Math.max(10, Math.round(newDim * 0.5));
            lights[idx].radius = newDim;
            this.updateLight(lights[idx]);
          }
        };

        const onDragEnd = async () => {
          if (!dragging) return;
          dragging = false;
          this.app.stage.off('pointermove', onDragMove);
          this.app.stage.off('pointerup', onDragEnd);
          this.app.stage.off('pointerupoutside', onDragEnd);

          const lights = (this as any).allLights;
          const currentLight = lights.find((l: any) => l.id === data.id);
          if (currentLight) {
            try {
              await api.put(`/stages/${currentLight.stageId}/lights/${currentLight.id}`, {
                dim: currentLight.dim,
                bright: currentLight.bright,
                radius: currentLight.radius
              });
              showToast('Raio de luz atualizado', 'success');
            } catch (err) {
              console.error('Erro ao salvar alteração de raio de luz:', err);
            }
          }
        };

        resizeG.on('pointerdown', (e) => {
          e.stopPropagation();
          dragging = true;
          this.app.stage.on('pointermove', onDragMove);
          this.app.stage.on('pointerup', onDragEnd);
          this.app.stage.on('pointerupoutside', onDragEnd);
        });

        handle.addChild(resizeG);
      }
    }
    this.updateFogLightOrigins();
  }

  removeLight(id: string): void {
    const group = this.lightGroups.get(id);
    if (!group) return;
    this.lightsContainer.removeChild(group);
    group.destroy({ children: true });
    this.lightGroups.delete(id);

    // Remove handle
    const handle = this.lightHandlesContainer.children.find((c: any) => c.label === `handle-${id}`);
    if (handle) {
      this.lightHandlesContainer.removeChild(handle);
      handle.destroy({ children: true });
    }

    // Remove from memory list
    this.allLights = this.allLights.filter((l) => l.id !== id);
    if (this.selectedLightId === id) {
      this.selectedLightId = null;
      this.drawSelectionOutline();
    }
    this.updateFogLightOrigins();
  }

  // ─── Ambient Noises (Sounds) ───────────────────────────────────────────────

  setSounds(noises: NoiseData[]): void {
    this.allNoises = noises;
    this.syncSounds();
  }

  private syncSounds(): void {
    this.soundsContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.soundGroups.clear();
    if (!this.currentStageId) return;
    for (const noise of this.allNoises) {
      if (noise.stageId === this.currentStageId && (!noise.hidden || this.isGM)) {
        this.updateSound(noise);
      }
    }
  }

  updateSound(data: NoiseData): void {
    if (this.currentStageId && data.stageId !== this.currentStageId) return;
    if (data.hidden && !this.isGM) {
      this.removeSound(data.id);
      return;
    }

    // Sincroniza a lista de noises cacheada localmente com os novos dados
    const idx = this.allNoises.findIndex((n) => n.id === data.id);
    if (idx >= 0) {
      this.allNoises[idx] = data;
    } else {
      this.allNoises.push(data);
    }

    let group = this.soundGroups.get(data.id);
    if (!group) {
      group = new Container();
      this.soundsContainer.addChild(group);
      this.soundGroups.set(data.id, group);
    }
    (group as any).__levelId = data.levelId ?? '';
    group.visible = this.isOnCurrentLevel(data.levelId);
    group.removeChildren().forEach((c) => c.destroy({ children: true }));
    group.x = data.x;
    group.y = data.y;

    const isSoundTool = this.activeTool === 'sounds' || this.activeTool === 'select-sound';
    const isSelected = this.selectedSoundId === data.id;

    // Radius circle – mais visível quando tool ativa ou selecionado
    const g = new Graphics();
    if (isSoundTool || isSelected) {
      g.circle(0, 0, data.radius);
      g.stroke({
        width: isSelected ? 2 : 1,
        color: isSelected ? 0xffa500 : 0x3b82f6,
        alpha: isSelected ? 0.5 : 0.3,
      });
      if (isSelected) {
        g.circle(0, 0, data.radius);
        g.fill({ color: 0xffa500, alpha: 0.04 });
      }
    }
    g.eventMode = 'none';
    group.addChild(g);

    // Sound icon background — this is the actual clickable hit target; the
    // parent Container has no geometry of its own so `group.eventMode='static'`
    // alone does nothing without an interactive child (unlike Graphics, which
    // gets hit-testing from its drawn shape once eventMode is enabled).
    const bg = new Graphics();
    bg.circle(0, 0, 12);
    bg.fill({ color: 0x3b82f6, alpha: 0.8 });
    bg.eventMode = isSoundTool ? 'static' : 'none';
    bg.hitArea = new Circle(0, 0, 14);
    bg.cursor = 'pointer';
    group.addChild(bg);

    // Sound icon (Font Awesome volume-up)
    const icon = new Text({
      text: '\uf028',
      style: {
        fontFamily: 'Font Awesome 5 Free',
        fontWeight: '900',
        fontSize: 12,
        fill: 0xffffff,
        align: 'center'
      }
    });
    icon.anchor.set(0.5);
    icon.eventMode = 'none';
    group.addChild(icon);

    // Volume indicator
    const volumeText = new Text({
      text: Math.round(data.volume * 100) + '%',
      style: {
        fontFamily: 'Arial',
        fontSize: 10,
        fill: 0xffffff,
        align: 'center'
      }
    });
    volumeText.y = 20;
    volumeText.alpha = 0.7;
    volumeText.eventMode = 'none';
    group.addChild(volumeText);

    group.eventMode = isSoundTool ? 'static' : 'none';
    group.cursor = isSoundTool ? 'pointer' : 'default';

    if (!isSoundTool) return;

    if (isSelected) {
      // Resize handle on the radius edge - drawn at 0,0 and positioned at x=radius
      const resizeG = new Graphics();
      resizeG.circle(0, 0, 7);
      resizeG.fill({ color: 0xffffff, alpha: 1 });
      resizeG.stroke({ color: 0xffa500, width: 2, alpha: 1 });
      resizeG.x = data.radius;
      resizeG.y = 0;
      resizeG.eventMode = 'static';
      resizeG.cursor = 'ew-resize';
      group.addChild(resizeG);

      let isResizing = false;
      let resizeStartGlobalX = 0;
      let resizeStartRadius = data.radius;

      const onResizeMove = (e: FederatedPointerEvent) => {
        if (!isResizing) return;
        const local = group!.toLocal(e.global);
        const newRadius = Math.max(10, Math.round(Math.abs(local.x)));
        data.radius = newRadius;

        // Redesenha dinamicamente apenas a linha do círculo de alcance
        g.clear();
        g.circle(0, 0, newRadius);
        g.stroke({
          width: 2,
          color: 0xffa500,
          alpha: 0.5,
        });
        g.circle(0, 0, newRadius);
        g.fill({ color: 0xffa500, alpha: 0.04 });

        // Move o botão de resize para acompanhar a borda
        resizeG.x = newRadius;

        this.drawSelectionOutline();
      };

      const onResizeEnd = () => {
        if (!isResizing) return;
        isResizing = false;
        this.suppressSoundCreate = false;

        // Atualiza a lista cacheada localmente
        const idx = this.allNoises.findIndex((n) => n.id === data.id);
        if (idx >= 0) {
          this.allNoises[idx].radius = data.radius;
        }

        this.onSoundResize?.(data.id, data.radius);
        this.updateSound(data); // Redesenha tudo de forma limpa no final
        this.app.stage.off('pointermove', onResizeMove);
        this.app.stage.off('pointerup', onResizeEnd);
        this.app.stage.off('pointerupoutside', onResizeEnd);
      };

      resizeG.on('pointerdown', (e) => {
        e.stopPropagation();
        isResizing = true;
        this.suppressSoundCreate = true;
        resizeStartGlobalX = e.global.x;
        resizeStartRadius = data.radius;
        this.app.stage.on('pointermove', onResizeMove);
        this.app.stage.on('pointerup', onResizeEnd);
        this.app.stage.on('pointerupoutside', onResizeEnd);
      });
    }

    // Click: select + start drag; Double-click: open config
    let lastClick = 0;
    let dragStart: { x: number; y: number } | null = null;
    let originPos: { x: number; y: number } | null = null;

    const onDragMove = (e: FederatedPointerEvent) => {
      if (!dragStart || !originPos) return;
      const dx = (e.global.x - dragStart.x) / this.zoomLevel;
      const dy = (e.global.y - dragStart.y) / this.zoomLevel;
      group!.x = originPos.x + dx;
      group!.y = originPos.y + dy;
      data.x = group!.x;
      data.y = group!.y;
    };

    const onDragEnd = () => {
      if (!dragStart || !originPos) {
        dragStart = null;
        originPos = null;
        return;
      }
      dragStart = null;
      originPos = null;
      group!.alpha = 1;
      this.suppressSoundCreate = false;
      this.onSoundMove?.(data.id, data.x, data.y);
      this.drawSelectionOutline();
      this.app.stage.off('pointermove', onDragMove);
      this.app.stage.off('pointerup', onDragEnd);
      this.app.stage.off('pointerupoutside', onDragEnd);
    };

    const onPointerDown = (e: FederatedPointerEvent) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastClick < 300) {
        this.onNoiseDoubleClick?.(data.id);
        return;
      }
      lastClick = now;

      this.selectSound(data.id);

      dragStart = { x: e.global.x, y: e.global.y };
      originPos = { x: group!.x, y: group!.y };
      group!.alpha = 0.7;
      this.suppressSoundCreate = true;
      this.app.stage.on('pointermove', onDragMove);
      this.app.stage.on('pointerup', onDragEnd);
      this.app.stage.on('pointerupoutside', onDragEnd);
    };

    // Evita empilhar listeners a cada re-render (group é reaproveitado do map, nunca destruído)
    group.removeAllListeners();
    group.on('pointerdown', onPointerDown);
  }

  removeSound(id: string): void {
    const group = this.soundGroups.get(id);
    if (!group) return;
    this.soundsContainer.removeChild(group);
    group.destroy({ children: true });
    this.soundGroups.delete(id);
    this.allNoises = this.allNoises.filter((n) => n.id !== id);
  }

  /** Check if a point is within the radius of any sound */
  isPointInNoiseRadius(x: number, y: number): { inRange: boolean; noiseId: string | null; volume: number } {
    if (!this.currentStageId) return { inRange: false, noiseId: null, volume: 0 };

    for (const noise of this.allNoises) {
      if (noise.stageId === this.currentStageId && (!noise.hidden || this.isGM)) {
        const distance = Math.hypot(x - noise.x, y - noise.y);
        if (distance <= noise.radius) {
          // Calculate volume based on distance (fade out near edges)
          const volumeMultiplier = noise.easing ?
            Math.max(0, 1 - (distance / noise.radius)) : 1;
          const effectiveVolume = noise.volume * volumeMultiplier;
          return { inRange: true, noiseId: noise.id, volume: effectiveVolume };
        }
      }
    }
    return { inRange: false, noiseId: null, volume: 0 };
  }

  /** Get all sounds that affect a given point */
  getNoisesAtPoint(x: number, y: number): NoiseData[] {
    if (!this.currentStageId) return [];

    return this.allNoises.filter(noise => {
      if (noise.stageId !== this.currentStageId || (noise.hidden && !this.isGM)) return false;
      const distance = Math.hypot(x - noise.x, y - noise.y);
      return distance <= noise.radius;
    });
  }

  // ─── Notes (Map Pins) ─────────────────────────────────────────────────────

  setNotes(notes: NoteData[]): void {
    this.allNotes = notes;
    this.syncNotes();
  }

  private syncNotes(): void {
    this.notesContainer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.noteGroups.clear();
    if (!this.currentStageId) return;
    for (const note of this.allNotes) {
      if (note.stageId === this.currentStageId && !note.isHidden) {
        this.updateNote(note);
      }
    }
  }

  updateNote(data: NoteData): void {
    if (this.currentStageId && data.stageId !== this.currentStageId) return;
    if (data.isHidden) {
      this.removeNote(data.id);
      return;
    }

    let group = this.noteGroups.get(data.id);
    if (!group) {
      group = new Container();
      this.notesContainer.addChild(group);
      this.noteGroups.set(data.id, group);
    }
    (group as any).__levelId = data.levelId ?? '';
    group.visible = this.isOnCurrentLevel(data.levelId);
    group.removeChildren().forEach((c) => c.destroy({ children: true }));
    group.x = data.x;
    group.y = data.y;
    group.cursor = 'pointer';

    const g = new Graphics();
    g.circle(0, 0, 8);
    g.fill({ color: 0x3b82f6, alpha: 0.8 });
    g.stroke({ color: 0x1e40af, width: 2 });

    const text = new Text({
      text: 'i',
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,
        align: 'center'
      }
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(-2, -2);
    group.addChild(g);
    group.eventMode = 'static';
    group.on('pointerdown', () => {
      this.onNoteClick?.(data);
    });
  }

  removeNote(id: string): void {
    const group = this.noteGroups.get(id);
    if (!group) return;
    this.notesContainer.removeChild(group);
    group.destroy({ children: true });
    this.noteGroups.delete(id);
  }

  // ─── Walls / FOV / Fog of War ───────────────────────────────────────────

  /** Define as walls do stage atual (usadas pelo raycasting de FOV e renderização visual) */
  getWalls(): WallSegment[] {
    return this.walls;
  }

  getVisibleWalls(): WallSegment[] {
    if (!this.currentLevelId) return this.walls;
    return this.walls.filter(w => this.isOnCurrentLevel(w.levelId));
  }

  /**
   * Um elemento pertence ao andar ativo?
   *
   * Regra unica usada por setLevel() E pelos pontos de criacao/update de
   * sprite. Antes o filtro so existia dentro de setLevel(): qualquer wall/
   * light/noise/note/drawing que chegasse DEPOIS da troca de andar (criacao
   * local, eco de WS de outro cliente) nascia visible=true em qualquer andar
   * — era o "subcena mostra elementos da cena" reportado.
   *
   * Elemento sem levelId e legado/global: aparece em todo andar, igual a
   * convencao que setLevel() ja usava.
   */
  /** Andar de menor elevacao da cena atual — o "terreo". */
  private get baseLevelId(): string {
    if (!this.levels?.length) return '';
    return [...(this.levels as any[])].sort(
      (a, b) => (a.bottomElevation ?? 0) - (b.bottomElevation ?? 0),
    )[0]?.id ?? '';
  }

  private isOnCurrentLevel(levelId?: string): boolean {
    // Cena sem andares (mundo legado): nao ha o que filtrar, mostra tudo.
    if (!this.currentLevelId) return true;

    // Rede de seguranca para registro orfao (`levelId` vazio): trata como se
    // fosse do terreo, em vez de sumir da tela inteira.
    //
    // Sem isto, qualquer elemento criado antes de ser carimbado — ou por um
    // caminho de criacao que ainda nao manda o campo — ficava invisivel em
    // TODOS os andares, e o usuario via o token simplesmente nao aparecer ao
    // arrastar pra cena. Aparecer no terreo e errado de leve; sumir e pior.
    if (!levelId) return this.currentLevelId === this.baseLevelId;

    // Com andares, a regra e ESTRITA: cada andar tem os seus elementos e nao
    // compartilha nenhum. Antes daqui "sem levelId" era tratado como global e
    // aparecia em todos os andares — o que fazia parede/luz orfa vazar pra
    // cima e continuar bloqueando movimento e visao no andar errado, ja que
    // colisao e FOV usam getVisibleWalls().
    return levelId === this.currentLevelId;
  }

  /**
   * Tiles e tokens sao filtrados pela coordenada Z, nao por `levelId` — de
   * proposito, pra transitarem entre andares. Mesma regra do setLevel(): topo
   * exclusivo, pra um elemento na fronteira nao cair em dois andares.
   */
  private isOnCurrentElevation(elevation?: number): boolean {
    if (!this.currentLevelBounds) return true;
    const el = elevation ?? 0;
    return el >= this.currentLevelBounds.bottom && el < this.currentLevelBounds.top;
  }

  setWalls(walls: WallSegment[]): void {
    this.walls = walls;
    this.fogLayer.setWalls(this.getVisibleWalls());
    this.fovDirty = true;
    this.updateFOV();
    this.loadWalls();
    this.syncLights();
  }

  /** Renderiza visualmente todas as walls no layers.wall */
  loadWalls(): void {
    this.clearWalls();
    for (const w of this.walls) {
      this.renderWall(w);
    }
  }

  getWallById(id: string): WallSegment | undefined {
    return this.walls.find((w) => w.id === id);
  }

  renderWall(wall: WallSegment): void {
    // A parede tem que entrar na lista que o motor de visao consulta, senao ela
    // e desenhada mas nao bloqueia nada ate a cena ser recarregada. Vale para
    // parede criada, movida ou editada — todas passam por aqui.
    const wallIdx = this.walls.findIndex((w) => w.id === wall.id);
    if (wallIdx === -1) this.walls.push(wall);
    else this.walls[wallIdx] = wall;
    this.fogLayer.setWalls(this.getVisibleWalls());

    if (!wall.id) return;

    let container = this.wallShapes.get(wall.id);
    if (!container) {
      container = new Container();
      this.layers.wall.addChild(container);
      this.wallShapes.set(wall.id, container);
      this.attachWallBodyDrag(container, wall.id);
    }
    (container as any).__levelId = wall.levelId ?? '';
    container.visible = this.isOnCurrentLevel(wall.levelId);
    container.removeChildren().forEach((c) => c.destroy({ children: true, texture: false }));

    const g = new Graphics();

    const isOpenDoor = wall.door > 0 && wall.doorState === 1;
    const isLocked = wall.door > 0 && wall.doorState === 2;
    const isClosedDoor = wall.door > 0 && wall.doorState === 0;

    let color = 0xE8D840;
    if (isLocked) {
      color = 0xc94040; // = --color-danger do design system
    } else if (isClosedDoor) {
      color = 0x9040C0;
    } else if (isOpenDoor) {
      color = 0x80E0A0;
    } else if (!wall.sight && wall.movement) {
      color = 0x40C060;
    }

    const alpha = isOpenDoor ? 0.4 : 0.8;

    g.setStrokeStyle({ width: 5, color, alpha });
    g.moveTo(wall.x1, wall.y1);
    g.lineTo(wall.x2, wall.y2);
    g.stroke();

    // Nós de endpoint
    g.circle(wall.x1, wall.y1, 5);
    g.fill({ color: 0xffffff, alpha });
    g.circle(wall.x2, wall.y2, 5);
    g.fill({ color, alpha });

    container.addChild(g);

    if (wall.door > 0) {
      const mx = (wall.x1 + wall.x2) / 2;
      const my = (wall.y1 + wall.y2) / 2;

      const doorHandle = new Container();
      doorHandle.x = mx;
      doorHandle.y = my;
      container.addChild(doorHandle);

      const circleG = new Graphics();
      circleG.circle(0, 0, 14);
      circleG.fill({ color: 0x222222, alpha: 0.85 });
      circleG.stroke({ color: color, width: 1.5, alpha: 0.9 });
      doorHandle.addChild(circleG);

      // Tranca (cadeado) s\u00f3 quando trancada; porta aberta/fechada mostra o
      // \u00edcone de porta correspondente, nunca o cadeado.
      const doorIconUnicode = isLocked ? '\uf023' : isOpenDoor ? '\uf52b' : '\uf52a';
      const doorText = new Text({
        text: doorIconUnicode,
        style: {
          fontFamily: 'Font Awesome 5 Free',
          fontWeight: '900',
          fontSize: 14,
          fill: color,
          align: 'center'
        }
      });
      doorText.anchor.set(0.5);
      doorHandle.addChild(doorText);
    }

    const x1 = Number.isFinite(wall.x1) ? wall.x1 : 0;
    const y1 = Number.isFinite(wall.y1) ? wall.y1 : 0;
    const x2 = Number.isFinite(wall.x2) ? wall.x2 : x1;
    const y2 = Number.isFinite(wall.y2) ? wall.y2 : y1;
    container.hitArea = new Rectangle(
      Math.min(x1, x2) - 15,
      Math.min(y1, y2) - 15,
      Math.abs(x2 - x1) + 30,
      Math.abs(y2 - y1) + 30,
    );

    this.updateWallsInteractionState();
  }

  removeWall(id: string): void {
    const container = this.wallShapes.get(id);
    if (container) {
      this.layers.wall.removeChild(container);
      container.destroy({ children: true });
      this.wallShapes.delete(id);
    }
    this.walls = this.walls.filter((w) => w.id !== id);
    this.fogLayer.setWalls(this.getVisibleWalls());
    this.fovDirty = true;
    this.updateFOV();
    this.syncLights();
  }

  clearWalls(): void {
    this.wallShapes.forEach((c) => {
      this.layers.wall.removeChild(c);
      c.destroy({ children: true });
    });
    this.wallShapes.clear();
  }

  /** Ativa/desativa o cálculo de FOV (visão dos tokens controlados) */
  setFOVEnabled(enabled: boolean): void {
    this.fovEnabled = enabled;
    if (!enabled) {
      this.fogLayer.setControlledOrigins([]);
      this.fogLayer.update();
      return;
    }
    this.fovDirty = true;
    this.updateFOV();
  }

  /** Define o alcance de visão (em px) usado para os tokens controlados */
  setSightRange(px: number): void {
    this.fovSightRange = px;
    this.fogLayer.setSightRange(px);
    this.fovDirty = true;
    this.updateFOV();
  }

  /**
   * Um token gera origem de FOV se o usuário o controla OU se o GM o selecionou
   * (preview de visão). `resolveFOVOrigins()` já considera as duas listas — este
   * predicado existe para que os gatilhos de "token se moveu, recalcule" usem
   * exatamente o mesmo critério. Testar só `controlledTokenIds` fazia a visão do
   * GM ficar congelada na posição em que o token foi selecionado.
   */
  private isFOVOrigin(id: string): boolean {
    if (this.controlledTokenIds.has(id)) return true;
    return this.gmVisionPreview && this.gmVisionPreviewIds.has(id);
  }

  /** Define quais tokens são "controlados" (usados como origem do FOV) */
  setControlledTokens(ids: string[]): void {
    this.controlledTokenIds = new Set(ids);
    this.fovDirty = true;
    this.updateFOV();
  }

  /**
   * Preview de visão do GM. Ao selecionar um token, o fog desliga (GM vê o que
   * o token vê, nada além); ao desmarcar, volta a ver a cena toda.
   */
  setGMVisionPreview(ids: string[]): void {
    this.gmVisionPreviewIds = new Set(ids);
    this.gmVisionPreview = ids.length > 0;
    this.fogLayer.setGMVisionPreview(this.gmVisionPreview);
    this.fovDirty = true;
    this.updateFOV();
  }

  /** Recalcula o FOV combinado de todos os tokens controlados */
  private updateFOV(): void {
    // Luz de token (independente de FOV ligado/sujo) — chamado em todo ponto que já
    // recalcula por causa de movimento/drag/token novo, então a luz acompanha o
    // personagem nos mesmos gatilhos da visão, sem duplicar cada call site.
    this.updateFogLightOrigins();
    if (!this.fovEnabled || !this.fovDirty) return;
    if (this.controlledTokenIds.size === 0 && !this.gmVisionPreview) {
      this.fogLayer.setControlledOrigins([]);
      this.fogLayer.update();
      this.fovDirty = false;
      this.reapplyTokenVisibility();
      return;
    }

    this.fogLayer.setControlledOrigins(this.resolveFOVOrigins());
    this.fogLayer.update();
    this.fovDirty = false;
    this.reapplyTokenVisibility();
  }

  /**
   * Reaplica a visibilidade (FOV + luzes) de todos os tokens ja renderizados.
   * Necessario porque ao mudar a origem do FOV (selecionar/arrastar um token) a
   * fog atualiza, mas a flag `visible` dos tokens que ja existem so era tocada
   * quando cada um era (re)renderizado — o token na escuridao ficava visivel.
   */
  private reapplyTokenVisibility(): void {
    this.tokens.forEach((container, id) => {
      const data = this.tokenData.get(id);
      if (data) this.applyHiddenVisibility(container, data);
    });
  }

  /** Versão com throttle de updateFOV() — exclusiva para arraste de token.
   *  80ms entre recalques = ~12 fps, evita travamento em mapas com parede
   *  complexa sem parecer lerdo. */
  private throttledUpdateFOV = (() => {
    let lastCall = 0;
    return () => {
      const now = Date.now();
      if (now - lastCall < 80) return;
      lastCall = now;
      this.updateFOV();
    };
  })();

  /** Verifica se um ponto está visível (dentro do FOV atual ou já explorado) */
  isPointVisible(px: number, py: number): boolean {
    return this.fogLayer.isPointVisible(px, py);
  }

  /** Verifica se um ponto está dentro do FOV **atual** (sem considerar exploração). */
  isPointVisibleNow(px: number, py: number): boolean {
    return this.fogLayer.isPointVisibleNow(px, py);
  }

  /** Verifica se um ponto está iluminado por uma luz que o jogador consegue ver. */
  isPointLit(px: number, py: number): boolean {
    return this.fogLayer.isPointLit(px, py);
  }

  /** Já é chamado internamente por applyStage() após o setBgImage — NÃO chamar de novo em game-hud.ts após applyStage(), incrementa weatherGeneration e cancela setup assíncrono (fog) em andamento, causando o efeito sumir. */
  setWeather(type: string): void {
    this.weatherType = type || 'none';
    this.weatherGeneration++;
    const generation = this.weatherGeneration;

    if (this.weatherAnimId !== null) {
      cancelAnimationFrame(this.weatherAnimId);
      this.weatherAnimId = null;
    }
    if (this.weatherFlashTimeoutId !== null) {
      clearTimeout(this.weatherFlashTimeoutId);
      this.weatherFlashTimeoutId = null;
    }
    this.layers.weather.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.weatherParticles = [];
    this.weatherFlashGraphic = null;

    if (this.weatherType === 'none') return;

    if (this.weatherType === 'fog') {
      void this.setupFog(generation);
      return;
    }

    const isStorm = this.weatherType === 'storm';
    const isSnow = this.weatherType === 'snow';
    const count = isSnow ? 130 : isStorm ? 450 : this.weatherType === 'rain' ? 320 : 0;
    if (count === 0) return;

    void this.setupPrecipitation(generation, count, isSnow, isStorm);
  }

  /** Rain/snow/storm: sprites (trace/circle de public/weather/) em vez de linha/círculo vetorial cru. */
  private async setupPrecipitation(generation: number, count: number, isSnow: boolean, isStorm: boolean): Promise<void> {
    const textures = isSnow ? SNOW_TEXTURES : RAIN_TEXTURES;
    await Promise.all(textures.map((url) => Assets.load(url).catch(() => null)));

    if (generation !== this.weatherGeneration || this.destroyed) return;

    const w = this.sceneWidth || 800;
    const h = this.sceneHeight || 600;
    const isRainLike = !isSnow;

    for (let i = 0; i < count; i++) {
      const url = textures[Math.floor(Math.random() * textures.length)];
      const sprite = new Sprite(Texture.from(url));
      sprite.anchor.set(0.5);

      const vx = isRainLike ? (isStorm ? -3 + Math.random() * -4 : -1.5 + Math.random() * -2.5) : -0.5 + Math.random() * 1;
      const vy = isRainLike ? (isStorm ? 20 + Math.random() * 10 : 14 + Math.random() * 8) : 1 + Math.random() * 1.6;

      if (isRainLike) {
        // trace_*.png é um PNG 512x512 com a linha de brilho ocupando só uma fração fina
        // do quadro — forçar width em poucos px (proporcional ao 512 original) esmagava
        // essa fração até virar sub-pixel e sumir. Width agora escala junto com o height
        // (fração de ~1/5, não um valor absoluto minúsculo) pra manter o traço visível.
        // Blend "add" + tint quase branco pra ler como brilho de água, não como mancha.
        // Rotação segue o ângulo real da velocidade (queda + vento) de cada partícula.
        const len = isStorm ? 40 + Math.random() * 16 : 30 + Math.random() * 14;
        sprite.height = len;
        sprite.width = len * (0.22 + Math.random() * 0.08);
        sprite.tint = 0xf0f6ff;
        sprite.alpha = isStorm ? 0.95 + Math.random() * 0.05 : 0.85 + Math.random() * 0.15;
        sprite.blendMode = 'add';
        sprite.rotation = Math.atan2(vx, vy);
      } else {
        const size = 3 + Math.random() * 5;
        sprite.width = size;
        sprite.height = size;
        sprite.tint = 0xffffff;
        sprite.alpha = 0.5 + Math.random() * 0.4;
      }

      sprite.x = Math.random() * w;
      sprite.y = Math.random() * h;

      this.layers.weather.addChild(sprite);
      this.weatherParticles.push({ g: sprite, vx, vy });
    }

    if (isStorm) {
      this.setupLightningFlash(generation);
    }

    const updateWeather = () => {
      if (this.destroyed || this.weatherType === 'none' || generation !== this.weatherGeneration) return;
      const width = this.sceneWidth || 800;
      const height = this.sceneHeight || 600;

      for (const p of this.weatherParticles) {
        p.g.x += p.vx;
        p.g.y += p.vy;

        if (this.weatherType === 'snow') {
          p.g.x += Math.sin(p.g.y * 0.02 + Date.now() * 0.001) * 0.3;
        }

        if (p.g.y > height + 20) {
          p.g.y = -20;
          p.g.x = Math.random() * width;
        }
        if (p.g.x < -100) p.g.x = width + 50;
        if (p.g.x > width + 100) p.g.x = -50;
      }

      this.weatherAnimId = requestAnimationFrame(updateWeather);
    };
    this.weatherAnimId = requestAnimationFrame(updateWeather);
  }

  /** Fog: sprites de fumaça (public/weather/smoke_*.png) grandes, opacos de leve, à deriva. */
  private async setupFog(generation: number): Promise<void> {
    const w = this.sceneWidth || 800;
    const h = this.sceneHeight || 600;
    const spriteCount = Math.max(10, Math.round((w * h) / 450000));

    const urls = Array.from({ length: spriteCount }, () => FOG_TEXTURES[Math.floor(Math.random() * FOG_TEXTURES.length)]);
    await Promise.all(urls.map((url) => Assets.load(url).catch(() => null)));

    if (generation !== this.weatherGeneration || this.destroyed) return;

    for (const url of urls) {
      const sprite = new Sprite(Texture.from(url));
      sprite.anchor.set(0.5);
      const scale = 3.2 + Math.random() * 2.5;
      sprite.width = 512 * scale;
      sprite.height = 512 * scale;
      sprite.tint = 0xd8dee8;
      sprite.alpha = 0.28 + Math.random() * 0.18;
      sprite.x = Math.random() * w;
      sprite.y = Math.random() * h;
      this.layers.weather.addChild(sprite);
      this.weatherParticles.push({
        g: sprite,
        vx: 0.08 + Math.random() * 0.15,
        vy: (Math.random() - 0.5) * 0.03,
      });
    }

    const updateFog = () => {
      if (this.destroyed || this.weatherType !== 'fog' || generation !== this.weatherGeneration) return;
      const width = this.sceneWidth || 800;
      const t = Date.now() * 0.0004;

      for (const p of this.weatherParticles) {
        p.g.x += p.vx;
        p.g.y += p.vy;
        p.g.alpha = 0.28 + (Math.sin(t + p.g.x * 0.001) + 1) * 0.09;

        if (p.g.x > width + 400) p.g.x = -400;
      }

      this.weatherAnimId = requestAnimationFrame(updateFog);
    };
    this.weatherAnimId = requestAnimationFrame(updateFog);
  }

  /** Storm: flash de tela ocasional (glow radial public/weather/light_01.png) simulando raio. */
  private setupLightningFlash(generation: number): void {
    void Assets.load(FLASH_TEXTURE).catch(() => null);

    const scheduleFlash = () => {
      const delay = 8000 + Math.random() * 14000;
      this.weatherFlashTimeoutId = setTimeout(() => {
        if (this.destroyed || this.weatherType !== 'storm' || generation !== this.weatherGeneration) return;

        const flash = new Graphics();
        // layers.weather é filho de app.stage (mundo/grid), então desenhar em (0,0,sceneWidth,sceneHeight)
        // confina o flash à área da cena — não vaza pro espaço vazio fora do mapa quando a câmera dá pan/zoom.
        flash.rect(0, 0, this.sceneWidth || 800, this.sceneHeight || 600);
        flash.fill({ color: 0xe8ecff, alpha: 1 });
        flash.alpha = 0;
        this.layers.weather.addChild(flash);

        // Intensidade variável: a maioria dos raios é fraca/distante, só de vez em quando um forte.
        const peakAlpha = Math.random() < 0.2 ? 0.28 + Math.random() * 0.12 : 0.08 + Math.random() * 0.1;
        let frame = 0;
        const totalFrames = 22;
        const animateFlash = () => {
          frame++;
          flash.alpha = frame <= 2 ? (frame / 2) * peakAlpha : Math.max(0, peakAlpha * (1 - (frame - 2) / (totalFrames - 2)));
          if (frame < totalFrames && generation === this.weatherGeneration) {
            requestAnimationFrame(animateFlash);
          } else {
            flash.destroy();
          }
        };
        requestAnimationFrame(animateFlash);

        scheduleFlash();
      }, delay);
    };
    scheduleFlash();
  }

  private async setBgImage(url: string): Promise<void> {
    // Limpar textura anterior imediatamente para evitar artefatos da cena anterior
    this.bgSprite.texture = Texture.EMPTY;

    if (!url) return;
    try {
      // Usar o Assets.load nativo do PixiJS v8 que retorna uma Promise resolvida com a textura
      const texture = await loadSmartTexture(url);

      if (this.bgSprite.destroyed) return;
      this.bgSprite.texture = texture;

      // Ajusta a imagem exatamente nas dimensões da cena (grade) para que nunca a ultrapasse
      this.bgSprite.width = this.sceneWidth;
      this.bgSprite.height = this.sceneHeight;
      this.bgSprite.position.set(0, 0);
    } catch (e) {
      console.error('[CanvasManager] Failed to load background:', e);
    }
  }

  drawGrid(): void {
    if (!this.gridGraphics) return;
    this.gridGraphics.clear();

    const width = this.sceneWidth || DEFAULT_SCENE_WIDTH;
    const height = this.sceneHeight || DEFAULT_SCENE_HEIGHT;

    // Moldura da cena: era #ff4444 com alpha 0.6, o elemento mais chamativo da
    // tela inteira. Passa a ser uma borda neutra e discreta.
    this.gridGraphics.setStrokeStyle({ width: 1, color: 0x666666, alpha: 0.5 });
    this.gridGraphics.rect(0, 0, width, height);
    this.gridGraphics.stroke();

    if (this.gridType === 'gridless') {
      return;
    }

    const size = this.gridSize || DEFAULT_GRID_SIZE;
    const colorHexValue = parseInt(this.gridColor.replace('#', '0x'), 16) || 0xffffff;

    this.gridGraphics.setStrokeStyle({ width: 1, color: colorHexValue, alpha: this.gridOpacity });

    if (this.gridType === 'hex') {
      this.drawHexGrid(size, width, height);
    } else {
      this.drawSquareGrid(size, width, height);
    }
  }

  private drawSquareGrid(size: number, width: number, height: number): void {
    for (let x = 0; x < width; x += size) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, height);
    }
    for (let y = 0; y < height; y += size) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(width, y);
    }
    this.gridGraphics.stroke();
  }

  private drawHexGrid(size: number, width: number, height: number): void {
    const hexWidth = Math.sqrt(3) * size;
    const hexHeight = 2 * size;
    const vertDist = hexHeight * 0.75;

    // Calculate bounds
    const cols = Math.ceil(width / hexWidth) + 2;
    const rows = Math.ceil(height / vertDist) + 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate center position
        let centerX = col * hexWidth;
        let centerY = row * vertDist;

        // Offset every other row for hexagonal pattern
        if (row % 2 === 1) {
          centerX += hexWidth / 2;
        }

        // Only draw if hexagon is visible
        if (centerX + size < 0 || centerX - size > width ||
          centerY + size < 0 || centerY - size > height) {
          continue;
        }

        // Draw hexagon (pointy-top)
        this.gridGraphics.moveTo(
          centerX + size * Math.cos(-90 * Math.PI / 180),
          centerY + size * Math.sin(-90 * Math.PI / 180)
        );

        for (let i = 1; i <= 6; i++) {
          this.gridGraphics.lineTo(
            centerX + size * Math.cos((-90 + i * 60) * Math.PI / 180),
            centerY + size * Math.sin((-90 + i * 60) * Math.PI / 180)
          );
        }

        this.gridGraphics.closePath();
      }
    }

    this.gridGraphics.stroke();
  }

  // ─── Active Tiles ─────────────────────────────────────────────────────────

  setTiles(tiles: TileData[]): void {
    this.clearTiles();
    for (const tile of tiles) {
      this.updateTile(tile);
    }
    this.startOcclusionTicker();
  }

  async updateTile(data: TileData): Promise<void> {
    if (this.currentStageId && data.stageId !== this.currentStageId) return;
    if (!data.isActive) {
      if (this.isGM && (data.triggers?.length || data.actions?.length)) {
        // GM sees inactive tiles dimmed — don't remove, just dim below
      } else {
        this.removeTile(data.id);
        return;
      }
    }

    this.tileData.set(data.id, data);
    let sprite = this.tiles.get(data.id);

    if (!sprite) {
      sprite = new Sprite();
      const targetLayer = data.isOverhead ? this.layers.overhead : this.layers.tile;
      targetLayer.addChild(sprite);
      this.tiles.set(data.id, sprite);
      this.attachTileInteraction(sprite, data.id);
    } else {
      const targetLayer = data.isOverhead ? this.layers.overhead : this.layers.tile;
      if (sprite.parent !== targetLayer) {
        sprite.removeFromParent();
        targetLayer.addChild(sprite);
      }
    }

    sprite.x = data.x;
    sprite.y = data.y;
    sprite.width = data.width;
    sprite.height = data.height;
    sprite.rotation = ((data.rotation ?? 0) * Math.PI) / 180;
    // Sem isto o filtro de andar so existia dentro de setLevel(): tile criado
    // ou atualizado depois da troca continuava visivel no andar errado.
    //
    // Passou a olhar `levelId` e nao `elevation`: filtrar por Z exigia que
    // alguem mantivesse o numero de elevacao de cada tile na mao, o que nunca
    // acontece — na pratica tile vazava de uma subcena para outra.
    sprite.visible = this.isOnCurrentLevel((data as any).levelId);
    if (data.hidden) {
      if (this.isGM) {
        sprite.renderable = true;
        sprite.alpha = (data.opacity ?? 1) * 0.5;
      } else {
        sprite.renderable = false;
        sprite.alpha = data.opacity ?? 1;
      }
    } else {
      sprite.renderable = true;
      sprite.alpha = data.isActive ? (data.opacity ?? 1) : (data.opacity ?? 1) * 0.35;
    }
    if (data.tintColor) {
      sprite.tint = parseInt(data.tintColor.replace('#', '0x'), 16);
    } else {
      sprite.tint = 0xffffff;
    }

    if (data.imgUrl) {
      try {
        sprite.texture = await loadSmartTexture(data.imgUrl);
      } catch (e) {
        console.error('[CanvasManager] Failed to load tile texture:', data.imgUrl, e);
      }
    } else {
      // Draw a fallback card or gridless style rectangular placeholder
      const g = new Graphics();
      g.rect(0, 0, data.width, data.height);
      g.fill({ color: 0x1a1620, alpha: 0.85 });
      g.stroke({ width: 2, color: 0xee9b3a, alpha: 0.5 });

      const text = new Text({
        text: data.name || 'Tile',
        style: { fontFamily: 'Arial', fontSize: 11, fill: 0xf0e6d3 }
      });
      text.anchor.set(0.5);
      text.position.set(data.width / 2, data.height / 2);

      // Graphics.addChild() está depreciado no Pixi v8 (Graphics deixou de ser
      // Container) — junta os dois num Container próprio só pra gerar a
      // textura, em vez de addChild direto no Graphics.
      const group = new Container();
      group.addChild(g, text);
      const texture = this.app.renderer.generateTexture(group);
      sprite.texture = texture;
      group.destroy({ children: true });
    }

    this.updateTileGMOverlay(data, sprite);
  }

  removeTile(id: string): void {
    const sprite = this.tiles.get(id);
    if (!sprite) return;
    this.layers.tile.removeChild(sprite);
    sprite.destroy({ children: true });
    this.tiles.delete(id);
    this.tileData.delete(id);
    this.removeTileBadge(id);
    if (this.selectedTileId === id) {
      this.selectTile(null);
    }
    windowManager.close(`tile-config-${id}`);
  }

  private updateTileGMOverlay(data: TileData, sprite: Sprite): void {
    if (!this.isGM || !this.isTileTool()) {
      this.removeTileBadge(data.id);
      return;
    }
    const hasTriggers = (data.triggers?.length ?? 0) > 0 || (data.actions?.length ?? 0) > 0;
    if (!hasTriggers) {
      this.removeTileBadge(data.id);
      return;
    }
    this.drawTileBadge(data, sprite);
  }

  private removeTileBadge(id: string): void {
    const existing = this.tileBadges.get(id);
    if (existing) {
      existing.removeFromParent();
      existing.destroy({ children: true });
      this.tileBadges.delete(id);
    }
  }

  private drawTileBadge(data: TileData, sprite: Sprite): void {
    this.removeTileBadge(data.id);
    const recipeIcons: Record<string, string> = {
      teleport: '\u{1F300}', trap: '\u26A1', 'secret-door': '\u{1F6AA}',
      'scene-passage': '\u{1F30D}', sign: '\u{1F4D6}', 'ambient-sound': '\u{1F50A}',
      ambush: '\u{1F5E1}',
    };
    const icon = data.recipeId && recipeIcons[data.recipeId] ? recipeIcons[data.recipeId] : '\u2699';

    const bg = new Graphics();
    bg.roundRect(0, 0, 22, 22, 4);
    bg.fill({ color: 0x1a1620, alpha: 0.85 });
    bg.stroke({ width: 1, color: 0xffa500, alpha: 0.7 });

    const badgeLabel = new Text({
      text: icon,
      style: { fontFamily: 'Arial', fontSize: 13, fill: 0xf0e6d3 },
    });
    badgeLabel.anchor.set(0.5);
    badgeLabel.position.set(11, 11);
    bg.addChild(badgeLabel);

    bg.position.set(sprite.x + data.width - 24, sprite.y - 2);
    this.layers.interface.addChild(bg);
    this.tileBadges.set(data.id, bg);
  }

  private showTileTooltip(id: string): void {
    if (!this.isGM || !this.isTileTool()) return;
    const data = this.tileData.get(id);
    if (!data) return;
    const hasTriggers = (data.triggers?.length ?? 0) > 0 || (data.actions?.length ?? 0) > 0;
    if (!hasTriggers) return;
    const summary = this.generateTileSummary(data);
    if (!summary) return;

    this.hideTileTooltip();

    const bg = new Graphics();
    bg.roundRect(0, 0, 1, 1, 4);
    bg.fill({ color: 0x1a1620, alpha: 0.9 });
    bg.stroke({ width: 1, color: 0xffa500, alpha: 0.5 });

    const text = new Text({
      text: summary,
      style: { fontFamily: 'Arial', fontSize: 11, fill: 0xf0e6d3, wordWrap: true, wordWrapWidth: 260 },
    });
    text.position.set(8, 6);

    const pad = 12;
    bg.clear();
    bg.roundRect(0, 0, Math.min(text.width + pad, 276), text.height + pad, 4);
    bg.fill({ color: 0x1a1620, alpha: 0.9 });
    bg.stroke({ width: 1, color: 0xffa500, alpha: 0.5 });

    const container = new Container();
    container.addChild(bg);
    container.addChild(text);
    container.position.set(data.x + data.width + 6, data.y);
    // Keep tooltip on screen
    if (container.x + container.width > (this.app.screen.width || 3000)) {
      container.x = data.x - container.width - 6;
    }

    this.tileTooltipBg = bg;
    this.layers.interface.addChild(container);
    this.tileTooltip = container;
  }

  private hideTileTooltip(): void {
    if (this.tileTooltip) {
      this.tileTooltip.removeFromParent();
      this.tileTooltip.destroy({ children: true });
      this.tileTooltip = null;
    }
    this.tileTooltipBg = null;
  }

  private generateTileSummary(data: TileData): string {
    const triggers: any[] = data.triggers ?? [];
    const conditions: any[] = data.conditions ?? [];
    const actions: any[] = data.actions ?? [];
    if (triggers.length === 0 && actions.length === 0) return '';

    const eventLabels: Record<string, string> = {
      'token-enter': 'on token enter', 'token-exit': 'on token exit',
      'token-move-inside': 'on move inside', 'click': 'on click',
    };
    const actionDesc = (a: any): string => {
      const map: Record<string, string> = {
        teleport: 'teleports', 'toggle-visibility': 'toggles visibility',
        'play-sound': 'plays sound', 'show-dialog': 'shows dialog',
        'pause-game': 'pauses game', 'toggle-lock': 'toggles lock',
        'activate-tile': 'activates/deactivates tile',
        'chat-message': 'sends message', 'show-notification': 'shows notification',
      };
      return map[a.type] || a.type;
    };

    const when = triggers.map((t) => eventLabels[t.event] || t.event).join(', ');
    const what = actions.map(actionDesc).join(', ');
    if (triggers.length > 0 && actions.length > 0) return `${when}: ${what}`;
    if (actions.length > 0) return what;
    return '';
  }

  private drawTeleportArrow(): void {
    // Remove old arrow
    if (this.teleportArrow) {
      this.teleportArrow.removeFromParent();
      this.teleportArrow.destroy();
      this.teleportArrow = null;
    }
    if (!this.isGM || !this.selectedTileId) return;
    const data = this.tileData.get(this.selectedTileId);
    if (!data) return;
    const teleportAction = (data.actions ?? []).find((a) => a.type === 'teleport');
    if (!teleportAction) return;
    const cfg = teleportAction.config || {};
    const tX = cfg.targetX;
    const tY = cfg.targetY;
    if (tX == null || tY == null) return;
    const sprite = this.tiles.get(this.selectedTileId);
    if (!sprite) return;

    // If teleport goes to another stage, show a marker with stage name
    if (cfg.stageId && cfg.stageId !== this.currentStageId) {
      const marker = new Text({
        text: `\u{1F30D} ${cfg.stageId}`,
        style: { fontFamily: 'Arial', fontSize: 12, fill: 0x00bfff },
      });
      marker.position.set(tX, tY - 16);
      this.teleportArrow = marker;
      this.layers.interface.addChild(marker);
      return;
    }

    // Draw arrow to destination on same stage
    const arrow = new Graphics();
    const sx = data.x + data.width / 2;
    const sy = data.y + data.height / 2;
    const ex = Number(tX);
    const ey = Number(tY);

    // Line
    arrow.moveTo(sx, sy);
    arrow.lineTo(ex, ey);
    arrow.stroke({ width: 2, color: 0x00bfff, alpha: 0.8 });

    // Arrowhead
    const angle = Math.atan2(ey - sy, ex - sx);
    const headLen = 10;
    arrow.moveTo(ex, ey);
    arrow.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4));
    arrow.moveTo(ex, ey);
    arrow.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4));
    arrow.stroke({ width: 2, color: 0x00bfff, alpha: 0.8 });

    // Destination dot
    arrow.circle(ex, ey, 4);
    arrow.fill({ color: 0x00bfff, alpha: 0.8 });

    this.teleportArrow = arrow;
    this.layers.interface.addChild(arrow);
  }

  clearTiles(): void {
    for (const id of Array.from(this.tiles.keys())) {
      this.removeTile(id);
    }
    this.occlusionTickerActive = false;
  }

  private updateOverheadTileOcclusion(): void {
    const overheadTiles: { sprite: Sprite; data: TileData }[] = [];
    for (const [id, sprite] of this.tiles) {
      const data = this.tileData.get(id);
      if (data?.isOverhead && data.occlusion?.mode === 'fade') {
        overheadTiles.push({ sprite, data });
      }
    }
    if (overheadTiles.length === 0) {
      this.occlusionTickerActive = false;
      return;
    }

    const tokenBounds: { x: number; y: number; r: number }[] = [];
    this.tokens.forEach((token) => {
      tokenBounds.push({ x: token.x, y: token.y, r: TOKEN_RADIUS });
    });

    for (const { sprite, data } of overheadTiles) {
      let closest = false;
      const tx = data.x;
      const ty = data.y;
      const tw = data.width;
      const th = data.height;
      for (const token of tokenBounds) {
        const closestX = Math.max(tx, Math.min(token.x, tx + tw));
        const closestY = Math.max(ty, Math.min(token.y, ty + th));
        const dist = Math.hypot(token.x - closestX, token.y - closestY);
        if (dist < token.r) {
          closest = true;
          break;
        }
      }
      sprite.alpha = closest ? (data.occlusion?.alpha ?? 0.3) : 1;
    }
  }

  private startOcclusionTicker(): void {
    if (this.occlusionTickerActive) return;
    this.occlusionTickerActive = true;
    const tick = () => {
      if (!this.occlusionTickerActive || this.destroyed) return;
      this.updateOverheadTileOcclusion();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private attachTileInteraction(sprite: Sprite, id: string): void {
    const tileData = this.tileData.get(id);
    const hasTriggers = (tileData?.triggers?.length ?? 0) > 0 || (tileData?.actions?.length ?? 0) > 0;
    const interactable = this.isTileTool() || hasTriggers;
    sprite.eventMode = interactable ? 'static' : 'none';
    sprite.cursor = this.isTileTool() ? 'pointer' : (hasTriggers ? 'pointer' : 'default');

    let dragStart: { x: number; y: number } | null = null;
    let originPos: { x: number; y: number } | null = null;
    let moved = false;
    let isResizing = false;
    let resizeCorner: 'tl' | 'tr' | 'bl' | 'br' | null = null;
    let resizeStartGlobal: { x: number; y: number } | null = null;
    let resizeStartBounds: { x: number; y: number; width: number; height: number } | null = null;
    const CLICK_THRESHOLD = 5;

    let lastClick = 0;
    sprite.on('pointerdown', (event: FederatedPointerEvent) => {
      const tileData = this.tileData.get(id);
      if (tileData?.locked) {
        event.stopPropagation();
        return;
      }
      if (this.activeTool === 'place-tile' || this.activeTool === 'tile-browse') return;
      const isSelecting = this.activeTool === 'select-tile' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette';
      if (event.button === 2) {
        event.preventDefault();
        const latest = this.tileData.get(id);
        if (latest) this.onTileContextMenu?.(latest, event);
        return;
      }
      if (!this.isTileTool()) return;

      // Check resize handle hit on selected tile
      if (this.selectedTileId === id && isSelecting) {
        const td = this.tileData.get(id);
        if (td) {
          // Compara em coordenadas globais (tela), nao locais do sprite — toLocal()
          // devolve o espaco pre-escala da textura (0..texture.width), que so bate
          // com td.width/height por coincidencia (tile fallback). Pra tile com imagem
          // real a textura quase nunca tem o mesmo tamanho em px do tile redimensionado,
          // entao o hit-test nunca acertava os cantos.
          const threshold = 10;
          const corners: Array<{ key: typeof resizeCorner; x: number; y: number }> = [
            { key: 'tl', x: 0, y: 0 },
            { key: 'tr', x: td.width, y: 0 },
            { key: 'bl', x: 0, y: td.height },
            { key: 'br', x: td.width, y: td.height },
          ];
          for (const c of corners) {
            const globalCorner = this.app.stage.toGlobal({ x: sprite.x + c.x, y: sprite.y + c.y });
            if (Math.abs(event.global.x - globalCorner.x) <= threshold && Math.abs(event.global.y - globalCorner.y) <= threshold) {
              isResizing = true;
              resizeCorner = c.key;
              resizeStartGlobal = { x: event.global.x, y: event.global.y };
              resizeStartBounds = { x: sprite.x, y: sprite.y, width: td.width, height: td.height };
              event.stopPropagation();
              return;
            }
          }
        }
      }

      dragStart = { x: event.global.x, y: event.global.y };
      originPos = { x: sprite.x, y: sprite.y };
      moved = false;
      sprite.alpha = 0.7;

      if (!isSelecting) return;
      const now = Date.now();
      if (now - lastClick < 300) {
        void windowManager.open(`tile-config-${id}`, TileConfigWindow, {
          id: `tile-config-${id}`,
          tileId: id,
        });
        dragStart = null;
        originPos = null;
      } else {
        this.selectTile(id);
      }
      lastClick = now;
    });

    const cursorByCorner: Record<'tl' | 'tr' | 'bl' | 'br', string> = {
      tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize',
    };
    sprite.on('pointermove', (event: FederatedPointerEvent) => {
      if (isResizing || dragStart) return;
      const isSelecting = this.activeTool === 'select-tile' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette';
      if (!(this.selectedTileId === id && isSelecting)) { sprite.cursor = 'pointer'; return; }
      const td = this.tileData.get(id);
      if (!td) return;
      const threshold = 10;
      const corners: Array<{ key: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }> = [
        { key: 'tl', x: 0, y: 0 }, { key: 'tr', x: td.width, y: 0 },
        { key: 'bl', x: 0, y: td.height }, { key: 'br', x: td.width, y: td.height },
      ];
      for (const c of corners) {
        const g = this.app.stage.toGlobal({ x: sprite.x + c.x, y: sprite.y + c.y });
        if (Math.abs(event.global.x - g.x) <= threshold && Math.abs(event.global.y - g.y) <= threshold) {
          sprite.cursor = cursorByCorner[c.key];
          return;
        }
      }
      sprite.cursor = 'pointer';
    });

    const onStageMove = (event: FederatedPointerEvent) => {
      // Handle resize
      if (isResizing && resizeCorner && resizeStartGlobal && resizeStartBounds) {
        const dx = (event.global.x - resizeStartGlobal.x) / this.zoomLevel;
        const dy = (event.global.y - resizeStartGlobal.y) / this.zoomLevel;

        let newX = resizeStartBounds.x;
        let newY = resizeStartBounds.y;
        let newW = resizeStartBounds.width;
        let newH = resizeStartBounds.height;

        if (resizeCorner === 'tr' || resizeCorner === 'br') {
          newW = Math.max(50, resizeStartBounds.width + dx);
        } else if (resizeCorner === 'tl' || resizeCorner === 'bl') {
          newW = Math.max(50, resizeStartBounds.width - dx);
          newX = resizeStartBounds.x + (resizeStartBounds.width - newW);
        }
        if (resizeCorner === 'bl' || resizeCorner === 'br') {
          newH = Math.max(50, resizeStartBounds.height + dy);
        } else if (resizeCorner === 'tl' || resizeCorner === 'tr') {
          newH = Math.max(50, resizeStartBounds.height - dy);
          newY = resizeStartBounds.y + (resizeStartBounds.height - newH);
        }

        sprite.x = newX;
        sprite.y = newY;
        sprite.width = newW;
        sprite.height = newH;
        const td = this.tileData.get(id);
        if (td) { td.x = newX; td.y = newY; td.width = newW; td.height = newH; }
        this.drawSelectionOutline();
        return;
      }

      if (!this.isTileTool() || this.activeTool === 'place-tile' || this.activeTool === 'tile-browse' || !dragStart || !originPos) return;
      const dx = (event.global.x - dragStart.x) / this.zoomLevel;
      const dy = (event.global.y - dragStart.y) / this.zoomLevel;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) moved = true;
      sprite.x = originPos.x + dx;
      sprite.y = originPos.y + dy;
      const td = this.tileData.get(id);
      if (td) { td.x = sprite.x; td.y = sprite.y; }
      this.drawSelectionOutline();
    };
    this.app.stage.on('pointermove', onStageMove);

    const onDragEnd = () => {
      if (isResizing) {
        isResizing = false;
        const td = this.tileData.get(id);
        if (td) this.onTileResize?.(id, td.x, td.y, td.width, td.height);
        resizeCorner = null;
        resizeStartGlobal = null;
        resizeStartBounds = null;
        return;
      }

      if (!dragStart) return;
      dragStart = null;
      originPos = null;
      const tileData = this.tileData.get(id);
      if (tileData) {
        if (tileData.hidden) {
          sprite.alpha = this.isGM ? (tileData.opacity ?? 1) * 0.5 : (tileData.opacity ?? 1);
        } else {
          sprite.alpha = tileData.isActive ? (tileData.opacity ?? 1) : (tileData.opacity ?? 1) * 0.35;
        }
      } else {
        sprite.alpha = 1;
      }

      if (!moved) return;

      if (this.gridType !== 'gridless' && this.gridSize > 0) {
        const snappedX = Math.round(sprite.x / this.gridSize) * this.gridSize;
        const snappedY = Math.round(sprite.y / this.gridSize) * this.gridSize;
        sprite.x = snappedX;
        sprite.y = snappedY;
      }

      this.onTileMove?.(id, sprite.x, sprite.y);
      this.drawSelectionOutline();
    };

    this.app.stage.on('pointerup', onDragEnd);
    this.app.stage.on('pointerupoutside', onDragEnd);

    // GM hover tooltip for tiles with triggers
    sprite.on('pointerover', () => {
      this.tileHoveredId = id;
      this.showTileTooltip(id);
    });
    sprite.on('pointerout', () => {
      this.tileHoveredId = null;
      this.hideTileTooltip();
    });

    // Adicionar listener de clique para triggers de tile
    sprite.on('click', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      // Notificar sistema de triggers (se existir)
      this.onTileClick?.(id, event);
    });
  }

  private isTileTool(): boolean {
    return this.activeTool === 'tiles' || this.activeTool === 'select-tile' || this.activeTool === 'place-tile' || this.activeTool === 'tile-browse' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette';
  }

  private updateTilesInteractionState(): void {
    const isTileTool = this.isTileTool();
    for (const [id, sprite] of this.tiles.entries()) {
      const tileData = this.tileData.get(id);
      const hasTriggers = (tileData?.triggers?.length ?? 0) > 0 || (tileData?.actions?.length ?? 0) > 0;
      const interactable = isTileTool || hasTriggers;
      sprite.eventMode = interactable ? 'static' : 'none';
      sprite.cursor = isTileTool ? 'pointer' : (hasTriggers ? 'pointer' : 'default');
    }
  }

  private updateWallsInteractionState(): void {
    const interactable = this.activeTool === 'select-wall' || this.activeTool === 'walls' || this.activeTool.startsWith('wall-');
    this.layers.wall.eventMode = 'static'; // Always static so door handles remain clickable

    for (const [id, container] of this.wallShapes.entries()) {
      const wall = this.walls.find(w => w.id === id);
      if (!wall) continue;

      // 1. Child 0 is the wall line Graphics. Hide it if not editing walls.
      const wallLine = container.children[0];
      if (wallLine) {
        wallLine.visible = interactable;
      }

      // 2. Child 1 is the door handle Container (if it's a door).
      const doorHandle = container.children[1] as Container;
      if (doorHandle) {
        const isSecret = wall.door === 2;
        // Door icon only appears outside the wall tool (during normal
        // gameplay) — while editing walls, it disappears to avoid cluttering
        // the view of the editing lines/nodes.
        const canShow = isSecret ? this.isGM : true;
        doorHandle.visible = !interactable && canShow;
        doorHandle.eventMode = doorHandle.visible ? 'static' : 'none';
        doorHandle.cursor = 'pointer';
      }

      // Container itself is static only when editing walls
      container.eventMode = interactable ? 'static' : 'none';
      container.cursor = interactable ? 'pointer' : 'default';
    }
  }

  /** Allows dragging the entire wall body (translation), not just endpoints. Clicking without dragging still selects it. */
  private attachWallBodyDrag(container: Container, wallId: string): void {
    const CLICK_THRESHOLD = 5;
    let dragStart: { x: number; y: number } | null = null;
    let origin: { x1: number; y1: number; x2: number; y2: number } | null = null;
    let moved = false;

    const onMove = (event: FederatedPointerEvent) => {
      if (!dragStart || !origin) return;
      const dx = (event.global.x - dragStart.x) / this.zoomLevel;
      const dy = (event.global.y - dragStart.y) / this.zoomLevel;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) moved = true;
      if (!moved) return;
      const wall = this.walls.find((w) => w.id === wallId);
      if (!wall) return;
      wall.x1 = origin.x1 + dx;
      wall.y1 = origin.y1 + dy;
      wall.x2 = origin.x2 + dx;
      wall.y2 = origin.y2 + dy;
      this.renderWall(wall);
      if (this.selectedWallId === wallId) this.drawWallSelectionOutline();
    };

    const onUp = () => {
      this.app.stage.off('pointermove', onMove);
      this.app.stage.off('pointerup', onUp);
      this.app.stage.off('pointerupoutside', onUp);
      dragStart = null;
      if (!moved) {
        this.selectWall(wallId);
      } else {
        const wall = this.walls.find((w) => w.id === wallId);
        if (wall) this.onWallUpdate?.(wallId, { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 });
      }
      moved = false;
      origin = null;
    };

    container.on('pointerdown', (event: FederatedPointerEvent) => {
      if (this.activeTool !== 'select-wall') return;
      event.stopPropagation();
      const wall = this.walls.find((w) => w.id === wallId);
      if (!wall) return;
      dragStart = { x: event.global.x, y: event.global.y };
      origin = { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
      moved = false;
      this.app.stage.on('pointermove', onMove);
      this.app.stage.on('pointerup', onUp);
      this.app.stage.on('pointerupoutside', onUp);
    });
  }

  updateToken(data: CastMemberData, remoteUpdate = false): void {
    if (this.draggedTokenId === data.id) return;

    // Rubber-banding: in a remote database (Postgres) two consecutive `token.move`
    // queries might be resolved out of order — if this echo is older
    // than the last applied one, keep the current position instead of
    // "pulling" the token back.
    if (remoteUpdate && data.movedAt !== undefined) {
      const lastMovedAt = this.tokenLastMovedAt.get(data.id) ?? 0;
      if (data.movedAt < lastMovedAt) {
        const current = this.tokenData.get(data.id);
        if (current) data = { ...data, x: current.x, y: current.y };
      } else {
        this.tokenLastMovedAt.set(data.id, data.movedAt);
      }
    }

    // Floating delta detection for monitored vital resource (HP / Bar 1)
    const b1Parsed = typeof data.bar1 === 'string' ? (() => { try { return JSON.parse(data.bar1 as any); } catch { return null; } })() : data.bar1;
    const b2Parsed = typeof data.bar2 === 'string' ? (() => { try { return JSON.parse(data.bar2 as any); } catch { return null; } })() : data.bar2;
    const bar1Attr = b1Parsed?.attribute !== undefined ? b1Parsed.attribute : 'attributes.hp';
    const bar1Res = resolveTokenAttribute(data, bar1Attr);
    const prevRes = this.tokenResourceCache.get(data.id);

    if (bar1Res && prevRes && prevRes.val1 !== undefined) {
      const delta = bar1Res.value - prevRes.val1;
      if (delta !== 0) {
        const color = delta < 0 ? '#e74c3c' : '#2ecc71';
        const sign = delta > 0 ? `+${delta}` : `${delta}`;
        this.showFloatingText(data.x, data.y - TOKEN_RADIUS, sign, color);
      }
    }

    if (bar1Res) {
      this.tokenResourceCache.set(data.id, {
        val1: bar1Res.value,
        val2: b2Parsed?.attribute ? resolveTokenAttribute(data, b2Parsed.attribute)?.value : undefined,
      });
    }

    this.tokenData.set(data.id, data);
    let token = this.tokens.get(data.id);

    const buildVisual = (container: Container, rotationFrom?: number) => {
      container.removeChildren().forEach((c) => c.destroy({ children: true, texture: false }));

      const visualContainer = new Container();
      const targetRotation = (data.rotation || 0) * (Math.PI / 180);
      if (rotationFrom !== undefined && rotationFrom !== targetRotation) {
        visualContainer.rotation = rotationFrom;
        this.animateTokenRotation(visualContainer, rotationFrom, targetRotation);
      } else {
        visualContainer.rotation = targetRotation;
      }
      container.addChild(visualContainer);

      const shape = data.shape || 'circle';
      const drawShape = (g: Graphics, radius: number) => {
        if (shape === 'square') {
          g.rect(-radius, -radius, radius * 2, radius * 2);
        } else {
          g.circle(0, 0, radius);
        }
      };

      {
        const fallback = new Graphics();
        drawShape(fallback, TOKEN_RADIUS - 3);
        fallback.fill({ color: data.colorHex ? parseInt(data.colorHex.replace('#', '0x'), 16) : 0x888888 });
        visualContainer.addChild(fallback);

        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.width = TOKEN_RADIUS * 2;
        sprite.height = TOKEN_RADIUS * 2;

        const mask = new Graphics();
        drawShape(mask, TOKEN_RADIUS);
        mask.fill({ color: 0xffffff, alpha: 0.01 });
        sprite.mask = mask;

        visualContainer.addChild(mask);
        visualContainer.addChild(sprite);

        const avatarUrl = data.avatarUrl || DEFAULT_PORTRAIT_URL;
        loadSmartTexture(avatarUrl)
          .then((texture) => {
            if (container.destroyed || sprite.destroyed) return;
            sprite.texture = texture;
          })
          .catch((e) => {
            console.error('[CanvasManager] Failed to load token avatar:', avatarUrl, e);
          });
      }

      const hasCustomRing = Boolean(data.ringUrl && data.ringUrl !== 'none');
      const ringScale = (data.ringScale && data.ringScale > 0.5) ? data.ringScale : getDefaultRingScale(data.ringUrl);
      const ringOuterRadius = hasCustomRing ? (TOKEN_RADIUS * ringScale * 0.42) : TOKEN_RADIUS;

      if (data.ringUrl === 'none') {
        // Sem anel
      } else if (data.ringUrl) {
        const ringSprite = new Sprite();
        ringSprite.anchor.set(0.5);
        ringSprite.width = (TOKEN_RADIUS * 2) * ringScale;
        ringSprite.height = (TOKEN_RADIUS * 2) * ringScale;
        ringSprite.label = 'custom-ring';
        visualContainer.addChild(ringSprite);
        loadSmartTexture(data.ringUrl)
          .then((texture) => {
            if (container.destroyed || ringSprite.destroyed) return;
            ringSprite.texture = texture;
          })
          .catch((e) => {
            console.error('[CanvasManager] Failed to load custom ring:', data.ringUrl, e);
          });

        if (data.ringEffect === 'spin') {
          const onSpin = (ticker: any) => {
            if (container.destroyed || ringSprite.destroyed) {
              this.app.ticker.remove(onSpin);
              return;
            }
            ringSprite.rotation += 0.01 * (ticker?.deltaTime ?? 1);
          };
          this.app.ticker.add(onSpin);
        } else if (data.ringEffect === 'pulse') {
          let pulseTime = 0;
          const onPulse = (ticker: any) => {
            if (container.destroyed || ringSprite.destroyed) {
              this.app.ticker.remove(onPulse);
              return;
            }
            pulseTime += 0.04 * (ticker?.deltaTime ?? 1);
            ringSprite.alpha = 0.65 + 0.35 * Math.sin(pulseTime);
          };
          this.app.ticker.add(onPulse);
        }
      } else {
        const ring = new Graphics();
        drawShape(ring, TOKEN_RADIUS);
        ring.stroke({ width: 3, color: data.colorHex ? parseInt(data.colorHex.replace('#', '0x'), 16) : 0xe74c3c, alpha: 1 });
        visualContainer.addChild(ring);
      }

      // Selection ring (follows grid type and size)
      const gridSize = this.gridSize || DEFAULT_GRID_SIZE;
      const selMargin = 3;
      const drawSelectionShape = (g: Graphics) => {
        if (this.gridType === 'square') {
          const hs = Math.max(gridSize / 2, ringOuterRadius) + selMargin;
          g.rect(-hs, -hs, hs * 2, hs * 2);
        } else if (this.gridType === 'hex') {
          const r = Math.max(gridSize, ringOuterRadius) + selMargin;
          g.moveTo(r, 0);
          for (let i = 1; i <= 6; i++) {
            const angle = (-90 + i * 60) * Math.PI / 180;
            g.lineTo(r * Math.cos(angle), r * Math.sin(angle));
          }
          g.closePath();
        } else {
          g.circle(0, 0, Math.max(TOKEN_RADIUS + 8, ringOuterRadius + 4));
        }
      };
      const selectionRing = new Graphics();
      drawSelectionShape(selectionRing);
      selectionRing.stroke({ width: 4, color: 0xfff35c, alpha: 1 });
      selectionRing.visible = this.selectedTokenIds?.has(data.id) ?? false;
      selectionRing.label = 'selection-ring';
      container.addChild(selectionRing);

      // Target brackets (only when targeted by current user, orange color)
      const targetedBy: string[] = data.targetedBy ?? [];
      const ext = Math.max(TOKEN_RADIUS + 6, ringOuterRadius + 4);
      if (this.currentUserId && targetedBy.includes(this.currentUserId)) {
        const bracketColor = 0xe49a42;
        const size = 8;
        const bw = 2;
        const brackets = new Graphics();
        brackets.label = 'target-brackets';
        // Top-left
        brackets.moveTo(-ext, -ext + size).lineTo(-ext, -ext).lineTo(-ext + size, -ext);
        // Top-right
        brackets.moveTo(ext - size, -ext).lineTo(ext, -ext).lineTo(ext, -ext + size);
        // Bottom-left
        brackets.moveTo(-ext, ext - size).lineTo(-ext, ext).lineTo(-ext + size, ext);
        // Bottom-right
        brackets.moveTo(ext - size, ext).lineTo(ext, ext).lineTo(ext, ext - size);
        brackets.stroke({ width: bw, color: bracketColor });
        container.addChild(brackets);
      }

      // Combat indicator (⚔️ fixed at top left corner)
      if (this.combatantIds.has(data.id)) {
        const combatIcon = new Text({
          text: '⚔️',
          style: { fontSize: 7 },
        });
        combatIcon.anchor.set(1, 0);
        combatIcon.x = -ext;
        combatIcon.y = -ext;
        combatIcon.label = 'combat-icon';
        container.addChild(combatIcon);
      }

      // Movement action icon (top right corner)
      const moveAction = data.movementAction || 'walk';
      if (moveAction !== 'walk') {
        const moveIcon = new Text({
          text: this.movementIconChar(moveAction),
          style: { fontSize: 7 },
        });
        moveIcon.anchor.set(1, 0);
        moveIcon.x = ext;
        moveIcon.y = -ext;
        moveIcon.label = 'movement-icon';
        container.addChild(moveIcon);
      }

      // ── Resource Bars (Bar 1: Bottom, Bar 2: Top) ──────────────────────────
      const displayBars = data.displayBars ?? 20; // 20 = OWNER_HOVER
      const isOwner = Boolean(
        this.isGM ||
        (this.currentUserId && (data.ownership?.[this.currentUserId] ?? data.ownership?.default ?? 0) >= 3)
      );
      const isControlled = this.selectedTokenIds?.has(data.id) ?? false;

      let barsVisible = false;
      if (displayBars === 50) { // Always
        barsVisible = true;
      } else if (displayBars === 40 && isOwner) { // Owner Always
        barsVisible = true;
      } else if (displayBars === 10 && isControlled) { // Control
        barsVisible = true;
      }

      const barContainer = new Container();
      barContainer.label = 'resource-bars';
      barContainer.visible = barsVisible;

      const b1 = typeof data.bar1 === 'string' ? (() => { try { return JSON.parse(data.bar1 as any); } catch { return null; } })() : data.bar1;
      const b2 = typeof data.bar2 === 'string' ? (() => { try { return JSON.parse(data.bar2 as any); } catch { return null; } })() : data.bar2;
      const bar1Attr = b1?.attribute !== undefined ? b1.attribute : 'attributes.hp';
      const bar2Attr = b2?.attribute || '';

      const bar1Res = resolveTokenAttribute(data, bar1Attr);
      const bar2Res = bar2Attr ? resolveTokenAttribute(data, bar2Attr) : null;

      const barW = Math.max(TOKEN_RADIUS * 1.6, 44);
      const barH = 5;

      const drawBar = (yPos: number, current: number, max: number, colorDef?: string) => {
        const bg = new Graphics();
        bg.roundRect(-barW / 2, yPos, barW, barH, 2);
        bg.fill({ color: 0x111111, alpha: 0.85 });
        bg.stroke({ color: 0x000000, width: 1, alpha: 0.9 });
        barContainer.addChild(bg);

        const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
        if (pct > 0) {
          const fill = new Graphics();
          let fillColor = 0x2ecc71;
          if (!colorDef || colorDef === 'dynamic') {
            fillColor = getHealthColor(pct);
          } else if (colorDef.startsWith('#')) {
            fillColor = parseInt(colorDef.replace('#', '0x'), 16);
          } else if (!isNaN(Number(colorDef))) {
            fillColor = Number(colorDef);
          }
          fill.roundRect(-barW / 2 + 0.5, yPos + 0.5, Math.max(2, (barW - 1) * pct), barH - 1, 1.5);
          fill.fill({ color: fillColor, alpha: 0.95 });
          barContainer.addChild(fill);
        }
      };

      let bottomBarOffset = 0;
      // Bar 1 (Bottom - Health)
      if (bar1Res && bar1Res.max > 0) {
        drawBar(ext + 3, bar1Res.value, bar1Res.max, b1?.color);
        bottomBarOffset = barH + 4;
      }

      // Bar 2 (Top - Resource/Mana)
      if (bar2Res && bar2Res.max > 0) {
        drawBar(-ext - barH - 3, bar2Res.value, bar2Res.max, b2?.color);
      }

      if (barContainer.children.length > 0) {
        container.addChild(barContainer);

        if (displayBars === 30 || (displayBars === 20 && isOwner)) {
          container.eventMode = 'static';
          container.on('pointerenter', () => { barContainer.visible = true; });
          container.on('pointerleave', () => { barContainer.visible = false; });
        }
      }

      // Status markers — fixed row below the token (offset below bottom bar if present)
      if (data.statusMarkers && data.statusMarkers.length > 0) {
        const statusContainer = new Container();
        statusContainer.x = 0;
        statusContainer.y = ext + bottomBarOffset;

        data.statusMarkers.forEach((marker, index) => {
          const statusIcon = this.createStatusIcon(marker);
          if (statusIcon) {
            statusIcon.x = (index % 3) * 14 - 14 + 7;
            statusIcon.y = Math.floor(index / 3) * 14;
            statusContainer.addChild(statusIcon);
          }
        });
        container.addChild(statusContainer);
      }
    };

    if (!token) {
      token = new Container();
      this.layers.cast.addChild(token);
      this.tokens.set(data.id, token);
      buildVisual(token);
      this.applyHiddenVisibility(token, data);
      this.attachDrag(token, data.id);
      token.x = data.x;
      token.y = data.y;
      this.updateFogLightOrigins();
      return;
    }

    const prevVisual = token.children[0] as Container | undefined;
    const prevRotation = prevVisual?.rotation;
    buildVisual(token, prevRotation);

    if (remoteUpdate) {
      this.animateTo(token, data.x, data.y);
    } else {
      token.x = data.x;
      token.y = data.y;
    }

    this.applyHiddenVisibility(token, data);

    if (this.isFOVOrigin(data.id)) {
      this.fovDirty = true;
      this.updateFOV();
    } else {
      // Token is not FOV origin, but can emit light (NPC torch etc) — light
      // illuminates for everyone, not just who controls the token, so we need
      // to recalculate even outside the FOV path.
      this.updateFogLightOrigins();
    }
  }

  /**
   * Updates only the token's vision cache (sightRange/sightEnabled/etc, read by
   * `resolveFOVOrigins()`) and recalculates FOV if it is an origin. Unlike
   * `updateToken()`, it does not rebuild visuals, move position or change
   * visibility — used in LOCAL save (direct API response), where the `data`
   * object might not have the same full format as what arrives via WS.
   */
  refreshTokenVision(data: CastMemberData): void {
    const existing = this.tokenData.get(data.id);
    this.tokenData.set(data.id, existing ? { ...existing, ...data } : data);
    if (this.isFOVOrigin(data.id)) {
      this.fovDirty = true;
      this.updateFOV();
    }
  }

  private applyHiddenVisibility(container: Container, data: CastMemberData): void {
    let isVisible = true;

    if (this.currentStageId && data.stageId !== this.currentStageId) {
      isVisible = false;
    }

    if (isVisible && data.hidden && !this.isGM && !this.controlledTokenIds.has(data.id)) {
      isVisible = false;
    }

    // Floor: by `levelId`, same as walls, lights, sounds, notes and drawings.
    //
    // Previously it was by `elevation` (Z). Did not work: every existing token has
    // elevation 0, so it either appeared on every floor (when bounds were null)
    // or disappeared on all except ground floor. Separating floors by Z requires
    // someone manually keeping track of the number for each token, and nobody does.
    //
    // `elevation` remains in the registry for sorting and teleportation; changing
    // floors is now explicitly changing `levelId`.
    //
    // NOTE: seeing the lower floor from the upper one
    // will be a configuration option, not the default. The default is isolation —
    // elements from one sub-scene do not leak into another.
    if (isVisible && !this.isOnCurrentLevel((data as any).levelId)) {
      isVisible = false;
    }

    // Token only appears if it is within the visible area (FOV + lights).
    // GM Rule:
    //  - GM WITHOUT vision preview sees all tokens, always;
    //  - GM WITH vision preview (selected a token) sees exactly what that
    //    token sees — the other tokens are filtered by its vision.
    // Remaining exceptions:
    //  - the token controlled by the player/GM is ALWAYS visible, even in total
    //    darkness, otherwise they lose sight of their own pawn and don't know where to click;
    //  - scene without fog enabled filters nothing.
    const visionFiltering = !this.isGM || this.gmVisionPreview;
    if (
      isVisible &&
      visionFiltering &&
      this.fovEnabled &&
      !this.controlledTokenIds.has(data.id) &&
      !this.gmVisionPreviewIds.has(data.id) &&
      !this.isPointVisibleNow(data.x, data.y) &&
      !this.isPointLit(data.x, data.y)
    ) {
      isVisible = false;
    }

    container.visible = isVisible;
    if (isVisible) {
      container.alpha = data.hidden && this.isGM ? 0.5 : 1;
    }
  }

  public setLevel(levelId: string, bottom: number, top: number): void {
    this.currentLevelId = levelId;
    this.currentLevelBounds = { bottom, top };
    this.tokens.forEach((token, id) => {
      const data = this.tokenData.get(id);
      if (data) this.applyHiddenVisibility(token, data);
    });

    // Reads the stamped `__levelId` on the container at render time, instead of
    // looking up the registry in this.walls/allLights/etc.
    //
    // Those lookups were conditional (`if (wall) {...}`): when the search
    // failed — list not populated yet, registry removed, sprite created by
    // a path that doesn't feed the list — the `visible` kept the PREVIOUS
    // value. In practice, an element from the lower floor kept appearing
    // on the upper one, and only that one, because only its lookup failed. The stamp
    // cannot fail: it is written in the exact same place where the sprite is born.
    const applyStamp = (container: Container) => {
      container.visible = this.isOnCurrentLevel((container as any).__levelId);
    };
    this.wallShapes.forEach(applyStamp);
    this.lightGroups.forEach(applyStamp);
    this.lightHandlesContainer.children.forEach((c) => applyStamp(c as Container));
    this.soundGroups.forEach(applyStamp);
    this.noteGroups.forEach(applyStamp);
    this.drawnShapes.forEach(applyStamp);

    this.tiles.forEach((sprite, id) => {
      const tile = this.tileData.get(id);
      if (tile) {
        const el = tile.elevation ?? 0;
        sprite.visible = (el >= bottom && el < top);
      }
    });

    this.fogLayer.setWalls(this.getVisibleWalls());
    this.fovDirty = true;
    this.updateFOV();
  }

  // NOTE: updateToken DOES NOT call this.onMove — this is intentional.
  // updateToken is used for REMOTE movement (via WebSocket), while
  // onMove is only called by LOCAL movement (drag or programmatic).
  // If updateToken ever calls onMove, all clients would evaluate
  // triggers simultaneously, duplicating actions. Keep this separation.

  private animateTo(token: Container, targetX: number, targetY: number): void {
    const speed = 0.2;
    const step = () => {
      token.x += (targetX - token.x) * speed;
      token.y += (targetY - token.y) * speed;
      if (Math.abs(token.x - targetX) > 0.5 || Math.abs(token.y - targetY) > 0.5) {
        requestAnimationFrame(step);
      } else {
        token.x = targetX;
        token.y = targetY;
      }
    };
    requestAnimationFrame(step);
  }


  /** Checa se o segmento `from -> to` cruza alguma wall bloqueante. Usado por qualquer
   * caminho de movimento que não passe pelo drag do mouse (ex: teclado). */
  isPathBlockedByWall(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    return this.wallCollisionPoint(from, to) !== null;
  }

  /** Anima a rotação de `container` pelo caminho mais curto (nunca gira "pelo lado errado"). */
  private animateTokenRotation(container: Container, fromRad: number, toRad: number): void {
    let delta = toRad - fromRad;
    delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const duration = 150;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      container.rotation = fromRad + delta * t;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private wallCollisionPoint(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } | null {
    if (this.unrestrictedMovement) return null;
    const activeWalls = this.getVisibleWalls().filter(w => w.movement && !(w.door > 0 && w.doorState === 1));
    let closest: { x: number; y: number } | null = null;
    let closestT = Infinity;
    for (const w of activeWalls) {
      const hit = raySegmentIntersection(from.x, from.y, to.x, to.y, w.x1, w.y1, w.x2, w.y2);
      if (hit) {
        const t = Math.hypot(hit.x - from.x, hit.y - from.y);
        if (t < closestT) {
          closestT = t;
          closest = hit;
        }
      }
    }
    if (!closest) return null;
    // Backs up a bit in the direction of origin so as not to leave the token exactly
    // on top/inside the wall — without this, the grid snapping could throw the token's center
    // to the other side of the wall (or stuck inside it) and it would never come out again.
    const dx = closest.x - from.x;
    const dy = closest.y - from.y;
    const dist = Math.hypot(dx, dy);
    const pullback = Math.min(TOKEN_RADIUS, dist);
    if (dist > 0) {
      closest = {
        x: closest.x - (dx / dist) * pullback,
        y: closest.y - (dy / dist) * pullback,
      };
    }
    return closest;
  }

  /** TODO: hex grid — implement hexagonal grid traversal when hex support is added */
  private gridTraversal(
    x1: number, y1: number, x2: number, y2: number, cellSize: number
  ): Array<{ col: number; row: number }> {
    const startCol = Math.floor(x1 / cellSize);
    const startRow = Math.floor(y1 / cellSize);
    const endCol = Math.floor(x2 / cellSize);
    const endRow = Math.floor(y2 / cellSize);

    const cells: Array<{ col: number; row: number }> = [];

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    let col = startCol;
    let row = startRow;

    const stepCol = x2 >= x1 ? 1 : -1;
    const stepRow = y2 >= y1 ? 1 : -1;

    const tDeltaX = dx === 0 ? Number.MAX_VALUE : cellSize / dx;
    const tDeltaY = dy === 0 ? Number.MAX_VALUE : cellSize / dy;

    let tMaxX: number;
    if (dx === 0) {
      tMaxX = Number.MAX_VALUE;
    } else {
      const nextBorderX = stepCol > 0 ? (startCol + 1) * cellSize : startCol * cellSize;
      tMaxX = Math.abs(nextBorderX - x1) / dx;
    }

    let tMaxY: number;
    if (dy === 0) {
      tMaxY = Number.MAX_VALUE;
    } else {
      const nextBorderY = stepRow > 0 ? (startRow + 1) * cellSize : startRow * cellSize;
      tMaxY = Math.abs(nextBorderY - y1) / dy;
    }

    cells.push({ col, row });

    while (col !== endCol || row !== endRow) {
      if (tMaxX < tMaxY) {
        tMaxX += tDeltaX;
        col += stepCol;
      } else if (tMaxY < tMaxX) {
        tMaxY += tDeltaY;
        row += stepRow;
      } else {
        tMaxX += tDeltaX;
        tMaxY += tDeltaY;
        col += stepCol;
        row += stepRow;
      }
      cells.push({ col, row });
    }

    return cells;
  }

  private drawDragRuler(currentX: number, currentY: number): void {
    const g = this.dragRuler;
    g.clear();

    this.dragRulerLabels.forEach(label => label.destroy());
    this.dragRulerLabels = [];

    const origin = this.draggedOriginPos.get(this.draggedTokenId!);
    if (!origin) return;

    const points: Array<{ x: number; y: number }> = [{ x: origin.x, y: origin.y }, ...this.dragWaypoints, { x: currentX, y: currentY }];

    let drawPoints = [...points];
    let blocked = false;

    if (!this.unrestrictedMovement) {
      const lastIdx = drawPoints.length - 1;
      const prev = drawPoints[lastIdx - 1];
      const curr = drawPoints[lastIdx];
      const wallHit = this.wallCollisionPoint(prev, curr);
      if (wallHit) {
        drawPoints[lastIdx] = wallHit;
        blocked = true;
      }
    }

    const hasGrid = this.gridType !== 'gridless' && this.gridSize > 0;
    const cellSize = this.gridSize || DEFAULT_GRID_SIZE;
    const lineColor = blocked ? 0xc94040 : 0x4ade80;

    if (hasGrid) {
      const speedCells = 6;
      const dashCells = speedCells * 2;
      let accumulatedCells = 0;

      for (let i = 1; i < drawPoints.length; i++) {
        const segPrev = drawPoints[i - 1];
        const segCurr = drawPoints[i];
        const cells = this.gridTraversal(segPrev.x, segPrev.y, segCurr.x, segCurr.y, cellSize);

        for (let j = 0; j < cells.length; j++) {
          if (i === 1 && j === 0) continue;
          accumulatedCells++;

          let cellColor: number;
          if (blocked && i === drawPoints.length - 1) {
            cellColor = 0xc94040;
          } else if (accumulatedCells <= speedCells) {
            cellColor = 0x4ade80;
          } else if (accumulatedCells <= dashCells) {
            cellColor = 0xfacc15;
          } else {
            cellColor = 0xc94040;
          }

          const { col, row } = cells[j];
          g.rect(col * cellSize, row * cellSize, cellSize, cellSize);
          g.fill({ color: cellColor, alpha: 0.35 });
        }
      }
    }

    g.setStrokeStyle({ width: hasGrid ? 1.5 : 2, color: lineColor, alpha: 0.9 });
    g.moveTo(drawPoints[0].x, drawPoints[0].y);

    for (let i = 1; i < drawPoints.length; i++) {
      g.lineTo(drawPoints[i].x, drawPoints[i].y);

      if (i < drawPoints.length - 1) {
        g.circle(drawPoints[i].x, drawPoints[i].y, 3);
      }
    }
    g.stroke();

    for (let i = 1; i < drawPoints.length - 1; i++) {
      g.circle(drawPoints[i].x, drawPoints[i].y, 2);
    }
    g.fill({ color: lineColor });

    let accumulatedDistance = 0;
    for (let i = 1; i < drawPoints.length; i++) {
      const prev = drawPoints[i - 1];
      const curr = drawPoints[i];

      const segmentPx = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const segmentGridSquares = segmentPx / cellSize;
      const segmentDistReal = segmentGridSquares * this.gridDistance;
      accumulatedDistance += segmentDistReal;

      const segmentDist = Math.round(segmentDistReal * 10) / 10;
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;

      const label = new Text({
        text: `${segmentDist} ${this.gridUnit}`,
        style: { fontFamily: 'Arial', fontSize: 13, fill: lineColor }
      });
      label.x = midX;
      label.y = midY - 15;
      label.anchor.set(0.5);
      this.layers.interface.addChild(label);

      this.dragRulerLabels.push(label);
    }

    const totalDist = Math.round(accumulatedDistance * 10) / 10;
    const waypointHint = this.dragWaypoints.length > 0 ? '' : ' (Ctrl: ponto)';

    this.dragRulerLabel.text = `${totalDist} ${this.gridUnit}${waypointHint}`;
    this.dragRulerLabel.visible = true;
    this.dragRulerLabel.x = (blocked ? drawPoints[drawPoints.length - 1].x : currentX) + 10;
    this.dragRulerLabel.y = (blocked ? drawPoints[drawPoints.length - 1].y : currentY) - 10;
  }

  /** Draws only the portion of the path that still needs to be traversed — used
   *  during animation for the ruler to "fade away" as the token moves. */
  private drawRemainingPath(fromX: number, fromY: number, remaining: Array<{ x: number; y: number }>): void {
    const g = this.dragRuler;
    g.clear();
    g.setStrokeStyle({ width: 2, color: 0x4ade80, alpha: 0.9 });
    g.moveTo(fromX, fromY);
    for (const wp of remaining) {
      g.lineTo(wp.x, wp.y);
    }
    g.stroke();
  }

  private animateTokenToPosition(
    token: Container,
    targetX: number,
    targetY: number,
    onComplete: () => void,
    onFrame?: (x: number, y: number) => void,
  ): void {
    const startX = token.x;
    const startY = token.y;
    const distance = Math.hypot(targetX - startX, targetY - startY);
    const duration = Math.max(800, distance * 4);

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easedProgress = 1 - Math.pow(1 - progress, 3);

      token.x = startX + (targetX - startX) * easedProgress;
      token.y = startY + (targetY - startY) * easedProgress;
      onFrame?.(token.x, token.y);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        token.x = targetX;
        token.y = targetY;
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  private animateThroughWaypoints(token: Container, waypoints: Array<{ x: number; y: number }>, onComplete: () => void, onFrame?: (x: number, y: number) => void): void {
    let segIdx = 0;
    const nextSegment = () => {
      if (segIdx >= waypoints.length) {
        onComplete();
        return;
      }
      const tgt = waypoints[segIdx];
      const remaining = waypoints.slice(segIdx);
      this.animateTokenToPosition(token, tgt.x, tgt.y, () => {
        segIdx++;
        nextSegment();
      }, (x, y) => {
        this.drawRemainingPath(x, y, remaining);
        onFrame?.(x, y);
      });
    };
    nextSegment();
  }

  setUnrestrictedMovement(val: boolean): void {
    this.unrestrictedMovement = val;
  }

  setNotesVisible(val: boolean): void {
    this.notesVisible = val;
    this.updateLayerVisibility();
  }

  setLightAnimationsEnabled(val: boolean): void {
    this.lightAnimationsEnabled = val;
  }

  setLiveVisionOnDrag(val: boolean): void {
    this.liveVisionOnDrag = val;
  }

  setCanvasVisible(val: boolean): void {
    if (!this.canvasEl) return;
    if (val) {
      this.app.ticker.start();
      this.canvasEl.style.display = '';
    } else {
      this.app.ticker.stop();
      this.canvasEl.style.display = 'none';
    }
  }

  setMaxFps(val: string): void {
    const fps = parseInt(val, 10);
    if (isNaN(fps) || fps <= 0) {
      this.app.ticker.maxFPS = 0;
    } else {
      this.app.ticker.maxFPS = fps;
    }
  }

  setLeftClickDeselect(val: boolean): void {
    this.leftClickDeselect = val;
  }

  private movementIconChar(action: string): string {
    switch (action) {
      case 'burrow': return '🕳️';
      case 'climb': return '🧗';
      case 'fly': return '🪽';
      case 'swim': return '🌊';
      case 'teleport': return '✨';
      default: return '🚶';
    }
  }

  panToToken(id: string): void {
    const data = this.tokenData.get(id);
    if (!data) return;
    this.panToPoint(data.x, data.y);
  }

  /** Centers the camera on a world-space point, keeping the current zoom level. */
  panToPoint(x: number, y: number): void {
    const el = this.canvasEl;
    if (!el) return;
    const viewWidth = el.clientWidth || window.innerWidth;
    const viewHeight = el.clientHeight || window.innerHeight;
    this.app.stage.x = viewWidth / 2 - x * this.zoomLevel;
    this.app.stage.y = viewHeight / 2 - y * this.zoomLevel;
  }

  private attachDrag(token: Container, id: string): void {
    token.eventMode = (this.activeTool === 'token' || this.activeTool === 'select-token') ? 'static' : 'none';
    token.cursor = 'pointer';
    const shape = this.tokenData.get(id)?.shape || 'circle';
    token.hitArea = shape === 'square'
      ? new Rectangle(-TOKEN_RADIUS, -TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2)
      : new Circle(0, 0, TOKEN_RADIUS);

    token.on('pointerover', () => {
      this.hoveredTokenId = id;
      if (this.draggedTokenId === null) token.alpha = 0.85;
    });
    token.on('pointerout', () => {
      if (this.hoveredTokenId === id) this.hoveredTokenId = null;
      if (this.draggedTokenId === null) token.alpha = 1;
    });

    // Model: press and hold to drag (token stays at origin,
    // only the ruler follows the cursor). Release without dragging = simple click
    // (select / double-click opens config). During drag,
    // holding Ctrl places a node at the current point and starts a new segment from there.
    let dragStart: { x: number; y: number } | null = null;
    let moved = false;
    const CLICK_THRESHOLD = 5;
    let cursorPos = { x: 0, y: 0 };
    let lastGlobal = { x: 0, y: 0 };
    let ctrlHeld = false;

    const tokenRadius = this.gridType !== 'gridless' ? (this.gridSize || 50) / 2 : TOKEN_RADIUS;
    const clampToScene = (val: number, max: number) => Math.max(tokenRadius, Math.min(max - tokenRadius, val));

    const clearRulerVisuals = () => {
      this.dragRuler.clear();
      this.dragRulerLabel.visible = false;
      this.dragRulerLabels.forEach(l => l.destroy());
      this.dragRulerLabels = [];
    };

    const clearMovementState = () => {
      document.removeEventListener('keydown', onCtrlDown);
      document.removeEventListener('keyup', onCtrlUp);
      document.removeEventListener('keydown', onEscape);
      clearRulerVisuals();
      dragStart = null;
      moved = false;
      ctrlHeld = false;
      token.alpha = 1;
      this.draggedTokenId = null;
      this.draggedOriginPos.clear();
      this.dragWaypoints = [];
      this.fovDragPositions = null;
    };

    const onEscape = (e: KeyboardEvent) => {
      if (this.draggedTokenId !== id || e.repeat) return;
      if (e.key !== 'Escape') return;
      e.preventDefault();
      clearMovementState();
    };

    // Places a waypoint at the current cursor position.
    // DOES NOT touch draggedOriginPos or dragStart — the drag origin is always
    // the original token position, so the ruler and animation are correct.
    const placeWaypoint = () => {
      if (this.draggedTokenId !== id) return;
      // Does not require `moved` — if the user holds Ctrl before moving the mouse,
      // the first waypoint is placed at the origin itself (harmless) instead of being
      // silently ignored.
      moved = true;
      const hasGrid = this.gridType !== 'gridless' && this.gridSize > 0;
      const cellSize = this.gridSize || DEFAULT_GRID_SIZE;
      let wpX = cursorPos.x;
      let wpY = cursorPos.y;
      if (hasGrid) {
        wpX = Math.round((cursorPos.x - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
        wpY = Math.round((cursorPos.y - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
      }
      this.dragWaypoints.push({ x: wpX, y: wpY });
      this.drawDragRuler(cursorPos.x, cursorPos.y);
    };

    const onCtrlDown = (e: KeyboardEvent) => {
      if (this.draggedTokenId !== id || e.repeat) return;
      if (e.key !== 'Control' && e.key !== 'Meta') return;
      ctrlHeld = true;
    };
    const onCtrlUp = (e: KeyboardEvent) => {
      if (e.key !== 'Control' && e.key !== 'Meta') return;
      ctrlHeld = false;
      if (this.draggedTokenId === id && moved) {
        onDragEnd();
      }
    };


    token.on('pointerdown', (event: FederatedPointerEvent) => {
      if (event.button === 2) return;
      if (this.draggedTokenId !== null) return;

      this.draggedTokenId = id;
      this.draggedTokenId = id;
      dragStart = { x: event.global.x, y: event.global.y };
      lastGlobal = { x: event.global.x, y: event.global.y };

      this.draggedOriginPos.clear();
      this.fovDragPositions = null;
      if (this.selectedTokenIds.has(id)) {
        this.selectedTokenIds.forEach((selId) => {
          const t = this.tokens.get(selId);
          if (t) {
            this.draggedOriginPos.set(selId, { x: t.x, y: t.y });
          }
        });
      } else {
        this.draggedOriginPos.set(id, { x: token.x, y: token.y });
      }
      cursorPos = { x: token.x, y: token.y };

      this.dragWaypoints = [];
      this.dragRuler.clear();
      this.dragRulerLabel.visible = false;
      moved = false;
      ctrlHeld = false;
      token.alpha = 0.7;
      document.addEventListener('keydown', onCtrlDown);
      document.addEventListener('keyup', onCtrlUp);
      document.addEventListener('keydown', onEscape);
    });

    token.on('rightdown', (event: FederatedPointerEvent) => {
      event.preventDefault?.();
      if (this.draggedTokenId === id && this.dragWaypoints.length > 0) {
        this.dragWaypoints.pop();
        if (this.dragWaypoints.length > 0 || moved) {
          this.drawDragRuler(cursorPos.x, cursorPos.y);
        } else {
          this.dragRuler.clear();
          this.dragRulerLabel.visible = false;
        }
        return;
      }
      const latest = this.tokenData.get(id);
      if (latest) this.onTokenContextMenu?.(latest, event);
    });

    const onStageMove = (event: FederatedPointerEvent) => {
      if (this.draggedTokenId !== id || !dragStart) return;
      lastGlobal = { x: event.global.x, y: event.global.y };
      // Threshold in SCREEN pixels, not world pixels (same logic as before).
      const screenDx = event.global.x - dragStart.x;
      const screenDy = event.global.y - dragStart.y;
      if (Math.abs(screenDx) > CLICK_THRESHOLD || Math.abs(screenDy) > CLICK_THRESHOLD) moved = true;
      // dx/dy to move the OTHER selected tokens together, in formation —
      // uses stage.scale.x directly (not the cached zoomLevel variable) to
      // match exactly with toWorldCoordinates() below.
      const dx = screenDx / this.app.stage.scale.x;
      const dy = screenDy / this.app.stage.scale.y;

      const primaryOrigin = this.draggedOriginPos.get(id);
      let trueDx = 0;
      let trueDy = 0;

      if (primaryOrigin) {
        // Tip of the ruler = real pointer position in the world, calculated with the
        // SAME utility already used (and proven correct) across the entire
        // rest of the canvas for wall/light/tile drags (toWorldCoordinates,
        // canvas-manager.ts:786) — do not reinvent the conversion here.
        const rawCoords = this.toWorldCoordinates(event.global.x, event.global.y);
        cursorPos = {
          x: clampToScene(rawCoords.x, this.sceneWidth),
          y: clampToScene(rawCoords.y, this.sceneHeight)
        };
        if (moved) this.drawDragRuler(cursorPos.x, cursorPos.y);

        trueDx = cursorPos.x - primaryOrigin.x;
        trueDy = cursorPos.y - primaryOrigin.y;
      } else {
        trueDx = screenDx / this.app.stage.scale.x;
        trueDy = screenDy / this.app.stage.scale.y;
      }

      this.draggedOriginPos.forEach((origin, dragId) => {
        if (dragId === id) return;
        const t = this.tokens.get(dragId);
        if (t) {
          t.x = clampToScene(origin.x + trueDx, this.sceneWidth);
          t.y = clampToScene(origin.y + trueDy, this.sceneHeight);
        }
      });

      // Recalculates FOV during drag without altering the token's visual
      if (moved && this.liveVisionOnDrag && this.isFOVOrigin(id)) {
        if (!this.fovDragPositions) this.fovDragPositions = new Map();
        this.fovDragPositions.set(id, { x: cursorPos.x, y: cursorPos.y });
        this.fovDirty = true;
        this.throttledUpdateFOV();
      }
    };
    this.app.stage.on('pointermove', onStageMove);

    const onDragEnd = (event?: FederatedPointerEvent) => {
      if (this.draggedTokenId !== id) return;

      // Ctrl held: mouse click creates a waypoint, drag continues
      if (event && ctrlHeld) {
        const rawCoords = this.toWorldCoordinates(event.global.x, event.global.y);
        cursorPos = {
          x: clampToScene(rawCoords.x, this.sceneWidth),
          y: clampToScene(rawCoords.y, this.sceneHeight)
        };
        placeWaypoint();
        dragStart = { x: event.global.x, y: event.global.y };
        return;
      }

      document.removeEventListener('keydown', onCtrlDown);
      document.removeEventListener('keyup', onCtrlUp);
      document.removeEventListener('keydown', onEscape);
      token.alpha = 1;
      this.draggedTokenId = null;

      if (!moved) {
        clearRulerVisuals();
        const latest = this.tokenData.get(id);
        if (!latest) { clearMovementState(); return; }
        const now = Date.now();
        const isDoubleClick = this.lastTokenClick?.id === id && now - this.lastTokenClick.time < 300;
        this.lastTokenClick = { id, time: now };
        if (isDoubleClick) {
          this.lastTokenClick = null;
          clearMovementState();
          this.onTokenClick?.(latest);
          return;
        }
        this.setSelection([id]);
        this.draggedOriginPos.clear();
        this.dragWaypoints = [];
        return;
      }

      // From here on the token will animate — the ruler remains visible until
      // the movement finishes
      // it is only cleared inside the onComplete callbacks below.

      const cellSize = this.gridSize || DEFAULT_GRID_SIZE;
      const hasWaypoints = this.dragWaypoints.length > 0;
      const primOrigin = this.draggedOriginPos.get(id);

      if (hasWaypoints) {
        // Last waypoint is the final destination — does not draw extra segment
        const lastWpRaw = this.dragWaypoints[this.dragWaypoints.length - 1];
        this.drawDragRuler(lastWpRaw.x, lastWpRaw.y);
        const snappedWp = this.dragWaypoints.map(wp => ({
          x: Math.round((wp.x - cellSize / 2) / cellSize) * cellSize + cellSize / 2,
          y: Math.round((wp.y - cellSize / 2) / cellSize) * cellSize + cellSize / 2,
        }));
        const lastWp = snappedWp[snappedWp.length - 1];

        if (primOrigin) {
          const offX = lastWp.x - primOrigin.x;
          const offY = lastWp.y - primOrigin.y;
          this.draggedOriginPos.forEach((o, dragId) => {
            const t = this.tokens.get(dragId);
            if (!t || dragId === id) return;
            t.x = clampToScene(o.x + offX, this.sceneWidth);
            t.y = clampToScene(o.y + offY, this.sceneHeight);
            this.onMove?.(dragId, t.x, t.y);
          });
          this.updateFogLightOrigins();
        }

        this.animateThroughWaypoints(token, snappedWp, () => {
          clearRulerVisuals();
          this.onMove?.(id, lastWp.x, lastWp.y);
          this.updateFogLightOrigins();
          if (this.isFOVOrigin(id)) { this.fovDirty = true; this.updateFOV(); }
        }, (x, y) => {
          this.fovDragPositions?.set(id, { x, y });
          this.updateFogLightOrigins();
          if (this.isFOVOrigin(id)) {
            this.fovDirty = true;
            this.throttledUpdateFOV();
          }
        });
      } else {
        let destX = cursorPos.x;
        let destY = cursorPos.y;

        if (primOrigin && !this.unrestrictedMovement) {
          const wallHit = this.wallCollisionPoint(primOrigin, cursorPos);
          if (wallHit) { destX = wallHit.x; destY = wallHit.y; }
        }
        const finalDest = { x: destX, y: destY };

        this.draggedOriginPos.forEach((origin, dragId) => {
          const t = this.tokens.get(dragId);
          if (t && dragId === id) {
            let snappedX = Math.round((finalDest.x - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
            let snappedY = Math.round((finalDest.y - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
            snappedX = clampToScene(snappedX, this.sceneWidth);
            snappedY = clampToScene(snappedY, this.sceneHeight);

            if (!this.unrestrictedMovement && this.wallCollisionPoint(origin, { x: snappedX, y: snappedY })) {
              snappedX = clampToScene(finalDest.x, this.sceneWidth);
              snappedY = clampToScene(finalDest.y, this.sceneHeight);
            }
            this.animateTokenToPosition(t, snappedX, snappedY, () => {
              clearRulerVisuals();
              this.onMove?.(dragId, snappedX, snappedY);
              this.updateFogLightOrigins();
              if (this.isFOVOrigin(dragId)) { this.fovDirty = true; this.updateFOV(); }
            }, (x, y) => {
              this.fovDragPositions?.set(dragId, { x, y });
              this.updateFogLightOrigins();
              if (this.isFOVOrigin(dragId)) {
                this.fovDirty = true;
                this.throttledUpdateFOV();
              }
            });
          } else if (t) {
            let snappedX = Math.round((t.x - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
            let snappedY = Math.round((t.y - cellSize / 2) / cellSize) * cellSize + cellSize / 2;
            snappedX = clampToScene(snappedX, this.sceneWidth);
            snappedY = clampToScene(snappedY, this.sceneHeight);
            t.x = snappedX;
            t.y = snappedY;
            this.updateFogLightOrigins();
            this.onMove?.(dragId, snappedX, snappedY);
          }
        });
        if (this.fovDirty) this.updateFOV();
      }

      this.draggedOriginPos.clear();
      this.dragWaypoints = [];
      this.fovDragPositions = null;
      dragStart = null;
    };
    this.app.stage.on('pointerup', onDragEnd);
    this.app.stage.on('pointerupoutside', onDragEnd);
    this.dragStageHandlers.set(id, { move: onStageMove, end: onDragEnd, escape: onEscape });
  }

  removeToken(id: string): void {
    const token = this.tokens.get(id);
    if (!token) return;
    this.layers.cast.removeChild(token);
    token.destroy({ children: true });
    this.tokens.delete(id);
    const handlers = this.dragStageHandlers.get(id);
    if (handlers) {
      this.app.stage.off('pointermove', handlers.move);
      this.app.stage.off('pointerup', handlers.end);
      this.app.stage.off('pointerupoutside', handlers.end);
      if (handlers.escape) document.removeEventListener('keydown', handlers.escape);
      this.dragStageHandlers.delete(id);
    }
    if (this.draggedTokenId === id) this.draggedTokenId = null;
    if (this.controlledTokenIds.delete(id)) {
      this.fovDirty = true;
      this.updateFOV();
    }
    this.tokenResourceCache.delete(id);
  }

  /** Removes every token from the canvas — used when switching stages, since each stage only shows its own cast. */
  clearTokens(): void {
    this.tokenResourceCache.clear();
    if (this.isGM && this.gmVisionPreview) this.setGMVisionPreview([]);
    for (const id of [...this.tokens.keys()]) {
      this.removeToken(id);
    }
  }

  // ── Drawings (freehand / rectangle / circle / line) ──────────────────

  private getCanvasPos = (e: MouseEvent | PointerEvent): { x: number; y: number } => {
    const rect = this.canvasEl!.getBoundingClientRect();
    return this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);
  };

  private handleDrawPointerDown = (e: PointerEvent): void => {
    const { x, y } = this.getCanvasPos(e);

    // Handle polygon drawing tool
    if (this.activeTool === 'draw-polygon' && this.isDrawing) {
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        this.drawPoints.pop();
        if (this.drawPoints.length === 0) {
          this.cancelDrawing();
        } else {
          this.previewPolygon(x, y);
        }
        return;
      }
      if (e.detail === 2) {
        this.finalizeDrawing();
        return;
      }
      this.drawPoints.push({ x, y });
      return;
    }

    if (e.button === 2) return;

    // Handle notes tool
    if (this.activeTool === 'notes' || this.activeTool === 'create-note') {
      e.preventDefault();
      this.onNoteCreate?.({ x, y, levelId: this.currentLevelId });
      return;
    }

    // Handle drawing tools (text included — drag defines the area, config window opens after creation)
    if (!DRAWING_TOOLS.includes(this.activeTool)) return;
    this.isDrawing = true;
    this.drawType = this.activeTool.replace('draw-', '').replace('template-', '');
    this.drawStart = { x, y };
    this.drawPoints = [{ x, y }];
  };

  private previewPolygon(mouseX: number, mouseY: number): void {
    if (this.drawPoints.length === 0) return;
    this.drawPreview.clear();
    this.drawPreview.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.8 });
    this.drawPreview.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
    for (let i = 1; i < this.drawPoints.length; i++) {
      this.drawPreview.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
    }
    this.drawPreview.lineTo(mouseX, mouseY);
    this.drawPreview.fill({ color: 0x6366f1, alpha: 0.12 });
    this.drawPreview.stroke();
  }

  private handleDrawPointerMove = (e: PointerEvent): void => {
    if (!this.isDrawing || !this.drawStart) return;
    const { x, y } = this.getCanvasPos(e);
    const sx = this.drawStart.x;
    const sy = this.drawStart.y;

    // Registers the current point — without this finalizeDrawing sees last===start and discards it as an accidental click
    if (this.drawType !== 'freehand' && this.drawType !== 'polygon') {
      this.drawPoints[1] = { x, y };
    }

    this.drawPreview.clear();
    this.drawPreview.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.8 });

    if (this.drawType === 'rectangle' || this.drawType === 'text') {
      const rx = Math.min(sx, x);
      const ry = Math.min(sy, y);
      this.drawPreview.rect(rx, ry, Math.abs(x - sx), Math.abs(y - sy));
    } else if (this.drawType === 'circle') {
      const r = Math.hypot(x - sx, y - sy);
      this.drawPreview.circle(sx, sy, r);
    } else if (this.drawType === 'freehand') {
      this.drawPoints.push({ x, y });
      if (this.drawPoints.length > 1) {
        this.drawPreview.moveTo(this.drawPoints[0].x, this.drawPoints[0].y);
        for (let i = 1; i < this.drawPoints.length; i++) {
          this.drawPreview.lineTo(this.drawPoints[i].x, this.drawPoints[i].y);
        }
      }
    } else if (this.drawType === 'polygon') {
      this.previewPolygon(x, y);
    } else if (this.drawType === 'line') {
      this.drawPreview.moveTo(sx, sy);
      this.drawPreview.lineTo(x, y);
    } else if (this.drawType === 'cone') {
      this.drawCone(sx, sy, x, y);
    } else if (this.drawType === 'rect') {
      this.drawDirectedRect(sx, sy, x, y);
    }

    this.drawPreview.fill({ color: 0x6366f1, alpha: 0.12 });
    this.drawPreview.stroke();
  };

  private handleDrawPointerUp = (): void => {
    if (this.isDrawing && this.drawType !== 'polygon') this.finalizeDrawing();
  };

  private attachDrawingHandlers(): void {
    if (this.drawingHandlersAttached || !this.canvasEl) return;
    this.drawingHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleDrawPointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleDrawPointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleDrawPointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleDrawPointerUp);
  }

  private detachDrawingHandlers(): void {
    if (!this.drawingHandlersAttached || !this.canvasEl) return;
    this.drawingHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleDrawPointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleDrawPointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleDrawPointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleDrawPointerUp);
  }

  cancelDrawing(): void {
    this.isDrawing = false;
    this.drawStart = null;
    this.drawPoints = [];
    this.drawPreview.clear();
  }

  get isDrawingActive(): boolean {
    return this.isDrawing;
  }

  private drawCone(originX: number, originY: number, targetX: number, targetY: number): void {
    // Cone angle fixed at 53 degrees (D&D 5e standard)
    const coneAngle = 53 * Math.PI / 180; // Convert to radians
    const distance = Math.hypot(targetX - originX, targetY - originY);

    // Calculate central angle from origin to target
    const centralAngle = Math.atan2(targetY - originY, targetX - originX);

    // Calculate start and end angles for the cone
    const startAngle = centralAngle - coneAngle / 2;
    const endAngle = centralAngle + coneAngle / 2;

    // Draw the cone using arc
    this.drawPreview.moveTo(originX, originY);
    this.drawPreview.arc(originX, originY, distance, startAngle, endAngle);
    this.drawPreview.lineTo(originX, originY);
  }

  private drawDirectedRect(originX: number, originY: number, targetX: number, targetY: number): void {
    // Fixed width of 1 grid cell
    const gridSize = this.getGridSize();
    const width = gridSize;
    const length = Math.hypot(targetX - originX, targetY - originY);

    // Calculate angle from origin to target
    const angle = Math.atan2(targetY - originY, targetX - originX);

    // Calculate the four corners of the rectangle
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Rectangle corners (centered on the direction line)
    const halfWidth = width / 2;
    const corners = [
      { x: originX - halfWidth * sin, y: originY + halfWidth * cos }, // top-left
      { x: originX + halfWidth * sin, y: originY - halfWidth * cos }, // top-right
      { x: originX + length * cos + halfWidth * sin, y: originY + length * sin - halfWidth * cos }, // bottom-right
      { x: originX + length * cos - halfWidth * sin, y: originY + length * sin + halfWidth * cos }, // bottom-left
    ];

    // Draw the rectangle
    this.drawPreview.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.drawPreview.lineTo(corners[i].x, corners[i].y);
    }
    this.drawPreview.closePath();
  }

  // ── Walls (draw tool + door interaction) ──────────────────────────────

  private snapToGrid(val: number): number {
    const size = this.gridSize || DEFAULT_GRID_SIZE;
    const precision = size <= 50 ? 4 : size <= 100 ? 8 : 16;
    const sub = size / precision;
    return Math.round(val / sub) * sub;
  }

  private getWorldPos(e: MouseEvent | PointerEvent): { x: number; y: number } {
    const rect = this.canvasEl!.getBoundingClientRect();
    return this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);
  }

  private handleWallPointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return;
    e.preventDefault();
    const world = this.getWorldPos(e);
    const sx = this.snapToGrid(world.x);
    const sy = this.snapToGrid(world.y);
    this.isDrawingWall = true;
    if (!this.wallStart) {
      this.wallStart = { x: sx, y: sy };
    }
    this.wallEnd = { x: sx, y: sy };
  };

  private handleWallPointerMove = (e: PointerEvent): void => {
    if (!this.isDrawingWall || !this.wallStart) return;
    const world = this.getWorldPos(e);
    const sx = this.snapToGrid(world.x);
    const sy = this.snapToGrid(world.y);
    this.wallEnd = { x: sx, y: sy };
    this.wallPreview.clear();
    this.wallPreview.setStrokeStyle({ width: 3, color: 0xE8D840, alpha: 0.6 });
    this.wallPreview.moveTo(this.wallStart.x, this.wallStart.y);
    this.wallPreview.lineTo(sx, sy);
    this.wallPreview.stroke();
  };

  private handleWallPointerUp = (e: PointerEvent): void => {
    if (this.isDrawingWall) this.finalizeWall(e.shiftKey);
  };

  private finalizeWall(shiftKey = false): void {
    const start = this.wallStart;
    if (!start) {
      this.isDrawingWall = false;
      return;
    }

    const end = this.wallEnd || start;
    const endX = end.x;
    const endY = end.y;

    const dx = Math.abs(endX - start.x);
    const dy = Math.abs(endY - start.y);

    if (dx < 4 && dy < 4) {
      this.wallStart = null;
      this.isDrawingWall = false;
      this.wallPreview.clear();
      return;
    }

    const variantFields: Record<string, { sight?: boolean; light?: boolean; movement?: boolean; sound?: boolean; door?: number; doorState?: number }> = {
      'wall-terrain': { sight: false, light: false, movement: true, sound: false, door: 0 },
      'wall-invisible': { sight: false, light: false, movement: true, sound: false, door: 0 },
      'wall-ethereal': { sight: true, light: true, movement: false, sound: false, door: 0 },
      'wall-door': { sight: true, light: true, movement: true, sound: true, door: 1, doorState: 0 },
      'wall-door-secret': { sight: true, light: true, movement: true, sound: true, door: 2, doorState: 0 },
      'wall-window': { sight: false, light: true, movement: true, sound: true, door: 0 },
    };
    const fields = variantFields[this.activeTool] ?? {
      sight: true,
      light: true,
      movement: true,
      sound: true,
      levelId: this.currentLevelId,
      door: 0
    };

    this.onWallCreate?.({
      x1: this.snapToGrid(start.x),
      y1: this.snapToGrid(start.y),
      x2: this.snapToGrid(endX),
      y2: this.snapToGrid(endY),
      levelId: this.currentLevelId,
      ...fields,
    });

    this.wallPreview.clear();

    if (shiftKey) {
      this.wallStart = { x: endX, y: endY };
    } else {
      this.wallStart = null;
      this.isDrawingWall = false;
    }
  }

  private handleWallChainDoubleClick = (): void => {
    if (!this.isDrawingWall) return;
    this.wallPreview.clear();
    this.wallStart = null;
    this.isDrawingWall = false;
  };

  private attachWallHandlers(): void {
    if (this.wallHandlersAttached || !this.canvasEl) return;
    this.wallHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleWallPointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleWallPointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleWallPointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleWallPointerUp);
    this.canvasEl.addEventListener('dblclick', this.handleWallChainDoubleClick);
  }

  private detachWallHandlers(): void {
    if (!this.wallHandlersAttached || !this.canvasEl) return;
    this.wallHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleWallPointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleWallPointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleWallPointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleWallPointerUp);
    this.canvasEl.removeEventListener('dblclick', this.handleWallChainDoubleClick);
    if (this.isDrawingWall) {
      this.isDrawingWall = false;
      this.wallPreview.clear();
      this.wallStart = null;
      this.wallEnd = null;
    }
  }

  /** Hit-test: distância ponto a segmento de reta */
  private distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) return Math.hypot(px - ax, py - ay);
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
  }

  /** Processa clique para abrir/fechar portas */
  private attachWallDoorHandlers(): void {
    if (this.wallDoorHandlersAttached || !this.canvasEl) return;
    this.wallDoorHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleWallDoorClick);
  }

  private detachWallDoorHandlers(): void {
    if (!this.wallDoorHandlersAttached || !this.canvasEl) return;
    this.wallDoorHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleWallDoorClick);
  }

  private handleWallDoorClick = (e: PointerEvent): void => {
    // Door clicks are always available, regardless of active tool
    // This handler needs screen coords (not world) for hit-testing doors
    const rect = this.canvasEl!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    for (const w of this.walls) {
      if (w.door === 0) continue;

      // Hit-test: find the door handle at the midpoint of the wall segment
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      // Convert world mid-point → screen coords (inverse of toWorldCoordinates)
      const scale = this.app ? this.app.stage.scale.x : 1;
      const ox = this.app ? this.app.stage.x : 0;
      const oy = this.app ? this.app.stage.y : 0;
      const screenMx = mx * scale + ox;
      const screenMy = my * scale + oy;
      const dist = Math.hypot(sx - screenMx, sy - screenMy);

      if (dist < 18) {
        e.preventDefault();
        e.stopPropagation();

        if (e.button === 2) {
          // Right-click: only GMs can lock/unlock
          if (!this.isGM) return;
          // Toggle: closed → locked, locked → closed, open stays open
          const newState = w.doorState === 2 ? 0 : 2;
          this.onWallDoorStateChange?.(w.id, newState);
        } else {
          // Left-click: open/close logic
          if (w.doorState === 2) {
            // Locked: players can't open it
            if (!this.isGM) {
              showToast('Esta porta está trancada!', 'info');
              return;
            }
            // GM can open locked doors (unlocks + opens)
            this.onWallDoorStateChange?.(w.id, 1);
          } else {
            // Normal toggle: 0 (closed) ↔ 1 (open)
            this.onWallDoorStateChange?.(w.id, w.doorState === 1 ? 0 : 1);
          }
        }
        return;
      }
    }
  };

  private onWallDoorStateChange: ((wallId: string, newState: number) => void) | null = null;

  setOnWallDoorStateChange(callback: (wallId: string, newState: number) => void): void {
    this.onWallDoorStateChange = callback;
  }

  /** Abre config window ao dar duplo clique numa parede */
  private handleWallDoubleClick = (e: MouseEvent): void => {
    // Only open wall config when the wall editing tool is active
    const isWallTool = this.activeTool === 'walls' || this.activeTool === 'select-wall' || this.activeTool.startsWith('wall-');
    if (!isWallTool) return;
    const world = this.getCanvasPos(e);
    for (const w of this.walls) {
      const dist = this.distPointToSegment(world.x, world.y, w.x1, w.y1, w.x2, w.y2);
      if (dist < 16) {
        this.onWallDoubleClick?.(w.id);
        return;
      }
    }
  };

  private onWallDoubleClick: ((wallId: string) => void) | null = null;

  setOnWallDoubleClick(callback: (wallId: string) => void): void {
    this.onWallDoubleClick = callback;
  }


  private handleNoiseDoubleClick = (e: MouseEvent): void => {
    const world = this.getCanvasPos(e);
    for (const noise of this.allNoises) {
      const dist = Math.hypot(world.x - noise.x, world.y - noise.y);
      if (dist < 20) {
        this.onNoiseDoubleClick?.(noise.id);
        return;
      }
    }
  };

  private onLightDoubleClick: ((lightId: string) => void) | null = null;
  private onLightToggle: ((lightId: string) => void) | null = null;

  private handleLightDoubleClick = (e: MouseEvent): void => {
    const world = this.getCanvasPos(e);
    for (const light of this.allLights) {
      const dist = Math.hypot(world.x - light.x, world.y - light.y);
      if (dist < 20) {
        this.onLightDoubleClick?.(light.id);
        return;
      }
    }
  };

  /** Chamado pelo game-hud quando quer ativar interação com portas */
  enableWallDoorInteraction(): void {
    this.attachWallDoorHandlers();
    this.canvasEl?.addEventListener('dblclick', this.handleWallDoubleClick);
  }

  disableWallDoorInteraction(): void {
    this.detachWallDoorHandlers();
    this.canvasEl?.removeEventListener('dblclick', this.handleWallDoubleClick);
  }

  /** Habilita interação de duplo-clique em sons */
  enableNoiseDoubleClickInteraction(): void {
    this.canvasEl?.addEventListener('dblclick', this.handleNoiseDoubleClick);
  }

  /** Desabilita interação de duplo-clique em sons */
  disableNoiseDoubleClickInteraction(): void {
    this.canvasEl?.removeEventListener('dblclick', this.handleNoiseDoubleClick);
  }

  /** Habilita interação de duplo-clique em luzes */
  enableLightDoubleClickInteraction(): void {
    this.canvasEl?.addEventListener('dblclick', this.handleLightDoubleClick);
  }

  /** Desabilita interação de duplo-clique em luzes */
  disableLightDoubleClickInteraction(): void {
    this.canvasEl?.removeEventListener('dblclick', this.handleLightDoubleClick);
  }

  // ── Sound placement tool ────────────────────────────────────────────────

  private handleSoundPointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return;
    if (this.suppressSoundCreate) return;

    const rect = this.canvasEl!.getBoundingClientRect();
    const world = this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);

    // Avoids creating a new sound if clicking on top of an existing sound or its resize handle
    for (const noise of this.allNoises) {
      if (noise.stageId === this.currentStageId && (!noise.hidden || this.isGM)) {
        // Clicked near the center of the sound? (18 pixels limit)
        if (Math.hypot(world.x - noise.x, world.y - noise.y) < 18) {
          return;
        }
        // Clicked near the resize handle of the selected sound?
        if (this.selectedSoundId === noise.id) {
          const handleX = noise.x + noise.radius;
          const handleY = noise.y;
          if (Math.hypot(world.x - handleX, world.y - handleY) < 12) {
            return;
          }
        }
      }
    }

    e.preventDefault();
    this.isDrawingSound = true;
    this.soundStart = { x: world.x, y: world.y };
  };

  private handleSoundPointerMove = (e: PointerEvent): void => {
    if (!this.isDrawingSound || !this.soundStart) return;
    const rect = this.canvasEl!.getBoundingClientRect();
    const { x, y } = this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);
    this.soundCurrent = { x, y };
    const r = Math.hypot(x - this.soundStart.x, y - this.soundStart.y);
    this.soundPreview.clear();
    this.soundPreview.setStrokeStyle({ width: 2, color: 0x3b82f6, alpha: 0.5 });
    this.soundPreview.circle(this.soundStart.x, this.soundStart.y, r);
    this.soundPreview.fill({ color: 0x3b82f6, alpha: 0.08 });
    this.soundPreview.stroke();
  };

  private handleSoundPointerUp = (): void => {
    if (this.isDrawingSound) this.finalizeSound();
  };

  private finalizeSound(): void {
    const start = this.soundStart;
    if (!start) {
      this.isDrawingSound = false;
      return;
    }
    this.isDrawingSound = false;
    this.soundPreview.clear();
    const end = this.soundCurrent || start;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let radius = Math.hypot(dx, dy);
    if (radius < 10) radius = 100;
    this.onNoiseCreate?.({ x: Math.round(start.x), y: Math.round(start.y), radius: Math.round(radius), levelId: this.currentLevelId });
    this.soundStart = null;
    this.soundCurrent = null;
  }

  private attachSoundHandlers(): void {
    if (this.soundHandlersAttached || !this.canvasEl) return;
    this.soundHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleSoundPointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleSoundPointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleSoundPointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleSoundPointerUp);
  }

  private detachSoundHandlers(): void {
    if (!this.soundHandlersAttached || !this.canvasEl) return;
    this.soundHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleSoundPointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleSoundPointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleSoundPointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleSoundPointerUp);
    if (this.isDrawingSound) {
      this.isDrawingSound = false;
      this.soundPreview.clear();
      this.soundStart = null;
      this.soundCurrent = null;
    }
  }

  // ── Light placement tool (drag-to-create) ─────────────────────────────

  private handleLightPointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return;
    const world = this.getWorldPos(e);
    // Skip if clicking on an existing light handle
    for (const light of this.allLights) {
      if (Math.hypot(world.x - light.x, world.y - light.y) < 18) return;
    }
    e.preventDefault();
    this.isCreatingLight = true;
    this.lightDragStart = { x: world.x, y: world.y };
  };

  private handleLightPointerMove = (e: PointerEvent): void => {
    if (!this.isCreatingLight || !this.lightDragStart) return;
    const world = this.getWorldPos(e);
    this.lightDragCurrent = { x: world.x, y: world.y };
    const r = Math.hypot(world.x - this.lightDragStart.x, world.y - this.lightDragStart.y);
    this.lightPreview.clear();
    this.lightPreview.setStrokeStyle({ width: 2, color: 0xee9b3a, alpha: 0.7 });
    this.lightPreview.circle(this.lightDragStart.x, this.lightDragStart.y, Math.max(4, r));
    this.lightPreview.fill({ color: 0xee9b3a, alpha: 0.08 });
    this.lightPreview.stroke();
    // Center dot
    this.lightPreview.circle(this.lightDragStart.x, this.lightDragStart.y, 5);
    this.lightPreview.fill({ color: 0xee9b3a, alpha: 0.9 });
  };

  private handleLightPointerUp = (): void => {
    if (this.isCreatingLight) this.finalizeLight();
  };

  private finalizeLight(): void {
    const start = this.lightDragStart;
    if (!start) { this.isCreatingLight = false; return; }
    this.isCreatingLight = false;
    this.lightPreview.clear();
    const end = this.lightDragCurrent || start;
    let radius = Math.hypot(end.x - start.x, end.y - start.y);
    if (radius < 10) radius = 100;
    this.onLightCreate?.({
      x: Math.round(start.x),
      y: Math.round(start.y),
      radius: Math.round(radius),
      dim: Math.round(radius),
      bright: Math.round(radius / 2),
      levelId: this.currentLevelId,
    });
    this.lightDragStart = null;
    this.lightDragCurrent = null;
  }

  private attachLightHandlers(): void {
    if (this.lightHandlersAttached || !this.canvasEl) return;
    this.lightHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleLightPointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleLightPointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleLightPointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleLightPointerUp);
  }

  private detachLightHandlers(): void {
    if (!this.lightHandlersAttached || !this.canvasEl) return;
    this.lightHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleLightPointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleLightPointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleLightPointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleLightPointerUp);
    if (this.isCreatingLight) {
      this.isCreatingLight = false;
      this.lightPreview.clear();
      this.lightDragStart = null;
      this.lightDragCurrent = null;
    }
  }

  // ── Tile creation (drag-to-create rectangle) ──────────────────────────

  setTilePendingImgUrl(url: string): void {
    this.tileCreatePendingImgUrl = url;
  }

  private handleTilePointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return;
    const world = this.getWorldPos(e);
    e.preventDefault();
    this.isCreatingTile = true;
    this.tileDragStart = { x: world.x, y: world.y };
  };

  private handleTilePointerMove = (e: PointerEvent): void => {
    if (!this.isCreatingTile || !this.tileDragStart) return;
    const world = this.getWorldPos(e);
    this.tileDragCurrent = { x: world.x, y: world.y };
    const g = this.tilePreview;
    g.clear();
    const x = Math.min(this.tileDragStart.x, world.x);
    const y = Math.min(this.tileDragStart.y, world.y);
    const w = Math.abs(world.x - this.tileDragStart.x);
    const h = Math.abs(world.y - this.tileDragStart.y);
    g.setStrokeStyle({ width: 2, color: 0xee9b3a, alpha: 0.7 });
    g.rect(x, y, Math.max(4, w), Math.max(4, h));
    g.stroke();
    g.rect(x, y, Math.max(4, w), Math.max(4, h));
    g.fill({ color: 0xee9b3a, alpha: 0.08 });
  };

  private handleTilePointerUp = (): void => {
    if (this.isCreatingTile) this.finalizeTile();
  };

  private finalizeTile(): void {
    const start = this.tileDragStart;
    if (!start) { this.isCreatingTile = false; return; }
    this.isCreatingTile = false;
    this.tilePreview.clear();
    const end = this.tileDragCurrent || start;
    const w = Math.max(50, Math.abs(end.x - start.x));
    const h = Math.max(50, Math.abs(end.y - start.y));
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    this.onTileCreate?.({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      imgUrl: this.tileCreatePendingImgUrl,
      elevation: this.currentLevelBounds?.bottom ?? 0,
    });
    this.tileCreatePendingImgUrl = '';
    this.tileDragStart = null;
    this.tileDragCurrent = null;
  }

  private attachTileCreateHandlers(): void {
    if (this.tileCreateHandlersAttached || !this.canvasEl) return;
    this.tileCreateHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleTilePointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleTilePointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleTilePointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleTilePointerUp);
  }

  private detachTileCreateHandlers(): void {
    if (!this.tileCreateHandlersAttached || !this.canvasEl) return;
    this.tileCreateHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleTilePointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleTilePointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleTilePointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleTilePointerUp);
    if (this.isCreatingTile) {
      this.isCreatingTile = false;
      this.tilePreview.clear();
      this.tileDragStart = null;
      this.tileDragCurrent = null;
    }
  }

  private handleCanvasDragOver = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleCanvasDrop = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const rawText = e.dataTransfer?.getData('text/plain');
    console.log('LoomVTT | Canvas Drop:', { rawText });

    if (!rawText) return;

    try {
      const data = JSON.parse(rawText);
      if (data && (data.type || data.uuid || data.packType)) {
        console.log('LoomVTT | Canvas Drop: Actor/Item detectado, dispatching event');
        // Calls the handler from game-hud.ts to deal with this drop
        const event = new CustomEvent('canvas-actor-drop', {
          detail: { data, clientX: e.clientX, clientY: e.clientY },
          bubbles: true,
        });
        this.canvasEl?.dispatchEvent(event);
        return;
      }
    } catch (err) {
      console.log('LoomVTT | Canvas Drop: não é JSON', err);
    }

    const looksLikeImagePath = /^(https?:|data:|\/|\.\/|\.\.\/)/i.test(rawText) ||
      /\.(png|jpe?g|gif|webp|svg|bmp|avif|webm|mp4|m4v|ogv|mov)(\?|#|$)/i.test(rawText);
    if (!looksLikeImagePath) {
      console.log('LoomVTT | Canvas Drop: texto não parece um caminho de imagem/vídeo, ignorando', rawText);
      return;
    }

    const rect = this.canvasEl!.getBoundingClientRect();
    const world = this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);

    const cellSize = this.gridSize || DEFAULT_GRID_SIZE;
    const defaultW = cellSize * 4;
    const defaultH = cellSize * 4;

    this.onTileCreate?.({
      x: Math.round(world.x - defaultW / 2),
      y: Math.round(world.y - defaultH / 2),
      width: Math.round(defaultW),
      height: Math.round(defaultH),
      imgUrl: rawText,
      elevation: this.currentLevelBounds?.bottom ?? 0,
    });
  };

  // ── Document-level drag handlers ──

  private isInsideCanvas(clientX: number, clientY: number): boolean {
    if (!this.canvasEl) return false;
    const r = this.canvasEl.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  private handleDocumentDragOver = (e: DragEvent): void => {
    if (this.isInsideCanvas(e.clientX, e.clientY)) {
      e.preventDefault();
    }
  };

  private handleDocumentDrop = (e: DragEvent): void => {
    if (this.isInsideCanvas(e.clientX, e.clientY)) {
      this.handleCanvasDrop(e);
    }
  };

  // ── Measure / Ruler tool ─────────────────────────────────────────────


  private handleMeasurePointerDown = (e: PointerEvent): void => {
    if (e.button === 2) return;
    e.preventDefault();
    const rect = this.canvasEl!.getBoundingClientRect();
    const { x, y } = this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);
    this.isMeasuring = true;
    this.measureStart = { x, y };
  };

  private handleMeasurePointerMove = (e: PointerEvent): void => {
    if (!this.isMeasuring || !this.measureStart) return;
    const rect = this.canvasEl!.getBoundingClientRect();
    const { x, y } = this.toWorldCoordinates(e.clientX - rect.left, e.clientY - rect.top);

    this.measurePreview.clear();
    this.measurePreview.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.6 });
    this.measurePreview.moveTo(this.measureStart.x, this.measureStart.y);
    this.measurePreview.lineTo(x, y);
    this.measurePreview.stroke();

    const dx = x - this.measureStart.x;
    const dy = y - this.measureStart.y;
    const distPx = Math.hypot(dx, dy);
    const gridSquares = distPx / this.gridSize;
    const distReal = gridSquares * this.gridDistance;
    const displayDist = Math.round(distReal * 10) / 10;
    this.measureLabel.text = `${displayDist} ${this.gridUnit}`;
    this.measureLabel.visible = true;
    this.measureLabel.x = x + 10;
    this.measureLabel.y = y - 10;
  };

  private handleMeasurePointerUp = (): void => {
    if (!this.isMeasuring) return;
    this.isMeasuring = false;
    this.measureStart = null;
    this.measurePreview.clear();
    this.measureLabel.visible = false;
  };

  private attachMeasureHandlers(): void {
    if (this.measureHandlersAttached || !this.canvasEl) return;
    this.measureHandlersAttached = true;
    this.canvasEl.addEventListener('pointerdown', this.handleMeasurePointerDown);
    this.canvasEl.addEventListener('pointermove', this.handleMeasurePointerMove);
    this.canvasEl.addEventListener('pointerup', this.handleMeasurePointerUp);
    this.canvasEl.addEventListener('pointerleave', this.handleMeasurePointerUp);
  }

  private detachMeasureHandlers(): void {
    if (!this.measureHandlersAttached || !this.canvasEl) return;
    this.measureHandlersAttached = false;
    this.canvasEl.removeEventListener('pointerdown', this.handleMeasurePointerDown);
    this.canvasEl.removeEventListener('pointermove', this.handleMeasurePointerMove);
    this.canvasEl.removeEventListener('pointerup', this.handleMeasurePointerUp);
    this.canvasEl.removeEventListener('pointerleave', this.handleMeasurePointerUp);
    if (this.isMeasuring) {
      this.isMeasuring = false;
      this.measureStart = null;
      this.measurePreview.clear();
      this.measureLabel.visible = false;
    }
  }

  private finalizeDrawing(): void {
    const start = this.drawStart;
    if (!start) {
      this.isDrawing = false;
      return;
    }

    const type = this.drawType;
    const last = this.drawPoints[this.drawPoints.length - 1] || start;
    let bounds: { x: number; y: number; w: number; h: number };
    let finalPoints: { x: number; y: number }[] = [];

    if (type === 'rectangle' || type === 'line' || type === 'text') {
      bounds = {
        x: Math.min(start.x, last.x),
        y: Math.min(start.y, last.y),
        w: Math.abs(last.x - start.x),
        h: Math.abs(last.y - start.y),
      };
      if (type === 'line') finalPoints = [start, last];
    } else if (type === 'circle') {
      const r = Math.hypot(last.x - start.x, last.y - start.y);
      bounds = { x: start.x - r, y: start.y - r, w: r * 2, h: r * 2 };
    } else {
      // freehand or polygon — bounding box from all sampled points
      const xs = this.drawPoints.map((p) => p.x);
      const ys = this.drawPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      bounds = { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
      finalPoints = this.drawPoints;
    }

    this.cancelDrawing();

    // Ignore accidental clicks (no meaningful drag)
    if (type !== 'freehand' && type !== 'polygon' && bounds.w < 2 && bounds.h < 2) return;
    if ((type === 'freehand' || type === 'polygon') && finalPoints.length < 2) return;

    // For templates, create persistent template via API
    if (type === 'cone' || type === 'rect') {
      this.createTemporaryTemplate(type, bounds, finalPoints);
      this.onTemplateCreate?.({
        type,
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        radius: Math.max(bounds.w, bounds.h) / 2,
        distance: Math.max(bounds.w, bounds.h),
        fillColor: '#6366f1',
        strokeColor: '#6366f1',
        opacity: 0.3,
      });
    } else if (type === 'text') {
      this.onDrawingCreate?.({
        type,
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        text: '',
        fillColor: '#ffffff',
        fillOpacity: 0.3,
        strokeColor: '#ffffff',
        strokeWidth: 2,
        levelId: this.currentLevelId,
        fontSize: 48,
        fontFamily: 'Arial',
        points: [],
      });
    } else {
      // Regular drawings are persisted
      this.onDrawingCreate?.({
        type,
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        fillColor: '#6366f1',
        fillOpacity: 0.2,
        strokeColor: '#6366f1',
        strokeWidth: 2,
        points: finalPoints,
      });
    }
  }

  private createTemporaryTemplate(type: string, bounds: { x: number; y: number; w: number; h: number }, points: { x: number; y: number }[]): void {
    const g = new Graphics();
    g.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.8 });

    if (type === 'cone') {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const radius = Math.max(bounds.w, bounds.h) / 2;
      const angle = 90 * (Math.PI / 180);
      const half = angle / 2;
      const startAngle = -half;
      const endAngle = half;
      g.moveTo(cx, cy);
      g.arc(cx, cy, radius, startAngle, endAngle);
      g.lineTo(cx, cy);
      g.closePath();
    } else if (type === 'rect') {
      g.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    }

    g.fill({ color: 0x6366f1, alpha: 0.12 });
    g.stroke();

    this.layers.interface.addChild(g);
    let opacity = 0.8;
    const fadeInterval = setInterval(() => {
      opacity -= 0.05;
      g.alpha = opacity;
      if (opacity <= 0) {
        clearInterval(fadeInterval);
        this.layers.interface.removeChild(g);
      }
    }, 75);
  }

  loadDrawings(drawings: DrawingData[]): void {
    this.clearDrawings();
    for (const d of drawings || []) this.renderDrawing(d);
  }

  clearDrawings(): void {
    this.drawnShapes.forEach((c) => {
      this.layers.drawings.removeChild(c);
      c.destroy({ children: true });
    });
    this.drawnShapes.clear();
    this.drawingDataMap.clear();
  }

  renderDrawing(data: DrawingData): void {
    if (!data.id) return;
    this.drawingDataMap.set(data.id, data);

    let container = this.drawnShapes.get(data.id);
    if (!container) {
      container = new Container();
      container.eventMode = 'none';
      this.layers.drawings.addChild(container);
      this.drawnShapes.set(data.id, container);
    }
    (container as any).__levelId = data.levelId ?? '';
    container.visible = this.isOnCurrentLevel(data.levelId);
    container.removeChildren().forEach((c) => c.destroy({ children: true, texture: false }));
    // Shapes are drawn in absolute coords; zeros the drag offset to not add up with the update echo
    container.x = 0;
    container.y = 0;

    const g = new Graphics();
    const t = data.type || 'rectangle';
    const pts: { x: number; y: number }[] = (() => {
      try {
        return typeof data.points === 'string' ? JSON.parse(data.points) : data.points || [];
      } catch {
        return [];
      }
    })();
    const fillColor = data.fillColor || '#000000';
    const fillOpacity = data.fillOpacity ?? 0.3;
    const strokeColor = data.strokeColor || '#ffffff';
    const strokeWidth = data.strokeWidth ?? 1;

    g.setStrokeStyle({ width: strokeWidth, color: strokeColor, alpha: 1 });

    if (t === 'rectangle') {
      g.rect(data.x ?? 0, data.y ?? 0, data.width ?? 100, data.height ?? 100);
    } else if (t === 'ellipse' || t === 'circle') {
      const cx = (data.x ?? 0) + (data.width ?? 100) / 2;
      const cy = (data.y ?? 0) + (data.height ?? 100) / 2;
      g.ellipse(cx, cy, (data.width ?? 100) / 2, (data.height ?? 100) / 2);
    } else if (t === 'line' && pts.length > 1) {
      g.moveTo(pts[0].x, pts[0].y);
      g.lineTo(pts[1].x, pts[1].y);
    } else if ((t === 'polygon' || t === 'freehand') && pts.length > 1) {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      if (t === 'polygon') g.closePath();
    }

    if (fillOpacity > 0 && t !== 'line' && t !== 'freehand' && t !== 'text') {
      g.fill({ color: fillColor, alpha: fillOpacity });
    }
    if (strokeWidth > 0 && t !== 'text') g.stroke();
    container.addChild(g);

    // Pure text OR label inside rectangle/ellipse.
    if (data.text && (t === 'text' || t === 'rectangle' || t === 'ellipse' || t === 'circle')) {
      const boxWidth = data.width ?? 0;
      const textStyle = {
        fontFamily: data.fontFamily || 'Arial',
        fontSize: data.fontSize || 16,
        fill: t === 'text' ? (data.strokeColor || '#ffffff') : (data.fillColor || '#ffffff'),
        wordWrap: boxWidth > 0,
        wordWrapWidth: Math.max(boxWidth - 16, 10),
        breakWords: true,
        align: 'center' as const,
      };
      const pixiText = new Text({ text: data.text, style: textStyle });
      pixiText.anchor.set(0.5);

      // Pure text box: never gets smaller than the text — grows in height
      // (line wrap) without persisting itself, only recalculates on every render
      // (used to center and to prevent selectionOutline from being smaller than the real text).
      let boxHeight = data.height ?? 0;
      if (t === 'text') {
        boxHeight = Math.max(boxHeight, pixiText.height + 16);
        data.height = boxHeight;
      }
      pixiText.x = (data.x ?? 0) + boxWidth / 2;
      pixiText.y = (data.y ?? 0) + boxHeight / 2;
      container.addChild(pixiText);
    }

    // Explicit hit area, with margin — without this, text with no fill (or
    // shape with fillOpacity 0) only receives pointerdown on top of the actual
    // glyphs/strokes, and the resize handles (which stay in the "empty" corners) never
    // trigger any click.
    const margin = 12;
    if (t === 'rectangle' || t === 'ellipse' || t === 'circle' || t === 'text') {
      const hx = data.x ?? 0, hy = data.y ?? 0, hw = data.width ?? 0, hh = data.height ?? 0;
      container.hitArea = new Rectangle(hx - margin, hy - margin, hw + margin * 2, hh + margin * 2);
    } else if (pts.length > 0) {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      container.hitArea = new Rectangle(minX - margin, minY - margin, Math.max(...xs) - minX + margin * 2, Math.max(...ys) - minY + margin * 2);
    }

    if (data.z) container.zIndex = data.z;
    this.updateDrawingsInteractionState();
  }

  private updateDrawingsInteractionState(): void {
    const interactable = this.activeTool === 'select-drawing';
    for (const [id, container] of this.drawnShapes.entries()) {
      container.eventMode = interactable ? 'static' : 'none';
      container.cursor = interactable ? 'pointer' : 'default';
      container.removeAllListeners('dblclick');
      container.removeAllListeners('pointerdown');
      if (interactable) {
        let lastClick = 0;
        container.on('pointerdown', (event: FederatedPointerEvent) => {
          event.stopPropagation();

          // Resize handle in the 4 corners — only when already selected and the type has bounding-box
          const resizable = ['rectangle', 'ellipse', 'circle', 'text'];
          if (this.selectedDrawingId === id) {
            const data = this.drawingDataMap.get(id);
            if (data && resizable.includes(data.type || '')) {
              const local = container.toLocal(event.global);
              const threshold = 10;
              const x0 = data.x ?? 0, y0 = data.y ?? 0, w0 = data.width ?? 0, h0 = data.height ?? 0;
              const corners: Array<{ key: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }> = [
                { key: 'tl', x: x0, y: y0 },
                { key: 'tr', x: x0 + w0, y: y0 },
                { key: 'bl', x: x0, y: y0 + h0 },
                { key: 'br', x: x0 + w0, y: y0 + h0 },
              ];
              for (const c of corners) {
                if (Math.abs(local.x - c.x) <= threshold && Math.abs(local.y - c.y) <= threshold) {
                  const startGX = event.global.x;
                  const startGY = event.global.y;
                  const startBounds = { x: x0, y: y0, w: w0, h: h0 };
                  const onResizeMove = (ev: FederatedPointerEvent) => {
                    const dx = (ev.global.x - startGX) / this.app.stage.scale.x;
                    const dy = (ev.global.y - startGY) / this.app.stage.scale.y;
                    let nx = startBounds.x, ny = startBounds.y, nw = startBounds.w, nh = startBounds.h;
                    if (c.key === 'tr' || c.key === 'br') nw = Math.max(20, startBounds.w + dx);
                    else { nw = Math.max(20, startBounds.w - dx); nx = startBounds.x + (startBounds.w - nw); }
                    if (c.key === 'bl' || c.key === 'br') nh = Math.max(20, startBounds.h + dy);
                    else { nh = Math.max(20, startBounds.h - dy); ny = startBounds.y + (startBounds.h - nh); }
                    data.x = nx; data.y = ny; data.width = nw; data.height = nh;
                    this.renderDrawing(data);
                    this.drawSelectionOutline();
                  };
                  const onResizeUp = () => {
                    this.app.stage.off('pointermove', onResizeMove);
                    this.app.stage.off('pointerup', onResizeUp);
                    this.app.stage.off('pointerupoutside', onResizeUp);
                    this.onDrawingMove?.(id, { x: data.x ?? 0, y: data.y ?? 0, width: data.width, height: data.height });
                  };
                  this.app.stage.on('pointermove', onResizeMove);
                  this.app.stage.on('pointerup', onResizeUp);
                  this.app.stage.on('pointerupoutside', onResizeUp);
                  return;
                }
              }
            }
          }

          const now = Date.now();
          if (now - lastClick < 300) {
            lastClick = now;
            void windowManager.open(`drawing-config-${id}`, DrawingConfigWindow, {
              id: `drawing-config-${id}`,
              drawingId: id,
            });
            return;
          }
          lastClick = now;
          this.selectDrawing(id);

          // Drag to move the drawing
          const startGX = event.global.x;
          const startGY = event.global.y;
          const origX = container.x;
          const origY = container.y;
          let moved = false;
          const onMove = (ev: FederatedPointerEvent) => {
            const dx = (ev.global.x - startGX) / this.app.stage.scale.x;
            const dy = (ev.global.y - startGY) / this.app.stage.scale.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            container.x = origX + dx;
            container.y = origY + dy;
            // Outline follows the live drag (otherwise it stays behind while the drawing moves)
            if (this.selectionOutline) {
              this.selectionOutline.x = dx;
              this.selectionOutline.y = dy;
            }
          };
          const onUp = () => {
            this.app.stage.off('pointermove', onMove);
            this.app.stage.off('pointerup', onUp);
            this.app.stage.off('pointerupoutside', onUp);
            if (!moved) return;
            const data = this.drawingDataMap.get(id);
            if (!data) return;
            const dx = container.x - origX;
            const dy = container.y - origY;
            let pts: { x: number; y: number }[] | undefined;
            try {
              const raw = typeof data.points === 'string' ? JSON.parse(data.points) : data.points;
              if (Array.isArray(raw) && raw.length) pts = raw.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
            } catch { /* pontos ilegíveis: move só x/y */ }
            data.x = (data.x ?? 0) + dx;
            data.y = (data.y ?? 0) + dy;
            if (pts) data.points = pts;
            // Zeros the outline offset (drawSelectionOutline will already redraw at the new `data` position)
            if (this.selectionOutline) {
              this.selectionOutline.x = 0;
              this.selectionOutline.y = 0;
            }
            this.drawSelectionOutline();
            this.onDrawingMove?.(id, { x: data.x, y: data.y, points: pts });
          };
          this.app.stage.on('pointermove', onMove);
          this.app.stage.on('pointerup', onUp);
          this.app.stage.on('pointerupoutside', onUp);
        });
      }
    }
  }

  removeDrawing(id: string): void {
    const container = this.drawnShapes.get(id);
    if (!container) return;
    this.layers.drawings.removeChild(container);
    container.destroy({ children: true });
    this.drawnShapes.delete(id);
    if (this.selectedDrawingId === id) {
      this.selectDrawing(null);
    }
    windowManager.close(`drawing-config-${id}`);
  }

  destroy(): void {
    if (CanvasManager.activeInstance === this) {
      CanvasManager.activeInstance = null;
    }
    this.destroyed = true;
    this.unsubCursor?.();
    this.unsubCursor = null;
    this.unsubFloatingText?.();
    this.unsubFloatingText = null;
    if (this.weatherAnimId !== null) {
      cancelAnimationFrame(this.weatherAnimId);
      this.weatherAnimId = null;
    }
    if (this.weatherFlashTimeoutId !== null) {
      clearTimeout(this.weatherFlashTimeoutId);
      this.weatherFlashTimeoutId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.canvasEl) {
      this.canvasEl.removeEventListener('pointerdown', this.handleDrawPointerDown);
      this.canvasEl.removeEventListener('pointermove', this.handleDrawPointerMove);
      this.canvasEl.removeEventListener('pointerup', this.handleDrawPointerUp);
      this.canvasEl.removeEventListener('pointerleave', this.handleDrawPointerUp);
      this.canvasEl.removeEventListener('pointerdown', this.handleWallPointerDown);
      this.canvasEl.removeEventListener('pointermove', this.handleWallPointerMove);
      this.canvasEl.removeEventListener('pointerup', this.handleWallPointerUp);
      this.canvasEl.removeEventListener('pointerleave', this.handleWallPointerUp);
      this.canvasEl.removeEventListener('dblclick', this.handleWallChainDoubleClick);
      this.canvasEl.removeEventListener('pointerdown', this.handleWallDoorClick);
      this.canvasEl.removeEventListener('dblclick', this.handleWallDoubleClick);
      this.canvasEl.removeEventListener('dblclick', this.handleNoiseDoubleClick);
      this.canvasEl.removeEventListener('dblclick', this.handleLightDoubleClick);
      this.canvasEl.removeEventListener('pointerdown', this.handleTilePointerDown);
      this.canvasEl.removeEventListener('pointermove', this.handleTilePointerMove);
      this.canvasEl.removeEventListener('pointerup', this.handleTilePointerUp);
      this.canvasEl.removeEventListener('pointerleave', this.handleTilePointerUp);
      this.canvasEl.removeEventListener('dragover', this.handleCanvasDragOver);
      this.canvasEl.removeEventListener('drop', this.handleCanvasDrop);
      document.removeEventListener('dragover', this.handleDocumentDragOver);
      document.removeEventListener('drop', this.handleDocumentDrop);
      this.canvasEl.removeEventListener('pointerdown', this.handleMeasurePointerDown);
      this.canvasEl.removeEventListener('pointermove', this.handleMeasurePointerMove);
      this.canvasEl.removeEventListener('pointerup', this.handleMeasurePointerUp);
      this.canvasEl.removeEventListener('pointerleave', this.handleMeasurePointerUp);
    }
    this.clearDrawings();
    this.clearWalls();
    this.clearTiles();
    for (const id of Array.from(this.tokens.keys())) {
      this.removeToken(id);
    }
    this.fogLayer?.destroy();
    if (this.app) {
      this.app.ticker.remove(this.updateAnimations, this);
      this.app.destroy(true);
    }
  }

  private createStatusIcon(marker: string): Container | null {
    const iconSize = 8;
    const icon = new Container();

    const def = statusEffectRegistry.get(marker);
    if (!def) return null;

    const bg = new Graphics();
    bg.circle(0, 0, iconSize);
    bg.fill({ color: def.color, alpha: 0.8 });

    icon.addChild(bg);

    const text = new Text({
      text: def.label.charAt(0).toUpperCase(),
      style: {
        fontFamily: 'Arial',
        fontSize: 6,
        fill: 0xffffff,
        align: 'center',
      }
    });
    text.anchor.set(0.5);
    icon.addChild(text);

    return icon;
  }

  setInitState(initState: { cast: any[] }): void {
    this.initState = initState;
  }

  private updateAnimations(): void {
    if (!this.app || this.destroyed) return;

    // Animate darkness transition (lerp toward target level)
    this.fogLayer.animate(this.app.ticker.deltaTime);

    // Animate lights
    for (const light of this.allLights) {
      const group = this.lightGroups.get(light.id);
      if (!group) continue;

      const anim = this.lightAnimationsEnabled ? (light.animation || 'none') : 'none';
      if (anim === 'none') {
        group.alpha = 1.0;
        group.scale.set(1.0);
        group.tint = 0xffffff;
        group.x = light.x;
        group.y = light.y;
        continue;
      }

      const speed = light.animationSpeed ?? 5;
      const intensity = light.animationIntensity ?? 5;

      // Map sliders (1 to 10) to actual mathematical speed/intensity ratios
      const speedFactor = speed * 0.5;
      const intensityFactor = intensity * 0.1;

      if (anim === 'torch') {
        const time = Date.now() * 0.003 * speedFactor;
        const flicker = Math.sin(time) * 0.12 + Math.sin(time * 2.3) * 0.08 + (Math.random() - 0.5) * 0.03;
        group.alpha = Math.max(0.2, 1.0 + flicker * intensityFactor * 0.5);
        group.scale.set(1.0 + flicker * intensityFactor * 0.12);
      } else if (anim === 'pulse') {
        const time = Date.now() * 0.0015 * speedFactor;
        const pulse = Math.sin(time);
        group.alpha = 1.0 + pulse * intensityFactor * 0.25;
        group.scale.set(1.0 + pulse * intensityFactor * 0.18);
      } else if (anim === 'wave') {
        const time = Date.now() * 0.002 * speedFactor;
        group.scale.set(1.0 + Math.sin(time) * intensityFactor * 0.15);
      } else if (anim === 'fog') {
        const time = Date.now() * 0.0005 * speedFactor;
        group.x = light.x + Math.sin(time) * intensityFactor * 15;
        group.y = light.y + Math.cos(time * 0.8) * intensityFactor * 15;
        group.alpha = 0.95 + Math.sin(time * 2) * intensityFactor * 0.05;
      } else if (anim === 'chroma') {
        const time = (Date.now() * 0.02 * speedFactor) % 360;
        group.tint = hslToHex(time, 90, 60);
      }
    }
  }

  private onPingSend?: (x: number, y: number) => void;

  /** Registers the callback that sends the ping via WebSocket (called by game-hud.ts). */
  setOnPingSend(callback: (x: number, y: number) => void): void {
    this.onPingSend = callback;
  }

  /** Draws a pulsing marker at (x,y) on the map for ~2s. Called locally AND via WS from other clients. */
  /** Radar "look here" style marker — rings expanding in cascade (Discord
   * ping). With `sustain=true` the rings keep spawning while the mouse button
   * is held down (caller holds the reference and calls the returned function on
   * pointerup); without it the marker would spawn and disappear on its own,
   * ignoring if t  he player was still holding the button. Returns `release()` — call
   * when you release the button; the marker stays for a little while longer (grace)
   * and disappears, instead of vanishing immediately. */
  showPing(x: number, y: number, color: string = '#ffcc00', sustain: boolean = false): () => void {
    const colorNum = parseInt(color.replace('#', '0x'), 16);
    const gfx = new Graphics();
    this.layers.interface.addChild(gfx);

    const RING_DELAY = 180; // ms between the birth of each ring
    const RING_DURATION = 900; // ms of life of each ring, from birth to disappearance
    const MAX_RADIUS = 42;
    const MIN_RADIUS = 6;
    const POST_RELEASE_GRACE = 700; // stays visible for a while after releasing the button 

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const startTime = performance.now();
    let releasedAt: number | null = sustain ? null : startTime;

    const release = () => {
      if (releasedAt === null) releasedAt = performance.now();
    };

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const spawnCutoff = releasedAt !== null ? releasedAt - startTime : elapsed;
      const lastRingIndex = Math.floor(spawnCutoff / RING_DELAY);

      gfx.clear();
      let ringAlive = false;
      for (let i = 0; i <= lastRingIndex; i++) {
        const ringElapsed = elapsed - i * RING_DELAY;
        if (ringElapsed < 0 || ringElapsed > RING_DURATION) continue;
        ringAlive = true;
        const t = easeOutCubic(ringElapsed / RING_DURATION);
        const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
        const alpha = (1 - t) * 0.9;
        const width = 3 - t * 1.5; // ring thins as it expands
        gfx.circle(x, y, radius).stroke({ width, color: colorNum, alpha });
      }

      // Center dot: quick pop-in in the first 200ms, stays firm while
      // sustaining, only starts to fade after release(). 
      const popT = Math.min(elapsed / 200, 1);
      const dotScale = 1 + (1 - easeOutCubic(popT)) * 1.8;
      const sinceRelease = releasedAt !== null ? now - releasedAt : 0;
      const dotFade = releasedAt !== null ? Math.max(0, 1 - sinceRelease / POST_RELEASE_GRACE) : 1;
      if (dotFade > 0) {
        gfx.circle(x, y, 9 * dotScale).fill({ color: colorNum, alpha: 0.18 * dotFade });
        gfx.circle(x, y, 4).fill({ color: colorNum, alpha: dotFade });
      }

      const doneFadingDot = releasedAt !== null && dotFade <= 0;
      if (!ringAlive && doneFadingDot) {
        this.layers.interface.removeChild(gfx);
        this.app.ticker.remove(tick);
      }
    };
    this.app.ticker.add(tick);
    return release;
  }

  /** Creates/updates a remote player cursor — called for each broadcast
    * `user.cursor` received (already throttled on the sender side). */
  private updateRemoteCursor(data: { userId: string; userName: string; userColor?: string; x: number; y: number }): void {
    let entry = this.remoteCursors.get(data.userId);
    if (!entry) {
      const colorNum = parseInt((data.userColor || '#888888').replace('#', '0x'), 16);
      const container = new Container();
      const dot = new Graphics();
      dot.circle(0, 0, 6).fill({ color: colorNum });
      dot.circle(0, 0, 6).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
      const label = new Text({
        text: data.userName || '',
        style: { fontSize: 12, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } },
      });
      label.x = 10;
      label.y = -8;
      container.addChild(dot, label);
      container.eventMode = 'none';
      this.layers.interface.addChild(container);
      entry = { container, dot, label, lastSeen: 0 };
      this.remoteCursors.set(data.userId, entry);
    }
    entry.container.x = data.x;
    entry.container.y = data.y;
    entry.lastSeen = performance.now();
  }

  /** Remove cursor of who stopped sending updates (left the stage, disconnected
  * without warning, switched tabs) — without this the dot would stay stuck at the
  * last position forever.   */
  private pruneStaleCursors(): void {
    if (this.remoteCursors.size === 0) return;
    const now = performance.now();
    const STALE_MS = 3000;
    for (const [userId, entry] of this.remoteCursors) {
      if (now - entry.lastSeen > STALE_MS) {
        this.layers.interface.removeChild(entry.container);
        this.remoteCursors.delete(userId);
      }
    }
  }

  /** Called when switching stages — cursor of who was in the previous stage no
  * longer makes sense to appear in the new one.  */
  private clearRemoteCursors(): void {
    for (const entry of this.remoteCursors.values()) {
      this.layers.interface.removeChild(entry.container);
    }
    this.remoteCursors.clear();
  }
}

const VIDEO_URL_RE = /\.(webm|mp4|m4v|ogv|mov)(\?|#|$)/i;

/** Loads texture via Assets.load, but with explicit config when it is video
 * (.webm/.mp4/etc — background, token or tile "animated"). Without it the Pixi
 * loads the video WITHOUT `loop`/`muted` (default is false for both), so it
 * plays once without audio blocked by the browser and stops — looks like a
 * still image, not "did not work". Cached by Assets.load itself by url,
 * so switching scenes/tokens back does not reload the file again. */
async function loadSmartTexture(url: string): Promise<Texture> {
  if (VIDEO_URL_RE.test(url)) {
    return Assets.load<Texture>({ src: url, data: { loop: true, muted: true, autoPlay: true } });
  }
  return Assets.load<Texture>(url);
}

function hslToHex(h: number, s: number, l: number): number {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return parseInt(`0x${f(0)}${f(8)}${f(4)}`, 16);
}


