import { BaseComponent } from '../../components/base-component.js';
import { applyUiOverride } from '../../core/ui-override.js';

export interface ToolItem {
  icon: string;
  label: string;
  id: string;
}

const DRAW_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-drawing' },
  { icon: '<i class="fas fa-paint-brush"></i>', label: 'Freehand', id: 'draw-freehand' },
  { icon: '<i class="far fa-square"></i>', label: 'Rectangle', id: 'draw-rectangle' },
  { icon: '<i class="far fa-circle"></i>', label: 'Circle', id: 'draw-circle' },
  { icon: '<i class="fas fa-slash"></i>', label: 'Line', id: 'draw-line' },
  { icon: '<i class="fas fa-draw-polygon"></i>', label: 'Polygon', id: 'draw-polygon' },
  { icon: '<i class="fas fa-font"></i>', label: 'Text', id: 'draw-text' },
];

const WALL_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-wall' },
  { icon: '<i class="fas fa-grip-lines"></i>', label: 'Basic Wall', id: 'walls' },
  { icon: '<i class="fas fa-mountain"></i>', label: 'Terrain', id: 'wall-terrain' },
  { icon: '<i class="fas fa-eye-slash"></i>', label: 'Invisible', id: 'wall-invisible' },
  { icon: '<i class="fas fa-eye"></i>', label: 'Ethereal', id: 'wall-ethereal' },
  { icon: '<i class="fas fa-door-open"></i>', label: 'Door', id: 'wall-door' },
  { icon: '<i class="fas fa-user-secret"></i>', label: 'Secret Door', id: 'wall-door-secret' },
  { icon: '<i class="far fa-window-maximize"></i>', label: 'Window', id: 'wall-window' },
  { icon: '<i class="fas fa-door-closed"></i>', label: 'Close Doors', id: 'wall-close-doors' },
  { icon: '<i class="fas fa-trash-alt"></i>', label: 'Clear Walls', id: 'wall-clear' },
];

const TILE_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-tile' },
  { icon: '<i class="fas fa-image"></i>', label: 'Place Tile', id: 'place-tile' },
  { icon: '<i class="fas fa-folder-open"></i>', label: 'Browse Tile', id: 'tile-browse' },
  { icon: '<i class="fas fa-th"></i>', label: 'Snap to Grid', id: 'tile-snap' },
  { icon: '<i class="fas fa-undo-alt"></i>', label: 'Clear Tiles', id: 'tile-clear' },
];

const LIGHT_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-light' },
  { icon: '<i class="fas fa-lightbulb"></i>', label: 'Create Light', id: 'create-light' },
  { icon: '<i class="fas fa-sun"></i>', label: 'Daylight Transition', id: 'light-daylight' },
  { icon: '<i class="fas fa-moon"></i>', label: 'Darkness Transition', id: 'light-darkness' },
  { icon: '<i class="fas fa-trash"></i>', label: 'Clear Lights', id: 'light-clear' },
];

const SOUND_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-sound' },
  { icon: '<i class="fas fa-volume-up"></i>', label: 'Place Sound', id: 'sounds' },
  { icon: '<i class="fas fa-volume-mute"></i>', label: 'Clear Sounds', id: 'sound-clear' },
];

const TEMPLATE_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-template' },
  { icon: '<i class="fas fa-play" style="transform: rotate(-90deg); font-size: 0.8rem;"></i>', label: 'Cone', id: 'template-cone' },
  { icon: '<i class="fas fa-ruler-horizontal"></i>', label: 'Ray', id: 'template-rect' },
];

const TOKEN_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-token' },
  { icon: '<i class="fas fa-ruler"></i>', label: 'Measure', id: 'measure' },
  { icon: '<i class="fas fa-bullseye"></i>', label: 'Targets', id: 'target' },
  { icon: '<i class="fas fa-arrows-alt"></i>', label: 'Unrestricted Mov.', id: 'unrestricted' },
];

const NOTES_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-mouse-pointer"></i>', label: 'Select', id: 'select-note' },
  { icon: '<i class="fas fa-eye"></i>', label: 'Toggle Visibility', id: 'toggle-notes' },
  { icon: '<i class="fas fa-plus"></i>', label: 'Create Note', id: 'create-note' },
];

const INTERACTION_SUBTOOLS: ToolItem[] = [
  { icon: '<i class="fas fa-bolt"></i>', label: 'Trap', id: 'int-trap' },
  { icon: '<i class="fas fa-arrows-alt-h"></i>', label: 'Teleport', id: 'int-teleport' },
  { icon: '<i class="fas fa-door-secret"></i>', label: 'Secret Door', id: 'int-door' },
  { icon: '<i class="fas fa-scroll"></i>', label: 'Sign', id: 'int-sign' },
  { icon: '<i class="fas fa-eye"></i>', label: 'Ambush', id: 'int-ambush' },
];

interface ToolHelpEntry {
  title: string;
  description: string;
  shortcuts: { label: string; keys: string }[];
}

const TOOL_HELP: Record<string, ToolHelpEntry> = {
  'select-token': {
    title: 'Select Tokens',
    description: 'Click to select a token. Drag to move. Use shortcuts for quick actions.',
    shortcuts: [
      { label: 'Select', keys: 'Click' },
      { label: 'Move', keys: 'Drag' },
      { label: 'Multiple', keys: 'Shift + Click' },
      { label: 'Rotate', keys: 'Ctrl + Scroll' },
      { label: 'HUD', keys: 'Right Click' },
      { label: 'Sheet', keys: 'Double Click' },
      { label: 'Delete', keys: 'Delete' },
      { label: 'Waypoint', keys: 'Ctrl + Click' },
      { label: 'Remove Waypoint', keys: 'Right Click' },
    ],
  },
  target: {
    title: 'Select Targets',
    description: 'Click a token to mark it as a target. The target is highlighted with orange borders for all players.',
    shortcuts: [
      { label: 'Mark Target', keys: 'Click' },
      { label: 'Multiple', keys: 'Shift + Click' },
    ],
  },
  measure: {
    title: 'Measure Distance',
    description: 'Click and drag to measure the distance between two points on the grid. Useful for checking ranges and movements.',
    shortcuts: [
      { label: 'Waypoint', keys: 'Ctrl + Click' },
      { label: 'Remove Waypoint', keys: 'Right Click' },
    ],
  },
  unrestricted: {
    title: 'Unrestricted Movement',
    description: 'When active, tokens can move through walls and impassable terrain without being blocked.',
    shortcuts: [
      { label: 'Toggle', keys: 'Click' },
    ],
  },
  'select-note': {
    title: 'Select Notes',
    description: 'Click to select a note on the map. Drag to move. Double click to open configuration.',
    shortcuts: [
      { label: 'Select', keys: 'Click' },
      { label: 'Move', keys: 'Drag' },
      { label: 'Configure', keys: 'Double Click' },
    ],
  },
  'toggle-notes': {
    title: 'Toggle Note Visibility',
    description: 'Shows or hides all note icons on the canvas.',
    shortcuts: [
      { label: 'Toggle', keys: 'Click' },
    ],
  },
  'create-note': {
    title: 'Create Note',
    description: 'Click on the canvas to create a new note at that point. Automatically opens configuration.',
    shortcuts: [
      { label: 'Create Note', keys: 'Click' },
    ],
  },
  'place-tile': {
    title: 'Place Tile',
    description: 'Drag an image from the Texture Browser to the canvas and drag to set the tile size.',
    shortcuts: [
      { label: 'Create', keys: 'Click + Drag' },
      { label: 'Move', keys: 'Drag' },
      { label: 'Rotate', keys: 'Ctrl + Scroll' },
      { label: 'HUD', keys: 'Right Click' },
      { label: 'Edit', keys: 'Double Click' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  'select-tile': {
    title: 'Select Tile',
    description: 'Click to select a tile. Drag to move. Use shortcuts for quick actions.',
    shortcuts: [
      { label: 'Move', keys: 'Drag' },
      { label: 'Rotate', keys: 'Ctrl + Scroll' },
      { label: 'Edit', keys: 'Double Click' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  token: {
    title: 'Token Tools',
    description: 'Opens the token tools menu: selection, measurement, and targeting.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  'walls-menu': {
    title: 'Wall Tools',
    description: 'Opens the menu for creating and editing walls, doors, and terrain.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  lighting: {
    title: 'Lighting Tools',
    description: 'Opens the menu for ambient lights and day/night transitions.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  notes: {
    title: 'Note Tools',
    description: 'Opens the map notes menu.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  tiles: {
    title: 'Tile Tools',
    description: 'Opens the tile menu: place, browse, and organize images on the map.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  drawing: {
    title: 'Drawing Tools',
    description: 'Opens the freehand drawing and geometric shapes menu.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  templates: {
    title: 'Area Templates',
    description: 'Opens the area of effect templates menu (cone, ray).',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  'select-drawing': {
    title: 'Select Drawing',
    description: 'Click to select a drawing. Drag to move.',
    shortcuts: [
      { label: 'Move', keys: 'Drag' },
      { label: 'Edit', keys: 'Double Click' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  'draw-freehand': {
    title: 'Freehand Drawing',
    description: 'Click and drag to draw a freehand line on the map.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  'draw-rectangle': {
    title: 'Rectangle',
    description: 'Click and drag to draw a rectangle.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  'draw-circle': {
    title: 'Circle',
    description: 'Click and drag to draw a circle.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  'draw-line': {
    title: 'Line',
    description: 'Click and drag to draw a straight line.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  'draw-polygon': {
    title: 'Polygon',
    description: 'Click to add points and form a polygon. Double click closes the shape.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Close shape', keys: 'Double Click' },
    ],
  },
  'draw-text': {
    title: 'Text',
    description: 'Click on the map to add text.',
    shortcuts: [{ label: 'Create', keys: 'Click' }],
  },
  'select-wall': {
    title: 'Select Wall',
    description: 'Click to select a wall or door. Drag to move.',
    shortcuts: [
      { label: 'Move', keys: 'Drag' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  walls: {
    title: 'Basic Wall',
    description: 'Click to add points and draw a wall that blocks movement and vision.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-terrain': {
    title: 'Terrain',
    description: 'Creates a terrain wall — blocks movement but not vision.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-invisible': {
    title: 'Invisible Wall',
    description: 'Creates a wall that blocks movement and vision, but is not drawn on the map.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-ethereal': {
    title: 'Ethereal Wall',
    description: 'Creates a wall that blocks vision but does not block movement.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-door': {
    title: 'Door',
    description: 'Creates a door that can be opened and closed during the game.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
      { label: 'Open/Close', keys: 'Right Click' },
    ],
  },
  'wall-door-secret': {
    title: 'Secret Door',
    description: 'Creates a secret door, visible only to the GM until discovered.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-window': {
    title: 'Window',
    description: 'Creates a window — blocks movement but allows partial vision.',
    shortcuts: [
      { label: 'Add point', keys: 'Click' },
      { label: 'Finish', keys: 'Double Click' },
    ],
  },
  'wall-close-doors': {
    title: 'Close Doors',
    description: 'Closes all open doors in the current scene at once.',
    shortcuts: [{ label: 'Close all', keys: 'Click' }],
  },
  'wall-clear': {
    title: 'Clear Walls',
    description: 'Removes all walls from the current scene.',
    shortcuts: [{ label: 'Remove all', keys: 'Click' }],
  },
  'tile-browse': {
    title: 'Browse Tile',
    description: 'Opens the texture browser to choose an image and place it on the map.',
    shortcuts: [{ label: 'Open browser', keys: 'Click' }],
  },
  'tile-snap': {
    title: 'Snap to Grid',
    description: 'Toggles whether tiles automatically snap to the grid when moving or creating.',
    shortcuts: [{ label: 'Toggle', keys: 'Click' }],
  },
  'tile-clear': {
    title: 'Clear Tiles',
    description: 'Removes all tiles from the current scene.',
    shortcuts: [{ label: 'Remove all', keys: 'Click' }],
  },
  'select-light': {
    title: 'Select Light',
    description: 'Click to select a light source. Drag to move.',
    shortcuts: [
      { label: 'Move', keys: 'Drag' },
      { label: 'Edit', keys: 'Double Click' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  'create-light': {
    title: 'Create Light',
    description: 'Click on the map to create a new ambient light source.',
    shortcuts: [{ label: 'Create', keys: 'Click' }],
  },
  'light-daylight': {
    title: 'Daylight Transition',
    description: 'Animates the scene to daylight darkness level.',
    shortcuts: [{ label: 'Apply', keys: 'Click' }],
  },
  'light-darkness': {
    title: 'Darkness Transition',
    description: 'Animates the scene to nighttime darkness level.',
    shortcuts: [{ label: 'Apply', keys: 'Click' }],
  },
  'light-clear': {
    title: 'Clear Lights',
    description: 'Removes all light sources from the current scene.',
    shortcuts: [{ label: 'Remove all', keys: 'Click' }],
  },
  'select-sound': {
    title: 'Select Sound',
    description: 'Click to select a sound source. Drag to move.',
    shortcuts: [
      { label: 'Move', keys: 'Drag' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  sounds: {
    title: 'Place Sound',
    description: 'Click on the map to place a new sound source.',
    shortcuts: [{ label: 'Create', keys: 'Click' }],
  },
  'sound-clear': {
    title: 'Clear Sounds',
    description: 'Removes all placed sounds from the current scene.',
    shortcuts: [{ label: 'Remove all', keys: 'Click' }],
  },
  'select-template': {
    title: 'Select Template',
    description: 'Click to select an area template. Delete removes the selected one.',
    shortcuts: [
      { label: 'Select', keys: 'Click' },
      { label: 'Delete', keys: 'Delete' },
    ],
  },
  'template-cone': {
    title: 'Cone Template',
    description: 'Click and drag to draw an area of effect cone template.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  'template-rect': {
    title: 'Ray Template',
    description: 'Click and drag to draw a ray/line area of effect template.',
    shortcuts: [{ label: 'Draw', keys: 'Click + Drag' }],
  },
  interactions: {
    title: 'Interaction Tools',
    description: 'Creates tiles with interactive behaviors: traps, teleports, secret doors and more.',
    shortcuts: [{ label: 'Open menu', keys: 'Click' }],
  },
  'int-trap': {
    title: 'Trap',
    description: 'Drag on the map to create a single-use trap. When a token steps on it, it triggers once and deactivates.',
    shortcuts: [{ label: 'Create', keys: 'Click + Drag' }],
  },
  'int-teleport': {
    title: 'Teleport',
    description: 'Drag the entrance area and click the destination. Tokens that step on the area will be teleported.',
    shortcuts: [{ label: 'Create', keys: 'Click + Drag' }],
  },
  'int-door': {
    title: 'Secret Door',
    description: 'Creates a secret door that opens when a token approaches.',
    shortcuts: [{ label: 'Create', keys: 'Click + Drag' }],
  },
  'int-sign': {
    title: 'Sign',
    description: 'Drag to create a sign that shows text when a token approaches.',
    shortcuts: [{ label: 'Create', keys: 'Click + Drag' }],
  },
  'int-ambush': {
    title: 'Ambush',
    description: 'Creates a trap that reveals hidden tokens when triggered.',
    shortcuts: [{ label: 'Create', keys: 'Click + Drag' }],
  },
};

export class Toolbox extends BaseComponent {
  private activeTool: string = 'select-token';
  private unrestricted = false;
  private notesVisible = true;
  private tooltipEl: HTMLElement | null = null;
  private tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
  private tooltipsVisible = true;
  private customTools: ToolItem[] = [];

  constructor(
    container: HTMLElement,
    private onToolChange?: (tool: string) => void,
    private onUnrestrictedChange?: (val: boolean) => void,
    private onNotesVisibleChange?: (val: boolean) => void,
    private isGM: boolean = false,
  ) {
    super(container);
    this.tooltipsVisible = localStorage.getItem('loom_show_tooltips') !== 'false';
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'tool-help tooltip-hidden';
    document.body.appendChild(this.tooltipEl);
    this.render();
  }

  setTooltipsVisible(val: boolean): void {
    this.tooltipsVisible = val;
    if (!val) this.hideTooltip();
  }

  setCustomTools(tools: ToolItem[]): void {
    this.customTools = tools;
    this.render();
  }

  render(): void {
    super.render();
    this.setupTooltipDelegation();
    applyUiOverride('controls', this.element, { activeTool: this.activeTool, options: { isGM: this.isGM } });
  }

  protected template(): string {
    // Walls, lighting, sounds, notes, tiles and drawing are scene construction
    // tools — only the GM edits the scene, player only uses token/templates.
    const GM_ONLY_GROUPS = new Set(['walls-menu', 'lighting', 'sounds', 'notes', 'tiles', 'drawing', 'interactions']);
    const allTools: ToolItem[] = [
      { icon: '<i class="fas fa-user-friends"></i>', label: 'Token', id: 'token' },
      { icon: '<i class="fas fa-draw-polygon"></i>', label: 'Walls', id: 'walls-menu' },
      { icon: '<i class="fas fa-lightbulb"></i>', label: 'Lighting', id: 'lighting' },
      { icon: '<i class="fas fa-volume-up"></i>', label: 'Sounds', id: 'sounds' },
      { icon: '<i class="fas fa-book-open"></i>', label: 'Notes', id: 'notes' },
      { icon: '<i class="fas fa-cubes"></i>', label: 'Tiles', id: 'tiles' },
      { icon: '<i class="fas fa-pencil-alt"></i>', label: 'Drawing', id: 'drawing' },
      { icon: '<i class="fas fa-bullseye"></i>', label: 'Templates', id: 'templates' },
      { icon: '<i class="fas fa-hand-pointer"></i>', label: 'Interactions', id: 'interactions' },
    ];
    const tools = this.isGM ? allTools : allTools.filter((t) => !GM_ONLY_GROUPS.has(t.id));

    const isTokenActive = this.activeTool === 'token' || this.activeTool === 'select-token' || this.activeTool === 'measure' || this.activeTool === 'target' || this.activeTool === 'unrestricted';
    const isDrawingActive = this.activeTool === 'drawing' || this.activeTool.startsWith('draw-') || this.activeTool === 'select-drawing';
    const isTemplateActive = this.activeTool === 'templates' || this.activeTool === 'select-template' || this.activeTool.startsWith('template-');
    const isTilesActive = this.activeTool === 'tiles' || this.activeTool === 'select-tile' || this.activeTool === 'place-tile' || this.activeTool === 'tile-browse' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette';
    const isWallActive = this.activeTool === 'walls' || this.activeTool.startsWith('wall-') || this.activeTool === 'select-wall' || this.activeTool === 'wall-close-doors' || this.activeTool === 'wall-clear';
    const isLightActive = this.activeTool === 'create-light' || this.activeTool === 'select-light' || this.activeTool.startsWith('light-');
    const isSoundActive = this.activeTool === 'sounds' || this.activeTool === 'select-sound' || this.activeTool === 'sound-clear';
    const isNotesActive = this.activeTool === 'notes' || this.activeTool === 'select-note' || this.activeTool === 'toggle-notes' || this.activeTool === 'create-note';
    const isInteractionActive = this.activeTool === 'interactions' || this.activeTool.startsWith('int-');

    let mainHtml = '<div class="toolbox-main-menu">';
    tools.forEach((tool) => {
      let isActive = false;
      if (tool.id === 'token') {
        isActive = isTokenActive;
      } else if (tool.id === 'drawing') {
        isActive = isDrawingActive;
      } else if (tool.id === 'templates') {
        isActive = isTemplateActive;
      } else if (tool.id === 'tiles') {
        isActive = isTilesActive;
      } else if (tool.id === 'walls-menu') {
        isActive = isWallActive;
      } else if (tool.id === 'lighting') {
        isActive = isLightActive;
      } else if (tool.id === 'sounds') {
        isActive = isSoundActive;
      } else if (tool.id === 'interactions') {
        isActive = isInteractionActive;
      } else if (tool.id === 'notes') {
        isActive = isNotesActive;
      } else {
        isActive = tool.id === this.activeTool;
      }
      mainHtml += `
        <button
          class="toolbox-item ${isActive ? 'active' : ''}"
          data-action="tool-${tool.id}"
          data-tool-id="${tool.id}"
        >
          ${tool.icon}
        </button>
      `;
    });
    mainHtml += '</div>';

    let subHtml = '';
    if (isTokenActive) {
      subHtml += '<div class="toolbox-submenu">';
      TOKEN_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isDrawingActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      DRAW_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isWallActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      WALL_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isLightActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      LIGHT_SUBTOOLS.forEach((sub) => {
        const isActive = sub.id === this.activeTool;
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${isActive ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isTilesActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      TILE_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isTemplateActive) {
      subHtml += '<div class="toolbox-submenu">';
      TEMPLATE_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isSoundActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      SOUND_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isNotesActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      NOTES_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      subHtml += '</div>';
    }

    if (isInteractionActive && this.isGM) {
      subHtml += '<div class="toolbox-submenu">';
      INTERACTION_SUBTOOLS.forEach((sub) => {
        subHtml += `
          <button
            class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
            data-action="tool-${sub.id}"
            data-tool-id="${sub.id}"
          >
            ${sub.icon}
          </button>
        `;
      });
      if (this.customTools.length > 0) {
        subHtml += '<div class="toolbox-separator"></div>';
        this.customTools.forEach((sub) => {
          subHtml += `
            <button
              class="toolbox-item toolbox-subitem ${sub.id === this.activeTool ? 'active' : ''}"
              data-action="tool-${sub.id}"
              data-tool-id="${sub.id}"
            >
              ${sub.icon}
            </button>
          `;
        });
      }
      subHtml += '</div>';
    }

    return `${mainHtml}${subHtml}`;
  }

  private setupTooltipDelegation(): void {
    this.element.querySelectorAll('.toolbox-item').forEach((btn) => {
      btn.addEventListener('mouseenter', (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        const toolId = target.getAttribute('data-tool-id');
        if (!toolId) return;
        this.showTooltip(toolId, target);
      });
      btn.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  private showTooltip(toolId: string, anchor: HTMLElement): void {
    if (!this.tooltipsVisible) return;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    const help = TOOL_HELP[toolId];
    if (!help) { this.hideTooltip(); return; }

    const el = this.tooltipEl!;
    el.innerHTML = `
      <div class="tool-help-title">${help.title}</div>
      <div class="tool-help-desc">${help.description}</div>
      ${help.shortcuts.length > 0 ? '<div class="tool-help-shortcuts">' + help.shortcuts.map(s =>
        `<span class="tool-help-shortcut"><kbd>${s.keys}</kbd> ${s.label}</span>`
      ).join('') + '</div>' : ''}
    `;

    el.classList.remove('tooltip-hidden');
    el.classList.add('tooltip-visible');

    const rect = anchor.getBoundingClientRect();
    const tipW = 300;
    const tipGap = 6;

    let left = rect.right + tipGap;
    if (left + tipW > window.innerWidth - 8) {
      left = rect.left - tipGap - tipW;
    }
    el.style.left = `${Math.max(4, left)}px`;

    // The tooltip is vertically centered via CSS (transform: translateY(-50%))
    // at the `top` point — for buttons near the top/bottom of the screen this pushed half
    // of the tooltip out of the viewport. Clamp using the actual rendered height.
    const tipH = el.offsetHeight || 100;
    const halfH = tipH / 2;
    let top = rect.top + rect.height / 2;
    top = Math.max(8 + halfH, Math.min(window.innerHeight - 8 - halfH, top));
    el.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    this.tooltipTimeout = setTimeout(() => {
      const el = this.tooltipEl!;
      el.classList.remove('tooltip-visible');
      el.classList.add('tooltip-hidden');
    }, 100);
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action.startsWith('tool-')) {
      const toolId = action.replace('tool-', '');
      const isSubitem = target.classList.contains('toolbox-subitem');
      this.selectTool(toolId, isSubitem);
    }
  }

  /** Changes the active tool from the outside (e.g., clicking a result in the
   * "Placeables" tab of the sidebar should switch to the selection tool of the right
   * type, just like clicking the corresponding icon in the toolbox would do). Goes straight
   * to the requested `toolId` — without the "keep current variant" logic of the icon
   * click, because here we already know exactly which select-tool is wanted. */
  setActiveTool(toolId: string): void {
    this.activeTool = toolId;
    this.render();
    this.onToolChange?.(this.activeTool);
  }

  private selectTool(toolId: string, isSubitem = false): void {
    if (toolId === 'drawing') {
      this.activeTool = (this.activeTool.startsWith('draw-') || this.activeTool === 'select-drawing') ? this.activeTool : 'draw-freehand';
    } else if (toolId === 'tiles') {
      const isTileVariant = this.activeTool === 'select-tile' || this.activeTool === 'place-tile' || this.activeTool === 'tile-browse' || this.activeTool === 'tile-snap' || this.activeTool === 'tile-palette';
      this.activeTool = isTileVariant ? this.activeTool : 'select-tile';
    } else if (toolId === 'templates') {
      this.activeTool = this.activeTool.startsWith('template-') ? this.activeTool : 'template-cone';
    } else if (toolId === 'walls-menu') {
      const isWallVariant = this.activeTool === 'walls' || this.activeTool.startsWith('wall-') || this.activeTool === 'select-wall' || this.activeTool === 'wall-close-doors' || this.activeTool === 'wall-clear';
      this.activeTool = isWallVariant ? this.activeTool : 'walls';
    } else if (toolId === 'lighting') {
      const isLightVariant = this.activeTool === 'create-light' || this.activeTool === 'select-light' || this.activeTool.startsWith('light-');
      this.activeTool = isLightVariant ? this.activeTool : 'select-light';
    } else if (toolId === 'sounds') {
      if (isSubitem) {
        // If clicked directly on the sound menu subitem, force its selection
        this.activeTool = 'sounds';
      } else {
        const isSoundVariant = this.activeTool === 'sounds' || this.activeTool === 'select-sound' || this.activeTool === 'sound-clear';
        this.activeTool = isSoundVariant ? this.activeTool : 'sounds';
      }
    } else if (toolId === 'interactions') {
      const isIntVariant = this.activeTool.startsWith('int-');
      this.activeTool = isIntVariant ? this.activeTool : 'int-trap';
    } else if (toolId === 'notes') {
      const isNotesVariant = this.activeTool === 'notes' || this.activeTool === 'select-note' || this.activeTool === 'toggle-notes' || this.activeTool === 'create-note';
      this.activeTool = isNotesVariant ? this.activeTool : 'select-note';
    } else if (toolId === 'token') {
      const isTokenVariant = this.activeTool === 'select-token' || this.activeTool === 'measure' || this.activeTool === 'target' || this.activeTool === 'unrestricted';
      this.activeTool = isTokenVariant ? this.activeTool : 'select-token';
    } else if (toolId === 'unrestricted') {
      this.unrestricted = !this.unrestricted;
      this.activeTool = this.unrestricted ? 'unrestricted' : 'select-token';
      this.render();
      this.onUnrestrictedChange?.(this.unrestricted);
      if (!this.unrestricted) this.onToolChange?.('select-token');
      return;
    } else if (toolId === 'toggle-notes') {
      this.notesVisible = !this.notesVisible;
      this.activeTool = this.notesVisible ? 'toggle-notes' : 'select-note';
      this.render();
      this.onNotesVisibleChange?.(this.notesVisible);
      if (!this.notesVisible) this.onToolChange?.('select-note');
      return;
    } else {
      this.activeTool = toolId;
    }
    this.render();
    this.onToolChange?.(this.activeTool);
  }

  destroy(): void {
    if (this.tooltipEl?.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
    super.destroy();
  }
}
