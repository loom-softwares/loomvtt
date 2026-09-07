// ──────────────────────────────────────────
// @loomvtt/sdk — LoomVTT Public API
// v0.1.0
// Uso: import { LoomHooks, SystemRegistry } from '/_loom/sdk/index.js'
// ──────────────────────────────────────────

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function L() {
  const l = (window as any).Loom;
  if (!l) throw new Error('[loomvtt/sdk] window.Loom not available');
  return l as LoomGlobal;
}

// ══════════════════════════════════════════
// WINDOW CLASSES — type definitions + bridge to client/windows/
// ══════════════════════════════════════════
// The abstract class declarations here exist ONLY for type-safety (typeof).
// At runtime the SDK re-exports the real classes from window.Loom via bridge.
// Keep these type defs in sync with client/windows/ whenever you add/change
// a method sign that an external subclass needs.

export interface BaseWindowOptions {
  id: string;
  title: string;
  icon?: string;
  width?: number;
  height?: number | 'auto';
  documentId?: string;
  submitOnChange?: boolean;
}

interface ContextMenuItem {
  icon?: string;
  label: string;
  action: string | (() => void);
  disabled?: boolean;
}

abstract class _BaseWindow {
  static DEFAULT_OPTIONS: Partial<BaseWindowOptions> = {};
  protected element!: HTMLElement;
  protected options!: BaseWindowOptions;
  abstract bodyTemplate(): string;
  abstract mount(): void;
  abstract destroy(): Promise<void>;
  abstract setZ(z: number): void;
  abstract bringToFront(): void;
  abstract setPosition(pos: { left?: number; top?: number; width?: number; height?: number }): void;
  abstract minimize(): void;
  abstract maximize(): void;
  abstract get isEditable(): boolean;
  protected abstract _preFirstRender(): void;
  protected abstract _preRender(): void;
  protected abstract _postRender(): void;
  protected onAction?: ((action: string, id: string | null, target: HTMLElement) => void);
  protected prepareContext?: (() => Record<string, any>);
  protected context: Record<string, any> = {};
  protected onRender?: (() => void);
  protected onClose?: (() => void | Promise<void>);
  protected abstract rerenderBody(): void;
  protected abstract attachWindow(): void;
  protected abstract detachWindow(): void;
  protected abstract renderChild<P>(ChildClass: new (props: P) => { mount(): void | Promise<void>; setZ(z: number): void; destroy(): void | Promise<void> }, id: string, props: P): void;
  protected popoutEnabled = false;
  protected abstract registerSubmit(handler: () => void): void;
  abstract dispatchEvent(name: string, data?: any): void;
}

abstract class _LoomDocumentSheet<DocType extends Record<string, any> = any> extends _BaseWindow {
  protected document: DocType | null = null;
  protected abstract get documentName(): string;
  protected abstract get apiRoute(): string;
  protected abstract get dataKey(): string;
  abstract submit(options?: { close?: boolean }): Promise<void>;
  protected abstract _processFormData(formData: Record<string, any>): Record<string, any>;
  protected abstract registerDragDrop(config: { onDrop: (data: { type: string; payload: any; clientY: number }) => void; acceptTypes: string[] }): void;
  protected abstract clearDragDrop(): void;
}

type LoomHandlebarsMixinFn = <TBase extends new (...args: any[]) => any>(Base: TBase) => TBase;

abstract class _LoomDialog extends _BaseWindow {
  static wait: (config?: DialogOptions) => Promise<any>;
  static prompt: (config?: DialogOptions) => Promise<any>;
  static confirm: (config?: DialogOptions) => Promise<any>;
  static input: (config?: DialogOptions) => Promise<any>;
  static query: (user: any, type: string, config?: DialogOptions) => Promise<any>;
}

// `window.Loom.LoomActorSheet`/`LoomItemSheet` sempre existiram (main.ts expõe
// os dois), mas nunca foram re-exportados aqui — quem importava via
// `import { LoomActorSheet } from '/_loom/sdk/index.js'` (o jeito documentado
// de usar o SDK, ao contrário de `window.Loom.LoomActorSheet` direto) achava
// `undefined` sem erro nenhum, e a classe base mais completa (a mesma que o
// sw-saga-edition usa via window.Loom direto) ficava inacessível pelo
// caminho "oficial".
abstract class _LoomActorSheet<DocType extends Record<string, any> = any> extends _LoomDocumentSheet<DocType> {
  get actor(): DocType | null { return null; }
  get token(): any | null { return null; }
}

abstract class _LoomItemSheet<DocType extends Record<string, any> = any> extends _LoomDocumentSheet<DocType> {
  get item(): DocType | null { return null; }
  get actor(): any | null { return null; }
}

export const BaseWindow: typeof _BaseWindow = L().BaseWindow;
export const LoomDocumentSheet: typeof _LoomDocumentSheet = L().LoomDocumentSheet;
export const LoomHandlebarsMixin: LoomHandlebarsMixinFn = L().LoomHandlebarsMixin;
export const LoomActorSheet: typeof _LoomActorSheet = L().LoomActorSheet;
export const LoomItemSheet: typeof _LoomItemSheet = L().LoomItemSheet;
export const LoomDialog: typeof _LoomDialog = L().LoomDialog;

/** Three.js sob demanda — só baixa o chunk se um addon realmente acessar `Loom.three`. */
export function loadThree(): Promise<typeof import('three')> {
  return L().three;
}

/** cannon-es sob demanda — mesma lógica de lazy-load. */
export function loadCannon(): Promise<typeof import('cannon-es')> {
  return L().cannon;
}

// ══════════════════════════════════════════
// TYPES — System Registry
// ══════════════════════════════════════════

export interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean' | 'dots' | 'actions'
  | 'select' | 'color' | 'image' | 'square-counter';
  /** Used by 'dots' (pip count) and 'square-counter' (total squares). */
  max?: number;
  /** Only for type 'select' — list of options. */
  options?: { value: string; label: string }[];
  /**
   * 'dots' e 'number' só (atributo/perícia): se true, o label vira clicável e
   * dispara um roll com `formula` (resolvida contra o systemData do
   * documento via resolveFormula, mesmo motor de "actions" de item).
   */
  rollable?: boolean;
  /** Fórmula de dados pro roll (ex: "1d10 + @attributes.forca"). Só usado quando rollable é true. */
  formula?: string;
}

export interface SheetTab {
  id: string;
  label: string;
  icon?: string;
  fields: SheetField[];
}

export interface SheetSchema {
  tabs: SheetTab[];
}

export interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  getItemDefaultData?(itemType: string): Record<string, any>;
  styles?: string;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}

// ══════════════════════════════════════════
// TYPES — Dice
// ══════════════════════════════════════════

export interface DiceEvaluation {
  rolls: number[];
  subtotal: number;
  label: string;
  dropped: boolean[];
}

export interface DieConfig {
  count: number;
  faces: number;
  modifier?: string;
}

export interface FateConfig {
  count: number;
}

export interface ModifierConfig {
  value: number;
}

// ══════════════════════════════════════════
// TYPES — Canvas / World Data
// ══════════════════════════════════════════

export interface CastMemberData {
  id: string;
  worldId: string;
  stageId: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  avatarUrl?: string;
  colorHex?: string;
  shape?: string;
  traits?: any;
  effects?: any;
  statusMarkers?: string[];
  actorId?: string;
  isLinked?: boolean;
  ownership?: Record<string, number>;
  elevation?: number;
  locked?: boolean;
  hidden?: boolean;
  targetedBy?: string[];
  sightEnabled?: boolean;
  systemData?: any;
}

export interface StageData {
  id: string;
  worldId: string;
  name: string;
  bgUrl?: string;
  backgroundColor?: string;
  gridSize?: number;
  gridColor?: string;
  gridType?: string;
  width?: number;
  height?: number;
  darknessLevel?: number;
  weatherEffect?: string;
  ambientPlaylistId?: string;
  ownership?: Record<string, number>;
  flags?: any;
}

export interface TileData {
  id: string;
  stageId: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imgUrl?: string;
  isOverhead?: boolean;
  rotation?: number;
  occlusion?: any;
  triggers?: any;
  conditions?: any;
  actions?: any;
}

export interface AmbientLightData {
  id: string;
  stageId: string;
  x: number;
  y: number;
  radius?: number;
  color?: string;
  intensity?: number;
  rotation?: number;
  bright?: number;
  dim?: number;
  angle?: number;
  walls?: boolean;
  vision?: boolean;
  animation?: any;
}

export interface DrawingData {
  id: string;
  stageId: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fillColor?: string;
  strokeColor?: string;
  points?: { x: number; y: number }[];
  isHidden?: boolean;
  isLocked?: boolean;
}

export interface WallData {
  id: string;
  stageId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sight?: number;
  light?: number;
  movement?: number;
  sound?: number;
  direction?: number;
  door?: number;
}

export interface NoteData {
  id: string;
  stageId: string;
  journalId: string;
  x: number;
  y: number;
  visibleToPlayers?: boolean;
}

export interface NoiseData {
  id: string;
  stageId: string;
  src: string;
  x: number;
  y: number;
  radius?: number;
  volume?: number;
  easing?: number;
  isHidden?: boolean;
}

// ══════════════════════════════════════════
// TYPES — Init
// ══════════════════════════════════════════

export interface InitData {
  system: { id: string; title: string; version: string; changelogUrl?: string; wikiUrl?: string; bugsUrl?: string };
  modules: { name: string; version: string | null }[];
  rulesets: { name: string; version: string | null }[];
  cast: CastMemberData[];
  stages: StageData[];
  actors: any[];
  tiles: TileData[];
  items: any[];
  journals: any[];
  folders: any[];
  playlists: any[];
  lights: AmbientLightData[];
  drawings: DrawingData[];
  combat: any;
  chatHistory: any[];
  onlineUsers: { clientId: string; worldId: string; userId: string; userName: string; userColor: string; userRole: number }[];
  permissions: { compendiumEdit: string[]; viewStages: string[] };
}

// ══════════════════════════════════════════
// TYPES — Dialog
// ══════════════════════════════════════════

export interface DialogButton {
  action: string;
  label: string;
  default?: boolean;
  callback?: (event: Event, button: HTMLButtonElement, dialog: any) => any;
}

export interface DialogOptions {
  window?: { title?: string };
  content?: string | HTMLElement;
  buttons?: DialogButton[];
  submit?: (result: any) => void;
  rejectClose?: boolean;
}

// ══════════════════════════════════════════
// TYPES — Wrappable
// ══════════════════════════════════════════

type AnyFn = (...args: any[]) => any;

export interface Wrappable<Fn extends AnyFn> {
  (...args: Parameters<Fn>): ReturnType<Fn>;
  wrap(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
}

// ══════════════════════════════════════════
// TYPES — Window
// ══════════════════════════════════════════

export interface WindowLike {
  setZ(z: number): void;
  mount(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

// ══════════════════════════════════════════
// TYPES — Internal (LoomGlobal shape)
// ══════════════════════════════════════════

interface LoomGlobal {
  LoomHooks: HooksAPI;
  windowManager: WindowManagerAPI;
  api: API;
  showToast: ShowToastFn;
  showConfirm: ShowConfirmFn;
  showPrompt: ShowPromptFn;
  showAlert: ShowAlertFn;
  showSelectDialog: ShowSelectDialogFn;
  sheets: SheetCatalogAPI;
  systems: SystemRegistryAPI;
  dispatchRoll: DispatchRollFn;
  dice: DiceRegistryAPI;
  statusEffects: StatusEffectRegistryAPI;
  keybinds: KeybindRegistryAPI;
  settings: SettingsAPI;
  wrap: <Fn extends AnyFn>(baseFn: Fn) => Wrappable<Fn>;
  wraps: {
    resolveFOVOrigins: Wrappable<AnyFn> | undefined;
    renderRollCard: Wrappable<AnyFn>;
    renderMessage: Wrappable<AnyFn>;
    renderMacroIcon: Wrappable<AnyFn>;
  };
  BaseWindow: typeof _BaseWindow;
  LoomDocumentSheet: typeof _LoomDocumentSheet;
  LoomHandlebarsMixin: LoomHandlebarsMixinFn;
  LoomActorSheet: any;
  LoomItemSheet: any;
  LoomDialog: typeof _LoomDialog;
  readonly three: Promise<typeof import('three')>;
  readonly cannon: Promise<typeof import('cannon-es')>;
}

interface HooksAPI {
  on(name: string, cb: (...args: any[]) => void): void;
  once(name: string, cb: (...args: any[]) => void): void;
  off(name: string, cb: (...args: any[]) => void): void;
  callAll(name: string, ...args: any[]): void;
}

interface WindowManagerAPI {
  open<P>(id: string, WindowClass: new (props: P) => WindowLike, props?: P): Promise<void>;
  focus(id: string): void;
  close(id: string): void;
  closeAll(): void;
}

interface API {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

interface ShowToastFn {
  (message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
}

interface ShowConfirmFn {
  (title: string, message: string): Promise<boolean>;
}

interface ShowPromptFn {
  (message: string, defaultValue?: string): Promise<string | null>;
}

interface ShowAlertFn {
  (message: string): Promise<void>;
}

interface ShowSelectDialogFn {
  (title: string, message: string, options: { value: string; label: string }[]): Promise<string | null>;
}

interface SheetCatalogAPI {
  catalog(docType: string, typeName: string, SheetClass: any): void;
  get(docType: string, typeName?: string): any;
}

interface SystemRegistryAPI {
  register(system: LoomSystem): void;
  get(id: string): LoomSystem | undefined;
  getAll(): LoomSystem[];
  getActive(): LoomSystem | undefined;
  setActive(id: string): void;
}

/**
 * Dispara um roll (dados a chat) a partir de qualquer sistema/ficha —
 * worldId/userId/userName/userColor são preenchidos sozinhos pela sessão
 * ativa, o sistema só passa a fórmula. Antes disso não existia NENHUM jeito
 * documentado nem exposto de rolar a partir de fora do core — sistemas
 * convertidos que tentavam `Loom.dispatchRoll(...)`  
 * achavam `undefined` e o roll simplesmente não fazia nada.
 */
interface DispatchRollFn {
  (opts: { formula: string; actorId?: string; mode?: string; meta?: Record<string, any> }): void;
}

interface DiceRegistryAPI {
  register(kind: string, exprClass: any): void;
  create(kind: string, config?: any): any;
  has(kind: string): boolean;
}

export interface StatusEffectDef {
  id: string;
  label: string;
  color: number;
  icon?: string;
}

interface StatusEffectRegistryAPI {
  register(def: StatusEffectDef): void;
  get(id: string): StatusEffectDef | undefined;
  getAll(): StatusEffectDef[];
}

interface KeybindActionSDK {
  id: string;
  label: string;
  description: string;
  defaultKey: string;
  category?: string;
  onPress?: () => void;
}

interface KeybindRegistryAPI {
  register(action: KeybindActionSDK): void;
  unregister(id: string): void;
  getKey(actionId: string): string;
  setBinding(actionId: string, key: string): void;
  resetBinding(actionId: string): void;
  resetAll(): void;
}

export interface SettingConfigSDK {
  name?: string;
  hint?: string;
  scope?: 'world' | 'client';
  config?: boolean;
  type?: any;
  default: any;
  choices?: Record<string, string>;
  onChange?: (value: any) => void;
}

export interface SettingMenuConfigSDK {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  restricted?: boolean;
  type?: new (...args: any[]) => any;
}

export interface SettingsAPI {
  register(module: string, key: string, config: SettingConfigSDK): void;
  registerMenu(module: string, key: string, config: SettingMenuConfigSDK): void;
  get<T = any>(module: string, key: string): T;
  set(module: string, key: string, value: any): Promise<void>;
  readonly settings: Map<string, any>;
}

// ══════════════════════════════════════════
// RUNTIME — System Registry
// ══════════════════════════════════════════
// Roda 100% no navegador, via window.Loom.systems (igual Hooks/sheets) — não
// precisa de um entry point "core" separado no servidor.

export const SystemRegistry: SystemRegistryAPI = {
  register(system) { L().systems.register(system); },
  get(id) { return L().systems.get(id); },
  getAll() { return L().systems.getAll(); },
  getActive() { return L().systems.getActive(); },
  setActive(id) { L().systems.setActive(id); },
};

export function defineSystem(config: LoomSystem): LoomSystem {
  return config;
}

// ══════════════════════════════════════════
// RUNTIME — Keybind Registry
// ══════════════════════════════════════════

export const keybinds: KeybindRegistryAPI = {
  register(action) { L().keybinds.register(action); },
  unregister(id) { L().keybinds.unregister(id); },
  getKey(actionId) { return L().keybinds.getKey(actionId); },
  setBinding(actionId, key) { L().keybinds.setBinding(actionId, key); },
  resetBinding(actionId) { L().keybinds.resetBinding(actionId); },
  resetAll() { L().keybinds.resetAll(); },
};

// ══════════════════════════════════════════
// RUNTIME — Settings Registry
// ══════════════════════════════════════════

export const settings: SettingsAPI = {
  register(module, key, config) { L().settings.register(module, key, config); },
  registerMenu(module, key, config) { L().settings.registerMenu(module, key, config); },
  get(module, key) { return L().settings.get(module, key); },
  set(module, key, value) { return L().settings.set(module, key, value); },
  get settings() { return L().settings.settings; },
};

// ══════════════════════════════════════════
// RUNTIME — Dice Registry
// ══════════════════════════════════════════
// Roda 100% no navegador, via window.Loom.dice (igual Hooks/sheets/systems).

export const diceRegistry: DiceRegistryAPI = {
  register(kind, exprClass) { L().dice.register(kind, exprClass); },
  create(kind, config) { return L().dice.create(kind, config); },
  has(kind) { return L().dice.has(kind); },
};

// ══════════════════════════════════════════
// RUNTIME — Status Effect Registry
// ══════════════════════════════════════════
// (id da condição), sem patch universal. Sistema registra as condições que
// o jogo tem; core usa `.get(id)` no token pra desenhar o ícone certo.

export const statusEffects: StatusEffectRegistryAPI = {
  register(def) { L().statusEffects.register(def); },
  get(id) { return L().statusEffects.get(id); },
  getAll() { return L().statusEffects.getAll(); },
};

// ══════════════════════════════════════════
// RUNTIME — Hooks
// ══════════════════════════════════════════

export const LoomHooks: HooksAPI = {
  on(name, cb) { L().LoomHooks.on(name, cb); },
  once(name, cb) {
    const wrapper = (...args: any[]) => {
      const result = cb(...args);
      L().LoomHooks.off(name, wrapper);
      return result;
    };
    L().LoomHooks.on(name, wrapper);
  },
  off(name, cb) { L().LoomHooks.off(name, cb); },
  callAll(name, ...args) { L().LoomHooks.callAll(name, ...args); },
};

// ══════════════════════════════════════════
// RUNTIME — REST API
// ══════════════════════════════════════════

export const api: API = {
  get(path) { return L().api.get(path); },
  post(path, body) { return L().api.post(path, body); },
  put(path, body) { return L().api.put(path, body); },
  delete(path) { return L().api.delete(path); },
};

// ══════════════════════════════════════════
// RUNTIME — Active Effects (buffs)
// ══════════════════════════════════════════
// O motor de efeitos ja existe no servidor (server/applications/lib/effects.ts)
// e roda sozinho: toda rota de ator passa por prepareActor(), que devolve o
// systemData JA com os `changes` aplicados. Este wrapper e' so' acucar por
// cima das rotas REST /buffs — nao ha' nada em window.Loom pra fazer bridge,
// por isso usa `api` direto, diferente de statusEffects/LoomHooks.

export interface EffectChange {
  /** Caminho dentro do systemData, ex: 'attributes.strength' */
  key: string;
  mode: 'add' | 'multiply' | 'override' | 'upgrade' | 'downgrade';
  value: number | string | boolean;
  /** Ordem de aplicacao, crescente. Default 0. */
  priority?: number;
}

export interface EffectData {
  id: string;
  worldId?: string;
  actorId?: string;
  itemId?: string;
  name: string;
  icon?: string;
  origin?: string;
  /** -1 = permanente (default do servidor) */
  duration?: number;
  disabled?: boolean;
  changes?: EffectChange[];
}

export interface EffectsAPI {
  forActor(actorId: string): Promise<EffectData[]>;
  forItem(itemId: string): Promise<EffectData[]>;
  create(data: Partial<EffectData> & { name: string }): Promise<EffectData>;
  update(id: string, changes: Partial<EffectData>): Promise<EffectData>;
  delete(id: string): Promise<void>;
}

export const effects: EffectsAPI = {
  forActor(actorId) { return api.get<EffectData[]>(`/buffs/actor/${actorId}`); },
  forItem(itemId) { return api.get<EffectData[]>(`/buffs/item/${itemId}`); },
  create(data) { return api.post<EffectData>('/buffs', data); },
  update(id, changes) { return api.put<EffectData>(`/buffs/${id}`, changes); },
  async delete(id) { await api.delete(`/buffs/${id}`); },
};

export const API_PATHS = {
  SETUP_STATUS: '/setup/status' as const,
  SETUP_INIT: '/setup/init' as const,
  SETUP_LOGIN: '/setup/login' as const,
  SETUP_LOGOUT: '/setup/logout' as const,
  SETUP_VERIFY: '/setup/verify' as const,
  SETUP_CONFIG: '/setup/config' as const,
  SETUP_LOCAL_ADDRESS: '/setup/local-address' as const,
  WORLDS: '/worlds' as const,
  WORLDS_INVITE_LINKS: '/worlds/:id/invite-links' as const,
  WORLDS_REGENERATE_PASSWORD: '/worlds/:id/invite-links/regenerate-password' as const,
  SYSTEMS: '/systems' as const,
  MARKETPLACE: '/marketplace' as const,
};

// ══════════════════════════════════════════
// RUNTIME — Window Manager
// ══════════════════════════════════════════

export const windowManager: WindowManagerAPI = {
  open(id, WindowClass, props) { return L().windowManager.open(id, WindowClass, props); },
  focus(id) { L().windowManager.focus(id); },
  close(id) { L().windowManager.close(id); },
  closeAll() { L().windowManager.closeAll(); },
};

// ══════════════════════════════════════════
// RUNTIME — Sheet Catalog
// ══════════════════════════════════════════

export const sheets: SheetCatalogAPI = {
  catalog(docType, typeName, SheetClass) { L().sheets.catalog(docType, typeName, SheetClass); },
  get(docType, typeName) {
    const dt = String(docType).toLowerCase();
    const fallback = dt === 'actor' ? L().LoomActorSheet
      : dt === 'item' ? L().LoomItemSheet
        : undefined;

    // Debug logging to help identify why it might still be undefined
    if (!L().sheets.get(docType, typeName)) {
      console.log(`[Loom SDK] sheets.get fallback trigger for ${docType}, returning:`, fallback);
    }

    return L().sheets.get(docType, typeName) ?? fallback;
  },
};

// ══════════════════════════════════════════
// RUNTIME — DataModel Fields (Compatibilidade V10+)
// ══════════════════════════════════════════
import {
  Field as CoreField,
  StringField as CoreStringField,
  NumberField as CoreNumberField,
  BooleanField as CoreBooleanField,
  SchemaField as CoreSchemaField,
  ChildrenField as CoreChildrenField,
  validateAgainstSchema,
  HTMLField as CoreHTMLField,
  SetField as CoreSetField
} from './vendor/shared-fields.js';

class SDKFieldWrapper<T extends CoreField<any>> {
  // We can't use a generic base class if we want concrete classes to extend Core classes.
}

// Em vez de DataField base, os fields do SDK estendem diretamente os Core Fields.
export const fields = {
  SchemaField: class SchemaField extends CoreSchemaField<any> {
    constructor(schema: any, options: any = {}) {
      options.default = options.default ?? options.initial;
      super(schema, options);
    }
    clean(value: any) { return value || {}; }
    validate(value: any) { return validateAgainstSchema(this as any, value) ? false : true; }
  },
  NumberField: class NumberField extends CoreNumberField {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super(options);
    }
    clean(value: any) { return typeof value === 'number' ? value : (this.default ?? 0); }
  },
  StringField: class StringField extends CoreStringField {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super(options);
    }
    clean(value: any) { return typeof value === 'string' ? value : (this.default ?? ''); }
  },
  BooleanField: class BooleanField extends CoreBooleanField {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super(options);
    }
    clean(value: any) { return !!value; }
  },
  ArrayField: class ArrayField extends CoreSetField<any> {
    constructor(element: any, options: any = {}) {
      options.default = options.default ?? options.initial ?? (() => []);
      super(element, options);
    }
    clean(value: any) { return Array.isArray(value) ? value : (typeof this.default === 'function' ? this.default() : []); }
    validate(value: any) { return Array.isArray(value); }
  },
  HTMLField: class HTMLField extends CoreHTMLField {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super(options);
    }
    clean(value: any) { return typeof value === 'string' ? value : (this.default ?? ''); }
  },
  ObjectField: class ObjectField extends CoreField<any> {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super('object', options);
    }
    clean(value: any) { return value || {}; }
  },
  ColorField: class ColorField extends CoreStringField {
    constructor(options: any = {}) {
      options.default = options.default ?? options.initial;
      super(options);
    }
    clean(value: any) { return typeof value === 'string' ? value : (this.default ?? ''); }
  },
};

// ══════════════════════════════════════════
// RUNTIME — Wrappable
// ══════════════════════════════════════════

export function wrap<Fn extends AnyFn>(baseFn: Fn): Wrappable<Fn> {
  return L().wrap(baseFn);
}

export function getWraps(): LoomGlobal['wraps'] {
  return L().wraps;
}

// ══════════════════════════════════════════
// RUNTIME — UI
// ══════════════════════════════════════════

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export function showToast(message: string, type?: ToastType): void {
  L().showToast(message, type);
}

export function showConfirm(title: string, message: string): Promise<boolean> {
  return L().showConfirm(title, message);
}

export function showSelectDialog(title: string, message: string, options: { value: string; label: string }[]): Promise<string | null> {
  return L().showSelectDialog(title, message, options);
}

export function showPrompt(message: string, defaultValue?: string): Promise<string | null> {
  return L().showPrompt(message, defaultValue);
}

export function showAlert(message: string): Promise<void> {
  return L().showAlert(message);
}

export const dispatchRoll: DispatchRollFn = (opts) => {
  L().dispatchRoll(opts);
};

// ══════════════════════════════════════════
// RUNTIME — Version info
// ══════════════════════════════════════════

export const VERSION = '0.1.0';
