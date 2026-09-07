/*******************************************************************************
 * LoomVTT
 * client/core/const.ts
 *
 *
 * Global engine constants, exposed as `window.CONST`. Native to Loom.
 ******************************************************************************/

export const CONST_VALUES = {
  // --- Document ownership / users -------------------------------------------------
  DOCUMENT_OWNERSHIP_LEVELS: {
    INHERIT: -1,
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3,
  },
  DOCUMENT_META_OWNERSHIP_LEVELS: {
    NOOWNER: -2,
    DEFAULT: -1,
  },
  USER_ROLES: {
    NONE: 0,
    PLAYER: 1,
    TRUSTED: 2,
    ASSISTANT: 3,
    GAMEMASTER: 4,
  },
  USER_ROLE_NAMES: {
    0: 'NONE',
    1: 'PLAYER',
    2: 'TRUSTED',
    3: 'ASSISTANT',
    4: 'GAMEMASTER',
  },
  // Simplified shape: the reference format nests {defaultRole, label, hint,
  // requiredRoles} per key — kept here as just the default role number, the
  // part code actually branches on (`game.user.can(...)`  checks against this).
  USER_PERMISSIONS: {
    ACTOR_CREATE: { defaultRole: 3 },
    BROADCAST_AUDIO: { defaultRole: 1 },
    BROADCAST_VIDEO: { defaultRole: 1 },
    CARDS_CREATE: { defaultRole: 3 },
    DRAWING_CREATE: { defaultRole: 3 },
    FILES_BROWSE: { defaultRole: 3 },
    FILES_UPLOAD: { defaultRole: 3 },
    ITEM_CREATE: { defaultRole: 3 },
    JOURNAL_CREATE: { defaultRole: 3 },
    MACRO_SCRIPT: { defaultRole: 3 },
    MANUAL_ROLLS: { defaultRole: 1 },
    MESSAGE_WHISPER: { defaultRole: 1 },
    NOTE_CREATE: { defaultRole: 3 },
    PING_CANVAS: { defaultRole: 1 },
    PLAYLIST_CREATE: { defaultRole: 3 },
    QUERY_USER: { defaultRole: 1 },
    REGION_CREATE: { defaultRole: 3 },
    SETTINGS_MODIFY: { defaultRole: 3 },
    SHOW_CURSOR: { defaultRole: 1 },
    SHOW_RULER: { defaultRole: 1 },
    TOKEN_CONFIGURE: { defaultRole: 3 },
    TOKEN_CREATE: { defaultRole: 3 },
    TOKEN_DELETE: { defaultRole: 3 },
    WALL_DOORS: { defaultRole: 1 },
  },

  // --- Active Effects ---------------------------------------------------------------
  // Verified 26/08/2026: keys are lowercase, values are apply-order priorities.
  ACTIVE_EFFECT_CHANGE_TYPES: {
    custom: 0,
    multiply: 10,
    add: 20,
    subtract: 20,
    downgrade: 30,
    upgrade: 40,
    override: 50,
  },
  ACTIVE_EFFECT_CHANGE_PHASES: {
    APPLY_AE: 0,
    OVERRIDE: 1,
  },
  ACTIVE_EFFECT_DURATION_UNITS: {
    NONE: '',
    TURNS: 'turns',
    ROUNDS: 'rounds',
    SECONDS: 'seconds',
  },
  ACTIVE_EFFECT_TIME_DURATION_UNITS: {
    SECONDS: 'seconds',
    MINUTES: 'minutes',
    HOURS: 'hours',
    DAYS: 'days',
    WEEKS: 'weeks',
    MONTHS: 'months',
    YEARS: 'years',
  },
  ACTIVE_EFFECT_EXPIRY_EVENTS: {
    NONE: 0,
    TURN_START: 1,
    TURN_END: 2,
  },
  ACTIVE_EFFECT_SHOW_ICON: {
    NEVER: 0,
    ALWAYS: 1,
    HUD_ONLY: 2,
  },

  // --- Chat ---------------------------------------------------------------------
  // Verified 26/08/2026.
  CHAT_MESSAGE_STYLES: {
    OTHER: 0,
    OOC: 1,
    IC: 2,
    EMOTE: 3,
  },

  // --- Grid / canvas geometry -----------------------------------------------------
  // Verified 26/08/2026.
  GRID_TYPES: {
    GRIDLESS: 0,
    SQUARE: 1,
    HEXODDR: 2,
    HEXEVENR: 3,
    HEXODDQ: 4,
    HEXEVENQ: 5,
  },
  GRID_MIN_SIZE: 50,
  GRID_DIAGONALS: {
    EQUIDISTANT: 0,
    EXACT: 1,
    APPROXIMATE: 2,
    RECTILINEAR: 3,
    ALTERNATING_1: 4,
    ALTERNATING_2: 5,
    ILLEGAL: 6,
  },
  GRID_SNAPPING_MODES: {
    CENTER: 1,
    VERTEX: 2,
    CORNER: 2,
    EDGE_MIDPOINT: 4,
    TOP_LEFT_VERTEX: 16,
    TOP_RIGHT_VERTEX: 32,
    BOTTOM_LEFT_VERTEX: 64,
    BOTTOM_RIGHT_VERTEX: 128,
    VERTICAL_EDGE_MIDPOINT: 256,
    HORIZONTAL_EDGE_MIDPOINT: 512,
  },

  // --- Edges (walls-as-graph, v13+) -------------------------------------------------
  EDGE_DIRECTIONS: {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    BOTH: 3,
  },
  EDGE_DIRECTION_MODES: {
    NORMAL: 0,
    REVERSED: 1,
  },
  EDGE_RESTRICTION_TYPES: ['light', 'sight', 'sound', 'move'],
  EDGE_SENSE_TYPES: {
    NONE: 0,
    LIMITED: 10,
    NORMAL: 20,
    PROXIMITY: 30,
    DISTANCE: 40,
  },

  // --- Walls -----------------------------------------------------------------------
  // WALL_DOOR_TYPES/STATES/RESTRICTION_TYPES verified 26/08/2026.
  WALL_DOOR_TYPES: {
    NONE: 0,
    DOOR: 1,
    SECRET: 2,
  },
  WALL_DOOR_STATES: {
    CLOSED: 0,
    OPEN: 1,
    LOCKED: 2,
  },
  WALL_DOOR_INTERACTIONS: ['open', 'close', 'lock', 'unlock', 'test'],
  WALL_MOVEMENT_TYPES: {
    NONE: 0,
    NORMAL: 20,
  },
  WALL_RESTRICTION_TYPES: ['light', 'sight', 'sound', 'move'],

  // --- Lighting/vision ---------------------------------------------------------------
  // Verified 26/08/2026.
  LIGHTING_LEVELS: {
    DARKNESS: -2,
    HALFDARK: -1,
    UNLIT: 0,
    DIM: 1,
    BRIGHT: 2,
    BRIGHTEST: 3,
  },
  OCCLUSION_MODES: {
    NONE: 0,
    FADE: 1,
    ROOF: 2,
    VISION: 3,
  },
  TILE_OCCLUSION_MODES: {
    NONE: 0,
    FADE: 1,
    ROOF: 2,
    VISION: 3,
  },
  TOKEN_OCCLUSION_MODES: {
    NONE: 0,
    FADE: 1,
  },

  // --- Tokens -----------------------------------------------------------------------
  // TOKEN_DISPOSITIONS/DISPLAY_MODES verified 26/08/2026.
  TOKEN_DISPOSITIONS: {
    SECRET: -2,
    HOSTILE: -1,
    NEUTRAL: 0,
    FRIENDLY: 1,
  },
  TOKEN_DISPLAY_MODES: {
    NONE: 0,
    CONTROL: 10,
    OWNER_HOVER: 20,
    HOVER: 30,
    OWNER: 40,
    ALWAYS: 50,
  },
  TOKEN_SHAPES: {
    ELLIPSE_1: 0,
    ELLIPSE_2: 1,
    TRAPEZOID_1: 2,
    TRAPEZOID_2: 3,
    RECTANGLE_1: 4,
    RECTANGLE_2: 5,
  },
  TOKEN_TURN_MARKER_MODES: {
    DEFAULT: 0,
    DISABLED: 1,
    CUSTOM: 2,
  },
  MOVEMENT_DIRECTIONS: {
    UP: 1,
    DOWN: 2,
    LEFT: 4,
    RIGHT: 8,
    UP_LEFT: 5,
    UP_RIGHT: 9,
    DOWN_LEFT: 6,
    DOWN_RIGHT: 10,
    DESCEND: 16,
    ASCEND: 32,
  },
  // --- Regions (v12+) ----------------------------------------------------------------
  REGION_EVENTS: {
    BEHAVIOR_STATUS: 'behaviorStatus',
    BEHAVIOR_ACTIVATED: 'behaviorActivated',
    BEHAVIOR_DEACTIVATED: 'behaviorDeactivated',
    BEHAVIOR_VIEWED: 'behaviorViewed',
    BEHAVIOR_UNVIEWED: 'behaviorUnviewed',
    TOKEN_ENTER: 'tokenEnter',
    TOKEN_EXIT: 'tokenExit',
    TOKEN_MOVE_IN: 'tokenMoveIn',
    TOKEN_MOVE_OUT: 'tokenMoveOut',
    TOKEN_MOVE_WITHIN: 'tokenMoveWithin',
    TOKEN_ANIMATE_IN: 'tokenAnimateIn',
    TOKEN_ANIMATE_OUT: 'tokenAnimateOut',
    TOKEN_TURN_START: 'tokenTurnStart',
    TOKEN_TURN_END: 'tokenTurnEnd',
    TOKEN_ROUND_START: 'tokenRoundStart',
    TOKEN_ROUND_END: 'tokenRoundEnd',
  },
  REGION_MOVEMENT_SEGMENTS: {
    ENTER: 1,
    MOVE: 0,
    EXIT: -1,
  },
  REGION_VISIBILITY: {
    LAYER: 0,
    GAMEMASTER: 1,
    ALWAYS: 2,
  },

  // --- Drawings ------------------------------------------------------------------
  // Verified 26/08/2026.
  DRAWING_FILL_TYPES: {
    NONE: 0,
    SOLID: 1,
    PATTERN: 2,
  },

  // --- Macros ------------------------------------------------------------------
  // Verified 26/08/2026.
  MACRO_TYPES: {
    CHAT: 'chat',
    SCRIPT: 'script',
  },
  MACRO_SCOPES: ['global', 'actors', 'actor'],

  // --- Cards -----------------------------------------------------------------------
  CARD_DRAW_MODES: {
    TOP: 0,
    BOTTOM: 1,
    RANDOM: 2,
  },

  // --- Playlists -----------------------------------------------------------------------
  PLAYLIST_MODES: {
    DISABLED: -1,
    SEQUENTIAL: 0,
    SHUFFLE: 1,
    SIMULTANEOUS: 2,
  },
  PLAYLIST_SORT_MODES: {
    ALPHABETICAL: 'a',
    MANUAL: 'm',
  },

  // --- Folders / documents ---------------------------------------------------------
  FOLDER_MAX_DEPTH: 4,
  FOLDER_DOCUMENT_TYPES: [
    'Actor', 'Adventure', 'Cards', 'Item', 'JournalEntry', 'Playlist', 'RollTable', 'Scene',
  ],
  COMPENDIUM_DOCUMENT_TYPES: [
    'Actor', 'Adventure', 'Cards', 'Item', 'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene',
  ],
  BASE_DOCUMENT_TYPE: 'base',
  EMBEDDED_DOCUMENT_TYPES: [
    'ActiveEffect', 'ActorDelta', 'Card', 'Combatant', 'CombatantGroup', 'Item',
    'JournalEntryCategory', 'JournalEntryPage', 'PlaylistSound', 'TableResult',
    'AmbientLight', 'AmbientSound', 'Drawing', 'Note', 'Region', 'RegionBehavior',
    'Tile', 'Token', 'Wall',
  ],
  WORLD_DOCUMENT_TYPES: [
    'Actor', 'Cards', 'ChatMessage', 'Combat', 'FogExploration', 'Folder', 'Item',
    'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene', 'Setting', 'User',
  ],
  PRIMARY_DOCUMENT_TYPES: [
    'Actor', 'Adventure', 'Cards', 'ChatMessage', 'Combat', 'FogExploration', 'Folder',
    'Item', 'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene', 'Setting', 'User',
  ],
  ALL_DOCUMENT_TYPES: [
    'ActiveEffect', 'Actor', 'ActorDelta', 'Adventure', 'AmbientLight', 'AmbientSound',
    'Card', 'Cards', 'ChatMessage', 'Combat', 'Combatant', 'CombatantGroup', 'Drawing',
    'FogExploration', 'Folder', 'Item', 'JournalEntry', 'JournalEntryCategory',
    'JournalEntryPage', 'Macro', 'Note', 'Playlist', 'PlaylistSound', 'Region',
    'RegionBehavior', 'RollTable', 'Scene', 'Setting', 'TableResult', 'Tile', 'Token',
    'User', 'Wall',
  ],
  SYSTEM_SPECIFIC_COMPENDIUM_TYPES: ['Actor', 'Item'],
  DOCUMENT_LINK_TYPES: [
    'Actor', 'Cards', 'Item', 'JournalEntry', 'JournalEntryPage', 'Macro', 'PlaylistSound',
    'RollTable', 'Scene',
  ],
  TABLE_RESULT_TYPES: {
    TEXT: 'text',
    DOCUMENT: 'document',
  },
  JOURNAL_ENTRY_PAGE_FORMATS: {
    HTML: 1,
    MARKDOWN: 2,
  },

  // --- Files / media -----------------------------------------------------------------
  AUDIO_FILE_EXTENSIONS: {
    aac: 'audio/aac', flac: 'audio/flac', m4a: 'audio/mp4', mid: 'audio/midi',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', webm: 'audio/webm',
  },
  VIDEO_FILE_EXTENSIONS: { m4v: 'video/mp4', mp4: 'video/mp4', ogv: 'video/ogg', webm: 'video/webm' },
  IMAGE_FILE_EXTENSIONS: {
    apng: 'image/apng', avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif',
    jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml',
    tiff: 'image/tiff', webp: 'image/webp',
  },
  TEXT_FILE_EXTENSIONS: {
    csv: 'text/csv', json: 'application/json', md: 'text/markdown', pdf: 'application/pdf',
    tsv: 'text/tab-separated-values', txt: 'text/plain', xml: 'application/xml', yml: 'application/yaml',
  },
  FONT_FILE_EXTENSIONS: { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' },
  GRAPHICS_FILE_EXTENSIONS: { usdz: 'model/vnd.usdz+zip' },
  HTML_FILE_EXTENSIONS: { html: 'text/html', htm: 'text/html' },
  MEDIA_FILE_CATEGORIES: ['IMAGE', 'VIDEO', 'AUDIO', 'TEXT', 'FONT', 'GRAPHICS'],
  MEDIA_MIME_TYPES: [
    'image/apng', 'image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png',
    'image/svg+xml', 'image/tiff', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    'audio/webm', 'video/mp4', 'video/ogg', 'video/webm',
  ],
  UPLOADABLE_FILE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp3', 'ogg', 'wav', 'webm', 'mp4'],
  FILE_CATEGORIES: {},
  FILE_PICKER_PUBLIC_DIRS: ['cards', 'icons', 'sounds', 'ui'],

  // --- Canvas performance / cursors -------------------------------------------------
  CANVAS_PERFORMANCE_MODES: { LOW: 0, MED: 1, HIGH: 2, MAX: 3 },
  CURSOR_STYLES: { default: 'default', pointer: 'pointer', grab: 'grab', grabbing: 'grabbing' },

  // --- Combat -----------------------------------------------------------------------
  COMBAT_ANNOUNCEMENTS: ['startEncounter', 'nextUp', 'yourTurn'],

  // --- Fonts / UI ---------------------------------------------------------------------
  FONT_WEIGHTS: { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 },
  // Real Loom themes (theme-manager.ts) — dark is the default.
  CSS_THEMES: { dark: 'THEME.dark', light: 'THEME.light' },
  TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2, LEFT: 3, RIGHT: 4 },
  TEXTURE_DATA_FIT_MODES: ['fill', 'contain', 'cover', 'width', 'height'],
  TEXTURE_FILE_EXTENSIONS: ['apng', 'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'tiff', 'webp'],

  // --- Text enrichment / HTML sanitization -------------------------------------------
  TEXT_ENRICH_EMBED_MAX_DEPTH: 5,
  ALLOWED_HTML_TAGS: [
    'header', 'main', 'section', 'article', 'aside', 'footer', 'nav', 'figure',
    'figcaption', 'div', 'address', 'p', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'blockquote', 'q', 'pre', 'code', 'hr', 'img', 'video', 'audio', 'source',
    'track', 'a', 'b', 'strong', 'i', 'em', 'mark', 'small', 'del', 's', 'ins',
    'u', 'sub', 'sup', 'span', 'br', 'wbr', 'table', 'caption', 'colgroup',
    'col', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4',
    'h5', 'h6', 'form', 'label', 'input', 'select', 'option', 'button', 'details', 'summary',
  ],
  ALLOWED_HTML_ATTRIBUTES: {
    '*': ['class', 'id', 'title', 'style', 'draggable'],
    a: ['href', 'name', 'target'],
    img: ['src', 'alt', 'width', 'height'],
  },
  ALLOWED_URL_SCHEMES: ['http', 'https', 'data', 'mailto', 'discord'],
  ALLOWED_URL_SCHEMES_APPLIED_TO_ATTRIBUTES: ['href', 'src'],
  TRUSTED_IFRAME_DOMAINS: ['google.com', 'youtube.com', 'vimeo.com'],
  SHOWDOWN_OPTIONS: { disableForced4SpacesIndentedSublists: true, noHeaderId: true, parseImgDimensions: true, strikethrough: true, tables: true, tablesHeaderId: true },

  // --- Keybindings / settings -----------------------------------------------------
  KEYBINDING_PRECEDENCE: { PRIORITY: 0, NORMAL: 1, DEFERRED: 2 },
  SETTING_SCOPES: { CLIENT: 'client', WORLD: 'world', USER: 'user' },

  // --- Setup / package -----------------------------------------------------------
  PACKAGE_TYPES: ['world', 'system', 'module'],
  PACKAGE_AVAILABILITY_CODES: {
    UNKNOWN: 0, AVAILABLE: 1, REQUIRES_UPDATE: 2, REQUIRES_SYSTEM: 3,
    REQUIRES_DEPENDENCY: 4, REQUIRES_CORE_DOWNGRADE: 5, REQUIRES_CORE_UPGRADE_STABLE: 6,
    REQUIRES_CORE_UPGRADE_UNSTABLE: 7, MISSING_SYSTEM: -1, MISSING_DEPENDENCY: -2,
    UNVERIFIED_GENERATION: -3, VERIFIED: 8,
  },
  SETUP_PACKAGE_PROGRESS: {
    ACTIONS: {
      CREATE_BACKUP: 'createBackup', RESTORE_BACKUP: 'restoreBackup', DELETE_BACKUP: 'deleteBackup',
      CREATE_SNAPSHOT: 'createSnapshot', INSTALL_PKG: 'installPackage', LAUNCH_WORLD: 'launchWorld',
      UPDATE_CORE: 'updateCore', UPDATE_DOWNLOAD: 'updateDownload',
    },
    STEPS: {
      ARCHIVE: 'archive', CHECK_DISK_SPACE: 'checkDiskSpace', CLEAN_WORLD: 'cleanWorld',
      CONNECT_WORLD: 'connectWorld', MIGRATE_WORLD: 'migrateWorld', CONNECT_SETUP: 'connectSetup',
      DOWNLOAD: 'download', EXTRACT: 'extract', INSTALL: 'install', CLEANUP: 'cleanup',
      COMPLETE: 'complete', DELETE: 'delete', ERROR: 'error', VEND: 'vend', SNAPSHOT_MODULES: 'snapshotModules',
    },
  },
  SETUP_VIEWS: { AUTH: 'auth', LICENSE: 'license', SETUP: 'setup', PACKAGES: 'packages', TOURS: 'tours', WORKAROUND: 'workaround' },
  SOFTWARE_UPDATE_CHANNELS: ['alpha', 'beta', 'release'],
  GAME_VIEWS: ['join', 'setup', 'players', 'license', 'game', 'stream', 'auth', 'update'],

  // --- Misc -----------------------------------------------------------------------
  IDLE_THRESHOLD_MS: 300000,
  CLIPPER_SCALING_FACTOR: 100,
  SORT_INTEGER_DENSITY: 100000,
  PASSWORD_SAFE_STRING: '••••••••••••••••',
  ASCII: `_______________________________
 _     ___   ___  __  __
| |   / _ \\ / _ \\|  \\/  |
| |  | | | | | | | |\\/| |
| |__| |_| | |_| | |  | |
|_____\\___/ \\___/|_|  |_|
_______________________________`,
  // Loom does not have a separate public website — intentionally empty, not a forgotten
  // dead slot.
  WEBSITE_URL: '',
  WEBSITE_API_URL: '',
  WORLD_JOIN_THEMES: { default: 'WORLD.JoinThemeDefault', minimal: 'WORLD.JoinThemeMinimal' },
  DIRECTORY_SEARCH_MODES: { NAME: 'name', FULL: 'full' },
  CORE_SUPPORTED_LANGUAGES: ['en'],
  TIMEOUTS: { CORE_WEBSITE: 10000, PACKAGE_REPOSITORY: 5000, REMOTE_PACKAGE: 5000 },

  // Verified 26/08/2026.
  COMPATIBILITY_MODES: { SILENT: 0, WARNING: 1, ERROR: 2, FAILURE: 3 },
  FOG_EXPLORATION_MODES: { DISABLED: 0, INDIVIDUAL: 1, SHARED: 2 },
  // Labels only — real localized text depends on Loom.i18n, not hardcoded here.
  AUDIO_CHANNELS: { environment: 'AUDIO.CHANNELS.ENVIRONMENT.label', interface: 'AUDIO.CHANNELS.INTERFACE.label', music: 'AUDIO.CHANNELS.MUSIC.label' },

  // Own icon, not a borrowed default — this project doesn't ship third-party assets.
  DEFAULT_TOKEN: '/images/default-token.svg',
};
