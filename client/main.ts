import { version as loomVersion } from '../package.json';
import { applyTheme } from './core/theme-manager.js';
import { isVideoUrl, mediaHtml } from './core/media-helper.js';
applyTheme();
import { ClientDocument } from './core/client-document.js';
import { applyTypeDataModelDefaults } from './core/data-model.js';
import { router } from './core/screen-router.js';
import { copyTextToClipboard } from './lib/clipboard.js';
import { api, API_PATHS, ApiError } from './core/api.js';
import { showToast } from './components/toast.js';
import { clog } from './lib/client-logger.js';
import { LoomHooks } from './core/hooks.js';
import { windowManager } from './core/window-manager.js';
import { showConfirm, showPrompt, showAlert, showSelectDialog } from './components/dialog.js';
import { sheetCatalog } from './core/sheet-catalog.js';
import { systemRegistry } from './core/system-registry.js';
import { diceRegistry } from './core/dice-registry.js';
import { statusEffectRegistry } from './core/status-effect-registry.js';
import { keybindManager } from './core/keybinds.js';
import { createWrappable } from './core/wrappable.js';
import { CanvasManager } from './canvas/canvas-manager.js';
import { renderRollCardWrap } from './screens/game-hud/roll-card.js';
import { renderMessageWrap, chatCardContextOptionsWrap } from './screens/game-hud/chat-message-card.js';
import { renderMacroIconWrap } from './screens/game-hud/macro-icon.js';
import { renderTemplate, loadTemplates } from './core/render-template.js';
import { dispatchRoll as dispatchRollInternal } from './screens/game-hud/roll-dispatch.js';
import './core/handlebars-helpers.js';
import { resolveFormula, resolveActionFormulas, sumPaths } from './core/resolve-formula.js';
import { getActiveModifiers, collectItemModifiers } from './core/item-modifiers.js';
import { BaseWindow } from './windows/base-window.js';
import { LoomDocumentSheet } from './windows/document-sheet.js';
import { LoomHandlebarsMixin } from './windows/application.js';
import { mountRichTextEditor } from './lib/rich-text-registry.js';
// Registers the `<prose-mirror>` custom element used by every description field in
// the sheets. Side-effect import: without it the tag stays an unknown element and
// the field renders as inert text, with no editor and no Edit button.
import './lib/prose-mirror-element.js';
import { LoomActorSheet } from './windows/actor-sheet.js';
import { LoomItemSheet } from './windows/item-sheet.js';
import { LoomCategoryBrowser } from './windows/loom-category-browser.js';
import './core/sheet-registration.js';
import './core/primitives.js';
import { LoomDialog } from './windows/loom-dialog.js';
import { LoomDragDrop } from './lib/loom-drag-drop.js';
import { LoomSidebarTab } from './core/sidebar-tab.js';
import { CONST_VALUES } from './core/const.js';
import { LOOM_CONFIG } from './core/config.js';
import { gameContext } from './core/game-context.js';
import { loadFontsFromCatalog } from './core/font-loader.js';
import { FontSettingsWindow } from './windows/font-settings-window.js';
import { CoreLanguageWindow } from './windows/core-language-window.js';
import { settingsRegistry } from './core/settings-registry.js';
import { mainMenuRegistry } from './core/main-menu-registry.js';
import { transitionEffectRegistry } from './canvas/transition-effect-registry.js';
import { rulesetI18n } from './core/ruleset-i18n.js';
import { t } from './lib/i18n.js';
import { actorsCollection } from './core/actors-collection.js';
import { scenesCollection } from './core/scenes-collection.js';
import { itemsCollection } from './core/items-collection.js';
import { modulesCollection } from './core/modules-collection.js';
import { usersCollection } from './core/users-collection.js';
import { messagesCollection } from './core/messages-collection.js';
import { macrosCollection } from './core/macros-collection.js';
import { packsCollection } from './core/packs-collection.js';
import { combatsCollection } from './core/combats-collection.js';
import { journalCollection } from './core/journal-collection.js';
import { foldersCollection } from './core/folders-collection.js';
import { rollTablesCollection } from './core/roll-tables-collection.js';
import { playlistsCollection } from './core/playlists-collection.js';
import { wsClient } from './core/ws-client.js';
import './lib/rich-text-doc-link.js';
import { FilePicker } from './core/file-picker.js';
import { effectsApi } from './core/effects-api.js';
import { bindContentEnricherHandlers } from './core/text-enricher.js';

import { debounce, throttle, mergeObject, duplicate, getProperty, setProperty, hasProperty, deepClone, isEmpty, randomID, flattenObject, expandObject, parseHTML, escapeHTML, performIntegerSort, debouncedReload } from './core/utils.js';
import { LoomFormData } from './core/form-data.js';

import {
  TypeDataModel,
  ArrayField,
  BooleanField,
  ColorField,
  HTMLField,
  NumberField,
  ObjectField,
  SchemaField,
  StringField,
  TypedObjectField,
} from './core/data-model.js';

// `Roll` = LoomRoll (classe completa com terms/dice/_evaluate/fromData). A
// classe simples homônima do bridge fica no módulo para scripts de teste.
import { Die, LoomRoll as Roll } from './core/dice-term-bridge.js';

// Sidebar tabs para sistemas convertidos customizarem (render lifecycle +
// dispatch de `DEFAULT_OPTIONS.actions` + menu de contexto por entrada).
const SIDEBAR_TABS = {
  ActorDirectory: class ActorDirectory extends LoomSidebarTab { },
  ChatLog: class ChatLog extends LoomSidebarTab { },
  CompendiumDirectory: class CompendiumDirectory extends LoomSidebarTab { },
  Settings: class Settings extends LoomSidebarTab { },
};

const GAME_PAUSE_STUB = class GamePause extends LoomSidebarTab { };

// Expõe a API do LoomVTT globalmente para criadores de addons e sistemas
(window as any).Loom = {
  LoomHooks,
  windowManager,
  api,
  showToast,
  showConfirm,
  showPrompt,
  showAlert,
  showSelectDialog,

  sheets: sheetCatalog,
  systems: systemRegistry,
  get system() {
    return systemRegistry.getActive();
  },
  // `release` — versão do próprio motor. Sistema convertido que faça checagem de
  // versão pra decidir caminho de código deve tratar isso como a versão do Loom.
  release: { generation: Number(loomVersion.split('.')[0]) || 0, version: loomVersion, channel: 'dev' },
  settings: {
    register: settingsRegistry.register.bind(settingsRegistry),
    registerMenu: settingsRegistry.registerMenu.bind(settingsRegistry),
    get: settingsRegistry.get.bind(settingsRegistry),
    set: settingsRegistry.set.bind(settingsRegistry),
    /** Map real de definições registradas (module.key -> config) — não é mais um dummyProxy. */
    get settings() {
      return settingsRegistry.settingsMap;
    },
  },
  /** Registro de itens do menu principal (botão da hotbar, "Menu Principal") — qualquer
   * addon/sistema pode adicionar uma entrada sem editar macro-hotbar.ts. */
  mainMenu: {
    register: mainMenuRegistry.register.bind(mainMenuRegistry),
    unregister: mainMenuRegistry.unregister.bind(mainMenuRegistry),
  },
  /** Registro de efeitos de transição de cena (config da cena, CanvasManager.applyStage)
   * — addon/sistema registra um efeito novo (mask-image/clip-path + keyframes) sem editar
   * canvas-manager.ts, screens.css nem stage-config-window.ts. */
  transitions: {
    register: transitionEffectRegistry.register.bind(transitionEffectRegistry),
    unregister: transitionEffectRegistry.unregister.bind(transitionEffectRegistry),
    registerAnimator: transitionEffectRegistry.registerAnimator.bind(transitionEffectRegistry),
  },
  i18n: {
    registerLang: rulesetI18n.registerLang.bind(rulesetI18n),
    localize: rulesetI18n.localize.bind(rulesetI18n),
    format: rulesetI18n.format.bind(rulesetI18n),
  },
  /** Espelha o padrão de sessão de usuário de sistemas de RPG convertidos — reflete a sessão real de quem está no mundo agora
   * (setada pelo GameHudScreen ao entrar), não mais um GM fixo hardcoded. */
  get user() {
    const session = gameContext.session;
    return {
      id: session?.userId ?? null,
      name: session?.userName ?? null,
      color: session?.userColor ?? '#CCCCCC',
      role: session?.userRole ?? 1,
      isGM: gameContext.isGM,
      /** Cast members atualmente mirados pelo usuário (targetedBy inclui o
       * userId da sessão). Some junto com o hook `targetToken` — sistemas
       * usam pra, por exemplo, pré-preencher dificuldade de rolagem com base
       * no NPC mirado. */
      get targets(): any[] {
        const userId = gameContext.session?.userId;
        if (!userId) return [];
        return gameContext.cast.filter((c: any) => Array.isArray(c.targetedBy) && c.targetedBy.includes(userId));
      },
    };
  },
  /** WorldCollection real de Atores, carregada uma vez ao entrar
   * no mundo (GameHudScreen chama `actorsCollection.load(worldId)`). */
  actors: actorsCollection,
  /** Stage = Scene no LoomVTT (ver CLAUDE.md). */
  scenes: scenesCollection,
  /** Coleção global de Itens (WorldCollection). */
  items: itemsCollection,
  /** Coleção de módulos/addons instalados. */
  modules: modulesCollection,
  /** Coleção de Macros (WorldCollection). */
  macros: macrosCollection,
  /** Coleção de Compendium Packs (WorldCollection). */
  packs: packsCollection,
  /** Coleção global de Usuários — `.current` é o LiveUser da sessão ativa. */
  users: usersCollection,
  /** Coleção global de mensagens de chat (WorldCollection). */
  messages: messagesCollection,
  combats: combatsCollection,
  get combat() { return combatsCollection.active; },
  journal: journalCollection,
  folders: foldersCollection,
  tables: rollTablesCollection,
  playlists: playlistsCollection,
  get world() { return (window as any)._loomWorldInfo; },
  clipboard: {
    copyPlainText: copyTextToClipboard,
  },
  time: {
    get worldTime() { return (window as any)._loomWorldTime || 0; },
    async advance(seconds: number) {
      const worldId = (window as any)._loomWorldInfo?.id;
      if (!worldId) return;
      try {
        const result = await api.put<any>(`/worlds/${worldId}/time`, { advance: seconds });
        if (result && typeof result.worldTime === 'number') {
          (window as any)._loomWorldTime = result.worldTime;
        }
      } catch (e) {
        clog.error('Failed to advance world time', e);
      }
    },
    earthCalendar: {
      timeToComponents(seconds: number) {
        let absSeconds = Math.abs(seconds);
        const years = Math.floor(absSeconds / (365 * 24 * 3600));
        absSeconds -= years * (365 * 24 * 3600);
        const days = Math.floor(absSeconds / (24 * 3600));
        absSeconds -= days * (24 * 3600);
        const hours = Math.floor(absSeconds / 3600);
        absSeconds -= hours * 3600;
        const minutes = Math.floor(absSeconds / 60);
        const secs = absSeconds - minutes * 60;
        return { years, days, hours, minutes, seconds: secs };
      },
      format(components: any, mode: 'duration' | string, options?: any) {
        if (mode === 'duration') {
          const parts = [];
          if (components.years) parts.push({ label: 'year', short: 'y', value: components.years });
          if (components.days) parts.push({ label: 'day', short: 'd', value: components.days });
          if (components.hours) parts.push({ label: 'hour', short: 'h', value: components.hours });
          if (components.minutes) parts.push({ label: 'minute', short: 'm', value: components.minutes });
          if (components.seconds || parts.length === 0) parts.push({ label: 'second', short: 's', value: components.seconds || 0 });

          let outParts = parts;
          if (options?.maxTerms && options.maxTerms > 0) {
            outParts = outParts.slice(0, options.maxTerms);
          }

          const isShort = options?.short;
          const sep = options?.separator || ' ';

          return outParts.map(p => {
            if (isShort) return `${p.value}${p.short}`;
            return `${p.value} ${p.label}${p.value !== 1 ? 's' : ''}`;
          }).join(sep);
        }
        return '';
      }
    }
  },
  /** WebSocket real do Loom (já usado internamente
   * pelo GameHudScreen), agora exposto pro sistema mandar/ouvir eventos custom próprios
   * (ex: `Loom.socket.on('system.wod5e', ...)`). Antes disso nem existia — travava o boot. */
  socket: {
    on: wsClient.on.bind(wsClient),
    off: wsClient.off.bind(wsClient),
    emit: wsClient.send.bind(wsClient),
  },

  /** Editor de texto rico (ProseMirror) já usado no journal do core, agora exposto
   * pra sistemas convertidos usarem em campos de descrição/bio/etc — antes só existia
   * dentro do core, nenhum ruleset conseguia montar um editor rico próprio. */
  mountRichTextEditor,

  /** CRUD wrapper for embedded Buff/effect documents (`/api/buffs`) — before this,
   * there was no `Loom.effects.*` surface, only the raw REST route and
   * `Loom.config.Buff.documentClass` (used solely for `prepareDerivedData()`). */
  effects: effectsApi,

  /**
   * Roll a partir de qualquer ficha/sistema — antes disso não existia NADA
   * exposto pro SDK público (packages/sdk) pra disparar um roll, então todo
   * sistema convertido que tentava `Loom.dispatchRoll(...)` (padrão comum
   * de origem) achava undefined e o roll não fazia nada, sem erro
   * nenhum (só um `console.warn` que o próprio sistema escrevia, se
   * escrevesse). Preenche worldId/userId/userName/userColor sozinho a partir
   * da sessão atual — sistema só passa formula/actorId/meta.
   */
  dispatchRoll(opts: { formula: string; actorId?: string; mode?: string; meta?: Record<string, any> }): void {
    const session = wsClient.session;
    if (!session) {
      clog.error('[Loom.dispatchRoll] Sem sessão ativa — roll ignorado.');
      return;
    }
    dispatchRollInternal({
      worldId: session.worldId || '',
      userId: session.userId || '',
      userName: session.userName || 'Anonymous',
      userColor: session.userColor || '#888',
      formula: opts.formula,
      mode: opts.mode,
      actorId: opts.actorId,
      meta: opts.meta,
    });
  },

  /** `fromUuidSync(uuid)` — synchronous resolution of `<Type>.<id>` to the world document.
   * This global doesn't exist natively in Loom; converted systems use it in
   * critical flows (item roll, group members — `item-roll.js`, `group-members.js`).
   * Resolves against native WorldCollections. `Compendium.*` UUIDs require access to
   * compendium (entry-dispatch) and return `undefined` for now — check by system. */
  fromUuidSync(uuid: string): any | undefined {
    if (!uuid || typeof uuid !== 'string') return undefined;
    const match = uuid.match(/^(\w+)\.([^.]+)$/);
    if (!match) return undefined;
    const type = match[1].toLowerCase();
    const id = match[2];
    const map: Record<string, any> = {
      actor: actorsCollection,
      item: itemsCollection,
      scene: scenesCollection,
      journalentry: journalCollection,
      journal: journalCollection,
      macro: macrosCollection,
      folder: foldersCollection,
      rolltable: rollTablesCollection,
      playlist: playlistsCollection,
      combat: combatsCollection,
      user: usersCollection,
    };
    const col = map[type];
    return col?.get?.(id);
  },

  dice: diceRegistry,
  /**
   * Base classes for dice/roll — converted systems do
   * `class WOD5eRoll extends Loom.Roll` (was the origin system's own dice/
   * term class, see DICE_MAP in mapping.py at converter). Must be exposed
   * here as an object property, not just a local import, or `class X extends
   * undefined` breaks the entire system's import.
   */
  Roll,
  Die,
  /** Additive registry of conditions/status effects (key-based registration, no universal patch). */
  statusEffects: statusEffectRegistry,
  keybinds: keybindManager,
  keybindings: keybindManager, // Alias for the converter's game.keybindings regex
  renderTemplate,
  loadTemplates,
  DragDrop: LoomDragDrop,
  // Must be these exact classes, not a redefinition — `TypeDataModel` (data-model.ts)
  // checks `instanceof` against them when resolving field defaults, so a separately
  // constructed `SchemaField` etc. would silently fail that check.
  fields: {
    SchemaField,
    NumberField,
    StringField,
    BooleanField,
    ArrayField,
    HTMLField,
    ObjectField,
    ColorField,
    TypedObjectField,
  },
  /** Generic tools for building a roll pool (sum of paths + contextual item bonuses). */
  rolls: {
    resolveFormula,
    resolveActionFormulas,
    sumPaths,
    getActiveModifiers,
    collectItemModifiers,
  },
  /** Creates an opt-in wrap point (addon intercepts without libWrapper). */
  wrap: createWrappable,
  /** Nominal wrap points exposed by core. */
  wraps: {
    get resolveFOVOrigins() {
      const cm = CanvasManager.activeInstance;
      if (!cm) throw new Error('CanvasManager not active');
      return cm.resolveFOVOrigins;
    },
    renderRollCard: renderRollCardWrap,
    renderMessage: renderMessageWrap,
    chatCardContextOptions: chatCardContextOptionsWrap,
    renderMacroIcon: renderMacroIconWrap,
  },
  BaseWindow,
  LoomDocumentSheet,
  /** Function of mixin (`(Base) => class extends Base {...}`), not a fixed class — apply in
   * the sheet declaration, on the base that corresponds to your document:
   * `LoomHandlebarsMixin(LoomActorSheet)`, `(LoomItemSheet)`, `(LoomDocumentSheet)` or
   * `(BaseWindow)` for a window without a document. Same format used by converted systems' template mixin. */
  LoomHandlebarsMixin,
  LoomActorSheet,
  LoomItemSheet,
  LoomDialog,
  LoomCategoryBrowser,
  LoomFormData,
  LoomSidebarTab,

  // Three.js on demand - only download the chunk when an addon really accesses it.
  get three() {
    return import('three');
  },
  // cannon-es on demand - same lazy-load logic as `three`.
  get cannon() {
    return import('cannon-es');
  },

  canvas: {
    get active() {
      return CanvasManager.activeInstance;
    },
    showFloatingText(
      target: string | number | { x: number; y: number },
      textOrY?: string | number,
      textStr?: string,
      color: string = '#ffffff',
      options?: { fontSize?: number; duration?: number; broadcast?: boolean }
    ) {
      const cm = CanvasManager.activeInstance;
      if (!cm) {
        console.warn('Loom.canvas.showFloatingText: CanvasManager not active');
        return;
      }
      cm.showFloatingText(target, textOrY, textStr, color, options);
    },
  },

  // utilities and stubs under Loom namespace
  utils: {
    debounce,
    throttle,
    isVideoUrl,
    mediaHtml,
    mergeObject,
    duplicate,
    getProperty,
    setProperty,
    hasProperty,
    deepClone,
    isEmpty,
    randomID,
    flattenObject,
    expandObject,
    parseHTML,
    escapeHTML,
    performIntegerSort,
    debouncedReload,
  },
  abstract: {
    TypeDataModel,
  },
  fields_v14: {
    ArrayField,
    BooleanField,
    ColorField,
    HTMLField,
    NumberField,
    ObjectField,
    SchemaField,
    StringField,
    TypedObjectField,
  },
  applications: {
    sidebar: { tabs: SIDEBAR_TABS },
    ui: { GamePause: GAME_PAUSE_STUB, Hotbar: GAME_PAUSE_STUB },
  },
  config: LOOM_CONFIG,
};

// Single delegated listener for `a.doc-link`/`span.inline-roll` clicks anywhere in
// the document — journal-window.ts had this wired privately for journal pages only;
// content enriched via `Loom.applications.ux.TextEditor.implementation.enrichHTML()`
// on an item/actor sheet had no click behavior at all until now.
bindContentEnricherHandlers();

// Hooks alias
(window as any).Hooks = LoomHooks;

// CONFIG alias
(window as any).CONFIG = (window as any).Loom.config;

// `CONST` is referenced as a loose global by converted systems (not under `game`/`Loom`) — subset in const.ts.
(window as any).CONST = CONST_VALUES;

// Alias `vtt.utils` — generic name, not of any specific product.
(window as any).vtt = {
  utils: (window as any).Loom.utils,
  abstract: (window as any).Loom.abstract,
  data: { fields: (window as any).Loom.fields_v14 },
};

// ui global object
// `window.ui.*` — the LoomVTT sidebar is a unique class (Sidebar) that aggregates
// all panels as internal tabs (chat, actors, items, combat, etc). The
// real instance is exposed in `window.ui.sidebar` (set in GameHudScreen when
// mounting the HUD) — that assignment is native code, not a converted-system-only
// path, so this object stays a plain alias. The fields below remain null by design:
// there are no separate objects per panel in the core.
// TODO: expose individual panels if some addon needs
// `window.ui.chat`/`ui.actors`/etc (exigiria quebrar a Sidebar em sub-classes).
(window as any).ui = {
  notifications: (window as any).Loom.notifications,
  chat: null,
  actors: null,
  items: null,
  scenes: null,
  journals: null,
  decks: null,
  macros: null,
  playlists: null,
  compendium: null,
  combat: null,
  settings: null,
  windows: {},
};

// Sheet class aliases
// `Application`/`FormApplication` (v1) have no equivalent — only ApplicationV2-style
// systems are supported. Sheet without a specific document type uses
// `LoomHandlebarsMixin(DocumentSheet)`.
(window as any).DocumentSheet = LoomDocumentSheet;
(window as any).ActorSheet = LoomActorSheet;
(window as any).ItemSheet = LoomItemSheet;

// Show LoomVTT boot banner and startup status
clog.banner();
clog.success('Client bundle loaded successfully');

/** Consumes a one-time stream setup code (`?setup=CODE`, see server/applications/api/stream.ts)
 * and exchanges it for a normal session cookie — same login the app already
 * uses everywhere else, just triggered without a form. Reloads without the
 * `setup` param on success so it never lingers in OBS's browser history/cache. */
async function consumeStreamSetupCode(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('setup');
  if (!code) return false;

  try {
    await api.post('/stream/exchange', { code });
    params.delete('setup');
    const query = params.toString();
    window.location.replace(`${window.location.pathname}${query ? `?${query}` : ''}`);
    return true;
  } catch (err) {
    clog.error('Stream setup code exchange failed', err);
    showToast('Código de stream inválido ou expirado.', 'error');
    return false;
  }
}

async function bootstrap(): Promise<void> {
  try {
    clog.info('Bootstrap started');

    if (await consumeStreamSetupCode()) return;

    // 1. Check license status
    clog.info('Checking LoomVTT license...');
    try {
      const licenseStatus = await api.get<{
        valid: boolean;
        isDev: boolean;
        isDevEnvironment: boolean;
        plan: string | null;
        validUntil: number | null;
      }>('/license/status');

      if (!licenseStatus.valid) {
        clog.warn('LoomVTT não licenciado — redirecionando para tela de ativação');
        await router.navigate('activation', {
          isDevEnvironment: licenseStatus.isDevEnvironment,
        });
        clog.success('Navegando para tela de ativação');
        return;
      }
    } catch (err) {
      clog.error('Erro ao verificar licença:', err);
    }

    // Load self-hosted fonts
    loadFontsFromCatalog().catch((e) => clog.warn('Font catalog load failed', e));

    // Check setup status
    clog.info('Checking server status...');
    const status = await api.get<{ isSetup: boolean; activeWorldId: string | null }>(
      API_PATHS.SETUP_STATUS,
    );
    clog.info('Server status obtained', status);

    // If the setup is not complete, always go to the admin login
    // even if there is an active world
    if (!status.isSetup) {
      // First time setup
      clog.warn('Server not yet configured — starting first-time setup');
      await router.navigate('admin-login', { mode: 'init' });
      clog.success('Bootstrap complete — navigating to', 'admin-login (init)');
      return;
    }

    // active world is a GLOBAL state of the server, not by session: as long as there is
    // an active world, no one accesses the configuration (not even admin) — only after
    // someone enters the game and deactivates the world through the HUD configuration tab.
    if (status.activeWorldId) {
      try {
        const worldSession = await api.get<{ valid: boolean; session?: any }>(
          `${API_PATHS.WORLDS}/session/verify`,
        );
        if (worldSession.valid && worldSession.session) {
          clog.success('World session active — resuming game');
          await router.navigate('game-hud', {
            session: worldSession.session,
            worldId: worldSession.session.worldId,
          });
          clog.success('Bootstrap complete — navigating to', 'game-hud');
          return;
        }
      } catch {
        // no session - world login screen
      }

      clog.info('Active world, no session - world login screen');
      await router.navigate('world-login', { worldId: status.activeWorldId });
      clog.success('Bootstrap complete — navigating to', 'world-login');
      return;
    }

    // Verify authentication
    clog.info('Verifying authentication...');
    const verify = await api.get<{ valid: boolean; admin: boolean; reason?: string }>(
      API_PATHS.SETUP_VERIFY,
    );
    clog.info('Authentication verified', verify);

    if (!verify.valid || !verify.admin) {
      // Need to login
      if (verify.reason === 'admin_session_replaced') {
        showToast('Sua sessão de Admin foi encerrada — login feito em outro dispositivo/navegador.', 'info');
      }
      clog.info('No active admin session — redirecting to login screen');
      await router.navigate('admin-login', { mode: 'login' });
      clog.success('Bootstrap concluído — navegando para', 'admin-login (login)');
      return;
    }

    // Authenticated, show setup hub
    clog.success('Admin session verified — loading Setup Hub');
    await router.navigate('setup-hub');
    clog.success('Bootstrap complete — navigating to', 'setup-hub');
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      clog.warn('Access denied or license required', e);
      await router.navigate('activation');
    } else if (e instanceof ApiError && e.status === 401) {
      // Not authenticated
      clog.error('Bootstrap failed - not authenticated', e);
      await router.navigate('admin-login', { mode: 'login' });
    } else {
      // Generic error - don't assume first-time setup
      clog.error('Bootstrap failed', e);
      showToast('Error connecting to server', 'error');
      await router.navigate('admin-login', { mode: 'login' });
    }
  }
}

// Disable native context menu globally (except in inputs/textareas for copy/paste)
window.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('input, textarea, [contenteditable="true"]')) {
    return;
  }
  e.preventDefault();
}, true);

// Global delegates for TextEditor enriched elements
window.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  // Handle inline roll clicks
  const inlineRoll = target.closest('.inline-roll');
  if (inlineRoll) {
    e.preventDefault();
    const formula = inlineRoll.getAttribute('data-formula');
    if (formula) {
      const { wsClient } = await import('./core/ws-client.js');
      const { dispatchRoll } = await import('./screens/game-hud/roll-dispatch.js');
      const session = wsClient.session;
      if (session) {
        dispatchRoll({
          worldId: session.worldId || '',
          userId: session.userId || '',
          userName: session.userName || 'Anonymous',
          userColor: session.userColor || '#888',
          formula,
          mode: 'public'
        });
      } else {
        clog.error('Cannot dispatch inline roll: Session not found');
      }
    }
    return;
  }

  // Handle doc-link clicks
  const docLink = target.closest('.doc-link');
  if (docLink) {
    e.preventDefault();
    const type = docLink.getAttribute('data-doc-type');
    const id = docLink.getAttribute('data-doc-id');
    if (type && id) {
      if (type.toLowerCase() === 'actor') {
        const { windowManager } = await import('./core/window-manager.js');
        const { ActorSheetWindow } = await import('./windows/actor-sheet-window.js');
        const { resolveSheetClass } = await import('./core/sheet-resolver.js');
        const SheetClass = resolveSheetClass('actor', '*', ActorSheetWindow);
        windowManager.open(id, SheetClass as any, { actorId: id });
      } else if (type.toLowerCase() === 'item') {
        const { windowManager } = await import('./core/window-manager.js');
        const { ItemSheetWindow } = await import('./windows/item-sheet-window.js');
        const { resolveSheetClass } = await import('./core/sheet-resolver.js');
        const SheetClass = resolveSheetClass('item', '*', ItemSheetWindow);
        windowManager.open(id, SheetClass as any, { itemId: id });
      } else if (type.toLowerCase() === 'journalentry' || type.toLowerCase() === 'journal') {
        const { windowManager } = await import('./core/window-manager.js');
        const { JournalWindow } = await import('./windows/journal-window.js');
        windowManager.open(id, JournalWindow as any, { journalId: id });
      }
    }
  }
});

// Drag support for doc-links
window.addEventListener('dragstart', (e) => {
  const target = e.target as HTMLElement;
  const docLink = target.closest('.doc-link');
  if (docLink && e.dataTransfer) {
    const type = docLink.getAttribute('data-doc-type');
    const id = docLink.getAttribute('data-doc-id');
    if (type && id) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        uuid: `${type.charAt(0).toUpperCase() + type.slice(1)}.${id}`
      }));
    }
  }
});

// ══════════════════════════════════════════
// TextEditor.implementation.enrichHTML
// ══════════════════════════════════════════
type LegacyEnricher = (content: string) => string;
interface EnricherConfig {
  id?: string;
  pattern: RegExp;
  enricher: (match: RegExpMatchArray, options?: any) => any;
  onRender?: (element: HTMLElement) => void;
}
type CustomEnricherEntry = LegacyEnricher | EnricherConfig;

const customEnrichers: CustomEnricherEntry[] = [];

function _applyCustomEnrichers(content: string): string {
  let result = content;
  for (const entry of customEnrichers) {
    try {
      if (typeof entry === 'function') {
        result = entry(result);
        continue;
      }
      if (!entry?.pattern || typeof entry.enricher !== 'function') continue;

      result = result.replace(entry.pattern, (...args: any[]) => {
        const groups = typeof args[args.length - 1] === 'object' ? args.pop() : undefined;
        args.pop(); // string completa
        args.pop(); // offset
        const match = args as unknown as RegExpMatchArray;
        if (groups) (match as any).groups = groups;
        const placeholderId = `enrich-${Math.random().toString(36).slice(2)}`;
        Promise.resolve(entry.enricher(match, {})).then((el: any) => {
          if (!el) return;
          const placeholder = document.querySelector(`[data-enrich-placeholder="${placeholderId}"]`);
          if (!placeholder) return;
          const html = el instanceof HTMLElement ? el.outerHTML : String(el);
          const temp = document.createElement('template');
          temp.innerHTML = html.trim();
          const newEl = temp.content.firstElementChild;
          if (!newEl) return;
          placeholder.replaceWith(newEl);
          entry.onRender?.(newEl as HTMLElement);
        }).catch((e) => clog.error('Custom enricher (pattern) failed', e));
        return `<span data-enrich-placeholder="${placeholderId}"></span>`;
      });
    } catch (e) {
      clog.error('Custom enricher failed', e);
    }
  }
  return result;
}

export function registerCustomEnricher(enricher: LegacyEnricher) {
  customEnrichers.push(enricher);
}

function _createContentLink(doc: any, options: any = {}): string {
  if (!doc) return '';
  const type = doc instanceof LoomActor || doc.documentName === 'Actor' ? 'actor'
    : doc instanceof LoomItem || doc.documentName === 'Item' ? 'item'
      : doc instanceof LoomJournalEntry || doc.documentName === 'JournalEntry' ? 'journal'
        : 'document';
  const label = options.label || doc.name || 'Link';
  return `<a class="doc-link" data-doc-type="${type}" data-doc-id="${doc.id}" href="#">${label}</a>`;
}

export function getContentLink(doc: any): string {
  return _createContentLink(doc);
}

export function createLegacyContentLink(doc: any): string {
  return _createContentLink(doc);
}

function _embedContent(uuid: string, options: any = {}): string {
  const match = uuid.match(/^(\w+)\.([^.]+)$/);
  if (!match) return '';
  const [, type, id] = match;
  let doc: any = null;
  if (type === 'Actor') doc = actorsCollection.get(id);
  else if (type === 'Item') doc = itemsCollection.get(id);
  // Optional: add journals or other collections if available

  if (!doc) return `<div class="loom-embed"><em>Document not found</em></div>`;
  const content = doc.systemData?.content || doc.systemData?.description || '';
  const label = options.label || doc.name;
  return `<div class="loom-embed"><strong>${label}</strong><div class="loom-embed-content">${content}</div></div>`;
}

function wrapSecrets(content: string): string {
  return content.replace(/\[\[secret\]\](.*?)\[\[\/secret\]\]/gs, (match, inner) => {
    // Basic blur wrap. (GM vs Player permission check is not available here)
    return `<span class="loom-secret" style="filter: blur(4px); transition: filter 0.2s;" onmouseover="this.style.filter='none'" onmouseout="this.style.filter='blur(4px)'">${inner}</span>`;
  });
}

function _createInlineRoll(formula: string): string {
  return `<a class="inline-roll" data-formula="${formula}">🎲 ${formula}</a>`;
}

function _enrichInlineRolls(content: string): string {
  return content.replace(/\[\[(?:\/roll )?([^\]]+)\]\]/g, (match, formula) => {
    if (formula === 'secret') return match; // Handled by wrapSecrets
    return _createInlineRoll(formula);
  });
}
function enrichHTML(content: string, options: any = {}): string {
  // Early return
  if (!/@UUID\[|@Actor\[|@Item\[|@Embed\[|\[\[secret\]\]|\[\[(?:\/roll )?([^\]]+)\]\]/.test(content)) {
    return _applyCustomEnrichers(content);
  }

  let result = content;

  // Processa @UUID[Actor.xxxx]{Label}
  const uuidRegex = /@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g;
  result = result.replace(uuidRegex, (match, uuid, label) => {
    const uuidMatch = uuid.match(/^(\w+)\.([^.]+)$/);
    if (uuidMatch) {
      const [, type, id] = uuidMatch;
      return `<a class="doc-link" data-doc-type="${type}" data-doc-id="${id}" href="#">${label || id}</a>`;
    }
    return match;
  });

  // Processa @Actor[id]{Label}
  const actorRegex = /@Actor\[([^\]]+)\](?:\{([^}]+)\})?/g;
  result = result.replace(actorRegex, (match, id, label) => {
    const actor = actorsCollection.get(id);
    if (actor) {
      return _createContentLink(actor, { label });
    }
    return match;
  });

  // Processa @Item[id]{Label}
  const itemRegex = /@Item\[([^\]]+)\](?:\{([^}]+)\})?/g;
  result = result.replace(itemRegex, (match, id, label) => {
    const item = itemsCollection.get(id);
    if (item) {
      return _createContentLink(item, { label });
    }
    return match;
  });

  // Processa @Embed[UUID]{Label}
  const embedRegex = /@Embed\[([^\]]+)\](?:\{([^}]+)\})?/g;
  result = result.replace(embedRegex, (match, uuid, label) => {
    return _embedContent(uuid, { label });
  });

  result = wrapSecrets(result);
  result = _enrichInlineRolls(result);
  result = _applyCustomEnrichers(result);

  return result;
}

function getDragEventData(event: DragEvent): any {
  try {
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    // Silently ignore invalid JSON
  }
  return {};
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function truncate(text: string, maxLength: number): string {
  return truncateText(text, maxLength);
}

function truncateHTML(html: string, maxLength: number): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  if (div.innerText.length <= maxLength) return html;

  let currentLength = 0;
  function traverse(node: Node) {
    if (currentLength >= maxLength) {
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
        node.textContent = '';
      }
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (currentLength + text.length > maxLength) {
        node.textContent = text.substring(0, maxLength - currentLength) + '...';
        currentLength = maxLength;
      } else {
        currentLength += text.length;
      }
    } else {
      Array.from(node.childNodes).forEach(traverse);
    }
  }
  traverse(div);
  return div.innerHTML;
}

function previewHTML(content: string): string {
  return truncateHTML(content, 200);
}

function decodeHTML(text: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  return txt.value;
}

function getTextNodes(element: HTMLElement): Text[] {
  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode as Text);
  }
  return textNodes;
}

function replaceTextNode(node: Text, newContent: string) {
  const span = document.createElement('span');
  span.innerHTML = newContent;
  node.parentNode?.replaceChild(span, node);
}

async function _uploadImage(file: File, options: any = {}): Promise<string | null> {
  const { wsClient } = await import('./core/ws-client.js');
  const worldId = wsClient.session?.worldId || '';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`/api/assets/upload?worldId=${worldId}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.path;
  } catch (e) {
    clog.error('Image upload failed', e);
    return null;
  }
}


// Exposed under Loom namespace for converted systems — without polluting the global
// Legacy sheets pointer to the LoomVTT real implementations
const LegacyDocumentSheet = LoomDocumentSheet;
const LegacyActorSheet = LoomActorSheet;
const LegacyItemSheet = LoomItemSheet;

// Merge TextEditor/FilePicker into Loom.applications (defined partially above)
const loomApps = (window as any).Loom.applications;
loomApps.ux = {
  TextEditor: {
    implementation: {
      enrichHTML,
      getDragEventData,
      truncateText,
      truncate,
      truncateHTML,
      previewHTML,
      decodeHTML,
      getTextNodes,
      replaceTextNode,
      createContentLink: _createContentLink,
      getContentLink,
      createLegacyContentLink,
      uploadImage: _uploadImage,
      _applyCustomEnrichers
    },
  },
  // Sistemas convertidos chamam `Loom.applications.ux.getDragEventData(event)`
  // direto (mesma assinatura de `foundry.applications.ux.DragDrop.implementation`),
  // não `.TextEditor.implementation.getDragEventData` — sem isto, `_onDrop` de
  // qualquer sheet convertida (ex.: group-actor-sheet.js) estourava
  // "getDragEventData is not a function" e nenhum drag-and-drop funcionava.
  getDragEventData,
};
loomApps.apps = {
  FilePicker: {
    implementation: FilePicker,
  },
};

// Systems register enrichers via `Loom.wraps.registerCustomEnricher(fn)` (see below) —
// pushes into `customEnrichers`, read by `_applyCustomEnrichers()`. There is no
// `Loom.config.TextEditor` bridge; `CONFIG.TextEditor.enrichers.push(fn)` is not wired.

// Document classes based on ClientDocument
const LoomDocument = ClientDocument;
const LoomActor = class Actor extends ClientDocument {
  static documentName = 'Actor';

  /** Alias for modern nomenclature (`actor.system`) — Loom's real field is `systemData`.
   * Applies schema defaults (`dataModels[type]`) here instead of in the constructor: the
   * world can load actors before a system registers `Loom.config.Actor.dataModels`.
   * Sem cache de propósito (ver comentário equivalente em `LoomItem.system`) — um cache
   * por referência trava num valor velho assim que qualquer caminho mutar `systemData`
   * no lugar em vez de reatribuir. Recalcular sempre é mais barato que caçar esse bug. */
  get system(): Record<string, any> {
    const raw = (this as any).systemData ?? {};
    const dataModels = (window as any).Loom?.config?.Actor?.dataModels;
    return applyTypeDataModelDefaults(dataModels, (this as any).type, raw);
  }

  /** Compat collection-like view of embedded items — filters the world's flat item
   * collection by `actorId`/`parent`. Not a plain array on purpose (see comment in
   * `document-sheet.ts` about why the raw-row sheet path avoids this shape). */
  get items(): any {
    const embeddedItems = Array.from(itemsCollection.contents || [])
      .filter((item: any) => item.actorId === this.id || item.parent?.id === this.id);

    return {
      invalidDocumentIds: new Set(),
      contents: embeddedItems,
      getInvalid: () => undefined,
      forEach: (fn: any) => embeddedItems.forEach(fn),
      map: (fn: any) => embeddedItems.map(fn),
      filter: (fn: any) => embeddedItems.filter(fn),
      find: (fn: any) => embeddedItems.find(fn),
      reduce: (fn: any, initial: any) => embeddedItems.reduce(fn, initial),
      some: (fn: any) => embeddedItems.some(fn),
      every: (fn: any) => embeddedItems.every(fn),
      sort: (fn: any) => [...embeddedItems].sort(fn),
      get size() { return embeddedItems.length; },
      [Symbol.iterator]: function* () {
        for (const item of embeddedItems) yield item;
      }
    };
  }

  /** Re-renders the actor's sheet if open. */
  render(): void {
    windowManager.rerenderIfOpen(`actor-sheet-${this.id}`);
  }
};
const LoomItem = class Item extends ClientDocument {
  static documentName = 'Item';

  /** Same alias as `LoomActor.system` — applies `dataModels[type]` defaults.
   * Campo de sistema do Item é `data`, não `systemData` (ver `SYSTEM_FIELD_BY_DOCUMENT`
   * em `client-document.ts`) — ler o campo errado aqui fazia o getter sempre cair nos
   * defaults do schema, mesmo com dado real salvo, revertendo a ficha após cada save.
   * Sem cache de propósito: um cache por referência (`raw !== cached`) exige que TODO
   * caminho de escrita troque a referência de `.data` pra invalidar — um único lugar que
   * mutasse `.data` no lugar (em vez de reatribuir) bastava pra travar o getter num valor
   * velho pra sempre. Recalcular sempre é mais barato que caçar esse tipo de bug de novo. */
  get system(): Record<string, any> {
    const raw = (this as any).data ?? {};
    const dataModels = (window as any).Loom?.config?.Item?.dataModels;
    return applyTypeDataModelDefaults(dataModels, (this as any).type, raw);
  }

  /** Re-renders the item's sheet if open. */
  render(): void {
    windowManager.rerenderIfOpen(`item-sheet-${this.id}`);
  }

  /** Prepares embedded buffs/effects (`Loom.config.Buff.documentClass.prepareDerivedData()`
   * per entry in `this.effects`) after the subclass's own stage runs. Subclasses that
   * override `prepareEmbeddedDocuments()` must call `super.prepareEmbeddedDocuments()`
   * (universal document pattern) to keep this running. */
  prepareEmbeddedDocuments(): void | Promise<void> {
    const effectClass = (window as any).Loom?.config?.Buff?.documentClass;
    if (effectClass?.prototype?.prepareDerivedData) {
      for (const effect of (this as any).effects ?? []) effectClass.prototype.prepareDerivedData.call(effect);
    }
  }
};
const LoomToken = class Token extends ClientDocument { };
const LoomScene = class Scene extends ClientDocument { };
const LoomUser = class User extends ClientDocument { };
const LoomChatMessage = class ChatMessage extends ClientDocument {

  static async create(data: Record<string, any> = {}): Promise<any> {
    const worldId = gameContext.worldId;
    const userId = gameContext.session?.userId;
    if (!worldId || !userId) {
      clog.error('[ChatMessage.create] Sem mundo/sessão ativa — mensagem ignorada.');
      return null;
    }
    const payload: Record<string, any> = {
      worldId,
      userId,
      content: data.content ?? '',
    };
    if (data.speaker) payload.speaker = data.speaker;
    // `flags` (ex: `flags.wod5e` de um sistema convertido) morria aqui antes de
    // sair pro servidor — a mensagem chegava sem eles pro resto dos clientes,
    // mesmo o chamador tendo montado tudo certo.
    if (data.flags) payload.flags = data.flags;
    wsClient.send('chat.message', payload);
    return { ...data, userId };
  }
  static applyMode(messageData: Record<string, any>, rollMode: string): Record<string, any> {
    messageData.flags ??= {};
    messageData.flags.rollMode = rollMode;
    return messageData;
  }
  static applyRollMode(messageData: Record<string, any>, rollMode: string): Record<string, any> {
    return this.applyMode(messageData, rollMode);
  }
  static getSpeaker(
    { actor, token, alias }: { actor?: any; token?: any; alias?: string } = {},
  ): { actor: string | null; token: string | null; alias: string } {
    const session = gameContext.session;
    return {
      actor: actor?.id ?? null,
      token: token?.id ?? null,
      // Nome do personagem primeiro — igual ficha do Foundry, o card mostra
      // quem rolou (o ator), não quem está logado.
      alias: actor?.name ?? alias ?? session?.userName ?? '',
    };
  }
};
const LoomCombat = class Combat extends ClientDocument { };
const LoomFolder = class Folder extends ClientDocument { };
const LoomJournalEntry = class JournalEntry extends ClientDocument { };
const LoomMacro = class Macro extends ClientDocument {
  static async create(data: any): Promise<Macro> {
    const { name, type, command, img, slot } = data;

    const response = await api.post('/macros', {
      worldId: gameContext.worldId,
      name: name || '',
      type: type || 'chat',
      command: command || '',
      imgUrl: img || '',
      slot: slot ?? -1,
    });

    if ((response as any).error) {
      throw new Error((response as any).error);
    }

    const macro = new Macro(response as any);
    return macro;
  }
};

// Global document aliases — must be placed after LoomActor/LoomItem/etc declarations
(window as any).Actor = LoomActor;
(window as any).Item = LoomItem;
(window as any).Token = LoomToken;
(window as any).Scene = LoomScene;

import { FilePickerWindow } from './windows/file-picker-window.js';

// Expose stubs for compatibility
const loomObj = (window as any).Loom;
loomObj.windowManager = windowManager;
loomObj.windows = loomObj.windows || {};
loomObj.windows.FilePickerWindow = FilePickerWindow;
loomObj.Document = LoomDocument;
loomObj.Actor = LoomActor;
loomObj.Item = LoomItem;
loomObj.Token = LoomToken;
loomObj.Scene = LoomScene;
loomObj.User = LoomUser;
loomObj.ChatMessage = LoomChatMessage;
loomObj.config.Actor.documentClass = LoomActor;
loomObj.config.Item.documentClass = LoomItem;
loomObj.config.ChatMessage.documentClass = LoomChatMessage;
loomObj.Combat = LoomCombat;
loomObj.Folder = LoomFolder;
loomObj.JournalEntry = LoomJournalEntry;
loomObj.Macro = LoomMacro;
loomObj.LegacyDocumentSheet = LegacyDocumentSheet;
loomObj.LegacyActorSheet = LegacyActorSheet;
loomObj.LegacyItemSheet = LegacyItemSheet;

import jQuery from 'jquery';
(window as any).$ = (window as any).jQuery = jQuery;

// Declaração de tipo para jQuery
declare global {
  interface Window {
    jQuery: typeof jQuery;
    $: typeof jQuery;
  }
}

// Exporta funções utilitárias que os sistemas invocam globalmente no init
(window as any).loadTemplates = loadTemplates;
(window as any).renderTemplate = renderTemplate;
(window as any).showToast = showToast;

// ui.notifications sob namespace Loom
(window as any).Loom.ui = {
  notifications: {
    info: (msg: string, options?: any) => showToast(msg, 'info'),
    warn: (msg: string, options?: any) => showToast(msg, 'warning' as any),
    error: (msg: string, options?: any) => showToast(msg, 'error'),
    notify: (msg: string, type: string = 'info') => showToast(msg, type as any),
  },
};
(window as any).Loom.CONST = CONST_VALUES;
import Handlebars from 'handlebars';
(window as any).Handlebars = Handlebars;

document.addEventListener('DOMContentLoaded', () => {
  // Texto do aviso de "gire o dispositivo" (client/index.html). O markup é
  // estático e não alcança t(), então o texto entra aqui. O elemento em si
  // fica escondido até a media query de retrato+toque revelá-lo.
  const rotateGate = document.getElementById('rotate-gate');
  if (rotateGate) {
    rotateGate.querySelector('.rotate-gate-title')!.textContent = t('responsive.rotateTitle');
    rotateGate.querySelector('.rotate-gate-desc')!.textContent = t('responsive.rotateDesc');
  }

  bootstrap().catch((e) => {
    console.error('[Bootstrap] Fatal error:', e);
    showToast('Erro fatal ao inicializar', 'error');
  });
});

settingsRegistry.registerMenu('core', 'fonts', {
  name: 'fontSettings.title',
  label: 'fontSettings.title',
  hint: 'fontSettings.hint',
  icon: 'Aa',
  type: FontSettingsWindow,
});

settingsRegistry.registerMenu('core', 'language', {
  name: 'gameSettings.language',
  label: 'gameSettings.language',
  hint: 'gameSettings.languageHint',
  type: CoreLanguageWindow,
});

if (import.meta.hot) {
  import.meta.hot.on('loom:css-update', (payload: any) => {
    console.log('[HMR] Hot-reloading CSS do Addon:', payload.file);
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href^="/marketplace/"]');
    links.forEach(link => {
      const url = new URL(link.href, window.location.origin);
      url.searchParams.set('t', Date.now().toString());
      link.href = url.toString();
    });
  });
}
