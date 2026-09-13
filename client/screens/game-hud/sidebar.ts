import { version as appVersion } from '../../../package.json';
import { BaseComponent } from '../../components/base-component.js';
import { DEFAULT_PORTRAIT_URL } from '../../lib/default-portrait.js';
import { Tabs } from '../../components/tabs.js';
import { showToast } from '../../components/toast.js';
import { showConfirm, showPrompt, showSelectDialog, showColorDialog, showRangeDialog, wait } from '../../components/dialog.js';
import { systemRegistry } from '../../core/system-registry.js';
import { copyTextToClipboard } from '../../lib/clipboard.js';
import { nextDefaultName } from '../../lib/unique-name.js';

interface CombatantGroupSummary { id: string; name: string; initiative: number | null; }
import { wsClient } from '../../core/ws-client.js';
import { LoomHooks } from '../../core/hooks.js';
import { api } from '../../core/api.js';
import { gameContext } from '../../core/game-context.js';
import { applyToTargets } from '../../core/apply-to-targets.js';
import { windowManager } from '../../core/window-manager.js';
import { sheetCatalog } from '../../core/sheet-catalog.js';
import { resolveSheetClass } from '../../core/sheet-resolver.js';
import { applyUiOverride } from '../../core/ui-override.js';
import { UserManagementWindow } from '../../windows/user-management-window.js';
import { OwnershipConfigWindow } from '../../windows/ownership-config-window.js';
import { InviteLinksWindow } from '../../windows/invite-links-window.js';
import { WorldConfigLiteWindow } from '../../windows/world-config-lite-window.js';
import { ModuleManagementWindow } from '../../windows/module-management-window.js';
import { KeybindConfigWindow } from '../../windows/keybind-config-window.js';
import { dispatchRoll } from './roll-dispatch.js';
import { executeMacro } from '../../lib/macro-runner.js';
import { GameConfigWindow } from '../../windows/game-config-window.js';
import { SheetConfigWindow } from '../../windows/sheet-config-window.js';
import { DiscordConfigWindow } from '../../windows/discord-config-window.js';
import { BugReportWindow } from '../../windows/bug-report-window.js';
import { TourManager } from '../../core/tour-manager.js';
import { ActorSheetWindow } from '../../windows/actor-sheet-window.js';
import { ItemSheetWindow } from '../../windows/item-sheet-window.js';
import { JournalWindow } from '../../windows/journal-window.js';
import { DeckSheetWindow } from '../../windows/deck-sheet-window.js';
import { fetchDeckPresets, loadDeckPresetFile, instantiateDeckCards } from '../../core/deck-presets.js';
import { escapeHTML } from '../../core/utils.js';
import { RollTableWindow } from '../../windows/roll-table-window.js';
import { WallConfigWindow } from '../../windows/wall-config-window.js';
import { LightConfigWindow } from '../../windows/light-config-window.js';
import { TileConfigWindow } from '../../windows/tile-config-window.js';
import { NoteConfigWindow } from '../../windows/note-config-window.js';
import { DrawingConfigWindow } from '../../windows/drawing-config-window.js';
import { LoomDialog } from '../../windows/loom-dialog.js';
import { StageConfigWindow } from '../../windows/stage-config-window.js';
import { MacroEditorWindow } from '../../windows/macro-editor-window.js';
import { PlaylistConfigWindow } from '../../windows/playlist-config-window.js';
import { SoundConfigWindow } from '../../windows/sound-config-window.js';
import { FilePicker } from '../../core/file-picker.js';
import { showContextMenu, ContextMenuItem } from '../../components/context-menu.js';
import { renderMessageWrap, chatCardContextOptionsWrap } from './chat-message-card.js';
import { messagesCollection } from '../../core/messages-collection.js';
import { actorsCollection } from '../../core/actors-collection.js';
import { itemsCollection } from '../../core/items-collection.js';

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
import { CompendiumPackWindow } from '../../windows/compendium-pack-window.js';
import { CompendiumSourceWindow } from '../../windows/compendium-source-window.js';
import { t } from '../../lib/i18n.js';

type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

interface DiceTermResult {
  kind: 'dice';
  count: number;
  faces: number;
  rolls: number[];
  dropped: boolean[];
  subtotal: number;
  modifier?: string;
}

interface ModifierTerm {
  kind: 'modifier';
  value: number;
}

type RollTerm = DiceTermResult | ModifierTerm;

interface RollResult {
  formula: string;
  terms: RollTerm[];
  total: number;
  flavor?: string;
  mode: RollMode;
  meta?: Record<string, any>;
}

interface ChatSpeaker {
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
}

interface ChatMessage {
  id: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isRoll?: boolean;
  roll?: RollResult;
  rollMode?: RollMode;
  userId?: string;
  speaker?: ChatSpeaker;
  flags?: Record<string, Record<string, any>>;
}

interface ActorSummary {
  id: string;
  name: string;
  type: string;
  avatarUrl?: string;
  folderId?: string;
  ownership?: Record<string, number>;
}

interface FolderSummary {
  id: string;
  name: string;
  type: string;
  parent?: string;
  color?: string;
}

interface StageSummary {
  id: string;
  name: string;
  isActive?: boolean;
  backgroundUrl?: string;
  thumbUrl?: string;
  folderId?: string;
  sceneType?: string;
  parentStageId?: string;
}

interface ItemSummary {
  id: string;
  name: string;
  type: string;
  imgUrl?: string;
  folderId?: string;
  /** Present when the item is embedded in an actor (POST /actors/:id/items) — these shouldn't
   * appear in the global Items directory, only in the owning actor's sheet. */
  actorId?: string;
}

interface JournalSummary {
  id: string;
  name: string;
  folderId?: string;
  /** Already arrive from `GET /journals` — `JournalsDocument.find()` returns the entire
   * row, without projection. Were only missing in this local type. */
  pages?: unknown[];
  isPinned?: boolean;
  updatedAt?: string;
}

interface DeckSummary {
  id: string;
  name: string;
  type: string;
  stackType?: 'deck' | 'hand' | 'pile';
  ownerId?: string;
  cards?: any[];
  folderId?: string;
}

interface RollTableSummary {
  id: string;
  name: string;
  description?: string;
  formula?: string;
  imgUrl?: string;
}

interface CompendiumPackSummary {
  id: string;
  worldId: string;
  name: string;
  type: string;
  entryCount: number;
  folderId?: string;
}

/** Pack vivo de um addon/ruleset — nunca copiado pro banco do mundo, só
 * navegado direto da fonte (ver compendium-source.ts no server). */
interface CompendiumSourceSummary {
  sourceId: string;
  name: string;
  type: string;
  ownerName: string;
  ownerType: 'addon' | 'ruleset';
}

interface MacroSummary {
  id: string;
  name: string;
  type: string;
  command: string;
  imgUrl?: string;
  folderId?: string;
}

interface PlaylistSummary {
  id: string;
  name: string;
  sounds?: PlaylistSoundSummary[];
  /** Count coming from the list (GET /playlists) — used in the badge when `sounds`
   * hasn't been loaded yet (collapsed) or is undefined to signal that. */
  soundCount?: number;
  folderId?: string;
}

interface PlaylistSoundSummary {
  id: string;
  name: string;
  path: string;
}

type EntityType = 'actor' | 'item' | 'journal' | 'stage' | 'deck' | 'macro' | 'playlist' | 'compendium';

const SIDEBAR_TABS = [
  { id: 'chat', label: t('sidebar.chat'), icon: 'ra ra-speech-bubble' },
  { id: 'combat', label: t('sidebar.combat'), icon: 'ra ra-crossed-swords' },
  { id: 'codex', label: 'Grimório', icon: 'ra ra-burning-book' },
  { id: 'playlists', label: t('sidebar.playlistsTab'), icon: 'fa-solid fa-music' },
  { id: 'settings', label: t('sidebar.settings'), icon: 'ra ra-gears' },
] as const;

export const CODEX_SUBTABS = [
  { id: 'actors', label: 'Personagens', icon: 'ra ra-player' },
  { id: 'items', label: 'Itens', icon: 'ra ra-relic-blade' },
  { id: 'journals', label: 'Diários', icon: 'ra ra-quill-ink' },
  { id: 'compendium', label: 'Compêndio', icon: 'ra ra-book' },
  { id: 'stages', label: 'Cenas', icon: 'fa-solid fa-map' },
  { id: 'placeables', label: 'Objetos', icon: 'ra ra-rune-stone' },
  { id: 'tables', label: 'Tabelas', icon: 'rpg-d20' },
  { id: 'decks', label: 'Baralhos', icon: 'ra ra-spades-card' },
  { id: 'macros', label: 'Macros', icon: 'ra ra-fairy-wand' },
] as const;

export type CodexSubtab = (typeof CODEX_SUBTABS)[number]['id'];

const ROLL_MODES: { id: RollMode; label: string; icon: string }[] = [
  { id: 'public', label: t('sidebar.rollModePublic'), icon: '<i class="fa-solid fa-globe"></i>' },
  { id: 'gmroll', label: t('sidebar.rollModeGm'), icon: '<i class="fa-solid fa-ghost"></i>' },
  { id: 'blindroll', label: t('sidebar.rollModeBlind'), icon: '<i class="fa-solid fa-eye-slash"></i>' },
  { id: 'selfroll', label: t('sidebar.rollModeSelf'), icon: '<i class="fa-solid fa-user"></i>' },
];

export class Sidebar extends BaseComponent {
  private tabs = new Tabs(SIDEBAR_TABS, 'chat', {
    classes: {
      nav: 'sidebar-tabs',
      button: 'sidebar-tab-btn',
      content: 'sidebar-content',
    },
  });
  private activeCodexTab: CodexSubtab = 'actors';
  private collapsed = true;
  private chatResizeObserver: ResizeObserver | null = null;
  private collapsedOverlayEl!: HTMLDivElement;
  private collapsedToastsEl!: HTMLDivElement;
  private activeRollMode: RollMode = 'public';
  private speakAs: ChatSpeaker | null = null;
  private speakAsActive = false;
  private myActorId: string | null = null;
  private messages: ChatMessage[] = [];
  private actors: ActorSummary[] = [];
  private actorsLoaded = false;
  private actorFolders: FolderSummary[] = [];
  private actorFoldersLoaded = false;
  private itemFolders: FolderSummary[] = [];
  private itemFoldersLoaded = false;
  private journalFolders: FolderSummary[] = [];
  private journalFoldersLoaded = false;
  private stageFolders: FolderSummary[] = [];
  private stageFoldersLoaded = false;
  private deckFolders: FolderSummary[] = [];
  private deckFoldersLoaded = false;
  private macroFolders: FolderSummary[] = [];
  private macroFoldersLoaded = false;
  private playlistFolders: FolderSummary[] = [];
  private playlistFoldersLoaded = false;
  private compendiumFolders: FolderSummary[] = [];
  private compendiumFoldersLoaded = false;
  private collapsedFolders = new Set<string>();
  /** Search text per directory tab (Actors, Items, Scenes, etc). Filters
   * `renderGroupedList` — each tab has its own "Search X" box. */
  private searchQueries: Partial<Record<EntityType, string>> = {};
  /** Search for the "Placeables" tab — separated from `searchQueries` because
   * it combines various data types into a single list (not an EntityType/renderGroupedList). */
  private placeablesQuery = '';
  private stages: StageSummary[] = [];
  private expandedMapStages = new Set<string>();
  private stagesLoaded = false;
  private items: ItemSummary[] = [];
  private itemsLoaded = false;
  private journals: JournalSummary[] = [];
  private journalsLoaded = false;
  private decks: DeckSummary[] = [];
  private decksLoaded = false;
  private rollTables: RollTableSummary[] = [];
  private rollTablesLoaded = false;
  private macros: MacroSummary[] = [];
  private macrosLoaded = false;
  private playlists: PlaylistSummary[] = [];
  private playlistsLoaded = false;
  private modules: any[] = [];
  private playingSoundId: string | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private volumeMaster = 0.5;
  private volumeMusic = 0.5;
  private volumeAmbient = 0.5;
  private compendiumPacks: CompendiumPackSummary[] = [];
  private compendiumPacksLoaded = false;
  private compendiumSources: CompendiumSourceSummary[] = [];
  private compendiumSourcesLoaded = false;
  private combat: any = null;
  private combatLoaded = false;
  private liveVisionOnDrag = true;
  private lightAnimationsEnabled = true;
  private locale = localStorage.getItem('loom_locale') || 'pt-BR';
  private hideCanvas = localStorage.getItem('loom_hide_canvas') === 'true';
  private leftClickDeselect = localStorage.getItem('loom_left_click_deselect') !== 'false';
  private maxFps = localStorage.getItem('loom_max_fps') || '60';
  private showTooltips = localStorage.getItem('loom_show_tooltips') !== 'false';
  private autosaveInterval = localStorage.getItem('loom_autosave_interval') || '30000';
  private universalKeys = localStorage.getItem('loom_universal_keys') === 'true';
  private hasAdminSession = false;
  private combatantBuffs: Map<string, any[]> = new Map();
  private isRendering = false;
  private isProcessingCombatAction = false;
  private userId: string;
  private userRole: number;
  private permissions: Record<string, number[]> = {};

  private hasPermission(key: string): boolean {
    return this.userRole >= 4 || (this.permissions[key] || []).includes(this.userRole);
  }

  private rebuildTabs(): void {
    this.tabs = new Tabs(SIDEBAR_TABS, this.tabs?.active ?? 'chat', {
      classes: {
        nav: 'sidebar-tabs',
        button: 'sidebar-tab-btn',
        content: 'sidebar-content',
      },
    });
  }

  setSystemData(
    system?: { id: string; title: string; version: string; changelogUrl?: string; wikiUrl?: string; bugsUrl?: string },
    modules?: any[],
  ): void {
    this.system = system;
    if (modules) this.modules = modules;
    this.render();
  }

  setPermissions(permissions: Record<string, unknown>): void {
    const clean: Record<string, number[]> = {};
    for (const key of Object.keys(permissions || {})) {
      clean[key] = Array.isArray(permissions[key]) ? (permissions[key] as number[]) : [];
    }
    this.permissions = clean;
    this.rebuildTabs();
    this.render();
  }
  private unsubscribeChat: (() => void) | null = null;
  private unsubscribeRoll: (() => void) | null = null;
  private unsubscribeMessageDeleted: (() => void) | null = null;
  private unsubscribeMessageUpdated: (() => void) | null = null;
  private unsubscribeChatCleared: (() => void) | null = null;
  private unsubscribeUserUpdate: (() => void) | null = null;
  private unsubscribeCombat: Array<() => void> = [];
  private unsubscribeActors: Array<() => void> = [];
  private unsubscribeItems: Array<() => void> = [];
  private unsubscribeDecks: Array<() => void> = [];
  private gameHud?: any;
  private userCache = new Map<string, { avatarUrl?: string; name?: string }>();

  constructor(
    container: HTMLElement,
    private worldId: string,
    private session?: { userId?: string; userName?: string; userColor?: string; userRole?: number },
    private system?: { id: string; title: string; version: string; changelogUrl?: string; wikiUrl?: string; bugsUrl?: string },
    modules?: any[],
    private onLiveVisionDragChange?: (val: boolean) => void,
    private onLightAnimationsChange?: (val: boolean) => void,
    private onLocaleChange?: (val: string) => void,
    private onHideCanvasChange?: (val: boolean) => void,
    private onLeftClickDeselectChange?: (val: boolean) => void,
    private onMaxFpsChange?: (val: string) => void,
    private onShowTooltipsChange?: (val: boolean) => void,
    private onAutosaveIntervalChange?: (val: string) => void,
    private onUniversalKeysChange?: (val: boolean) => void,
    gameHud?: any,
  ) {
    super(container);
    this.userId = session?.userId || 'anon';
    this.userRole = session?.userRole ?? 0;
    this.modules = modules || [];
    this.gameHud = gameHud;
    this.rebuildTabs();
    this.setupWebSocketListeners();
    this.element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if ((e.target as HTMLElement).getAttribute('name') !== 'chat-input') return;
      e.preventDefault();
      this.sendChatMessage();
    });
    this.setupCollapsedOverlay();
    this.loadActors().then(() => {
      if (this.tabs.active === 'chat') this.render();
    });
    void this.loadMyCharacter();
    this.render();
    this.setupChatScrollObserver();
    this.element.addEventListener('contextmenu', this.onChatCardContextMenu);

    this.element.addEventListener('dragstart', (e: DragEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-entity-type][data-id]',
      );
      if (!item) {
        console.log('LoomVTT | Dragstart: não encontrou item');
        return;
      }
      const type = item.getAttribute('data-entity-type');
      const id = item.getAttribute('data-id');
      console.log('LoomVTT | Dragstart:', { type, id });
      if (!type || !id || !e.dataTransfer) {
        console.log('LoomVTT | Dragstart: dados incompletos');
        return;
      }

      const payload = {
        type: type.charAt(0).toUpperCase() + type.slice(1),
        id: id,
        uuid: `${type.charAt(0).toUpperCase() + type.slice(1)}.${id}`
      };

      console.log('LoomVTT | Dragstart: payload', payload);
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
    });

    this.element.addEventListener('dragover', (e: DragEvent) => {
      const header = (e.target as HTMLElement).closest<HTMLElement>('.sidebar-folder-header');
      if (header) {
        e.preventDefault();
        header.classList.add('drag-over');
        return;
      }
      const tabContent = (e.target as HTMLElement).closest<HTMLElement>('.sidebar-content[data-tab]');
      if (tabContent) {
        e.preventDefault();
      }
    });

    this.element.addEventListener('dragleave', (e: DragEvent) => {
      const header = (e.target as HTMLElement).closest<HTMLElement>('.sidebar-folder-header');
      if (header) {
        header.classList.remove('drag-over');
      }
    });

    this.element.addEventListener('drop', (e: DragEvent) => {
      if (!e.dataTransfer) return;

      const rawText = e.dataTransfer.getData('text/plain');
      if (!rawText) return;

      let data: any;
      try { data = JSON.parse(rawText); } catch { return; }

      const header = (e.target as HTMLElement).closest<HTMLElement>('.sidebar-folder-header');
      if (header) {
        header.classList.remove('drag-over');
        e.preventDefault();
        const folderId = header.getAttribute('data-id')!;
        const folderType = header.getAttribute('data-folder-type') as EntityType;
        if (data.type?.toLowerCase() === folderType) {
          void this.moveEntityToFolder(folderType, data.id, folderId);
        }
        return;
      }

      const tabContent = (e.target as HTMLElement).closest<HTMLElement>('.sidebar-content[data-tab]');
      if (!tabContent) return;

      const tabId = tabContent.getAttribute('data-tab');
      if (data.uuid?.startsWith('Compendium.') && tabId) {
        e.preventDefault();
        void this.importCompendiumEntry(tabId, data);
      }
    });

    this.element.addEventListener('contextmenu', (e: MouseEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[data-entity-type][data-id]');
      if (!item) return;
      e.preventDefault();
      const entityType = item.getAttribute('data-entity-type') as string;
      const id = item.getAttribute('data-id')!;
      if (entityType === 'folder') {
        const folderType = item.getAttribute('data-folder-type') as 'actor' | 'item' | 'journal';
        this.showFolderContextMenu(id, folderType, e);
      } else {
        this.showEntityContextMenu(entityType as EntityType, id, e);
      }
    });

  }

  private async loadActors(): Promise<void> {
    if (!this.actorsLoaded) {
      try {
        this.actors = await api.get<ActorSummary[]>(`/actors?worldId=${this.worldId}`);
      } catch {
        this.actors = [];
      }
      this.actorsLoaded = true;
    }
    if (!this.actorFoldersLoaded) {
      try {
        this.actorFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=actor`);
      } catch {
        this.actorFolders = [];
      }
      this.actorFoldersLoaded = true;
    }
  }

  private async loadMyCharacter(): Promise<void> {
    const userId = gameContext.session?.userId;
    const worldId = gameContext.worldId;
    if (!userId || !worldId) return;
    try {
      const users = await api.get<any[]>(`/worlds/${worldId}/users`);
      this.myActorId = users.find((u) => u.id === userId)?.actorId || null;
      // `userCache` was never populated — every chat message without "speak
      // as" fell back to the placeholder, even with an avatar configured
      // in the profile, because `.get(userId)` always hit undefined.
      for (const u of users) this.userCache.set(u.id, { avatarUrl: u.avatarUrl || undefined, name: u.name || u.userName || undefined });
    } catch {
      this.myActorId = null;
    }
    this.render();
  }

  private applySpeakAs(): void {
    const actor = this.myActorId
      ? this.actors.find((a) => a.id === this.myActorId)
      : null;

    if (!this.speakAsActive || !actor) {
      this.speakAs = null;
      this.speakAsActive = false;
      return;
    }

    this.speakAs = {
      actorId: actor.id,
      actorName: actor.name,
      actorAvatar: actor.avatarUrl || '',
    };
  }

  private async loadStages(): Promise<void> {
    if (!this.stagesLoaded) {
      try {
        this.stages = await api.get<StageSummary[]>(`/stages?worldId=${this.worldId}`);
      } catch {
        this.stages = [];
      }
      this.stagesLoaded = true;
    }
    if (!this.stageFoldersLoaded) {
      try {
        this.stageFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=scene`);
      } catch {
        this.stageFolders = [];
      }
      this.stageFoldersLoaded = true;
    }
  }

  private async loadItems(): Promise<void> {
    if (!this.itemsLoaded) {
      try {
        const all = await api.get<ItemSummary[]>(`/items?worldId=${this.worldId}`);
        this.items = all.filter(i => !i.actorId);
      } catch {
        this.items = [];
      }
      this.itemsLoaded = true;
    }
    if (!this.itemFoldersLoaded) {
      try {
        this.itemFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=item`);
      } catch {
        this.itemFolders = [];
      }
      this.itemFoldersLoaded = true;
    }
  }

  private async loadJournals(): Promise<void> {
    if (!this.journalsLoaded) {
      try {
        this.journals = await api.get<JournalSummary[]>(`/journals?worldId=${this.worldId}`);
      } catch {
        this.journals = [];
      }
      this.journalsLoaded = true;
    }
    if (!this.journalFoldersLoaded) {
      try {
        this.journalFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=journal`);
      } catch {
        this.journalFolders = [];
      }
      this.journalFoldersLoaded = true;
    }
  }

  private async loadDecks(): Promise<void> {
    if (!this.decksLoaded) {
      try {
        this.decks = await api.get<DeckSummary[]>(`/decks/world/${this.worldId}`);
        const deckClass = (window as any).Loom?.config?.Deck?.documentClass;
        const cardClass = (window as any).Loom?.config?.Card?.documentClass;
        for (const deck of this.decks) {
          if (deckClass?.prototype?.prepareDerivedData) deckClass.prototype.prepareDerivedData.call(deck);
          if (cardClass?.prototype?.prepareDerivedData) {
            for (const card of deck.cards ?? []) cardClass.prototype.prepareDerivedData.call(card);
          }
        }
      } catch {
        this.decks = [];
      }
      this.decksLoaded = true;
    }
    if (!this.deckFoldersLoaded) {
      try {
        this.deckFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=deck`);
      } catch {
        this.deckFolders = [];
      }
      this.deckFoldersLoaded = true;
    }
  }

  private async loadRollTables(): Promise<void> {
    if (this.rollTablesLoaded) return;
    try {
      this.rollTables = await api.get<RollTableSummary[]>(`/roll-tables?worldId=${this.worldId}`);
    } catch {
      this.rollTables = [];
    }
    this.rollTablesLoaded = true;
  }

  private async loadMacros(): Promise<void> {
    if (!this.macrosLoaded) {
      try {
        this.macros = await api.get<MacroSummary[]>(`/macros?worldId=${this.worldId}`);
      } catch {
        this.macros = [];
      }
      this.macrosLoaded = true;
    }
    if (!this.macroFoldersLoaded) {
      try {
        this.macroFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=macro`);
      } catch {
        this.macroFolders = [];
      }
      this.macroFoldersLoaded = true;
    }
  }

  private async loadPlaylists(): Promise<void> {
    if (!this.playlistsLoaded) {
      try {
        this.playlists = await api.get<PlaylistSummary[]>(`/playlists?worldId=${this.worldId}`);
      } catch {
        this.playlists = [];
      }
      this.playlistsLoaded = true;
    }
    if (!this.playlistFoldersLoaded) {
      try {
        this.playlistFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=playlist`);
      } catch {
        this.playlistFolders = [];
      }
      this.playlistFoldersLoaded = true;
    }
  }

  private async loadCompendiumPacks(): Promise<void> {
    if (!this.compendiumPacksLoaded) {
      try {
        this.compendiumPacks = await api.get<CompendiumPackSummary[]>(`/compendium?worldId=${this.worldId}`);
      } catch {
        this.compendiumPacks = [];
      }
      this.compendiumPacksLoaded = true;
    }
    if (!this.compendiumFoldersLoaded) {
      try {
        this.compendiumFolders = await api.get<FolderSummary[]>(`/folders?worldId=${this.worldId}&type=compendium`);
      } catch {
        this.compendiumFolders = [];
      }
      this.compendiumFoldersLoaded = true;
    }
    if (!this.compendiumSourcesLoaded) {
      try {
        this.compendiumSources = await api.get<CompendiumSourceSummary[]>('/compendium/sources');
      } catch {
        this.compendiumSources = [];
      }
      this.compendiumSourcesLoaded = true;
    }
  }

  private async loadAdminSessionStatus(): Promise<void> {
    try {
      const verify = await api.get<{ valid: boolean; admin: boolean }>('/setup/verify');
      this.hasAdminSession = !!(verify.valid && verify.admin);
    } catch {
      this.hasAdminSession = false;
    }
  }

  private async loadCombat(): Promise<void> {
    if (this.combatLoaded) return;
    try {
      this.combat = await api.get<any>(`/combat/${this.worldId}`);
    } catch {
      this.combat = null;
    }
    this.combatLoaded = true;
    await this.loadCombatantBuffs();
  }

  /** Fetches active buffs of each combatant (via cast.actorId) to show an icon in the list. Silent failure per combatant — a cast without actorId or buffs simply doesn't show an icon. */
  private async loadCombatantBuffs(): Promise<void> {
    if (!this.combat?.combatants?.length) {
      this.combatantBuffs.clear();
      return;
    }
    const CONCURRENCY_LIMIT = 5;
    const entries: Map<string, any[]> = new Map();
    const processBatch = async (batch: any[]) => {
      await Promise.all(
        batch.map(async (combatant: any) => {
          try {
            const cast = await api.get<{ actorId?: string }>(`/cast/${combatant.id}`);
            if (!cast.actorId) return;
            const buffs = await api.get<any[]>(`/buffs/actor/${cast.actorId}`);
            entries.set(combatant.id, buffs.filter((b) => !b.disabled));
          } catch {
            /* silencioso */
          }
        }),
      );
    };
    for (let i = 0; i < this.combat.combatants.length; i += CONCURRENCY_LIMIT) {
      const batch = this.combat.combatants.slice(i, i + CONCURRENCY_LIMIT);
      await processBatch(batch);
    }
    this.combatantBuffs = entries;
  }

  render(): void {
    if (this.isRendering) return;
    this.isRendering = true;
    if (this.collapsed) {
      this.element.classList.add('collapsed');
    } else {
      this.element.classList.remove('collapsed');
    }

    super.render();
    this.onRender();
    this.isRendering = false;
  }

  private setupWebSocketListeners(): void {
    this.unsubscribeChat = wsClient.on('chat.message', (data) => {
      messagesCollection.add(data);
      // `speaker` arrives in two forms: `{actorName, actorAvatar, ...}` (rolls,
      // resolved on the server) or `{actor, token, alias}` (`Loom.ChatMessage.getSpeaker()`,
      // used by simple system messages). The old filter only accepted the first
      // form — messages of the second type arrived live via WS WITHOUT speaker (turned into
      // "logged-in player's speech" instead of Actor), although `loadChatHistory` (after reload)
      // always preserved any format without this filter.
      let speaker: ChatSpeaker | undefined;
      if (data.speaker && typeof data.speaker === 'object') {
        speaker = data.speaker as ChatSpeaker;
      }
      const msg: ChatMessage = {
        id: data.id || Date.now().toString(),
        userName: data.userName || 'Unknown',
        userColor: data.userColor || '#CCCCCC',
        userAvatar: this.userCache.get(data.userId)?.avatarUrl,
        content: data.content,
        timestamp: new Date(data.createdAt || Date.now()),
        userId: data.userId,
        speaker,
        flags: data.flags,
      };
      this.messages.push(msg);
      this.updateChatDisplay();
      this.pushCollapsedToast(msg);
    });

    this.unsubscribeRoll = wsClient.on('chat.roll', (data) => {
      // `Loom.messages.get(id)` only really existed for `chat.message` — without
      // this, no roll could be found later to edit in-place
      // (e.g.: Willpower reroll).
      messagesCollection.add(data);
      LoomHooks.callAll('chat.roll', data.roll);
      // Same reason as the `chat.message` handler above — accept any format.
      let rollSpeaker: ChatSpeaker | undefined;
      if (data.speaker && typeof data.speaker === 'object') {
        rollSpeaker = data.speaker as ChatSpeaker;
      }
      const msg: ChatMessage = {
        id: data.id || Date.now().toString(),
        userName: data.userName || 'Unknown',
        userColor: data.userColor || '#CCCCCC',
        userAvatar: this.userCache.get(data.userId)?.avatarUrl,
        content: '',
        timestamp: new Date(data.createdAt || Date.now()),
        isRoll: true,
        roll: data.roll,
        rollMode: data.roll?.mode || 'public',
        userId: data.userId,
        speaker: rollSpeaker,
      };
      this.messages.push(msg);
      this.updateChatDisplay();
      this.pushCollapsedToast(msg);
    });

    this.unsubscribeMessageDeleted = wsClient.on('chat.messageDeleted', (data: { id: string }) => {
      this.messages = this.messages.filter((m) => m.id !== data.id);
      this.updateChatDisplay();
    });

    // Edita um card de roll já postado no lugar (ex: reroll de Força de
    // Vontade) — sem isto, `LiveMessage.setRoll()` gravava no servidor mas
    // ninguém via a mudança sem recarregar a página.
    this.unsubscribeMessageUpdated = wsClient.on('chat.messageUpdated', (data: { id: string; roll: RollResult }) => {
      messagesCollection.patchRoll(data.id, data.roll);
      const msg = this.messages.find((m) => m.id === data.id);
      if (msg) {
        msg.roll = data.roll;
        if (data.roll?.mode) {
          msg.rollMode = data.roll.mode;
        }
        this.updateChatDisplay();
      }
    });

    this.unsubscribeChatCleared = wsClient.on('chat.cleared', () => {
      this.messages = [];
      this.updateChatDisplay();
    });

    this.unsubscribeUserUpdate = wsClient.on('user.updated', (user: any) => {
      if (user.id !== gameContext.session?.userId) return;
      this.myActorId = user.actorId || null;
      if (this.speakAsActive) this.applySpeakAs();
      this.render();
    });

    this.unsubscribeCombat.push(
      wsClient.on('combat.started', async (data) => {
        this.combat = data;
        this.combatLoaded = true;
        await this.loadCombatantBuffs();
        this.render();
      }),
      wsClient.on('combat.next', (data) => {
        this.combat = data;
        this.render();
      }),
      wsClient.on('combat.ended', () => {
        this.combat = null;
        this.combatantBuffs.clear();
        this.render();
      }),
      wsClient.on('stage.activated', (data) => {
        const newStageId = data.id ?? data.stageId;
        this.stages.forEach(s => s.isActive = s.id === newStageId);
        this.render();
      }),
      wsClient.on('combat.updated', (data) => {
        this.combat = data;
        this.render();
      }),
    );

    this.unsubscribeActors.push(
      wsClient.on('actor.created', (data) => {
        LoomHooks.callAll('actor.created', data);
        LoomHooks.callAll('createActor', data);
        LoomHooks.callAll('createDocument', 'actor', data);
        if (this.actors.some((a) => a.id === data.id)) return;
        this.actors.push({ id: data.id, name: data.name, type: data.type, avatarUrl: data.avatarUrl || '', folderId: data.folderId || '' });
        this.actorsLoaded = true;
        actorsCollection.add(data);
        // render() rebuilds the entire sidebar, including the message list — with the chat
        // open this throws the scroll back to the top. onTabSwitched() already does loadActors() +
        // render() upon entering the actors tab, so skipping here doesn't leave anything outdated.
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('actor.updated', (data) => {
        LoomHooks.callAll('actor.updated', data);
        LoomHooks.callAll('updateActor', data);
        LoomHooks.callAll('updateDocument', 'actor', data);
        const existing = this.actors.find((a) => a.id === data.id);
        if (existing) {
          existing.name = data.name;
          existing.type = data.type;
          existing.avatarUrl = data.avatarUrl || '';
          existing.folderId = data.folderId || '';
        }
        actorsCollection.add(data);
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('actor.deleted', (data) => {
        LoomHooks.callAll('actor.deleted', data);
        LoomHooks.callAll('deleteActor', data);
        LoomHooks.callAll('deleteDocument', 'actor', data);
        if (!data?.id) return;
        this.actors = this.actors.filter((a) => a.id !== data.id);
        actorsCollection.delete(data.id);
        if (this.tabs.active !== 'chat') this.render();
      }),
    );

    this.unsubscribeItems.push(
      wsClient.on('item.created', (data) => {
        LoomHooks.callAll('item.created', data);
        LoomHooks.callAll('createItem', data);
        LoomHooks.callAll('createDocument', 'item', data);
        if (this.items.some((i) => i.id === data.id)) return;
        this.items.push({ id: data.id, name: data.name, type: data.type, imgUrl: data.imgUrl || '', folderId: data.folderId || '' });
        this.itemsLoaded = true;
        itemsCollection.add(data);
        // Same reason as `actor.created`/`actor.updated` above: `render()` rebuilds
        // the entire sidebar, including the chat, forcibly throwing the scroll to the top — without
        // this guard, any update of an embedded Item (e.g.: changing the dots of a
        // Background/Merit/Flaw in a dot, which is saved in the ITEM, not the Actor)
        // reset the chat even with the Chat tab active.
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('item.updated', (data) => {
        LoomHooks.callAll('item.updated', data);
        LoomHooks.callAll('updateItem', data);
        LoomHooks.callAll('updateDocument', 'item', data);
        const existing = this.items.find((i) => i.id === data.id);
        if (existing) {
          existing.name = data.name;
          existing.type = data.type;
          existing.imgUrl = data.imgUrl || '';
          existing.folderId = data.folderId || '';
        }
        itemsCollection.add(data);
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('item.deleted', (data) => {
        LoomHooks.callAll('item.deleted', data);
        LoomHooks.callAll('deleteItem', data);
        LoomHooks.callAll('deleteDocument', 'item', data);
        if (!data?.id) return;
        this.items = this.items.filter((i) => i.id !== data.id);
      }),
    );

    this.unsubscribeDecks.push(
      wsClient.on('deck.created', (data) => {
        if (this.decks.some((d) => d.id === data.id)) return;
        this.decks.push({ id: data.id, name: data.name, type: data.type, stackType: data.stackType, ownerId: data.ownerId, cards: data.cards || [], folderId: data.folderId || '' });
        this.decksLoaded = true;
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('deck.updated', (data) => {
        const existing = this.decks.find((d) => d.id === data.id);
        if (existing) {
          existing.name = data.name;
          existing.type = data.type;
          existing.folderId = data.folderId || '';
        }
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('deck.deleted', (data) => {
        if (!data?.id) return;
        this.decks = this.decks.filter((d) => d.id !== data.id);
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('roll-table.created', (data) => {
        if (this.rollTables.some((t) => t.id === data.id)) return;
        this.rollTables.push({ id: data.id, name: data.name, description: data.description || '', formula: data.formula || '', imgUrl: data.imgUrl || '' });
        this.rollTablesLoaded = true;
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('roll-table.updated', (data) => {
        const existing = this.rollTables.find((t) => t.id === data.id);
        if (existing) {
          existing.name = data.name;
          existing.description = data.description || '';
          existing.formula = data.formula || '';
          existing.imgUrl = data.imgUrl || '';
        }
        if (this.tabs.active !== 'chat') this.render();
      }),
      wsClient.on('roll-table.deleted', (data) => {
        if (!data?.id) return;
        this.rollTables = this.rollTables.filter((t) => t.id !== data.id);
        if (this.tabs.active !== 'chat') this.render();
      }),
    );
  }

  private canSeeRoll(msg: ChatMessage): boolean {
    const mode = msg.roll?.mode || msg.rollMode || 'public';
    if (mode === 'public') return true;
    if (mode === 'selfroll') return msg.userId === this.userId;
    if (mode === 'gmroll') return this.userRole >= 4 || msg.userId === this.userId;
    if (mode === 'blindroll') return this.userRole >= 4;
    return true;
  }

  /** Context-menu of chat/roll card — searches for `[data-message-id]`, written
   * ALWAYS by `renderMessage()` (outside the wrap point), so it works even if
   * the system swaps the entire card via `Loom.wraps.renderMessage`/`renderRollCard`.
   * System registers its own options (e.g. reroll with its own criteria) via
   * `Loom.wraps.chatCardContextOptions.addWrapper((wrapped, msg) => [...wrapped(msg), { label: '...', action: () => {...} }])`.
   * Core has no options by default — with no system registered, the menu
   * simply doesn't appear (without preventDefault, normal right-click of the
   * browser remains available). */
  private onChatCardContextMenu = (event: MouseEvent): void => {
    const wrapper = (event.target as HTMLElement).closest<HTMLElement>('[data-message-id]');
    if (!wrapper) return;
    const id = wrapper.getAttribute('data-message-id');
    const msg = this.messages.find((m) => m.id === id);
    if (!msg || !id) return;

    const canManage = this.userRole >= 4 || msg.userId === this.userId;
    const items: ContextMenuItem[] = [];

    // Privacy and delete are generic actions of any card — they stay here
    // in core (not in the wrap point) because they don't make sense as something a
    // sistema convertido precisaria sobrescrever.
    if (canManage && msg.isRoll && msg.roll) {
      const currentMode = msg.roll.mode || msg.rollMode || 'public';
      const isPrivate = currentMode !== 'public';
      items.push({
        icon: `<i class="fa-solid fa-${isPrivate ? 'eye' : 'eye-slash'}"></i>`,
        label: isPrivate ? t('sidebar.showToAll') : t('sidebar.makePrivate'),
        action: () => void this.toggleRollPrivacy(id, isPrivate),
      });
    }

    const options = chatCardContextOptionsWrap(msg);
    for (const o of options) {
      items.push({ icon: o.icon, label: o.label, action: o.action, danger: o.danger });
    }

    if (canManage) {
      items.push({
        icon: '<i class="fa-solid fa-trash"></i>',
        label: t('sidebar.deleteMessage'),
        action: () => void this.deleteChatMessage(id),
        danger: true,
      });
    }

    if (!items.length) return;
    showContextMenu(event, items);
  };

  private async toggleRollPrivacy(id: string, currentlyPrivate: boolean): Promise<void> {
    const message = messagesCollection.get(id);
    if (!message?.roll) return;
    try {
      await message.setRoll({ ...message.roll, mode: currentlyPrivate ? 'public' : 'gmroll' });
    } catch (err: any) {
      showToast(err?.message || 'Erro ao mudar a privacidade da rolagem', 'error');
    }
  }

  private async deleteChatMessage(id: string): Promise<void> {
    try {
      // ?worldId= is mandatory: admin session (Setup Hub) doesn't have worldId in the token
      await api.delete(`/chat-messages/${id}?worldId=${this.worldId}`);
      this.messages = this.messages.filter((m) => m.id !== id);
      this.updateChatDisplay();
    } catch (err: any) {
      showToast(`Erro ao apagar mensagem: ${err?.message || err}`, 'error');
    }
  }

  private renderMessage(msg: ChatMessage): string {
    // The `data-message-id` wrapper is written HERE, outside the wrap point
    // (`Loom.wraps.renderMessage`) — if a system overwrites the entire card
    // (swaps the complete HTML, not just the content), the reroll context-menu
    // (`onChatCardContextMenu`) still finds the right message, because the container
    // it looks for never depends on the system's customized HTML.
    const canDelete = this.userRole >= 4 || msg.userId === this.userId;
    const inner = renderMessageWrap(msg, { esc: this.escapeHtml.bind(this), canSeeRoll: this.canSeeRoll(msg), canDelete });
    // `display: contents` — disappears in the DOM for the data-attribute to work, invisible
    // to the flex/gap layout of the list (otherwise it would break the existing spacing).
    return `<div data-message-id="${this.escapeHtml(msg.id || '')}" style="display: contents;">${inner}</div>`;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private renderCombatActive(): string {
    // `currentTurn` always indexes this flat list by individual initiative — groups
    // do not collapse turns (each combatant keeps their own turn), only share
    // an initiative displayed/editable together and stay visually grouped below.
    const sortedCombatants = [...this.combat.combatants].sort((a, b) => b.initiative - a.initiative);
    const currentCombatant = sortedCombatants[this.combat.currentTurn];
    const groups: CombatantGroupSummary[] = this.combat.groups || [];
    const groupById = new Map(groups.map((g) => [g.id, g]));

    const membersByGroup = new Map<string, any[]>();
    const solo: any[] = [];
    for (const c of this.combat.combatants) {
      if (c.groupId && groupById.has(c.groupId)) {
        if (!membersByGroup.has(c.groupId)) membersByGroup.set(c.groupId, []);
        membersByGroup.get(c.groupId)!.push(c);
      } else {
        solo.push(c);
      }
    }

    const rows: { initiative: number; html: string }[] = [];
    for (const group of groups) {
      const members = membersByGroup.get(group.id) || [];
      if (members.length === 0) continue;
      const effectiveInit = group.initiative ?? Math.max(...members.map((m) => m.initiative ?? -Infinity));
      const allDefeated = members.every((m) => (m.hp ?? 0) <= 0);
      rows.push({
        initiative: effectiveInit,
        html: `
          <div class="combatant-group${allDefeated ? ' defeated' : ''}">
            <div class="combatant-group-header">
              <span class="combatant-group-name">${this.escapeHtml(group.name)}</span>
              <input type="number" class="combatant-group-initiative" name="group-init-${group.id}"
                     value="${group.initiative ?? ''}" placeholder="Init"
                     data-action="combat-group-initiative" data-id="${group.id}"
                     ${this.userRole >= 4 ? '' : 'readonly'} />
              ${this.userRole >= 4 ? `
              <button class="btn-icon" data-action="combat-rename-group" data-id="${group.id}" title="Renomear grupo">✏️</button>
              <button class="btn-icon" data-action="combat-delete-group" data-id="${group.id}" title="Remover grupo">✕</button>
              ` : ''}
            </div>
            ${members.map((m) => this.renderCombatantItem(m, m === currentCombatant, groups)).join('')}
          </div>
        `,
      });
    }
    for (const c of solo) {
      rows.push({ initiative: c.initiative ?? -Infinity, html: this.renderCombatantItem(c, c === currentCombatant, groups) });
    }
    rows.sort((a, b) => b.initiative - a.initiative);

    return `
      <div class="combat-header">
        <div class="combat-info">
          <span class="combat-round">Round ${this.combat.round}</span>
          <span class="combat-turn">Turn ${this.combat.currentTurn + 1} of ${sortedCombatants.length}</span>
        </div>
        <div class="combat-actions">
          ${this.userRole >= 4 ? `
          <button class="btn" data-action="combat-add-group">+ Grupo</button>
          <button class="btn" data-action="combat-next">Next</button>
          <button class="btn btn-danger" data-action="combat-end">End</button>
          ` : ''}
        </div>
      </div>
      <div class="combat-list">
        ${rows.map((r) => r.html).join('')}
      </div>
    `;
  }

  private renderCombatantItem(combatant: any, isActive: boolean, groups: CombatantGroupSummary[]): string {
    return `
      <div class="combatant-item ${isActive ? 'active' : ''}" data-action="combat-select" data-id="${combatant.id}">
        <div class="combatant-info">
          <div class="combatant-name">${this.escapeHtml(combatant.name)}</div>
          <div class="combatant-initiative">Init: ${combatant.initiative}</div>
          ${this.renderCombatantBuffIcons(combatant.id)}
        </div>
        ${this.userRole >= 4 && groups.length > 0 ? `
        <select class="combatant-group-select" name="group-${combatant.id}" data-action="combat-set-group" data-id="${combatant.id}" title="Mover para grupo">
          <option value="">Sem grupo</option>
          ${groups.map((g) => `<option value="${g.id}"${combatant.groupId === g.id ? ' selected' : ''}>${this.escapeHtml(g.name)}</option>`).join('')}
        </select>
        ` : ''}
        <div class="combatant-hp">
          <input type="number"
                 name="hp-${combatant.id}"
                 value="${combatant.hp}"
                 max="${combatant.maxHp}"
                 min="0"
                 data-action="combat-hp"
                 data-id="${combatant.id}"
                 placeholder="HP"
                 ${this.userRole >= 4 ? '' : 'readonly'} />
          <span class="combatant-max-hp">/ ${combatant.maxHp}</span>
        </div>
      </div>
    `;
  }

  private renderCombatantBuffIcons(combatantId: string): string {
    const buffs = this.combatantBuffs.get(combatantId);
    if (!buffs || buffs.length === 0) return '';
    return `
      <div class="combatant-buffs">
        ${buffs.map((b) => `<span class="combatant-buff-icon" title="${this.escapeHtml(b.name)}">${b.icon ? `<img src="${this.escapeHtml(b.icon)}" alt="${this.escapeHtml(b.name)}" />` : '<i class="fa-solid fa-fa-star"></i>'}</span>`).join('')}
      </div>
    `;
  }

  private renderCombatEmpty(): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-khanda"></i></div>
        <div class="empty-state-title">${t('sidebar.combat')}</div>
        <p>${t('sidebar.emptyCombat')}</p>
        ${this.userRole >= 4 ? `<button class="btn" data-action="combat-start-dex">Start Combat (DEX Initiative)</button>` : ''}
      </div>
    `;
  }

  private renderPlaylistSounds(playlist: PlaylistSummary): string {
    const sounds = playlist.sounds || [];
    return `
      <div class="playlist-sounds">
        ${sounds.map((s) => `
          <div class="playlist-sound-item ${this.playingSoundId === s.id ? 'playing' : ''}" data-sound-id="${s.id}" data-playlist-id="${this.escapeHtml(playlist.id)}">
            <button class="playlist-sound-btn playlist-sound-play" data-action="toggle-sound" data-id="${s.id}" data-path="${this.escapeHtml(s.path)}" title="${this.playingSoundId === s.id ? t('sidebar.soundStop') : t('sidebar.soundPlay')}">
              <i class="fa-solid ${this.playingSoundId === s.id ? 'fa-stop' : 'fa-play'}"></i>
            </button>
            <div class="playlist-sound-name" title="${this.escapeHtml(s.name)}">${this.escapeHtml(s.name)}</div>
            <button class="playlist-sound-btn" data-action="configure-sound" data-id="${s.id}" data-playlist-id="${this.escapeHtml(playlist.id)}" title="${t('sidebar.soundConfigure')}"><i class="fa-solid fa-gear"></i></button>
            <button class="playlist-sound-btn playlist-sound-remove" data-action="delete-sound" data-id="${s.id}" data-playlist-id="${this.escapeHtml(playlist.id)}" title="${t('sidebar.soundRemove')}"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Marks the sidebar as "moving" during the slide.
   *
   * Serves for CSS to turn off the panel's `backdrop-filter` while it moves:
   * background blur over the WebGL canvas is recomposed every frame and drops
   * the transition to very few frames — visually becomes a hard cut.
   *
   * The timer is the mandatory fallback: `transitionend` doesn't fire if the transition
   * is canceled (fast double click on the button) nor if the user has
   * `prefers-reduced-motion`, and the class would be stuck forever.
   */
  private animatingTimer: number | null = null;

  private markAnimating(): void {
    this.element.classList.add('is-animating');
    if (this.animatingTimer !== null) clearTimeout(this.animatingTimer);
    this.animatingTimer = window.setTimeout(() => {
      this.element.classList.remove('is-animating');
      this.animatingTimer = null;
    }, 450);
  }

  protected template(): string {
    const chatTab = `
      <div id="chat-messages" class="sidebar-message-list">
        ${this.messages.map(msg => this.renderMessage(msg)).join('')}
      </div>
      <div class="sidebar-input">
        <div class="sidebar-input-row-top">
          <div class="sidebar-roll-modes">
            ${ROLL_MODES.map(m => `
              <button class="roll-mode-btn${this.activeRollMode === m.id ? ' active' : ''}"
                data-action="roll-mode-${m.id}" title="${m.label}">${m.icon}</button>
            `).join('')}
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
            ${(() => {
        const actor = this.myActorId ? this.actors.find((a) => a.id === this.myActorId) : null;
        const on = this.speakAsActive && !!actor;
        if (!actor) {
          return `<button type="button" class="roll-mode-btn" data-action="toggle-speak-as" disabled
                          title="${t('sidebar.chatSpeakAsNoCharacter')}">
                          <i class="fa-solid fa-masks-theater"></i>
                        </button>`;
        }
        return `<button type="button" class="roll-mode-btn${on ? ' active' : ''}" data-action="toggle-speak-as"
                        title="${on ? actor.name : t('sidebar.chatSpeakAsCharacter')}">
                        <i class="fa-solid fa-masks-theater"></i>
                      </button>`;
      })()}
          </div>
          <div class="sidebar-chat-actions" style="display: flex; gap: 0.35rem;">
            <button class="roll-mode-btn" data-action="export-chat" title="Exportar Histórico"><i class="fa-solid fa-floppy-disk"></i></button>
            ${this.userRole >= 4 ? `<button class="roll-mode-btn" data-action="clear-chat" title="Limpar Histórico" style="color: var(--color-danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </div>
        <div class="sidebar-input-row-middle" style="display: flex; gap: 0.35rem; align-items: center; background: rgba(0,0,0,0.25); padding: 0.35rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: var(--color-text-secondary); border: 1px solid rgba(255,255,255,0.02); margin-bottom: 0.25rem;">
          <span style="font-weight: 600; color: var(--color-accent); font-family: var(--font-display);">Formatação</span>
          <span style="margin: 0 0.15rem; opacity: 0.35;">|</span>
          <button type="button" class="roll-mode-btn" data-action="chat-quick-dice" title="Rolar Dados Rápidos (/r)" style="width: 20px; height: 20px; font-size: 0.75rem;"><i class="rpg-d20"></i></button>
          <button type="button" class="roll-mode-btn" data-action="chat-fmt-image" title="Inserir Imagem" style="width: 20px; height: 20px; font-size: 0.75rem;"><i class="fa-solid fa-image"></i></button>
          <button type="button" class="roll-mode-btn" data-action="chat-fmt-link" title="Link" style="width: 20px; height: 20px; font-size: 0.75rem;"><i class="fa-solid fa-link"></i></button>
          <button type="button" class="roll-mode-btn" data-action="chat-fmt-bold" title="Negrito" style="width: 20px; height: 20px; font-size: 0.75rem;"><i class="fa-solid fa-bold"></i></button>
          <button type="button" class="roll-mode-btn" data-action="chat-fmt-code" title="Código" style="width: 20px; height: 20px; font-size: 0.75rem;"><i class="fa-solid fa-code"></i></button>
        </div>
        <div class="sidebar-input-row-bottom">
          <textarea name="chat-input" placeholder="${t('sidebar.chatPlaceholder')}" rows="3" style="width: 100%;"></textarea>
        </div>
      </div>
    `;

    const emptyActors = t('sidebar.emptyActors');
    const actorsTab = `
      ${this.hasPermission('createActor') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-actor">${t('sidebar.actorCreate')}</button>
            <button class="btn btn-secondary" data-action="create-actor-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('actor', 'Procurar Atores')}
      ${this.actors.length === 0 && this.actorFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-masks-theater"></i></div>
            <div class="empty-state-title">${t('sidebar.actors')}</div>
            <p>${emptyActors}</p>
          </div>`
        : `<div class="sidebar-actor-list directory-list">
            ${this.renderActorListGrouped()}
          </div>`}
    `;

    const itemsTab = `
      ${this.hasPermission('createItem') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-item">${t('sidebar.itemCreate')}</button>
            <button class="btn btn-secondary" data-action="create-item-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('item', 'Procurar Itens')}
      ${this.items.length === 0 && this.itemFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-sack-xmark"></i></div>
            <div class="empty-state-title">${t('sidebar.items')}</div>
            <p>${t('sidebar.emptyItems')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderItemListGrouped()}
          </div>`}
    `;

    const stagesTab = this.userRole < 4 ? '' : `
      <div class="sidebar-header-actions">
        <button class="btn" data-action="create-stage"><i class="fa-solid fa-map"></i> ${t('sidebar.stageCreate')}</button>
        <button class="btn btn-secondary" data-action="create-stage-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
      </div>
      ${this.renderSearchBox('stage', 'Procurar Cenas')}
      ${this.stages.length === 0 && this.stageFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-map"></i></div>
            <div class="empty-state-title">${t('sidebar.stages')}</div>
            <p>${t('sidebar.emptyStages')}</p>
          </div>`
        : `<div class="stage-cards-grid">
            ${this.renderStageListGrouped()}
          </div>`}
    `;

    const journalsTab = `
      ${this.hasPermission('createJournal') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-journal">${t('sidebar.journalCreate')}</button>
            <button class="btn btn-secondary" data-action="create-journal-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('journal', 'Procurar Jornais')}
      ${this.journals.length === 0 && this.journalFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-book-open"></i></div>
            <div class="empty-state-title">${t('sidebar.journals')}</div>
            <p>${t('sidebar.emptyJournals')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderJournalListGrouped()}
          </div>`}
    `;

    const decksTab = `
      ${this.hasPermission('createDeck') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-deck">${t('sidebar.deckCreate')}</button>
            <button class="btn btn-secondary" data-action="create-deck-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('deck', 'Procurar Baralhos')}
      ${this.decks.length === 0 && this.deckFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-clone"></i></div>
            <div class="empty-state-title">${t('sidebar.decks')}</div>
            <p>${t('sidebar.emptyDecks')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderDeckListGrouped()}
          </div>`}
    `;

    const tablesTab = `
      ${this.userRole >= 4 ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-roll-table">Nova Tabela</button>
          </div>` : ''}
      ${this.rollTables.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-dice"></i></div>
            <div class="empty-state-title">Tabelas de Rolagem</div>
            <p>Nenhuma tabela criada ainda.</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.rollTables.map((table) => `
              <div class="sidebar-actor-item" data-action="open-roll-table" data-entity-type="rolltable" data-id="${this.escapeHtml(table.id)}" draggable="true">
                <div class="sidebar-actor-avatar" style="${table.imgUrl ? `background-image:url('${this.escapeHtml(table.imgUrl)}')` : ''}">
                  ${table.imgUrl ? '' : '<i class="fa-solid fa-dice"></i>'}
                </div>
                <div class="sidebar-actor-name">${this.escapeHtml(table.name)}</div>
                <div class="sidebar-actor-meta">${this.escapeHtml(table.formula || '')}</div>
              </div>
            `).join('')}
          </div>`}
    `;

    const macrosTab = `
      ${this.hasPermission('createMacro') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-macro">${t('common.macroCreate')}</button>
            <button class="btn btn-secondary" data-action="create-macro-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('macro', 'Procurar Macros')}
      ${this.macros.length === 0 && this.macroFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-bolt"></i></div>
            <div class="empty-state-title">${t('sidebar.macrosTab')}</div>
            <p>${t('sidebar.emptyMacros')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderMacroListGrouped()}
          </div>`}
    `;

    const playlistsTab = `
      <div class="sidebar-volume-section">
        <div class="sidebar-volume-row">
          <label class="sidebar-volume-label"><i class="fa-solid fa-volume-high"></i> Geral</label>
          <input type="range" class="sidebar-volume-slider" data-volume="master" min="0" max="1" step="0.05" value="${this.volumeMaster}" />
          <span class="sidebar-volume-value" data-volume-label="master">${Math.round(this.volumeMaster * 100)}%</span>
        </div>
        <div class="sidebar-volume-row">
          <label class="sidebar-volume-label"><i class="fa-solid fa-music"></i> Música</label>
          <input type="range" class="sidebar-volume-slider" data-volume="music" min="0" max="1" step="0.05" value="${this.volumeMusic}" />
          <span class="sidebar-volume-value" data-volume-label="music">${Math.round(this.volumeMusic * 100)}%</span>
        </div>
        <div class="sidebar-volume-row">
          <label class="sidebar-volume-label"><i class="fa-solid fa-leaf"></i> Ambiente</label>
          <input type="range" class="sidebar-volume-slider" data-volume="ambient" min="0" max="1" step="0.05" value="${this.volumeAmbient}" />
          <span class="sidebar-volume-value" data-volume-label="ambient">${Math.round(this.volumeAmbient * 100)}%</span>
        </div>
      </div>
      ${this.hasPermission('createPlaylist') ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-playlist">${t('sidebar.playlistCreate')}</button>
            <button class="btn btn-secondary" data-action="create-playlist-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('playlist', 'Procurar Playlists')}
      ${this.playlists.length === 0 && this.playlistFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-music"></i></div>
            <div class="empty-state-title">${t('sidebar.playlistsTab')}</div>
            <p>${t('sidebar.emptyPlaylists')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderPlaylistListGrouped()}
          </div>`}
    `;

    const canEditCompendium = this.hasPermission('compendiumEdit');
    const compendiumTab = `
      ${canEditCompendium ? `<div class="sidebar-header-actions">
            <button class="btn" data-action="create-compendium-pack">${t('sidebar.compendiumCreate')}</button>
            <button class="btn btn-secondary" data-action="create-compendium-folder" title="Nova Pasta"><i class="fa-solid fa-folder-plus"></i></button>
          </div>` : ''}
      ${this.renderSearchBox('compendium', 'Procurar Compêndios')}
      ${this.compendiumPacks.length === 0 && this.compendiumFolders.length === 0
        ? `<div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-book-atlas"></i></div>
            <div class="empty-state-title">${t('sidebar.compendium')}</div>
            <p>${t('sidebar.emptyCompendium')}</p>
          </div>`
        : `<div class="sidebar-actor-list">
            ${this.renderCompendiumListGrouped()}
          </div>`}
      ${this.compendiumSources.length > 0 ? `
        <div class="sidebar-section-label">Compêndios do Sistema/Addons</div>
        <div class="sidebar-actor-list">
          ${this.compendiumSources.map((s) => this.renderCompendiumSourceItem(s)).join('')}
        </div>
      ` : ''}
    `;

    const combatTab = `
      ${this.combat ? this.renderCombatActive() : this.renderCombatEmpty()}
    `;

    const placeablesTab = this.renderPlaceablesTab();

    const settingsTab = `
      ${this.system ? `
        <div class="sidebar-manifest-header">
          <div class="sidebar-manifest-title">LoomVTT</div>
          <div class="sidebar-manifest-version">Version ${appVersion}</div>
          ${appVersion.includes('build') ? `<div class="sidebar-manifest-build">${appVersion}</div>` : ''}
          <div class="sidebar-manifest-system">${this.system.title}   ${this.system.version}</div>
          <div class="sidebar-manifest-links">
            ${this.system.changelogUrl ? `<a href="${this.system.changelogUrl}" target="_blank" rel="noopener">Notas de Atualização</a>` : ''}
            ${this.system.wikiUrl ? `<a href="${this.system.wikiUrl}" target="_blank" rel="noopener">Wiki</a>` : ''}
            ${this.system.bugsUrl ? `<a href="${this.system.bugsUrl}" target="_blank" rel="noopener">Problemas</a>` : ''}
          </div>
          <div class="sidebar-manifest-modules">Módulos Ativos: ${this.modules.length}</div>
        </div>
      ` : ''}
      <div class="sidebar-settings-panel">
        ${this.userRole >= 4 ? `
          <h3 class="sidebar-settings-section-title">Gestão</h3>
          <div class="sidebar-settings-menu">
            <button class="btn btn-block" data-action="open-tours"><i class="fa-solid fa-clapperboard"></i> Apresentações</button>
            <button class="btn btn-block" data-action="open-keybind-config"><i class="fa-solid fa-keyboard"></i> Atalhos de Teclado</button>
            <button class="btn btn-block" data-action="open-module-management"><i class="fa-solid fa-cube"></i> Módulos</button>
            <button class="btn" data-action="open-invite-links" style="width:100%"><i class="fa-solid fa-id-card"></i> Links de Convite</button>
            <button class="btn" data-action="open-world-config" style="width:100%"><i class="fa-solid fa-earth-americas"></i> Configuração do Mundo</button>
            <button class="btn btn-block" data-action="open-game-config"><i class="fa-solid fa-gear"></i> Configurações</button>
            <button class="btn btn-block" data-action="open-user-management"><i class="fa-solid fa-users"></i> Usuários</button>
            <button class="btn btn-block" data-action="create-discord-room"><i class="fa-solid fa-microphone"></i> Criar Sala Discord</button>
            <button class="btn btn-block" data-action="open-bug-report"><i class="fa-solid fa-bug"></i> Bug Tracker</button>
          </div>
        ` : ''}

        <h3 class="sidebar-settings-section-title">${t('sidebar.settingsGameAccess')}</h3>
        <div class="sidebar-settings-menu">
          <button class="btn" data-action="logout" style="width:100%"><i class="fa-solid fa-right-from-bracket"></i> ${t('sidebar.settingsLogout')}</button>

          ${this.userRole >= 4 ? `
            <div class="sidebar-settings-item">
              <div class="sidebar-settings-item-label">${t('sidebar.settingsReturnToSetup')}</div>
              <p>${t('sidebar.settingsReturnToSetupDesc')}</p>
              ${this.hasAdminSession ? '' : `
                <div class="form-group">
                  <input type="password" name="return-to-setup-password" placeholder="${t('sidebar.settingsAdminPasswordPrompt')}" />
                </div>
              `}
              <button class="btn btn-danger" data-action="return-to-setup" style="width:100%"><i class="fa-solid fa-lock"></i> ${t('sidebar.settingsReturnToSetup')}</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    let navHtml = this.tabs.navTemplate({ iconOnly: true });
    // Highlight combat button when a combat encounter is active
    if (this.combat) {
      navHtml = navHtml.replace('data-tab="combat"', 'data-tab="combat" data-combat-active="true"');
    }

    const collapseIcon = this.collapsed ? '◀' : '▶';
    const collapseButton = `
      <button class="sidebar-collapse-btn" data-action="sidebar-toggle" title="Expandir/Recolher">
        ${collapseIcon}
      </button>
    `;
    const collapsedIconsBlock = `<div class="sidebar-tabs-collapsed-icons">${this.collapsedIconsTemplate()}</div>`;
    navHtml = navHtml.replace('</div>', `${collapseButton}${collapsedIconsBlock}</div>`);

    const hideStages = !this.hasPermission('viewStages');
    const availableCodexTabs = CODEX_SUBTABS.filter((t) => (t.id as string) !== 'stages' || !hideStages);

    const activeSubtab = CODEX_SUBTABS.find(st => st.id === this.activeCodexTab) || CODEX_SUBTABS[0];

    const codexNavHtml = `
      <div class="codex-subtabs-bar">
        ${availableCodexTabs.map(st => `
          <button type="button" class="codex-subtab-btn ${this.activeCodexTab === st.id ? 'active' : ''}"
                  data-action="codex-subtab" data-id="${st.id}" title="${st.label}">
            <i class="${st.icon}"></i>
          </button>
        `).join('')}
      </div>
      <div class="codex-active-header">
        <span class="codex-active-title"><i class="${activeSubtab.icon}"></i> ${activeSubtab.label}</span>
      </div>
    `;

    let activeCodexContent = actorsTab;
    if (this.activeCodexTab === 'items') activeCodexContent = itemsTab;
    else if (this.activeCodexTab === 'journals') activeCodexContent = journalsTab;
    else if (this.activeCodexTab === 'compendium') activeCodexContent = compendiumTab;
    else if (this.activeCodexTab === 'stages') activeCodexContent = stagesTab;
    else if (this.activeCodexTab === 'placeables') activeCodexContent = placeablesTab;
    else if (this.activeCodexTab === 'tables') activeCodexContent = tablesTab;
    else if (this.activeCodexTab === 'decks') activeCodexContent = decksTab;
    else if (this.activeCodexTab === 'macros') activeCodexContent = macrosTab;

    const codexTab = `
      <div class="codex-panel-container">
        ${codexNavHtml}
        <div class="codex-panel-body">
          ${activeCodexContent}
        </div>
      </div>
    `;

    return `
      ${navHtml}
      ${this.tabs.contentWrapper('chat', chatTab)}
      ${this.tabs.contentWrapper('combat', combatTab)}
      ${this.tabs.contentWrapper('codex', codexTab)}
      ${this.tabs.contentWrapper('playlists', playlistsTab)}
      ${this.tabs.contentWrapper('settings', settingsTab)}
    `;
  }

  private entityListRefs: Record<EntityType, { endpoint: string; list: () => any[]; markStale: () => void }> = {
    actor: { endpoint: '/actors', list: () => this.actors, markStale: () => { this.actorsLoaded = false; } },
    item: { endpoint: '/items', list: () => this.items, markStale: () => { this.itemsLoaded = false; } },
    journal: { endpoint: '/journals', list: () => this.journals, markStale: () => { this.journalsLoaded = false; } },
    stage: { endpoint: '/stages', list: () => this.stages, markStale: () => { this.stagesLoaded = false; } },
    deck: { endpoint: '/decks', list: () => this.decks, markStale: () => { this.decksLoaded = false; } },
    macro: { endpoint: '/macros', list: () => this.macros, markStale: () => { this.macrosLoaded = false; } },
    playlist: { endpoint: '/playlists', list: () => this.playlists, markStale: () => { this.playlistsLoaded = false; } },
    compendium: { endpoint: '/compendium', list: () => this.compendiumPacks, markStale: () => { this.compendiumPacksLoaded = false; } },
  };

  private openEntity(type: EntityType, id: string): void {
    if (type === 'actor') {
      const actor = this.actors.find(a => a.id === id);
      const typeName = actor?.type || '*';
      const SheetClass = resolveSheetClass('actor', typeName, ActorSheetWindow);
      windowManager.open(`actor-sheet-${id}`, SheetClass, { actorId: id, worldId: this.worldId });
    } else if (type === 'item') {
      const item = this.items.find(i => i.id === id);
      const typeName = item?.type || '*';
      const SheetClass = resolveSheetClass('item', typeName, ItemSheetWindow);
      windowManager.open(`item-sheet-${id}`, SheetClass, { itemId: id });
    } else if (type === 'journal') windowManager.open(`journal-${id}`, JournalWindow, { journalId: id });
    else if (type === 'stage') {
      void api.get<any>(`/stages/${id}`).then((stage) => {
        windowManager.open(`stage-config-${id}`, StageConfigWindow, {
          stage,
          onSaved: () => { this.stagesLoaded = false; void this.loadStages().then(() => this.render()); },
          worldId: this.worldId,
        });
      });
    } else if (type === 'compendium') {
      windowManager.open(`compendium-pack-${id}`, CompendiumPackWindow, { packId: id });
    }
  }

  private showEntityContextMenu(type: EntityType, id: string, event: MouseEvent): void {
    const items: ContextMenuItem[] = [
      { icon: '<i class="fa-solid fa-pen-to-square"></i>', label: 'Editar', action: () => this.openEntity(type, id) },
      { icon: '<i class="fa-solid fa-copy"></i>', label: 'Duplicar', action: () => void this.duplicateEntity(type, id) },
      { icon: '<i class="fa-solid fa-download"></i>', label: 'Exportar Dados', action: () => void this.exportEntity(type, id) },
      { divider: true, label: '' },
      { icon: '<i class="fa-solid fa-trash"></i>', label: 'Excluir', danger: true, action: () => void this.deleteEntity(type, id) },
    ];
    if (type === 'stage') {
      items.unshift(
        {
          icon: '<i class="fa-solid fa-circle-play"></i>',
          label: 'Ativar (Todos os Jogadores)',
          action: () => {
            wsClient.send('stage.activate', { stageId: id, worldId: this.worldId });
          }
        },
        {
          icon: '<i class="fa-solid fa-eye"></i>',
          label: 'Visualizar (Apenas GM)',
          action: () => {
            window.dispatchEvent(new CustomEvent('preview-stage', { detail: { stageId: id } }));
          }
        }
      );
      items.splice(3, 0, {
        icon: '<i class="fa-solid fa-image"></i>',
        label: 'Gerar Miniatura',
        action: () => {
          const stage = this.stages.find(s => s.id === id);
          if (!stage?.backgroundUrl) { showToast('Cena sem imagem de fundo', 'info'); return; }
          showToast('Miniatura gerada a partir da imagem de fundo', 'success');
        },
      });
    }
    if (type === 'actor') {
      items.splice(3, 0, {
        icon: '<i class="fa-solid fa-user"></i>',
        label: 'Criar Token na Cena',
        action: () => void this.createActorToken(id),
      });
    }
    if (type === 'macro') {
      items.unshift({
        icon: '<i class="fa-solid fa-play"></i>',
        label: 'Executar Macro',
        action: () => {
          const macro = this.macros.find(m => m.id === id);
          if (macro) void executeMacro(macro, this.worldId);
        },
      });
    }
    if (type === 'actor' || type === 'item' || type === 'journal') {
      items.splice(3, 0, {
        icon: '<i class="fa-solid fa-folder"></i>',
        label: 'Mover para Pasta',
        action: () => void this.moveEntityToFolder(type, id),
      });
    }
    // Ownership only exists for actor/item/journal, and only GM
    // configures it — normal player has no reason to decide who sees what.
    if ((type === 'actor' || type === 'item' || type === 'journal') && this.userRole >= 4) {
      const apiRoute = type === 'actor' ? '/actors' : type === 'item' ? '/items' : '/journals';
      const list = type === 'actor' ? this.actors : type === 'item' ? this.items : this.journals;
      items.splice(4, 0, {
        icon: '<i class="fa-solid fa-user-group"></i>',
        label: 'Configurar Propriedade',
        action: () => {
          const entity = (list as any[]).find(e => e.id === id);
          windowManager.open(`ownership-config-${id}`, OwnershipConfigWindow, {
            worldId: this.worldId,
            documentId: id,
            apiRoute,
            ownership: entity?.ownership || {},
            onSaved: (ownership: Record<string, number>) => {
              if (entity) entity.ownership = ownership;
            },
          });
        },
      });
    }
    showContextMenu(event, items);
  }

  private async duplicateEntity(type: EntityType, id: string): Promise<void> {
    const { endpoint, markStale } = this.entityListRefs[type];
    try {
      const original = await api.get<any>(`${endpoint}/${id}`);
      const { id: _omit, createdAt, updatedAt, ...rest } = original;
      const copy = await api.post<any>(endpoint, { ...rest, name: `${original.name} (Cópia)`, worldId: this.worldId });
      markStale();
      await this.reloadEntityList(type);
      this.render();
      showToast(`"${original.name}" duplicado`, 'success');
      void copy;
    } catch (e: any) {
      showToast(e?.message || 'Erro ao duplicar', 'error');
    }
  }

  private async createActorToken(actorId: string): Promise<void> {
    const stageId = this.gameHud?.initState?.activeStage?.id;
    if (!stageId) {
      showToast('Nenhuma cena ativa', 'error');
      return;
    }
    try {
      const actor = await api.get<any>(`/actors/${actorId}`);
      const grid = this.gameHud?.canvasManager?.getGridSize() || 50;
      const x = grid * 2;
      const y = grid * 2;
      await api.post('/cast', {
        actorId,
        isLinked: true,
        name: actor.name,
        avatarUrl: actor.avatarUrl || '',
        x,
        y,
        stageId,
        worldId: this.worldId,
      });
      showToast(`Token "${actor.name}" criado na cena`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar token', 'error');
    }
  }

  private async exportEntity(type: EntityType, id: string): Promise<void> {
    const { endpoint } = this.entityListRefs[type];
    try {
      const data = await api.get<any>(`${endpoint}/${id}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.name || type).replace(/[^a-z0-9-_]+/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao exportar dados', 'error');
    }
  }

  private async deleteEntity(type: EntityType, id: string): Promise<void> {
    const { endpoint, list, markStale } = this.entityListRefs[type];
    const entity = list().find((e: any) => e.id === id);
    const confirmed = await showConfirm('Excluir', `Remover "${entity?.name ?? id}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      markStale();
      await this.reloadEntityList(type);
      this.render();
      showToast('Removido com sucesso', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover', 'error');
    }
  }

  private async reloadEntityList(type: EntityType): Promise<void> {
    if (type === 'actor') await this.loadActors();
    else if (type === 'item') await this.loadItems();
    else if (type === 'journal') await this.loadJournals();
    else if (type === 'stage') await this.loadStages();
    else if (type === 'compendium') await this.loadCompendiumPacks();
  }

  private async addSound(playlistId: string): Promise<void> {
    const path = await new FilePicker({ type: 'audio', worldId: this.worldId }).browse();
    if (!path) return;
    const fileName = path.split('/').pop() || path;
    const name = fileName.replace(/\.[^.]+$/, '');
    try {
      await api.post(`/playlists/${playlistId}/sounds`, { name, path, volume: 0.5, loop: false, fadeIn: 0, fadeOut: 0 });
      await this.reloadPlaylistSounds(playlistId);
      showToast(t('sidebar.soundAdded'), 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao adicionar som', 'error');
    }
  }

  private async deletePlaylistSound(playlistId: string, soundId: string): Promise<void> {
    const confirmed = await showConfirm('Excluir Som', 'Deseja remover este som da playlist?');
    if (!confirmed) return;
    try {
      await api.delete(`/playlists/${playlistId}/sounds/${soundId}`);
      await this.reloadPlaylistSounds(playlistId);
      showToast('Som removido', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover som', 'error');
    }
  }

  protected onRender(): void {
    // CONFIG.ui.sidebar: whole-container override point (distinct from the
    // per-tab entries below) — same decorate-only pattern, scoped to the
    // entire sidebar element instead of one `[data-tab]` block.
    applyUiOverride('sidebar', this.element, { options: { worldId: this.worldId, userRole: this.userRole } });

    const options = { worldId: this.worldId, userRole: this.userRole };
    applyUiOverride('actors', this.element.querySelector('.sidebar-actor-list'), { actors: this.actors, folders: this.actorFolders, options });

    // Same pattern as ActorDirectory above, for the other panels registrable via
    // `CONFIG.ui.*` (25/08/2026 — deduped to use the shared `applyUiOverride` helper
    // instead of a hand-copied version of it). Each entry only decorates the
    // already-rendered `[data-tab="X"]` block — never replaces the native template.
    const otherPanels: Array<{ key: string; tab: string; context: () => Record<string, any> }> = [
      { key: 'decks', tab: 'decks', context: () => ({ decks: this.decks, folders: this.deckFolders }) },
      { key: 'chat', tab: 'chat', context: () => ({}) },
      { key: 'combat', tab: 'combat', context: () => ({}) },
      { key: 'compendium', tab: 'compendium', context: () => ({ packs: this.compendiumPacks }) },
      { key: 'items', tab: 'items', context: () => ({ items: this.items, folders: this.itemFolders }) },
      { key: 'journals', tab: 'journals', context: () => ({ journals: this.journals, folders: this.journalFolders }) },
      { key: 'macros', tab: 'macros', context: () => ({ macros: this.macros }) },
      { key: 'playlists', tab: 'playlists', context: () => ({ playlists: this.playlists }) },
      { key: 'stages', tab: 'stages', context: () => ({ scenes: this.stages }) },
      { key: 'settings', tab: 'settings', context: () => ({}) },
      { key: 'tables', tab: 'tables', context: () => ({ tables: this.rollTables }) },
      // `placeables`: config.ts documented this as covered "see ui-override.ts" since
      // 21/08/2026, but no caller ever existed — the search box below never called it.
      { key: 'placeables', tab: 'placeables', context: () => ({ query: this.placeablesQuery }) },
    ];
    for (const panel of otherPanels) {
      applyUiOverride(panel.key, this.element.querySelector(`[data-tab="${panel.tab}"]`), { ...panel.context(), options });
    }

    // "Search X" boxes of each directory tab + the search in the Placeables tab.
    // Typing cannot lose focus/cursor on every key — saves the cursor position
    // before the full render() and restores it in the same input afterwards.
    for (const input of this.element.querySelectorAll<HTMLInputElement>('[data-search-type]')) {
      input.addEventListener('input', () => {
        const type = input.dataset.searchType!;
        const cursorPos = input.selectionStart;
        if (type === 'placeables') {
          this.placeablesQuery = input.value;
        } else {
          this.searchQueries[type as EntityType] = input.value;
        }
        this.render();
        const restored = this.element.querySelector<HTMLInputElement>(`[data-search-type="${type}"]`);
        if (restored) {
          restored.focus();
          restored.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    for (const row of this.element.querySelectorAll<HTMLElement>('.sidebar-placeable-item')) {
      const id = row.getAttribute('data-id');
      const type = row.getAttribute('data-placeable-type');
      row.addEventListener('dblclick', () => {
        if (id && type) this.openPlaceableConfig(id, type);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!id || !type) return;
        showContextMenu(e, [
          {
            icon: '<i class="fa-solid fa-crosshairs"></i>',
            label: 'Selecionar no Canvas',
            action: () => row.dispatchEvent(new MouseEvent('click', { bubbles: true })),
          },
          {
            icon: '<i class="fa-solid fa-gear"></i>',
            label: 'Configurar',
            action: () => this.openPlaceableConfig(id, type),
          },
        ]);
      });
    }

    for (const item of this.element.querySelectorAll<HTMLElement>('[data-action="toggle-playlist-expand"]')) {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = item.getAttribute('data-id')!;
        showContextMenu(e, [
          { icon: '<i class="fa-solid fa-plus"></i>', label: t('sidebar.soundAdd'), action: () => void this.addSound(id) },
          { icon: '<i class="fa-solid fa-gear"></i>', label: 'Configurar', action: () => this.openPlaylistConfig(id) },
          { divider: true, label: '' },
          {
            icon: '<i class="fa-solid fa-trash"></i>', label: 'Excluir', danger: true, action: () => {
              void showConfirm('Excluir Playlist', 'Deseja remover esta playlist?').then((confirmed) => {
                if (!confirmed) return;
                api.delete(`/playlists/${id}`).then(() => {
                  this.playlistsLoaded = false;
                  void this.loadPlaylists().then(() => this.render());
                  showToast('Playlist removida', 'success');
                }).catch((e: any) => showToast(e?.message || 'Erro ao remover playlist', 'error'));
              });
            }
          },
        ]);
      });
    }
    for (const row of this.element.querySelectorAll<HTMLElement>('[data-sound-id]')) {
      row.addEventListener('dblclick', (e) => {
        const id = row.getAttribute('data-sound-id')!;
        const playlistId = row.getAttribute('data-playlist-id')!;
        this.openSoundConfig(playlistId, id);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = row.getAttribute('data-sound-id')!;
        const playlistId = row.getAttribute('data-playlist-id')!;
        showContextMenu(e, [
          { icon: '<i class="fa-solid fa-gear"></i>', label: 'Configurar', action: () => this.openSoundConfig(playlistId, id) },
          { divider: true, label: '' },
          { icon: '<i class="fa-solid fa-trash"></i>', label: 'Excluir', danger: true, action: () => void this.deletePlaylistSound(playlistId, id) },
        ]);
      });
    }
    for (const slider of this.element.querySelectorAll<HTMLInputElement>('.sidebar-volume-slider')) {
      slider.addEventListener('input', () => {
        const channel = slider.dataset.volume as string;
        const value = parseFloat(slider.value);
        const label = this.element.querySelector(`[data-volume-label="${channel}"]`);
        if (label) label.textContent = Math.round(value * 100) + '%';
        switch (channel) {
          case 'master': {
            this.volumeMaster = value;
            window.dispatchEvent(new CustomEvent('volume-change', { detail: { volume: value } }));
            if (this.currentAudio) {
              this.currentAudio.volume = value * this.volumeMusic;
            }
            break;
          }
          case 'music': {
            this.volumeMusic = value;
            if (this.currentAudio) {
              this.currentAudio.volume = value * this.volumeMaster;
            }
            break;
          }
          case 'ambient': {
            this.volumeAmbient = value;
            window.dispatchEvent(new CustomEvent('ambient-volume-change', { detail: { volume: value } }));
            break;
          }
        }
      });
    }
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'pan-to-placeable' && id) {
      const type = target.getAttribute('data-placeable-type') || '';
      const found = this.findPlaceable(id, type);
      const canvasManager = (this.gameHud as any)?.canvasManager;
      if (found) {
        const x = 'x1' in found ? (found.x1 + found.x2) / 2 : found.x;
        const y = 'y1' in found ? (found.y1 + found.y2) / 2 : found.y;
        canvasManager?.panToPoint(x, y);
      }
      // Swaps to the selection tool of the right type and already selects the
      // element — clicking on the list should equal clicking on it on the canvas.
      const toolByType: Record<string, string> = {
        token: 'select-token', tile: 'select-tile', wall: 'select-wall',
        light: 'select-light', drawing: 'select-drawing', note: 'select-note',
      };
      (this.gameHud as any)?.subcomponents?.toolbox?.setActiveTool?.(toolByType[type] ?? 'select-token');
      if (type === 'token') canvasManager?.selectToken?.(id);
      else if (type === 'tile') canvasManager?.selectTile?.(id);
      else if (type === 'wall') canvasManager?.selectWall?.(id);
      else if (type === 'light') canvasManager?.selectLight?.(id);
      else if (type === 'drawing') canvasManager?.selectDrawing?.(id);
      return;
    }
    if (action === 'toggle-placeable-group') {
      const group = target.getAttribute('data-group');
      if (group) {
        if (this.placeablesHiddenGroups.has(group)) this.placeablesHiddenGroups.delete(group);
        else this.placeablesHiddenGroups.add(group);
        this.render();
      }
      return;
    }
    if (action === 'sidebar-toggle') {
      this.collapsed = !this.collapsed;
      this.markAnimating();
      // 1a. Toggle directly via classList, no this.render()
      this.element.classList.toggle('collapsed', this.collapsed);
      // The button's arrow is mounted in the template (line ~1210, `this.collapsed ? '◀' : '▶'`).
      // Since this path stopped calling render() — on purpose, so as not to destroy
      // the content mid-transition — it needs to be updated by hand, otherwise
      // it stays pointing the wrong way until the next re-render for another reason.
      const collapseBtn = this.element.querySelector('.sidebar-collapse-btn');
      if (collapseBtn) collapseBtn.textContent = this.collapsed ? '◀' : '▶';
      this.updateCollapsedOverlayVisibility();
      if (!this.collapsed && this.tabs.active === 'chat') this.updateChatDisplay();
    } else if (this.tabs.handleAction(action)) {
      if (this.collapsed) {
        this.collapsed = false;
        // 1b. Remove collapsed class before rendering
        this.element.classList.remove('collapsed');
        this.updateCollapsedOverlayVisibility();
      }
      this.render();
      if (this.tabs.active === 'chat') this.updateChatDisplay();
      void this.onTabSwitched(this.tabs.active);
    } else if (action === 'codex-subtab' && id) {
      this.activeCodexTab = id as CodexSubtab;
      this.render();
      void this.onTabSwitched(id);
      return;
    } else if (action.startsWith('roll-mode-')) {
      const mode = action.replace('roll-mode-', '') as RollMode;
      if (ROLL_MODES.some(m => m.id === mode)) {
        this.activeRollMode = mode;
        this.render();
      }
    } else if (action === 'toggle-speak-as') {
      // this.render() instead of punctual DOM update: there are two copies
      // of the button now (expanded panel + collapsed tabs column), a
      // querySelector would only grab the first and leave the other outdated.
      if (!this.myActorId) return;
      this.speakAsActive = !this.speakAsActive;
      this.applySpeakAs();
      this.render();
      return;
    } else if (action === 'send-chat') {
      this.sendChatMessage();
    } else if (action === 'export-chat') {
      const chatText = this.messages.map(m => `[${this.formatTime(m.timestamp)}] ${m.userName}: ${m.content}`).join('\n');
      const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-log-${this.worldId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (action === 'clear-chat') {
      void showConfirm('Limpar Chat', 'Deseja limpar todo o histórico do chat pra todo mundo? Não dá pra desfazer.').then(async (confirmed) => {
        if (!confirmed) return;
        try {
          await api.delete(`/chat-messages?worldId=${this.worldId}`);
          this.messages = [];
          this.updateChatDisplay();
          showToast('Histórico limpo', 'success');
        } catch (err: any) {
          // Actual server message in the toast — "generic error + nothing in the log" already
          // cost an entire debugging session
          showToast(`Erro ao limpar histórico: ${err?.message || err}`, 'error');
        }
      });
    } else if (action === 'chat-fmt-bold' || action === 'chat-fmt-code' || action === 'chat-fmt-link') {
      const textarea = target.closest<HTMLElement>('.sidebar-input, .sidebar-collapsed-editor')
        ?.querySelector<HTMLTextAreaElement>('textarea[name^="chat-input"]');
      if (textarea) this.applyChatFormat(textarea, action === 'chat-fmt-bold' ? 'bold' : action === 'chat-fmt-code' ? 'code' : 'link');
    } else if (action === 'chat-fmt-image') {
      const textarea = target.closest<HTMLElement>('.sidebar-input, .sidebar-collapsed-editor')
        ?.querySelector<HTMLTextAreaElement>('textarea[name^="chat-input"]');
      if (textarea) this.pickChatImage(textarea);
    } else if (action === 'chat-quick-dice') {
      const textarea = target.closest<HTMLElement>('.sidebar-input, .sidebar-collapsed-editor')
        ?.querySelector<HTMLTextAreaElement>('textarea[name^="chat-input"]');
      const rect = target.getBoundingClientRect();
      const diceOptions: { formula: string; icon: string }[] = [
        { formula: '1d20', icon: '<i class="rpg-d20"></i>' },
        { formula: '2d6',  icon: '<i class="rpg-d6"></i>' },
        { formula: '1d100', icon: '<i class="rpg-d10"></i>' },
        { formula: '1d12', icon: '<i class="rpg-d12"></i>' },
        { formula: '1d10', icon: '<i class="rpg-d10"></i>' },
        { formula: '1d8',  icon: '<i class="rpg-d8"></i>' },
        { formula: '1d6',  icon: '<i class="rpg-d6"></i>' },
        { formula: '1d4',  icon: '<i class="rpg-d4"></i>' },
      ];
      const items: ContextMenuItem[] = diceOptions.map((opt) => ({
        icon: opt.icon,
        label: `/r ${opt.formula}`,
        action: () => {
          if (textarea) {
            textarea.value = `/r ${opt.formula}`;
            this.sendChatMessage(textarea);
          } else {
            wsClient.send('chat.roll', {
              worldId: this.worldId,
              userId: this.userId,
              userName: this.session?.userName || 'Anonymous',
              userColor: this.session?.userColor || '#888',
              formula: opt.formula,
              mode: this.activeRollMode,
            });
          }
        },
      }));
      items.push({ divider: true, label: '' });
      items.push({
        icon: '<i class="fa-solid fa-pen"></i>',
        label: 'Inserir comando /r',
        action: () => {
          if (textarea) {
            textarea.value = '/r ';
            textarea.focus();
          }
        },
      });
      showContextMenu(new MouseEvent('contextmenu', { clientX: rect.left, clientY: rect.bottom }), items);
    } else if (action === 'delete-message' && id) {
      void this.deleteChatMessage(id);
    } else if (action === 'toggle-dice-tooltip') {
      // Generic for any roll card (native or converted system)
      // with `.dice-roll > .dice-tooltip` — expands/collapses the detail per die.
      target.closest('.dice-roll')?.classList.toggle('expanded');
    } else if (action === 'open-actor' && id) {
      const actor = this.actors.find(a => a.id === id);
      const typeName = actor?.type || '*';
      const SheetClass = resolveSheetClass('actor', typeName, ActorSheetWindow);
      windowManager.open(`actor-sheet-${id}`, SheetClass, { actorId: id, worldId: this.worldId });
    } else if (action === 'create-actor') {
      this.createActor();
    } else if (action === 'create-actor-folder') {
      void this.createFolder('actor');
    } else if (action === 'create-item-folder') {
      void this.createFolder('item');
    } else if (action === 'create-journal-folder') {
      void this.createFolder('journal');
    } else if (action === 'create-stage-folder') {
      void this.createFolder('stage');
    } else if (action === 'create-deck-folder') {
      void this.createFolder('deck');
    } else if (action === 'create-macro-folder') {
      void this.createFolder('macro');
    } else if (action === 'create-playlist-folder') {
      void this.createFolder('playlist');
    } else if (action === 'create-compendium-folder') {
      void this.createFolder('compendium');
    } else if (action === 'toggle-folder' && id) {
      if (this.collapsedFolders.has(id)) this.collapsedFolders.delete(id);
      else this.collapsedFolders.add(id);
      this.render();
    } else if (action === 'create-subfolder' && id) {
      const type = target.getAttribute('data-type') as EntityType;
      if (type) void this.createFolder(type, id);
    } else if (action === 'create-entry' && id) {
      const type = target.getAttribute('data-type') as EntityType;
      if (type === 'actor') void this.createActor(id);
      else if (type === 'item') void this.createItem(id);
      else if (type === 'journal') void this.createJournal(id);
      else if (type === 'stage') void this.createStage(id);
      else if (type === 'deck') void this.createDeck(id);
      else if (type === 'macro') void this.createMacro(id);
      else if (type === 'playlist') void this.createPlaylist(id);
      else if (type === 'compendium') void this.createCompendiumPack(id);
    } else if (action === 'open-stage' && id) {
      this.openEntity('stage', id);
    } else if (action === 'toggle-stage-group' && id) {
      if (this.expandedMapStages.has(id)) this.expandedMapStages.delete(id);
      else this.expandedMapStages.add(id);
      this.render();
    } else if (action === 'create-stage') {
      this.createStage();
    } else if (action === 'open-item' && id) {
      const itemType = this.items.find((i) => i.id === id)?.type ?? '*';
      const SheetClass = resolveSheetClass('item', itemType, ItemSheetWindow);
      windowManager.open(`item-sheet-${id}`, SheetClass, { itemId: id });
    } else if (action === 'create-item') {
      this.createItem();
    } else if (action === 'open-journal' && id) {
      windowManager.open(`journal-${id}`, JournalWindow, { journalId: id });
    } else if (action === 'open-deck' && id) {
      windowManager.open(`deck-sheet-${id}`, DeckSheetWindow, { deckId: id });
    } else if (action === 'open-roll-table' && id) {
      windowManager.open(`roll-table-${id}`, RollTableWindow, { tableId: id, worldId: this.worldId });
    } else if (action === 'create-roll-table') {
      void this.createRollTable();
    } else if (action === 'create-journal') {
      this.createJournal();
    } else if (action === 'create-deck') {
      this.createDeck();
    } else if (action === 'create-macro') {
      this.createMacro();
    } else if (action === 'open-macro' && id) {
      this.openMacro(id);
    } else if (action === 'create-playlist') {
      this.createPlaylist();
    } else if (action === 'toggle-playlist-expand' && id) {
      void this.togglePlaylistExpand(id);
    } else if (action === 'toggle-sound' && id) {
      const path = target.getAttribute('data-path');
      if (path) this.toggleSound(id, path);
    } else if (action === 'configure-playlist' && id) {
      this.openPlaylistConfig(id);
    } else if (action === 'configure-sound' && id) {
      const playlistId = target.getAttribute('data-playlist-id');
      if (playlistId) this.openSoundConfig(playlistId, id);
    } else if (action === 'delete-sound' && id) {
      const playlistId = target.getAttribute('data-playlist-id');
      if (playlistId) void this.deletePlaylistSound(playlistId, id);
    } else if (action === 'open-compendium-pack' && id) {
      windowManager.open(`compendium-pack-${id}`, CompendiumPackWindow, { packId: id });
    } else if (action === 'open-compendium-source' && id) {
      windowManager.open(`compendium-source-${id}`, CompendiumSourceWindow, { sourceId: id, worldId: this.worldId });
    } else if (action === 'create-compendium-pack') {
      this.createCompendiumPack();
    } else if (action === 'combat-next') {
      this.nextTurn();
    } else if (action === 'combat-end') {
      this.endCombat();
    } else if (action === 'combat-start-dex') {
      this.startCombatWithDexInitiative();
    } else if (action === 'combat-hp' && id) {
      const input = target as HTMLInputElement;
      const hp = parseInt(input.value);
      this.updateCombatantHP(id, hp);
    } else if (action === 'combat-add-group') {
      void this.addCombatantGroup();
    } else if (action === 'combat-rename-group' && id) {
      void this.renameCombatantGroup(id);
    } else if (action === 'combat-delete-group' && id) {
      void this.deleteCombatantGroup(id);
    } else if (action === 'combat-set-group' && id) {
      const select = target as HTMLSelectElement;
      void this.setCombatantGroup(id, select.value);
    } else if (action === 'combat-group-initiative' && id) {
      const input = target as HTMLInputElement;
      const initiative = input.value === '' ? null : parseInt(input.value);
      void this.setGroupInitiative(id, initiative);
    } else if (action === 'apply-roll') {
      const applyTo = target.getAttribute('data-apply-to');
      const rollTotalStr = target.getAttribute('data-roll-total');
      if (!applyTo || !rollTotalStr) return;
      const rollTotal = parseInt(rollTotalStr);
      const userId = wsClient.session?.userId || '';
      const worldId = this.worldId;
      api.get<any[]>(`/cast?worldId=${worldId}`).then(allCast => {
        const targetIds = allCast
          .filter((cm: any) => (cm.targetedBy || []).includes(userId))
          .map((cm: any) => cm.id);
        if (targetIds.length === 0) {
          showToast('Nenhum alvo selecionado', 'info');
          return;
        }
        applyToTargets(rollTotal, applyTo, targetIds, worldId).then(() => {
          showToast(`Aplicado ${rollTotal} em ${targetIds.length} alvo(s)`, 'success');
        }).catch(e => {
          showToast('Erro ao aplicar', 'error');
        });
      });
    } else if (action === 'open-tours') {
      showToast('Iniciando apresentação...', 'info');
      void TourManager.getInstance().startGameHudTourAfterSeen();
    } else if (action === 'open-user-management') {
      windowManager.open(`user-management-${this.worldId}`, UserManagementWindow, { worldId: this.worldId });
    } else if (action === 'open-invite-links') {
      windowManager.open(`invite-links-${this.worldId}`, InviteLinksWindow, { worldId: this.worldId });
    } else if (action === 'open-world-config') {
      windowManager.open(`world-config-lite-${this.worldId}`, WorldConfigLiteWindow, { worldId: this.worldId });
    } else if (action === 'open-module-management') {
      windowManager.open(`module-management-${this.worldId}`, ModuleManagementWindow, { worldId: this.worldId });
    } else if (action === 'open-keybind-config') {
      windowManager.open('keybind-config', KeybindConfigWindow, { worldId: this.worldId });
    } else if (action === 'open-game-config') {
      windowManager.open('game-config', GameConfigWindow, {
        worldId: this.worldId,
        liveVisionOnDrag: this.liveVisionOnDrag,
        onLiveVisionDragChange: (val: boolean) => {
          this.liveVisionOnDrag = val;
          this.onLiveVisionDragChange?.(val);
        },
        lightAnimationsEnabled: this.lightAnimationsEnabled,
        onLightAnimationsChange: (val: boolean) => {
          this.lightAnimationsEnabled = val;
          this.onLightAnimationsChange?.(val);
        },
        locale: this.locale,
        onLocaleChange: (val: string) => {
          this.locale = val;
          this.onLocaleChange?.(val);
        },
        hideCanvas: this.hideCanvas,
        onHideCanvasChange: (val: boolean) => {
          this.hideCanvas = val;
          this.onHideCanvasChange?.(val);
        },
        leftClickDeselect: this.leftClickDeselect,
        onLeftClickDeselectChange: (val: boolean) => {
          this.leftClickDeselect = val;
          this.onLeftClickDeselectChange?.(val);
        },
        maxFps: this.maxFps,
        onMaxFpsChange: (val: string) => {
          this.maxFps = val;
          this.onMaxFpsChange?.(val);
        },
        showTooltips: this.showTooltips,
        onShowTooltipsChange: (val: boolean) => {
          this.showTooltips = val;
          this.onShowTooltipsChange?.(val);
        },
        autosaveInterval: this.autosaveInterval,
        onAutosaveIntervalChange: (val: string) => {
          this.autosaveInterval = val;
          this.onAutosaveIntervalChange?.(val);
        },
        universalKeys: this.universalKeys,
        onUniversalKeysChange: (val: boolean) => {
          this.universalKeys = val;
          this.onUniversalKeysChange?.(val);
        },
        onOpenSheetConfig: () => {
          windowManager.open('sheet-config', SheetConfigWindow);
        },
      });
    } else if (action === 'create-discord-room') {
      void this.createDiscordRoom();
    } else if (action === 'open-bug-report') {
      windowManager.open('bug-report', BugReportWindow, { worldId: this.worldId });
    } else if (action === 'return-to-setup') {
      void this.returnToSetup();
    } else if (action === 'logout') {
      void this.logout();
    }
  }

  private async createDiscordRoom(): Promise<void> {
    const roomName = await showPrompt('Criar Sala Discord', 'Nome da sala de voz:');
    if (!roomName) return;
    try {
      const result = await api.post<{ channelId: string; inviteUrl: string }>(
        `/worlds/${this.worldId}/discord/room`,
        { roomName },
      );
      showToast('Sala criada! Clique para copiar o link.', 'info');
      const inviteResult = await showPrompt(
        '✅ Sala Criada',
        `Link do convite (clique em OK para copiar):`,
        result.inviteUrl,
      );
      if (inviteResult) {
        copyTextToClipboard(result.inviteUrl);
        showToast('Link copiado!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar sala Discord', 'error');
    }
  }

  /** Exits the game without deactivating the world (world remains active for other players). */
  private async logout(): Promise<void> {
    try {
      await api.post('/worlds/session/logout', {});
      window.location.href = '/';
    } catch (e: any) {
      showToast(e?.message || 'Erro ao sair', 'error');
    }
  }

  public openTab(tabName: string): void {
    if (CODEX_SUBTABS.some(st => st.id === tabName)) {
      this.activeCodexTab = tabName as CodexSubtab;
      this.tabs.set('codex');
    } else {
      this.tabs.set(tabName as any);
    }
    if (this.collapsed) {
      this.collapsed = false;
      this.element.classList.remove('collapsed');
      this.updateCollapsedOverlayVisibility();
    }
    this.render();
    if (tabName === 'chat') this.updateChatDisplay();
    void this.onTabSwitched(tabName);
  }

  private async onTabSwitched(tabName: string): Promise<void> {
    if (tabName === 'codex') {
      await this.onTabSwitched(this.activeCodexTab);
      return;
    }
    if (tabName === 'actors') {
      await this.loadActors();
    } else if (tabName === 'stages') {
      await this.loadStages();
    } else if (tabName === 'items') {
      await this.loadItems();
    } else if (tabName === 'journals') {
      await this.loadJournals();
    } else if (tabName === 'decks') {
      await this.loadDecks();
    } else if (tabName === 'tables') {
      await this.loadRollTables();
    } else if (tabName === 'macros') {
      await this.loadMacros();
    } else if (tabName === 'playlists') {
      await this.loadPlaylists();
    } else if (tabName === 'compendium') {
      await this.loadCompendiumPacks();
    } else if (tabName === 'combat') {
      await this.loadCombat();
    } else if (tabName === 'settings') {
      await this.loadAdminSessionStatus();
    }
    this.render();
    if (tabName === 'chat') {
      this.scrollChatToBottom();
    }
  }

  /** GM returns the world to the configuration screen — deactivates the world (kicks everyone)
   * and requires admin password if not already in a valid session (cookie separate from the game's). */
  private async returnToSetup(): Promise<void> {
    const confirmed = await showConfirm(t('sidebar.settingsReturnToSetup') || 'Retornar ao Setup', t('sidebar.settingsReturnToSetupConfirm'));
    if (!confirmed) return;
    try {
      if (!this.hasAdminSession) {
        const passwordInput = this.element.querySelector<HTMLInputElement>('[name="return-to-setup-password"]');
        const password = passwordInput?.value;
        if (!password) {
          showToast(t('sidebar.settingsAdminPasswordPrompt'), 'error');
          return;
        }
        await api.post('/setup/login', { password });
      }
      await api.post('/worlds/deactivate');
      await api.post('/worlds/session/logout', {});
      showToast(t('sidebar.settingsReturnToSetup'), 'success');
      window.location.href = '/setup';
    } catch (e: any) {
      showToast(e?.message || 'Erro ao voltar para configuração', 'error');
    }
  }

  private async createActor(folderId?: string): Promise<void> {
    const activeSystem = systemRegistry.getActive();
    const actorTypes = activeSystem?.actorTypes ?? [];
    let type = actorTypes[0] ?? 'npc';

    if (actorTypes.length > 1) {
      const chosen = await showSelectDialog(
        'Criar Ator',
        'Tipo de ator',
        actorTypes.map((t) => ({ value: t, label: t })),
      );
      if (!chosen) return;
      type = chosen;
    }

    try {
      const name = nextDefaultName('Novo Ator', this.actors.map(a => a.name));
      const actor = await api.post<{ id: string }>('/actors', {
        worldId: this.worldId,
        name,
        type,
        folderId: folderId || '',
        systemData: activeSystem?.getDefaultData?.(type) ?? {},
      });
      // Guard: WebSocket event may arrive before or after this optimistic push
      if (!this.actors.some((a) => a.id === actor.id)) {
        this.actors.push({ id: actor.id, name, type, avatarUrl: '', folderId: folderId || '' });
      }
      this.actorsLoaded = true;
      this.render();
      // Inserts into WorldCollection right away — without this, converted sheets (ApplicationV2) opened
      // right after wouldn't find the document until the next full reload.
      actorsCollection.add(actor as any);
      const SheetClass = resolveSheetClass('actor', type, ActorSheetWindow);
      windowManager.open(`actor-sheet-${actor.id}`, SheetClass, { actorId: actor.id, worldId: this.worldId });
    } catch (e: any) {
      showToast(e?.message || 'Error creating actor', 'error');
    }
  }

  /** Level 3 = OWNER (see CONST_VALUES.DOCUMENT_OWNERSHIP_LEVELS). */
  private ehMeuAtor(a: ActorSummary): boolean {
    const userId = gameContext.session?.userId;
    return !!userId && (a.ownership?.[userId] ?? 0) >= 3;
  }

  private renderActorItem(a: ActorSummary): string {
    const meu = this.ehMeuAtor(a);
    const tipo = (a.type || '').replace(/-/g, ' ').trim();

    const partes: string[] = [];
    if (meu) partes.push('<span class="sidebar-entry-flag">your character</span>');
    if (tipo) partes.push(this.escapeHtml(tipo));

    return `
      <div class="sidebar-actor-item directory-item document actor${meu ? ' is-mine' : ''}" data-action="open-actor" data-entity-type="actor" data-id="${a.id}" data-entry-id="${a.id}" draggable="true">
        <div class="sidebar-actor-avatar" style="background-image:url('${this.escapeHtml(a.avatarUrl || DEFAULT_PORTRAIT_URL)}')"></div>
        <div class="sidebar-actor-name">${this.escapeHtml(a.name)}</div>
        ${partes.length ? `<div class="sidebar-entry-meta">${partes.join('<span class="sep">·</span>')}</div>` : ''}
      </div>`;
  }

  private renderItemEntry(it: ItemSummary): string {
    const typeLabel = (it.type || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `
      <div class="sidebar-actor-item" data-action="open-item" data-entity-type="item" data-id="${it.id}" draggable="true">
        <div class="sidebar-actor-avatar" style="${it.imgUrl ? `background-image:url('${this.escapeHtml(it.imgUrl)}')` : ''}">
          ${it.imgUrl ? '' : '<i class="fa-solid fa-briefcase"></i>'}
        </div>
        <div class="sidebar-actor-name">${this.escapeHtml(it.name)}</div>
        <div class="sidebar-actor-meta">${typeLabel}</div>
      </div>`;
  }

  private renderJournalEntry(j: JournalSummary): string {
    const partes: string[] = [];

    const nPaginas = Array.isArray(j.pages) ? j.pages.length : 0;
    if (nPaginas > 0) partes.push(`${nPaginas} ${nPaginas === 1 ? 'page' : 'pages'}`);

    // Pinned to map is the most useful data in the list: it says that this journal has
    // a pin in a scene, not that it is bookmarked.
    if (j.isPinned) partes.push('<span class="sidebar-entry-flag"><i class="fa-solid fa-map-pin"></i> on map</span>');

    const editado = this.tempoRelativo(j.updatedAt);
    if (editado) partes.push(editado);

    return `
      <div class="sidebar-actor-item" data-action="open-journal" data-entity-type="journal" data-id="${j.id}" draggable="true">
        <div class="sidebar-actor-avatar"><i class="fa-solid fa-book-open"></i></div>
        <div class="sidebar-actor-name">${this.escapeHtml(j.name)}</div>
        ${partes.length ? `<div class="sidebar-entry-meta">${partes.join('<span class="sep">·</span>')}</div>` : ''}
      </div>`;
  }

  /**
   * "2 days ago", "now". Returns empty string when there is no date — the second
   * line disappears entirely instead of showing "Invalid Date".
   */
  private tempoRelativo(iso?: string): string {
    if (!iso) return '';
    const quando = new Date(iso).getTime();
    if (Number.isNaN(quando)) return '';

    const minutos = Math.floor((Date.now() - quando) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `há ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `há ${horas}h`;

    const dias = Math.floor(horas / 24);
    if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  /** "Search X" box at the top of each directory tab — filters `renderGroupedList`
   * for the same `type` via `this.searchQueries`. */
  private renderSearchBox(type: EntityType, label: string): string {
    const value = this.searchQueries[type] || '';
    return `
      <div class="sidebar-search-box">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" data-search-type="${type}" placeholder="${label}" value="${this.escapeHtml(value)}" />
      </div>
    `;
  }

  private readonly PLACEABLE_GROUPS: { group: string; icon: string }[] = [
    { group: 'Player Character', icon: 'fa-solid fa-user' },
    { group: 'Non-Player Character', icon: 'fa-solid fa-dragon' },
    { group: 'Light', icon: 'fa-solid fa-lightbulb' },
    { group: 'Wall', icon: 'fas fa-grip-lines' },
    { group: 'Tile', icon: 'fa-solid fa-image' },
    { group: 'Note', icon: 'fa-solid fa-note-sticky' },
    { group: 'Drawing', icon: 'fa-solid fa-pen' },
  ];

  /** Hidden groups in the "Placeables" tab (clicked chip to filter by type). */
  private placeablesHiddenGroups = new Set<string>();

  /** Finds the raw data of a placeable by id+type — same source used to
   * build the list (see `renderPlaceablesTab`), reused for click
   * (pan/selection) and double click (open config). */
  private findPlaceable(id: string, type: string): any {
    const canvasManager = (this.gameHud as any)?.canvasManager;
    if (type === 'token') {
      const cast: any[] = (this.gameHud as any)?.initState?.cast ?? [];
      return cast.find((c) => c.id === id);
    }
    if (type === 'light') return (canvasManager?.getLights?.() ?? []).find((l: any) => l.id === id);
    if (type === 'wall') return (canvasManager?.getVisibleWalls?.() ?? []).find((w: any) => w.id === id);
    if (type === 'tile') return canvasManager?.getTileData?.()?.get(id);
    if (type === 'note') return (canvasManager?.getNotesData?.() ?? []).find((n: any) => n.id === id);
    if (type === 'drawing') return canvasManager?.getDrawingData?.()?.get(id);
    return null;
  }

  /** Double click on a result in the "Placeables" tab opens the config window of the
   * right type — token opens the Actor sheet (same behavior as double
   * clicking directly on the canvas, see `game-hud.ts:setupTokenStatusHandler`). */
  private openPlaceableConfig(id: string, type: string): void {
    const found = this.findPlaceable(id, type);
    if (!found) return;
    const worldId = this.worldId;
    if (type === 'token') {
      if (!found.actorId) return;
      const typeName = actorsCollection.get(found.actorId)?.type || '*';
      const SheetClass = resolveSheetClass('actor', typeName, ActorSheetWindow);
      void windowManager.open(`actor-sheet-${found.actorId}`, SheetClass, { actorId: found.actorId, worldId });
      return;
    }
    if (type === 'wall') {
      windowManager.open(`wall-config-${id}`, WallConfigWindow, { wall: found, wallId: id });
      return;
    }
    if (type === 'light') {
      windowManager.open(`light-config-${id}`, LightConfigWindow, { light: found, lightId: id });
      return;
    }
    if (type === 'tile') {
      windowManager.open(`tile-config-${id}`, TileConfigWindow, { id: `tile-config-${id}`, tileId: id });
      return;
    }
    if (type === 'note') {
      windowManager.open(`note-config-${id}`, NoteConfigWindow, { id: `note-config-${id}`, noteId: id, worldId });
      return;
    }
    if (type === 'drawing') {
      windowManager.open(`drawing-config-${id}`, DrawingConfigWindow, { id: `drawing-config-${id}`, drawingId: id });
      return;
    }
  }

  /**
   * "Placeables" tab: centralizes everything in the active scene (tokens, lights,
   * walls, tiles, notes, drawings), grouped by type — token is further
   * divided into Player Character/Non-Player Character via `isLinked`. Clicking
   * on a result centers the camera on it. Light/wall/note don't have a real
   * name in the schema — falls back to a generic numbered label.
   *
   * Data source: is NOT `scenesCollection` — that object comes from the
   * LIST route (`GET /api/stages`), which only brings `{...stage, levels, thumbUrl}`,
   * without tokens/lights/walls/etc (actual bug: tab always empty even with a
   * full scene). Who actually loads the content is the `CanvasManager` (via
   * dedicated routes per type), so we read from it — `this.gameHud.canvasManager`.
   */
  private renderPlaceablesTab(): string {
    const searchBox = `
      <div class="sidebar-search-box">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" data-search-type="placeables" placeholder="Procurar na Cena" value="${this.escapeHtml(this.placeablesQuery)}" />
      </div>
    `;
    const filterChips = `
      <div class="sidebar-placeable-filters">
        ${this.PLACEABLE_GROUPS.map(({ group, icon }) => `
          <button type="button" class="sidebar-placeable-filter-chip ${this.placeablesHiddenGroups.has(group) ? 'is-off' : ''}"
            data-action="toggle-placeable-group" data-group="${this.escapeHtml(group)}" title="${this.escapeHtml(group)}">
            <i class="${icon}"></i>
          </button>
        `).join('')}
      </div>
    `;

    const canvasManager = (this.gameHud as any)?.canvasManager;
    const activeStageId = (this.gameHud as any)?.initState?.activeStage?.id;
    if (!canvasManager || !activeStageId) {
      return `${searchBox}${filterChips}<div class="empty-state"><p>Nenhuma cena ativa.</p></div>`;
    }

    const q = this.placeablesQuery.trim().toLowerCase();
    type Row = { id: string; type: string; group: string; label: string; x: number; y: number };
    const rows: Row[] = [];
    const matches = (label: string) => !q || label.toLowerCase().includes(q);

    const cast: any[] = (this.gameHud as any)?.initState?.cast ?? [];
    for (const token of cast) {
      if (token.stageId !== activeStageId) continue;
      const label = token.name || '(sem nome)';
      if (!matches(label)) continue;
      rows.push({
        id: token.id, type: 'token', x: token.x, y: token.y, label,
        group: token.isLinked === false ? 'Non-Player Character' : 'Player Character',
      });
    }
    (canvasManager.getLights?.() ?? []).forEach((l: any, i: number) => {
      const label = l.name || `Luz (${i + 1})`;
      if (!matches(label)) return;
      rows.push({ id: l.id, type: 'light', x: l.x, y: l.y, label, group: 'Light' });
    });
    (canvasManager.getVisibleWalls?.() ?? []).forEach((w: any, i: number) => {
      const label = w.name || `Parede (${i + 1})`;
      if (!matches(label)) return;
      rows.push({ id: w.id, type: 'wall', x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2, label, group: 'Wall' });
    });
    Array.from((canvasManager.getTileData?.() as Map<string, any> ?? new Map()).values()).forEach((tile: any, i: number) => {
      const label = tile.name || `Tile (${i + 1})`;
      if (!matches(label)) return;
      rows.push({ id: tile.id, type: 'tile', x: tile.x, y: tile.y, label, group: 'Tile' });
    });
    (canvasManager.getNotesData?.() ?? []).forEach((note: any, i: number) => {
      const label = `Nota (${i + 1})`;
      if (!matches(label)) return;
      rows.push({ id: note.id, type: 'note', x: note.x, y: note.y, label, group: 'Note' });
    });
    Array.from((canvasManager.getDrawingData?.() as Map<string, any> ?? new Map()).values()).forEach((drawing: any, i: number) => {
      const label = drawing.text || `Desenho (${i + 1})`;
      if (!matches(label)) return;
      rows.push({ id: drawing.id || '', type: 'drawing', x: drawing.x ?? 0, y: drawing.y ?? 0, label, group: 'Drawing' });
    });

    const visibleRows = rows.filter((r) => !this.placeablesHiddenGroups.has(r.group));
    if (visibleRows.length === 0) {
      return `${searchBox}${filterChips}<div class="empty-state"><p>Nada encontrado.</p></div>`;
    }

    const byGroup = new Map<string, Row[]>();
    for (const row of visibleRows) {
      if (!byGroup.has(row.group)) byGroup.set(row.group, []);
      byGroup.get(row.group)!.push(row);
    }

    const groupsHtml = this.PLACEABLE_GROUPS
      .filter(({ group }) => byGroup.has(group))
      .map(({ group, icon }) => {
        const items = byGroup.get(group)!;
        return `
          <div class="sidebar-folder">
            <div class="sidebar-folder-header">
              <span class="sidebar-folder-name">${this.escapeHtml(group)}</span>
              <span class="sidebar-folder-count">${items.length}</span>
            </div>
            <div class="sidebar-folder-items">
              ${items.map((row) => `
                <div class="sidebar-actor-item sidebar-placeable-item" data-action="pan-to-placeable" data-id="${this.escapeHtml(row.id)}" data-placeable-type="${row.type}">
                  <i class="${icon} sidebar-placeable-item-icon"></i>
                  <div class="sidebar-actor-name">${this.escapeHtml(row.label)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

    return `${searchBox}${filterChips}<div class="sidebar-actor-list directory-list">${groupsHtml}</div>`;
  }

  /**
   * Groups any document list (actor/item/journal) by folder, with
   * "no folder" fallback for those without folderId OR whose folder was
   * deleted (orphaned folderId) — never hides an entity from the list.
   */
  private renderGroupedList<T extends { id: string; folderId?: string; name?: string }>(
    folders: FolderSummary[],
    entities: T[],
    renderItem: (e: T) => string,
    type: EntityType
  ): string {
    // Searching: ignores folders on purpose (flattened list of results,
    // like every search directory) — without this we'd have to expand every
    // folder to find what matched.
    const query = (this.searchQueries[type] || '').trim().toLowerCase();
    if (query) {
      const matches = entities.filter((e) => (e.name || '').toLowerCase().includes(query));
      if (matches.length === 0) return `<div class="empty-state"><p>Nada encontrado.</p></div>`;
      return matches.map(renderItem).join('');
    }

    const knownFolderIds = new Set(folders.map((f) => f.id));
    const byFolder = new Map<string, T[]>();
    const noFolder: T[] = [];
    for (const e of entities) {
      if (e.folderId && knownFolderIds.has(e.folderId)) {
        if (!byFolder.has(e.folderId)) byFolder.set(e.folderId, []);
        byFolder.get(e.folderId)!.push(e);
      } else {
        noFolder.push(e);
      }
    }

    const subfoldersByParent = new Map<string, FolderSummary[]>();
    const rootFolders: FolderSummary[] = [];

    for (const f of folders) {
      const parentId = f.parent || '';
      if (parentId && knownFolderIds.has(parentId)) {
        if (!subfoldersByParent.has(parentId)) subfoldersByParent.set(parentId, []);
        subfoldersByParent.get(parentId)!.push(f);
      } else {
        rootFolders.push(f);
      }
    }

    const renderFolderNode = (f: FolderSummary, depth: number = 0): string => {
      const items = byFolder.get(f.id) ?? [];
      const subfolders = subfoldersByParent.get(f.id) ?? [];
      const collapsed = this.collapsedFolders.has(f.id);

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
      };

      const rgb = f.color ? hexToRgb(f.color) : null;
      const folderStyle = rgb ? `style="background: rgba(${rgb}, 0.85); color: #fff; border-radius: 4px;"` : '';
      const textStyle = rgb ? `style="color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"` : '';
      const indentStyle = depth > 0 ? `style="margin-left: ${depth * 10}px;"` : '';

      let contentHtml = '';
      if (!collapsed) {
        contentHtml = `
          <div class="sidebar-folder-items">
            ${subfolders.map(sub => renderFolderNode(sub, depth + 1)).join('')}
            ${items.map(renderItem).join('')}
          </div>
        `;
      }

      return `
        <div class="sidebar-folder" ${indentStyle}>
          <div class="sidebar-folder-header ${rgb ? 'has-color' : ''}" data-action="toggle-folder" data-id="${f.id}" data-entity-type="folder" data-folder-type="${type}" ${folderStyle}>
            <span class="sidebar-folder-caret" ${textStyle}>${collapsed ? '<i class="fa-solid fa-folder"></i>' : '<i class="fa-solid fa-folder-open"></i>'}</span>
            <span class="sidebar-folder-name" ${textStyle}>${this.escapeHtml(f.name)}</span>
            <span class="sidebar-folder-count" ${textStyle}>${items.length + subfolders.length}</span>
            <div class="sidebar-folder-actions">
              <button class="btn-folder-action" data-action="create-subfolder" data-id="${f.id}" data-type="${type}" title="Criar Pasta"><i class="fa-solid fa-folder-plus"></i></button>
              <button class="btn-folder-action" data-action="create-entry" data-id="${f.id}" data-type="${type}" title="Criar Entrada"><i class="fa-solid fa-file-circle-plus"></i></button>
            </div>
          </div>
          ${contentHtml}
        </div>
      `;
    };

    const folderBlocks = rootFolders.map(f => renderFolderNode(f, 0)).join('');
    return folderBlocks + noFolder.map(renderItem).join('');
  }

  private renderActorListGrouped(): string {
    return this.renderGroupedList(this.actorFolders, this.actors, (a) => this.renderActorItem(a), 'actor');
  }

  private renderItemListGrouped(): string {
    return this.renderGroupedList(this.itemFolders, this.items, (it) => this.renderItemEntry(it), 'item');
  }

  private renderJournalListGrouped(): string {
    return this.renderGroupedList(this.journalFolders, this.journals, (j) => this.renderJournalEntry(j), 'journal');
  }

  private renderStageListGrouped(): string {
    // Cenas-filhas (com parentStageId) só aparecem aninhadas dentro do card da
    // cena-mapa que as agrupa — sem esse filtro apareceriam duas vezes: solta
    // no topo da lista E dentro do grupo do mapa.
    const topLevelStages = this.stages.filter((s) => !s.parentStageId);
    return this.renderGroupedList(this.stageFolders, topLevelStages, (s) => this.renderStageItem(s), 'stage');
  }

  private renderStageItem(s: StageSummary): string {
    const bg = s.thumbUrl || s.backgroundUrl;
    const bgStyle = bg ? `background-image:url('${this.escapeHtml(bg as string)}')` : '';
    const noThumbClass = bg ? '' : ' stage-card-no-thumb';

    if (s.sceneType === 'map') {
      const expanded = this.expandedMapStages.has(s.id);
      const children = this.stages.filter((c) => c.parentStageId === s.id);
      const childrenHtml = expanded
        ? `<div class="stage-card-group-children">${children.map((c) => this.renderStageItem(c)).join('') || '<div class="stage-card-group-empty">Nenhuma cena filha ainda</div>'}</div>`
        : '';
      return `
        <div class="stage-card stage-card-map${noThumbClass} ${s.isActive ? 'active' : ''}" data-action="toggle-stage-group" data-entity-type="stage" data-id="${s.id}" title="Clique para expandir • Botão direito para configurar" draggable="true"
             style="${bgStyle}">
          <div class="stage-card-overlay">
            <i class="fa-solid fa-chevron-${expanded ? 'down' : 'right'}"></i>
            <span class="stage-card-name">${this.escapeHtml(s.name)}</span>
            ${s.isActive ? '<span class="stage-card-active-dot"></span>' : ''}
          </div>
        </div>
        ${childrenHtml}`;
    }

    return `
      <div class="stage-card${noThumbClass} ${s.isActive ? 'active' : ''}" data-action="open-stage" data-entity-type="stage" data-id="${s.id}" title="Clique para configurar • Botão direito para mais opções" draggable="true"
           style="${bgStyle}">
        <div class="stage-card-overlay">
          <span class="stage-card-name">${this.escapeHtml(s.name)}</span>
          ${s.isActive ? '<span class="stage-card-active-dot"></span>' : ''}
        </div>
      </div>`;
  }

  private renderDeckListGrouped(): string {
    const isGM = this.userRole >= 4;
    // Jogador comum só vê baralhos gerais, pilhas e a sua própria mão
    const visibleDecks = isGM
      ? this.decks
      : this.decks.filter((d) => d.stackType !== 'hand' || !d.ownerId || d.ownerId === this.userId);
    return this.renderGroupedList(this.deckFolders, visibleDecks, (d) => this.renderDeckItem(d), 'deck');
  }

  private renderDeckItem(d: DeckSummary): string {
    const isHand = d.stackType === 'hand';
    let ownerLabel = '';
    if (isHand) {
      if (d.ownerId && d.ownerId === this.userId) {
        ownerLabel = ' <span class="sidebar-entry-flag" style="margin-left: 4px; font-size: 0.65rem;">sua mão</span>';
      } else if (d.ownerId) {
        const ownerName = this.userCache.get(d.ownerId)?.name || 'outro jogador';
        ownerLabel = ` <span style="font-size: 0.75rem; opacity: 0.7; margin-left: 4px;">(${this.escapeHtml(ownerName)})</span>`;
      } else {
        ownerLabel = ' <span style="font-size: 0.75rem; opacity: 0.7; margin-left: 4px;">(mão)</span>';
      }
    }
    return `
      <div class="sidebar-actor-item" data-action="open-deck" data-entity-type="deck" data-id="${d.id}" draggable="true">
        <div class="sidebar-actor-avatar">${isHand ? '✋' : '🃏'}</div>
        <div class="sidebar-actor-name">${this.escapeHtml(d.name)}${ownerLabel}</div>
        <div class="sidebar-actor-meta">${d.cards?.length ?? 0} cartas</div>
      </div>`;
  }

  private renderMacroListGrouped(): string {
    return this.renderGroupedList(this.macroFolders, this.macros, (m) => this.renderMacroItem(m), 'macro');
  }

  private renderMacroItem(m: MacroSummary): string {
    return `
      <div class="sidebar-actor-item" data-action="open-macro" data-entity-type="macro" data-id="${m.id}" draggable="true">
        <div class="sidebar-actor-avatar">${m.imgUrl ? `<img src="${this.escapeHtml(m.imgUrl)}" alt="" />` : '<i class="fa-solid fa-bolt"></i>'}</div>
        <div class="sidebar-actor-name">${this.escapeHtml(m.name)}</div>
        <div class="sidebar-actor-meta">${this.escapeHtml(m.type)}</div>
      </div>`;
  }

  private renderPlaylistListGrouped(): string {
    return this.renderGroupedList(this.playlistFolders, this.playlists, (p) => this.renderPlaylistItem(p), 'playlist');
  }

  private renderPlaylistItem(p: PlaylistSummary): string {
    return `
      <div class="sidebar-actor-item" data-action="toggle-playlist-expand" data-entity-type="playlist" data-id="${p.id}" draggable="true">
        <div class="sidebar-actor-avatar"><i class="fa-solid fa-music"></i></div>
        <div class="sidebar-actor-name">${this.escapeHtml(p.name)}</div>
        <div class="sidebar-actor-meta">${p.sounds?.length ?? p.soundCount ?? 0} faixas</div>
      </div>
      ${this.renderPlaylistSounds(p)}`;
  }

  /** Pack de addon/ruleset — banner simplificado (sem pasta/contagem, é read-only
   * na origem). Abre CompendiumSourceWindow, nunca CompendiumPackWindow. */
  private renderCompendiumSourceItem(s: CompendiumSourceSummary): string {
    const bgMap: Record<string, string> = {
      Actor: '/images/compendium-bg/actor.png',
      Item: '/images/compendium-bg/item.png',
      Scene: '/images/compendium-bg/scenes.png',
      JournalEntry: '/images/compendium-bg/journal.png',
      RollTable: '/images/compendium-bg/roll-tabels.png',
      Cards: '/images/compendium-bg/cards.png',
    };
    const iconMap: Record<string, string> = {
      Actor: 'fa-solid fa-user-group',
      Item: 'fa-solid fa-briefcase',
      Scene: 'fa-solid fa-map',
      JournalEntry: 'fa-solid fa-book-open',
    };
    const bgUrl = bgMap[s.type] || '';
    const icon = iconMap[s.type] || 'fa-solid fa-book';
    const bgStyle = bgUrl ? `background-image: url('${bgUrl}');` : '';
    return `
      <div class="sidebar-compendium-banner" data-action="open-compendium-source" data-id="${s.sourceId}" style="${bgStyle}">
        <div class="sidebar-compendium-banner-overlay"></div>
        <div class="sidebar-compendium-banner-content">
          <div class="sidebar-compendium-banner-title">
            <i class="${icon}"></i>
            <span>${this.escapeHtml(s.name)}</span>
          </div>
          <div class="sidebar-compendium-banner-badges">
            <span class="compendium-badge sys-badge"><i class="fa-solid fa-cube"></i> ${this.escapeHtml(s.ownerName)}</span>
            <i class="fa-solid fa-lock" style="font-size: 0.7rem; opacity: 0.5;" title="Bloqueado (somente leitura)"></i>
          </div>
        </div>
      </div>
    `;
  }

  private renderCompendiumListGrouped(): string {
    return this.renderGroupedList(this.compendiumFolders, this.compendiumPacks, (p) => this.renderCompendiumItem(p), 'compendium');
  }

  private renderCompendiumItem(p: CompendiumPackSummary): string {
    const bgMap: Record<string, string> = {
      Actor: '/images/compendium-bg/actor.png',
      Item: '/images/compendium-bg/item.png',
      Scene: '/images/compendium-bg/scenes.png',
      JournalEntry: '/images/compendium-bg/journal.png',
      RollTable: '/images/compendium-bg/roll-tabels.png',
      Cards: '/images/compendium-bg/cards.png',
    };
    const iconMap: Record<string, string> = {
      Actor: 'fa-solid fa-user-group',
      Item: 'fa-solid fa-briefcase',
      Scene: 'fa-solid fa-map',
      JournalEntry: 'fa-solid fa-book-open',
      RollTable: 'fa-solid fa-dice',
      Cards: 'fa-solid fa-layer-group',
    };

    const bgUrl = bgMap[p.type] || '';
    const icon = iconMap[p.type] || 'fa-solid fa-book';
    const bgStyle = bgUrl ? `background-image: url('${bgUrl}');` : '';

    return `
      <div class="sidebar-compendium-banner" data-action="open-compendium-pack" data-entity-type="compendium" data-id="${p.id}" draggable="true" style="${bgStyle}">
        <div class="sidebar-compendium-banner-overlay"></div>
        <div class="sidebar-compendium-banner-content">
          <div class="sidebar-compendium-banner-title">
            <i class="${icon}"></i>
            <span>${this.escapeHtml(p.name)}</span>
          </div>
          <div class="sidebar-compendium-banner-badges">
            <span class="compendium-badge sys-badge"><i class="fa-solid fa-cube"></i> world</span>
            <i class="fa-solid fa-lock" style="font-size: 0.7rem; opacity: 0.5;" title="Bloqueado (somente leitura)"></i>
          </div>
        </div>
      </div>`;
  }

  private foldersByType(type: EntityType): FolderSummary[] {
    if (type === 'actor') return this.actorFolders;
    if (type === 'item') return this.itemFolders;
    if (type === 'journal') return this.journalFolders;
    if (type === 'stage') return this.stageFolders;
    if (type === 'deck') return this.deckFolders;
    if (type === 'macro') return this.macroFolders;
    if (type === 'playlist') return this.playlistFolders;
    if (type === 'compendium') return this.compendiumFolders;
    return [];
  }

  private async createFolder(type: EntityType, parent: string = ''): Promise<void> {
    const name = nextDefaultName('Nova Pasta', this.foldersByType(type).map(f => f.name));
    try {
      const folder = await api.post<FolderSummary>('/folders', {
        worldId: this.worldId,
        name,
        type: type === 'stage' ? 'scene' : type,
        parent,
      });
      this.foldersByType(type).push(folder);
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar pasta', 'error');
    }
  }

  private async importCompendiumEntry(tabId: string, payload: any): Promise<void> {
    const tabToEntityType: Record<string, EntityType> = {
      actors: 'actor',
      items: 'item',
      stages: 'stage',
      journals: 'journal',
      decks: 'deck',
      macros: 'macro',
      playlists: 'playlist',
    };

    const entityType = tabToEntityType[tabId];
    if (!entityType) return;

    const ref = this.entityListRefs[entityType];
    if (!ref) return;

    const PAYLOAD_TYPE_ALIAS: Record<string, string> = {
      scene: 'stage',
    };
    const rawType = (payload.type || payload.packType || '').toLowerCase();
    const payloadType = PAYLOAD_TYPE_ALIAS[rawType] || rawType;
    if (payloadType !== entityType && payloadType !== 'compendium') {
      return;
    }

    try {
      let entries: any[];

      if (payload.data) {
        entries = [payload.data];
      } else {
        const pack = await api.get<{ entries: any[] }>(`/compendium/${payload.id}`);
        entries = pack.entries;
        if (entries.length === 0) {
          showToast('Compêndio vazio', 'info');
          return;
        }
      }

      for (const entryData of entries) {
        const createPayload: Record<string, any> = {
          worldId: this.worldId,
        };
        if (entityType === 'stage') {
          Object.assign(createPayload, entryData.data || {});
          createPayload.name = entryData.name;
          createPayload.backgroundUrl = entryData.data?.backgroundUrl || entryData.imgUrl || '';
        } else {
          Object.assign(createPayload, entryData);
          createPayload.data = entryData.data ?? entryData.systemData ?? {};
        }
        delete createPayload.systemData;
        delete createPayload.id;
        delete createPayload._id;
        const created = await api.post<any>(ref.endpoint, createPayload);
        showToast(`${t('common.saved')}: ${entryData.name}`, 'success');
      }

      ref.markStale();

      if (entityType === 'actor') {
        // actorsCollection doesn't have refresh
        await this.loadActors();
      } else if (entityType === 'item') await this.loadItems();
      else if (entityType === 'journal') await this.loadJournals();
      else if (entityType === 'stage') await this.loadStages();
      else if (entityType === 'deck') await this.loadDecks();
      else if (entityType === 'macro') await this.loadMacros();
      else if (entityType === 'playlist') await this.loadPlaylists();

      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao importar do compêndio', 'error');
    }
  }

  private async moveEntityToFolder(type: EntityType, entityId: string, folderId?: string): Promise<void> {
    let chosen: string | null = null;
    if (folderId !== undefined) {
      chosen = folderId;
    } else {
      const choices = [
        { value: '', label: '(Sem pasta)' },
        ...this.foldersByType(type).map((f) => ({ value: f.id, label: f.name })),
      ];
      chosen = await showSelectDialog('Mover para Pasta', 'Pasta de destino', choices);
      if (chosen === null) return;
    }
    const { endpoint } = this.entityListRefs[type];
    try {
      await api.put(`${chosen ? `${endpoint}/${entityId}` : `${endpoint}/${entityId}`}`, { folderId: chosen || '' });
      const list = this.entityListRefs[type].list();
      const entity = list.find((e: any) => e.id === entityId);
      if (entity) entity.folderId = chosen || undefined;
      this.render();
      showToast('Movido com sucesso', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao mover', 'error');
    }
  }

  private showFolderContextMenu(folderId: string, type: EntityType, event: MouseEvent): void {
    const folder = this.foldersByType(type).find(f => f.id === folderId);
    if (!folder) return;

    const labels: Record<EntityType, string> = {
      actor: 'Ator',
      item: 'Item',
      journal: 'Diário',
      stage: 'Cena',
      deck: 'Deck',
      macro: 'Macro',
      playlist: 'Playlist',
      compendium: 'Compêndio'
    };
    const typeLabel = labels[type] || 'Entidade';
    const items: ContextMenuItem[] = [];

    const canCreate = (type === 'actor' && this.hasPermission('createActor')) ||
      (type === 'item' && this.hasPermission('createItem')) ||
      (type === 'journal' && this.hasPermission('createJournal')) ||
      (type === 'stage' && this.userRole >= 4) ||
      (type === 'deck' && this.userRole >= 4) || // Fallback permission check
      (type === 'macro' && this.userRole >= 2) ||
      (type === 'playlist' && this.userRole >= 3) ||
      (type === 'compendium' && this.userRole >= 4);

    if (canCreate) {
      items.push({
        icon: '<i class="fa-solid fa-plus"></i>',
        label: `Criar ${typeLabel}`,
        action: () => {
          if (type === 'actor') void this.createActor(folderId);
          else if (type === 'item') void this.createItem(folderId);
          else if (type === 'journal') void this.createJournal(folderId);
          else if (type === 'stage') void this.createStage(folderId);
          else if (type === 'deck') void this.createDeck(folderId);
          else if (type === 'macro') void this.createMacro(folderId);
          else if (type === 'playlist') void this.createPlaylist(folderId);
          else if (type === 'compendium') void this.createCompendiumPack(folderId);
        }
      });
    }

    items.push(
      {
        icon: '<i class="fa-solid fa-folder"></i>',
        label: 'Criar Subpasta',
        action: () => void this.createFolder(type, folderId)
      },
      {
        icon: '<i class="fa-solid fa-pen-to-square"></i>',
        label: 'Editar Pasta',
        action: async () => {
          const name = await showPrompt('Editar Pasta', 'Nome da pasta', folder.name);
          if (name === null) return;
          const color = await showColorDialog('Editar Pasta', 'Cor da pasta', folder.color || '');
          if (color === null) return;

          try {
            await api.put(`/folders/${folderId}`, {
              name: name.trim(),
              color: color.trim()
            });
            folder.name = name.trim();
            folder.color = color.trim();
            this.render();
            showToast('Pasta atualizada', 'success');
          } catch (e: any) {
            showToast(e?.message || 'Erro ao atualizar pasta', 'error');
          }
        }
      },
      { divider: true, label: '' },
      {
        icon: '<i class="fa-solid fa-trash"></i>',
        label: 'Excluir Pasta',
        danger: true,
        action: async () => {
          const confirmed = await showConfirm('Excluir Pasta', `Deseja mesmo excluir a pasta "${folder.name}"? Os itens nela serão mantidos fora de pastas.`);
          if (!confirmed) return;
          try {
            await api.delete(`/folders/${folderId}`);
            const list = this.foldersByType(type);
            const idx = list.findIndex(f => f.id === folderId);
            if (idx !== -1) list.splice(idx, 1);

            // Locally corrects orphaned items/folders
            for (const f of list) {
              if (f.parent === folderId) f.parent = '';
            }
            const entitiesList: Array<{ id: string; folderId?: string }> =
              type === 'actor' ? this.actors : type === 'item' ? this.items : this.journals;
            for (const ent of entitiesList) {
              if (ent.folderId === folderId) delete ent.folderId;
            }

            this.render();
            showToast('Pasta excluída', 'success');
          } catch (e: any) {
            showToast(e?.message || 'Erro ao excluir pasta', 'error');
          }
        }
      }
    );

    showContextMenu(event, items);
  }

  private async createStage(folderId?: string): Promise<void> {
    try {
      const name = nextDefaultName('Nova Cena', this.stages.map(s => s.name));

      const stage = await api.post<any>('/stages', {
        worldId: this.worldId,
        name,
        folderId: folderId || '',
      });
      if (!this.stages.some((s) => s.id === stage.id)) {
        this.stages.push({ id: stage.id, name: stage.name, isActive: !!stage.isActive, thumbUrl: stage.thumbUrl || stage.backgroundUrl || '', folderId: folderId || '' });
      }
      this.stagesLoaded = true;
      this.render();
      windowManager.open(`stage-config-${stage.id}`, StageConfigWindow, {
        stage,
        onSaved: () => {
          this.stagesLoaded = false;
          void this.loadStages().then(() => this.render());
        },
        worldId: this.worldId,
      });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar cena', 'error');
    }
  }

  private async createItem(folderId?: string): Promise<void> {
    const activeSystem = systemRegistry.getActive();
    const itemTypes = activeSystem?.itemTypes ?? [];
    let type = itemTypes[0] ?? 'equipment';

    if (itemTypes.length > 1) {
      const chosen = await showSelectDialog(
        'Criar Item',
        'Tipo de item',
        itemTypes.map((t) => ({
          value: t,
          label: t.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        })),
      );
      if (!chosen) return;
      type = chosen;
    }

    try {
      console.log('[Sidebar] Criando item com worldId:', this.worldId);
      const defaultData = activeSystem?.getDefaultData?.(type) ?? {};
      const name = nextDefaultName('Novo Item', this.items.map(i => i.name));
      const item = await api.post<{ id: string }>('/items', {
        worldId: this.worldId,
        name,
        type,
        data: defaultData,
        folderId: folderId || '',
      });
      console.log('[Sidebar] Item criado:', item);
      if (!this.items.some((i) => i.id === item.id)) {
        this.items.push({ id: item.id, name, type, imgUrl: '', folderId: folderId || '' });
      }
      this.itemsLoaded = true;
      this.render();
      const SheetClass = resolveSheetClass('item', type, ItemSheetWindow);
      windowManager.open(`item-sheet-${item.id}`, SheetClass, { itemId: item.id });
    } catch (e: any) {
      console.error('[Sidebar] Erro ao criar item:', e);
      showToast(e?.message || 'Erro ao criar item', 'error');
    }
  }

  private async createJournal(folderId?: string): Promise<void> {
    try {
      console.log('[Sidebar] Criando journal com worldId:', this.worldId);
      const name = nextDefaultName('Novo Journal', this.journals.map(j => j.name));
      const journal = await api.post<{ id: string }>('/journals', {
        worldId: this.worldId,
        name,
        type: 'notes',
        content: '',
        folderId: folderId || '',
      });
      console.log('[Sidebar] Journal criado:', journal);
      if (!this.journals.some((j) => j.id === journal.id)) {
        this.journals.push({ id: journal.id, name, folderId: folderId || '' });
      }
      this.journalsLoaded = true;
      this.render();
      const SheetClass = sheetCatalog.get('journal', '*') || JournalWindow;
      windowManager.open(`journal-${journal.id}`, SheetClass, { journalId: journal.id });
    } catch (e: any) {
      console.error('[Sidebar] Erro ao criar journal:', e);
      showToast(e?.message || 'Erro ao criar journal', 'error');
    }
  }

  private async createDeck(folderId?: string): Promise<void> {
    const presets = await fetchDeckPresets();
    const presetOptions = presets.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${p.count} cartas)</option>`).join('');

    const content = `
      <div class="form-group">
        <label>${t('sidebar.deckStackType')}</label>
        <select name="stackType" id="create-deck-stack-type">
          <option value="deck">${t('sidebar.deckStackDeck')}</option>
          <option value="hand">${t('sidebar.deckStackHand')}</option>
          <option value="pile">${t('sidebar.deckStackPile')}</option>
        </select>
      </div>
      <div class="form-group" id="create-deck-preset-group">
        <label>Modelo / Preset</label>
        <select name="presetId">
          <option value="">Personalizado (Vazio)</option>
          ${presetOptions}
        </select>
        <p class="form-help" style="margin-top:6px; font-size:12px; color:var(--text-muted, #aaa);">
          Selecione um baralho completo pré-configurado para carregar todas as cartas automaticamente.
        </p>
      </div>
    `;
    const result = (await LoomDialog.wait({
      window: { title: t('sidebar.deckCreate') },
      content,
      width: 380,
      render: (_e, dialog) => {
        const body = dialog.getBody();
        if (!body) return;
        const stackTypeSelect = body.querySelector<HTMLSelectElement>('#create-deck-stack-type');
        const presetGroup = body.querySelector<HTMLElement>('#create-deck-preset-group');
        if (stackTypeSelect && presetGroup) {
          stackTypeSelect.addEventListener('change', () => {
            presetGroup.style.display = stackTypeSelect.value === 'deck' ? 'block' : 'none';
          });
        }
      },
      buttons: [
        { action: 'cancel', label: t('common.cancel') },
        {
          action: 'create',
          label: t('sidebar.deckCreate'),
          variant: 'primary',
          default: true,
          callback: (_e: Event, _button: HTMLButtonElement, dialog: LoomDialog) => {
            const body = dialog.getBody();
            const stackType = (body?.querySelector('[name="stackType"]') as HTMLSelectElement)?.value || 'deck';
            const presetId = (body?.querySelector('[name="presetId"]') as HTMLSelectElement)?.value || '';
            return { stackType, presetId };
          }
        }
      ]
    })) as { stackType: string; presetId: string } | null;
    if (!result?.stackType) return;

    const names: Record<string, string> = {
      deck: t('sidebar.deckStackDeck'),
      hand: t('sidebar.deckStackHand'),
      pile: t('sidebar.deckStackPile'),
    };
    const ownerId = result.stackType === 'hand' ? (gameContext.session?.userId || '') : '';

    let cards: any[] = [];
    let deckType = 'standard';
    const state: Record<string, any> = {};
    let defaultDeckName = names[result.stackType];

    if (result.presetId && result.stackType === 'deck') {
      const preset = presets.find(p => p.id === result.presetId);
      if (preset) {
        const presetData = await loadDeckPresetFile(preset.file);
        if (presetData) {
          cards = instantiateDeckCards(presetData.cards);
          deckType = presetData.type || 'standard';
          defaultDeckName = presetData.name;
          if (presetData.back) {
            state.backImg = presetData.back;
          }
        }
      }
    }

    try {
      const name = nextDefaultName(defaultDeckName, this.decks.map(d => d.name));
      const deck = await api.post<{ id: string }>('/decks', {
        worldId: this.worldId,
        name,
        type: deckType,
        stackType: result.stackType,
        ownerId,
        cards,
        state,
        folderId: folderId || '',
      });
      if (!this.decks.some((d) => d.id === deck.id)) {
        this.decks.push({ id: deck.id, name, type: deckType as any, stackType: result.stackType as any, ownerId, cards, folderId: folderId || '' });
      }
      this.decksLoaded = true;
      this.render();
      windowManager.open(`deck-sheet-${deck.id}`, DeckSheetWindow, { deckId: deck.id });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar deck', 'error');
    }
  }

  private async createRollTable(): Promise<void> {
    const name = nextDefaultName('Nova Tabela de Rolagem', this.rollTables.map(t => t.name));
    try {
      const table = await api.post<RollTableSummary>('/roll-tables', { worldId: this.worldId, name });
      if (!this.rollTables.some((t) => t.id === table.id)) this.rollTables.push(table);
      this.rollTablesLoaded = true;
      this.render();
      windowManager.open(`roll-table-${table.id}`, RollTableWindow, { tableId: table.id, worldId: this.worldId });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar tabela', 'error');
    }
  }

  private createMacro(folderId?: string): void {
    windowManager.open(`macro-editor--1`, MacroEditorWindow, {
      worldId: this.worldId,
      slot: -1,
      folderId: folderId || '',
      onSaved: () => {
        this.macrosLoaded = false;
        void this.loadMacros().then(() => this.render());
      },
      userRole: this.userRole,
    });
  }

  private openMacro(id: string): void {
    const macro = this.macros.find((m) => m.id === id);
    if (!macro) return;
    windowManager.open(`macro-editor-${id}`, MacroEditorWindow, {
      worldId: this.worldId,
      slot: -1,
      macro: macro as any,
      onSaved: () => {
        this.macrosLoaded = false;
        void this.loadMacros().then(() => this.render());
      },
      userRole: this.userRole,
    });
  }

  private async createPlaylist(folderId?: string): Promise<void> {
    const name = nextDefaultName('Nova Playlist', this.playlists.map(p => p.name));
    const mode = await showSelectDialog('Modo da Playlist', 'Modo', [
      { value: 'sequential', label: 'Sequencial' },
      { value: 'random', label: 'Aleatório' },
      { value: 'loop', label: 'Loop' },
    ]);
    if (!mode) return;
    const volume = await showRangeDialog('Volume', 'Volume', 0, 1, 0.05, 0.5);
    try {
      const playlist = await api.post<{ id: string }>('/playlists', {
        worldId: this.worldId,
        name,
        mode,
        volume,
        folderId: folderId || '',
      });
      if (!this.playlists.some((p) => p.id === playlist.id)) {
        this.playlists.push({ id: playlist.id, name, folderId: folderId || '' });
      }
      this.playlistsLoaded = true;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar playlist', 'error');
    }
  }

  private async togglePlaylistExpand(id: string): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === id);
    if (!playlist) return;
    if (playlist.sounds) {
      playlist.sounds = undefined;
      this.render();
      return;
    }
    await this.reloadPlaylistSounds(id);
  }

  /**
   * Reloads only the `sounds` of ONE playlist (via GET /playlists/:id, which
   * includes them — GET /playlists in list DOES NOT include). Using `loadPlaylists()`
   * after add/remove sound swaps the entire array for objects without `sounds`,
   * which "collapses" the playlist and clears the sound that just changed even
   * if the operation succeeded on the server.
   */
  private async reloadPlaylistSounds(id: string): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === id);
    if (!playlist) return;
    try {
      const full = await api.get<any>(`/playlists/${id}`);
      const sounds = (full.sounds || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        path: s.path,
      }));
      playlist.sounds = sounds;
      playlist.soundCount = sounds.length;
      this.render();
    } catch {
      showToast('Erro ao carregar sons', 'error');
    }
  }

  private toggleSound(soundId: string, path: string): void {
    if (this.playingSoundId === soundId) {
      this.currentAudio?.pause();
      this.currentAudio = null;
      this.playingSoundId = null;
      this.render();
      return;
    }
    this.currentAudio?.pause();
    const audio = new Audio(path);
    audio.volume = this.volumeMusic * this.volumeMaster;
    audio.addEventListener('ended', () => {
      this.playingSoundId = null;
      this.currentAudio = null;
      this.render();
    });
    audio.play().catch(() => {
      showToast('Erro ao reproduzir som', 'error');
    });
    this.currentAudio = audio;
    this.playingSoundId = soundId;
    this.render();
  }

  private openPlaylistConfig(playlistId: string): void {
    windowManager.open(`playlist-config-${playlistId}`, PlaylistConfigWindow, {
      playlistId,
      onSaved: () => {
        this.playlistsLoaded = false;
        void this.loadPlaylists().then(() => this.render());
      },
    });
  }

  private openSoundConfig(playlistId: string, soundId: string): void {
    windowManager.open(`sound-config-${soundId}`, SoundConfigWindow, {
      playlistId,
      soundId,
      onSaved: () => {
        this.playlistsLoaded = false;
        void this.loadPlaylists().then(() => this.render());
      },
    });
  }

  private async createCompendiumPack(folderId?: string): Promise<void> {
    const packType = await showSelectDialog('Novo Compêndio', 'Tipo do pack', [
      { value: 'Actor', label: 'Ator' },
      { value: 'Item', label: 'Item' },
      { value: 'Scene', label: 'Cena' },
      { value: 'JournalEntry', label: 'Diário' },
      { value: 'RollTable', label: 'Tabela de Rolagem' },
      { value: 'Macro', label: 'Macro' },
      { value: 'Adventure', label: 'Aventura' },
    ]);
    if (!packType) return;
    try {
      const name = nextDefaultName('Novo Pack', this.compendiumPacks.map(p => p.name));
      const pack = await api.post<{ id: string }>('/compendium', {
        worldId: this.worldId,
        name,
        type: packType,
        folderId: folderId || '',
      });
      if (!this.compendiumPacks.some((p) => p.id === pack.id)) {
        this.compendiumPacks.push({ id: pack.id, worldId: this.worldId, name, type: packType, entryCount: 0, folderId: folderId || '' });
      }
      this.compendiumPacksLoaded = true;
      this.render();
      windowManager.open(`compendium-pack-${pack.id}`, CompendiumPackWindow, { packId: pack.id, packType });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar pack', 'error');
    }
  }

  private async nextTurn(): Promise<void> {
    if (this.isProcessingCombatAction) return;
    this.isProcessingCombatAction = true;
    try {
      const updated = await api.post<any>(`/combat/${this.worldId}/next`);
      this.combat = updated;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error advancing turn', 'error');
    } finally {
      this.isProcessingCombatAction = false;
    }
  }

  private async endCombat(): Promise<void> {
    if (this.isProcessingCombatAction) return;
    this.isProcessingCombatAction = true;
    try {
      await api.post<any>(`/combat/${this.worldId}/end`);
      this.combat = null;
      this.combatLoaded = false;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error ending combat', 'error');
    } finally {
      this.isProcessingCombatAction = false;
    }
  }

  private async startCombatWithDexInitiative(): Promise<void> {
    const castIds = Array.from(this.gameHud?.canvasManager?.getSelectedTokenIds() ?? []);
    if (castIds.length === 0) {
      showToast('Selecione ao menos um token no canvas pra entrar em combate.', 'info');
      return;
    }
    const activeSystemId = systemRegistry.getActive()?.id;
    const initiativeFormula = (activeSystemId && (window as any).Loom?.settings?.get(activeSystemId, 'initiativeFormula')) || '1d20';
    try {
      const updated = await api.post<any>(`/combat/${this.worldId}/dex-initiative`, { castIds, initiativeFormula });
      this.combat = updated;
      this.combatLoaded = true;
      this.render();
    } catch (e: any) {
      const msg = e?.message || '';
      if (e?.status === 400 && msg.includes('No cast')) {
        showToast('Você não tem tokens no cenário — arraste atores para o cenário primeiro.', 'info');
      } else {
        showToast(msg || 'Erro ao iniciar combate', 'error');
      }
    }
  }

  private updateCombatantHP = debounce(async (castId: string, hp: number): Promise<void> => {
    try {
      const updated = await api.put<any>(`/combat/${this.worldId}/combatant/${castId}`, { hp });
      this.combat = updated;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Error updating HP', 'error');
    }
  }, 300);

  private async addCombatantGroup(): Promise<void> {
    if (!this.combat) return;
    const name = nextDefaultName('Novo Grupo', (this.combat.groups || []).map((g: CombatantGroupSummary) => g.name));
    try {
      // The route returns only the created group (201) — reloads combat to get the updated array.
      await api.post(`/combat/${this.worldId}/group`, { name });
      await this.reloadCombat();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar grupo', 'error');
    }
  }

  private async renameCombatantGroup(groupId: string): Promise<void> {
    if (!this.combat) return;
    const group = (this.combat.groups || []).find((g: CombatantGroupSummary) => g.id === groupId);
    if (!group) return;
    const name = await showPrompt('Renomear Grupo', 'Nome do grupo', group.name);
    if (!name || !name.trim()) return;
    try {
      await api.put(`/combat/${this.worldId}/group/${groupId}`, { name: name.trim() });
      group.name = name.trim();
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao renomear grupo', 'error');
    }
  }

  private async deleteCombatantGroup(groupId: string): Promise<void> {
    if (!this.combat) return;
    const confirmed = await showConfirm('Excluir Grupo', 'Deseja remover este grupo? Os combatentes voltam pra iniciativa individual.');
    if (!confirmed) return;
    try {
      await api.delete(`/combat/${this.worldId}/group/${groupId}`);
      await this.reloadCombat();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover grupo', 'error');
    }
  }

  private async setCombatantGroup(castId: string, groupId: string): Promise<void> {
    if (!this.combat) return;
    try {
      const updated = await api.put<any>(`/combat/${this.worldId}/combatant/${castId}`, { groupId: groupId || null });
      this.combat = updated;
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao mover combatente', 'error');
    }
  }

  private setGroupInitiative = debounce(async (groupId: string, initiative: number | null): Promise<void> => {
    try {
      await api.put(`/combat/${this.worldId}/group/${groupId}`, { initiative });
      if (this.combat) {
        const group = (this.combat.groups || []).find((g: CombatantGroupSummary) => g.id === groupId);
        if (group) group.initiative = initiative;
        this.render();
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao definir iniciativa do grupo', 'error');
    }
  }, 300);

  private async reloadCombat(): Promise<void> {
    try {
      this.combat = await api.get<any>(`/combat/${this.worldId}`);
      this.render();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao recarregar combate', 'error');
    }
  }

  loadChatHistory(rawMessages: any[]): void {
    this.messages = rawMessages.map((m) => {
      const isRoll = m.type === 'roll';
      let roll: RollResult | undefined;
      if (isRoll && m.rollData && m.rollData !== 'null') {
        try { roll = JSON.parse(m.rollData); } catch { }
      }
      let speaker: ChatSpeaker | undefined;
      if (m.speaker) {
        try { speaker = typeof m.speaker === 'string' ? JSON.parse(m.speaker) : m.speaker; } catch { }
      }
      let flags: Record<string, Record<string, any>> | undefined;
      if (m.flags) {
        try { flags = typeof m.flags === 'string' ? JSON.parse(m.flags) : m.flags; } catch { }
      }
      return {
        id: m.id,
        userName: m.userName || 'Unknown',
        userColor: m.userColor || '#CCCCCC',
        userAvatar: this.userCache.get(m.userId)?.avatarUrl,
        content: m.content || '',
        timestamp: new Date(m.createdAt || Date.now()),
        isRoll,
        roll,
        rollMode: (roll?.mode as RollMode) || 'public',
        userId: m.userId,
        speaker,
        flags,
      };
    });
    this.updateChatDisplay();
  }

  /** Wraps textarea selection in light markup (**bold** / ```code block```).
   * Without selection, inserts an already selected placeholder — like Discord/GitHub. */
  private applyChatFormat(textarea: HTMLTextAreaElement, kind: 'bold' | 'code' | 'link'): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = end > start;
    let selected = '';
    if (kind === 'bold') selected = hasSelection ? textarea.value.slice(start, end) : 'texto';
    else if (kind === 'code') selected = hasSelection ? textarea.value.slice(start, end) : 'código';
    else if (kind === 'link') selected = hasSelection ? textarea.value.slice(start, end) : 'texto';

    let wrapped = '';
    if (kind === 'bold') wrapped = `**${selected}**`;
    else if (kind === 'code') wrapped = `\`\`\`\n${selected}\n\`\`\``;
    else if (kind === 'link') wrapped = `[${selected}](url)`;

    textarea.focus();
    textarea.setRangeText(wrapped, start, end, 'end');
  }

  /** Opens the file picker and uploads the image via the upload endpoint already used
   * in avatar/asset (`POST /api/assets/upload`), then inserts `![img](url)`
   * into the textarea — rendered in `renderMessage()` (chat-message-card.ts). */
  private pickChatImage(textarea: HTMLTextAreaElement): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void this.uploadChatImage(file, textarea);
    });
    input.click();
  }

  private async uploadChatImage(file: File, textarea: HTMLTextAreaElement): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const qs = this.worldId ? `?worldId=${this.worldId}` : '';
      const res = await fetch(`/api/assets/upload${qs}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no upload');
      const url = data.path.startsWith('http') || data.path.startsWith('/') ? data.path : `/${data.path}`;
      const pos = textarea.selectionStart;
      textarea.focus();
      textarea.setRangeText(`![img](${url})`, pos, pos, 'end');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao enviar imagem', 'error');
    }
  }

  private sendChatMessage(fromInput?: HTMLTextAreaElement): void {
    const input = fromInput ?? this.element.querySelector<HTMLTextAreaElement>(
      '[name="chat-input"]',
    );
    if (!input || !input.value) return;

    const content = input.value;
    input.value = '';

    if (content.startsWith('/r ')) {
      dispatchRoll({
        worldId: this.worldId,
        userId: this.userId,
        userName: this.session?.userName || 'Anonymous',
        userColor: this.session?.userColor || '#888',
        formula: content.slice(3).trim(),
        mode: this.activeRollMode,
      });
      return;
    }

    wsClient.send('chat.message', {
      worldId: this.worldId,
      content,
      userId: this.userId,
      ...(this.speakAs ? { speaker: this.speakAs } : {}),
    });
  }

  /**
   * Chat overlay that stays OUTSIDE `this.element` (`#hud-sidebar`), on purpose:
   * `#hud-sidebar` entirely slides via `transform: translateX()` when collapsed
   * (see `.hud-sidebar.collapsed` in screens.css) — anything inside it disappears
   * with it. The persistent input and card toasts need to remain visible with
   * the sidebar collapsed, so they live in their own element attached to `document.body`.
   */
  private setupCollapsedOverlay(): void {
    this.collapsedOverlayEl = document.createElement('div');
    this.collapsedOverlayEl.className = 'sidebar-collapsed-chat';
    this.collapsedOverlayEl.innerHTML = `
      <div class="sidebar-collapsed-toasts"></div>
      <div class="sidebar-collapsed-editor">
        <div class="sidebar-collapsed-format-bar">
          <span class="sidebar-collapsed-format-label">Formatação</span>
          <span class="sidebar-collapsed-format-divider">|</span>
          <button type="button" data-action="chat-quick-dice" title="Rolar Dados Rápidos (/r)"><i class="rpg-d20"></i></button>
          <button type="button" data-action="chat-fmt-image" title="Inserir Imagem"><i class="fa-solid fa-image"></i></button>
          <button type="button" data-action="chat-fmt-link" title="Link"><i class="fa-solid fa-link"></i></button>
          <button type="button" data-action="chat-fmt-bold" title="Negrito"><i class="fa-solid fa-bold"></i></button>
          <button type="button" data-action="chat-fmt-code" title="Código"><i class="fa-solid fa-code"></i></button>
        </div>
        <textarea name="chat-input-collapsed" class="sidebar-collapsed-input" placeholder="${t('sidebar.chatPlaceholder')}" rows="1"></textarea>
      </div>
    `;
    this.collapsedToastsEl = this.collapsedOverlayEl.querySelector('.sidebar-collapsed-toasts')!;
    document.body.appendChild(this.collapsedOverlayEl);
    this.updateCollapsedOverlayVisibility();

    this.collapsedOverlayEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.getAttribute('name') !== 'chat-input-collapsed') return;
      e.preventDefault();
      this.sendChatMessage(target as HTMLTextAreaElement);
    });

    // The overlay lives outside `this.element` (see comment in the class above),
    // so it doesn't receive the [data-action] dispatch from BaseComponent — it needs
    // its own delegated listener here, just for these formatting buttons.
    this.collapsedOverlayEl.addEventListener('click', (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'chat-fmt-bold' || action === 'chat-fmt-code' || action === 'chat-fmt-image' || action === 'chat-fmt-link' || action === 'chat-quick-dice') {
        this.onAction(action, null, btn);
      }
    });

    const collapsedInput = this.collapsedOverlayEl.querySelector<HTMLTextAreaElement>('.sidebar-collapsed-input')!;
    collapsedInput.addEventListener('focus', () => collapsedInput.classList.add('expanded'));
    collapsedInput.addEventListener('blur', () => {
      if (!collapsedInput.value) collapsedInput.classList.remove('expanded');
    });
  }

  private updateCollapsedOverlayVisibility(): void {
    this.collapsedOverlayEl?.classList.toggle('visible', this.collapsed);
  }

  /** Mirrors the roll-mode/speak-as buttons of the expanded panel (line ~966), except
   * stacked vertically. */
  private collapsedIconsTemplate(): string {
    const actor = this.myActorId ? this.actors.find((a) => a.id === this.myActorId) : null;
    const speakOn = this.speakAsActive && !!actor;

    const rollButtons = ROLL_MODES.map(m => `
      <button class="roll-mode-btn${this.activeRollMode === m.id ? ' active' : ''}"
        data-action="roll-mode-${m.id}" title="${m.label}">${m.icon}</button>
    `).join('');

    const speakButton = !actor
      ? `<button type="button" class="roll-mode-btn" data-action="toggle-speak-as" disabled
           title="${t('sidebar.chatSpeakAsNoCharacter')}"><i class="fa-solid fa-masks-theater"></i></button>`
      : `<button type="button" class="roll-mode-btn${speakOn ? ' active' : ''}" data-action="toggle-speak-as"
           title="${speakOn ? actor.name : t('sidebar.chatSpeakAsCharacter')}"><i class="fa-solid fa-masks-theater"></i></button>`;

    return rollButtons + speakButton;
  }

  /**
   * Temporary toast-like card, only appears with the sidebar collapsed — disappears by itself
   * after a while, or is pushed out when the stack exceeds the limit
   * (new message enters, the oldest one exits prematurely).
   */
  private pushCollapsedToast(msg: ChatMessage): void {
    if (!this.collapsed || !this.collapsedToastsEl) return;

    const MAX_VISIBLE = 3;
    const AUTO_DISMISS_MS = 6000;

    const card = document.createElement('div');
    card.className = 'sidebar-collapsed-toast';
    card.innerHTML = this.renderMessage(msg);
    this.collapsedToastsEl.appendChild(card);

    const timeoutId = window.setTimeout(() => card.remove(), AUTO_DISMISS_MS);
    card.dataset.timeoutId = String(timeoutId);

    while (this.collapsedToastsEl.children.length > MAX_VISIBLE) {
      const oldest = this.collapsedToastsEl.firstElementChild as HTMLElement | null;
      if (!oldest) break;
      const oldTimeoutId = Number(oldest.dataset.timeoutId);
      if (oldTimeoutId) clearTimeout(oldTimeoutId);
      oldest.remove();
    }
  }

  private setupChatScrollObserver(): void {
    this.chatResizeObserver?.disconnect();
    this.chatResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        if (w > 40 && this.tabs.active === 'chat') {
          this.scrollChatToBottom();
        }
      }
    });
    this.chatResizeObserver.observe(this.element);
  }

  private scrollChatToBottom(): void {
    const messageList = this.element.querySelector('#chat-messages');
    if (!messageList) return;
    requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
  }

  private updateChatDisplay(): void {
    const messageList = this.element.querySelector('#chat-messages');
    if (!messageList) return;

    // Before changing innerHTML: if it was already at the bottom (or the list is
    // empty — first load), keeps it glued to the bottom afterwards.
    const wasAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 40;

    messageList.innerHTML = this.messages.map(msg => this.renderMessage(msg)).join('');
    // Only forces scroll to the bottom if it was already there — without this check, ANY
    // call to `updateChatDisplay()` (including those triggered by any `actor.updated`
    // while the chat tab is active, e.g.: clicking a resource dot on the
    // sheet) forcefully threw the scroll to the bottom, losing the position of whoever was reading
    // history further up.
    if (!this.collapsed && wasAtBottom) this.scrollChatToBottom();

    // Dice icons (rolls) load AFTER the HTML enters the DOM — the
    // actual card height only becomes right when the image finishes loading.
    // Without this, the scroll calculated right above (before the images load)
    // would get "stuck in the middle" as soon as they finished and the list grew,
    // especially noticeable when reloading the page with a full history.
    if (wasAtBottom) {
      messageList.querySelectorAll('img').forEach((img) => {
        if (!(img as HTMLImageElement).complete) {
          img.addEventListener('load', () => this.scrollChatToBottom(), { once: true });
        }
      });
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public updateStage(data: any): void {
    const isActiveUpdate = data.isActive === true;

    // If activating this stage, deactivate all other stages first
    if (isActiveUpdate) {
      this.stages.forEach(s => {
        if (s.id !== data.id) s.isActive = false;
      });
    }

    const idx = this.stages.findIndex((s) => s.id === data.id);
    if (idx !== -1) {
      this.stages[idx] = {
        ...this.stages[idx],
        name: data.name !== undefined ? data.name : this.stages[idx].name,
        isActive: data.isActive !== undefined ? data.isActive : this.stages[idx].isActive,
        thumbUrl: data.thumbUrl !== undefined ? data.thumbUrl : this.stages[idx].thumbUrl,
      };
      this.render();
    }
  }

  public addStage(data: any): void {
    if (!this.stages.some((s) => s.id === data.id)) {
      this.stages.push({
        id: data.id,
        name: data.name,
        isActive: data.isActive || false,
        thumbUrl: data.thumbUrl || data.backgroundUrl || '',
        folderId: data.folderId || '',
      });
      this.stagesLoaded = true;
      this.render();
    }
  }

  public removeStage(id: string): void {
    this.stages = this.stages.filter((s) => s.id !== id);
    this.render();
  }

  destroy(): void {
    this.element.removeEventListener('contextmenu', this.onChatCardContextMenu);
    this.collapsedOverlayEl?.remove();
    this.chatResizeObserver?.disconnect();
    this.unsubscribeChat?.();
    this.unsubscribeRoll?.();
    this.unsubscribeMessageDeleted?.();
    this.unsubscribeMessageUpdated?.();
    this.unsubscribeChatCleared?.();
    this.unsubscribeUserUpdate?.();
    this.unsubscribeCombat.forEach((fn) => fn());
    this.unsubscribeCombat = [];
    this.unsubscribeActors.forEach((fn) => fn());
    this.unsubscribeActors = [];
    this.unsubscribeItems.forEach((fn) => fn());
    this.unsubscribeItems = [];
    this.unsubscribeDecks.forEach((fn) => fn());
    this.unsubscribeDecks = [];
    super.destroy();
  }
}
