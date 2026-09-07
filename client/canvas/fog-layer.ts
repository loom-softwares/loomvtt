import { Graphics, Container, AlphaFilter, Texture, Sprite } from 'pixi.js';
import { computeFOV } from './fov-engine';
import type { WallSegment } from './fov-engine';

export interface FOVOrigin {
  x: number;
  y: number;
  range: number;
  angle?: number;
  facing?: number;
  /** Vision mode of the token generating this origin (influences the field's appearance). */
  mode?: VisionMode;
}

export type VisionMode = 'basic' | 'darkvision' | 'monochrome' | 'blindness' | 'tremorsense' | 'lightAmplification';

// NOTE: there is no longer a color table per vision mode. To see = to view the
// map as it is; painting a colored polygon over it just washed out the image.
// Modes that change the APPEARANCE (monochrome, light amplification) require a
// color filter over the masked background, not a solid fill.

export interface ExploredArea {
  id: string;
  stageId: string;
  userId: string;
  polygons: { x: number; y: number }[][];
  updatedAt: string;
}

/** Line of sight without range limit, used as a mask for lights. */
const MAX_SIGHT = 100000;

export interface FogConfig {
  tokenVision: boolean;
  fogExplorationMode: 'none' | 'individual' | 'shared';
  fogExploredColor: string;
  fogUnexploredColor: string;
}

let cachedGradientTexture: Texture | null = null;
function getGradientTexture(): Texture {
  if (cachedGradientTexture) return cachedGradientTexture;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (let s = 0; s < 48; s++) {
    const t = s / 47;
    const alpha = 1 - t; // 1.0 curve
    gradient.addColorStop(t, `rgba(255, 255, 255, ${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  cachedGradientTexture = Texture.from(canvas);
  return cachedGradientTexture;
}

export class FogLayer {
  public container: Container;

  /**
   * Darkness shield: a solid rectangle, no blend and no filter.
   *
   * Two previous attempts failed and are recorded to not return:
   * `blendMode: 'erase'` + `BlurFilter` on the same object (Pixi v8 draws the
   * object in its own texture before compositing, so the hole cut out the
   * filter texture and showed emptiness instead of the map), and `cut()` (which does not
   * support overlapping holes — token vision crossing a light became a black
   * spot) — this remains a known limitation, still without a fix.
   */
  private darknessGraphics: Graphics;
  /**
   * Reveal layer — SEPARATE object from darknessGraphics, blendMode
   * 'erase'. The previous attempt (documented above) applied erase+blur
   * on the SAME object that also drew the solid fill — Pixi
   * applies blendMode to the entire object, so the fill itself
   * tried to "erase" instead of drawing solid. Here the fill
   * (darknessGraphics, normal blend) and the reveal (this, erase blend) are
   * separate objects, within the same filtered container — the reveal
   * only erases the sibling drawn before it, without affecting the rest of the scene.
   */
  private revealContainer: Container;
  private lightPool: { sprite: Sprite; mask: Graphics }[] = [];
  /** Wraps only darknessGraphics — the BlurFilter goes here, never on the Graphics
   *  directly (corrupts cut() geometry, see note in constructor). */
  private lightGlowContainer: Container;
  /** Optional geometry (e.g. explored areas) drawn after the shield. */
  private exploredRevealGraphics: Graphics;
  /**
   * Rectangular mask locking EVERYTHING (darkness, reveal, blur) to the exact
   * bounds of the scene. Without this, the blur spreads the glow of the reveal beyond
   * the polygon — including outside the map, where nothing should exist.
   */
  private boundsMask: Graphics;

  private sceneWidth = 5000;
  private sceneHeight = 5000;
  private darknessLevel = 0;
  private currentDarknessAlpha = 0;   // animated value (lerps toward target)
  private fovEnabled = false;
  private walls: WallSegment[] = [];
  private sightRange = 2000;
  private controlledOrigins: FOVOrigin[] = [];
  private exploredPolygons: { x: number; y: number }[][] = [];
  private stageId: string | null = null;
  private isGM = false;
  private gmVisionPreview = false;
  private dirty = true;
  private exploredDirty = true;

  /** Fog configuration coming from the scene (config window / payload). */
  private config: FogConfig = {
    tokenVision: true,
    fogExplorationMode: 'individual',
    fogExploredColor: '#000000',
    fogUnexploredColor: '#000000',
  };

  setIsGM(isGM: boolean) {
    this.isGM = isGM;
    this.dirty = true;
  }

  /** Toggles GM vision preview (fog reappears with the selected token's cutout). */
  setGMVisionPreview(preview: boolean) {
    if (preview === this.gmVisionPreview) return;
    this.gmVisionPreview = preview;
    this.dirty = true;
  }

  /** Saves scene preferences and re-evaluates fog configuration. */
  setConfig(cfg: Partial<FogConfig>) {
    this.config = { ...this.config, ...cfg };
    // tokenVision false = the scene wants everything visible, no token restriction.
    // DOES NOT depend on darknessLevel: token vision and fog exploration are
    // independent of whether the scene is light or dark (bug fixed 21/08/2026 —
    // with darknessLevel=0, new scene default, fog was never computed/saved).
    this.fovEnabled = this.config.tokenVision;
    this.dirty = true;
  }

  /** The field of view is active when tokenVision is enabled in the scene. */
  get tokenVisionOn(): boolean {
    return this.config.tokenVision;
  }

  /**
   * Darkness alpha ceiling (considers your user role).
   */
  private maxDarkness(): number {
    return this.isGM && !this.gmVisionPreview ? 0.35 : 1;
  }

  /**
   * Darkness alpha target. Outside of vision preview, it's limited by the
   * scene's darknessLevel (day = 0 = no overlay). In GM vision preview,
   * ignores this ceiling: the point of clicking a token is to see only what it sees, even
   * in a daylight scene (darknessLevel=0) — without this, `Math.min(0, maxDarkness())`
   * always gave 0 and the preview didn't darken anything in any bright scene.
   */
  private targetDarknessAlpha(): number {
    // Player (non-GM) and GM vision preview always get the full ceiling: the
    // token vision is true fog-of-war, not day/night decoration —
    // depending on darknessLevel left the player seeing the whole map in a
    // daytime scene (darknessLevel=0), even with tokenVision enabled. Only the GM
    // outside of preview uses the reduced ceiling (0.35), to edit the scene without being
    // in total darkness.
    if (this.gmVisionPreview || !this.isGM) return this.maxDarkness();
    return Math.min(this.darknessLevel, this.maxDarkness());
  }

  constructor() {
    this.container = new Container();

    // The filter is NOT just aesthetic here: it's what forces Pixi to render
    // darknessGraphics+revealGraphics on an ISOLATED texture before compositing
    // on the scene. Without any filter, the revealGraphics 'erase' blendMode
    // leaks to the real backbuffer (map, lights, everything that was already drawn
    // before in the same pass) instead of erasing only the darknessGraphics —
    // removing the filter breaks the entire vision, not just the blur aesthetics.
    const alphaFilter = new AlphaFilter();
    alphaFilter.padding = 512;
    this.lightGlowContainer = new Container();
    this.lightGlowContainer.filters = [alphaFilter];

    this.darknessGraphics = new Graphics();
    // SEPARATE object from darknessGraphics — cut() does not support overlapping
    // holes (token vision almost always crosses the circle of some
    // light), so the vision/light holes no longer use cut(). This layer
    // draws the polygons as white shapes with 'erase' blendMode: each
    // shape erases the darknessGraphics (sibling, drawn before, same
    // filtered container) where it overlaps, and overlap between shapes
    // in this layer itself breaks nothing (erase is idempotent).
    this.revealContainer = new Container();
    this.exploredRevealGraphics = new Graphics();
    this.exploredRevealGraphics.blendMode = 'erase';

    this.lightGlowContainer.addChild(this.darknessGraphics, this.revealContainer);
    this.container.addChild(this.lightGlowContainer);

    this.boundsMask = new Graphics();
    this.container.mask = this.boundsMask;
    this.drawBoundsMask();
  }

  private drawBoundsMask(): void {
    this.boundsMask.clear();
    this.boundsMask.rect(0, 0, this.sceneWidth, this.sceneHeight).fill(0xffffff);
  }

  setSceneSize(w: number, h: number) {
    this.sceneWidth = w;
    this.sceneHeight = h;
    this.drawBoundsMask();
    this.dirty = true;
  }

  setDarkness(level: number) {
    this.darknessLevel = Math.max(0, Math.min(1, level));
    // fovEnabled reflects target immediately so walls/vision are computed right away.
    // Darkness only affects the darkness overlay's alpha, not whether FOV runs.
    this.fovEnabled = this.config.tokenVision;
    this.dirty = true;
  }

  /** Instantly set darkness to target (no animation). Use on scene load. */
  snapToTarget() {
    this.currentDarknessAlpha = this.targetDarknessAlpha();
    this.dirty = true;
  }

  setWalls(walls: WallSegment[]) {
    this.walls = walls;
    this.dirty = true;
  }

  setSightRange(px: number) {
    this.sightRange = px;
    this.dirty = true;
  }

  private lightOrigins: { x: number; y: number; range: number; walls?: boolean }[] = [];

  setLightOrigins(origins: { x: number; y: number; range: number; walls?: boolean }[]) {
    this.lightOrigins = origins;
    this.dirty = true;
  }

  setControlledOrigins(origins: FOVOrigin[]) {
    this.controlledOrigins = origins;
    this.dirty = true;
  }

  setUserId(_id: string | null) {
    // userId saved for future per-user fog reveal support
  }

  setStageId(id: string | null) {
    if (id !== this.stageId) {
      this.exploredPolygons = [];
      this.exploredDirty = true;
    }
    this.stageId = id;
  }

  setExploredPolygons(polygons: { x: number; y: number }[][]) {
    this.exploredPolygons = polygons;
    this.exploredDirty = true;
  }

  getExploredPolygons(): { x: number; y: number }[][] {
    return this.exploredPolygons;
  }

  markDirty() {
    this.dirty = true;
  }

  /**
   * Called every ticker frame from CanvasManager.
   * Lerps currentDarknessAlpha toward the target darknessLevel.
   * Returns true while still animating so the caller can keep ticking.
   */
  animate(delta: number): boolean {
    const target = this.targetDarknessAlpha();
    const speed = 0.025 * delta;          // ~0.025 alpha-units per frame at 60fps
    const diff = target - this.currentDarknessAlpha;

    if (Math.abs(diff) < 0.002) {
      if (this.currentDarknessAlpha !== target) {
        this.currentDarknessAlpha = target;
        this.dirty = true;
        this.update();
      }
      return false; // animation complete
    }

    this.currentDarknessAlpha += diff > 0
      ? Math.min(diff, speed)
      : Math.max(diff, -speed);
    this.dirty = true;
    this.update();
    return true; // still animating
  }

  update() {
    if (this.exploredDirty) {
      this.drawExplored();
      this.exploredDirty = false;
    }
    if (this.dirty) {
      this.drawDarkness();
      this.dirty = false;
    }
  }

  /**
   * Renders the scene's darkness layer.
   *
   * Visibility is calculated through the union (not intersection) of light sources 
   * and token vision. `vision.light` and `vision.sight` share the same container,
   * composed with MAX_COLOR in the same texture. A point becomes visible if it is illuminated
   * OR if it is within the token's vision range.
   *  
   * Visible areas (holes in the darkness) use `blendMode = 'erase'` in a
   * dedicated Graphics (`revealGraphics`), which allows correct overlapping of
   * multiple sources (such as token vision crossing a light ray) independently,
   * avoiding rendering artifacts.
   */
  private drawDarkness() {
    const g = this.darknessGraphics;
    g.clear();
    this.revealContainer.removeChildren();
    this.revealContainer.addChild(this.exploredRevealGraphics);
    if (this.currentDarknessAlpha <= 0) return; // fully day — nothing to draw

    const color = this.config.fogUnexploredColor || '#070714';
    const alpha = this.currentDarknessAlpha;

    // Draw the darkness slightly larger than the scene so the BlurFilter
    // does not make the edges semi-transpare nt (which would cause the
    // map to leak at the edges). The boundsMask will cut the excess.
    const pad = 100;
    g.rect(-pad, -pad, this.sceneWidth + pad * 2, this.sceneHeight + pad * 2);
    g.fill({ color, alpha });

    // Without a controlled token or preview, the darkness app  lies fully. 
    if (!this.fovEnabled) return;

    let poolIndex = 0;
    const getLightObjects = () => {
      if (poolIndex >= this.lightPool.length) {
        const sprite = new Sprite(getGradientTexture());
        sprite.blendMode = 'erase';
        sprite.anchor.set(0.5);
        const mask = new Graphics();
        sprite.mask = mask;
        this.lightPool.push({ sprite, mask });
      }
      const pair = this.lightPool[poolIndex++];
      pair.mask.clear();
      this.revealContainer.addChild(pair.sprite, pair.mask);
      return pair;
    };

    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );

    // Sight range in the dark (can be 0 — token that only sees with light).  
    for (const origin of this.controlledOrigins) {
      if (!origin.range || origin.range <= 0) continue;
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range, 360, origin.angle ?? 360, origin.facing ?? 0, { x0: 0, y0: 0, x1: this.sceneWidth, y1: this.sceneHeight });
      if (result.polygon.length < 3) continue;

      const { sprite, mask } = getLightObjects();

      sprite.position.set(origin.x, origin.y);
      sprite.width = origin.range * 2;
      sprite.height = origin.range * 2;

      this.tracePath(mask, result.polygon);
      mask.fill({ color: 0xffffff });
    }

    const inLos = this.lightOriginInLos(sightWalls);
    for (let i = 0; i < this.lightOrigins.length; i++) {
      if (inLos && inLos[i] === false) continue;
      const light = this.lightOrigins[i];
      const activeWalls = light.walls !== false ? sightWalls : [];
      const result = computeFOV(light.x, light.y, activeWalls, light.range, 360, 360, 0, { x0: 0, y0: 0, x1: this.sceneWidth, y1: this.sceneHeight });
      if (result.polygon.length < 3) continue;

      const { sprite, mask } = getLightObjects();

      sprite.position.set(light.x, light.y);
      sprite.width = light.range * 2;
      sprite.height = light.range * 2;

      this.tracePath(mask, result.polygon);
      mask.fill({ color: 0xffffff });
    }
  }

  /** Copies a polygon into a closed path (xb). */
  private tracePath(g: Graphics, polygon: { x: number; y: number }[]) {
    if (polygon.length === 0) return;
    g.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      g.lineTo(polygon[i].x, polygon[i].y);
    }
    g.closePath();
  }

  private drawExplored() {
    const g = this.exploredRevealGraphics;
    g.clear();
    if (this.exploredPolygons.length === 0) return;

    for (const poly of this.exploredPolygons) {
      if (poly.length < 3) continue;
      g.poly(poly);
    }
    g.fill({ color: 0xffffff, alpha: 0.6 });
  }

  mergeCurrentIntoExplored() {
    if (!this.fovEnabled || this.controlledOrigins.length === 0) return;
    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );
    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range || this.sightRange, 360, origin.angle ?? 360, origin.facing ?? 0, { x0: 0, y0: 0, x1: this.sceneWidth, y1: this.sceneHeight });
      if (result.polygon.length >= 3) {
        this.exploredPolygons.push(result.polygon);
        this.exploredDirty = true;
      }
    }
  }

  resetExplored() {
    this.exploredPolygons = [];
    this.exploredDirty = true;
  }

  /**
   * Point inside the current FOV or some already explored area. This is the criteria
   * that keeps the gray map background (explored) visible.
   */
  isPointVisible(px: number, py: number): boolean {
    if (!this.fovEnabled) return true;
    if (this.exploredPolygons.some(poly => pointInPolygon(px, py, poly))) return true;
    return this.isPointVisibleNow(px, py);
  }

  /**
   * Point is inside the **current** FOV of some controlled token, or of a light
   * that the player sees. It's the found criteria to decide whether a
   * TOKEN appears: the explored area (gray fog) keeps the map background, but doesn't
   * "guess" tokens — they only appear under direct vision or live lighting.
   */
  isPointVisibleNow(px: number, py: number): boolean {
    if (!this.fovEnabled) return true;
    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );
    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range || this.sightRange, 360, origin.angle ?? 360, origin.facing ?? 0);
      if (pointInPolygon(px, py, result.polygon)) return true;
    }
    return false;
  }

  /** Is a point illuminated by an ambient light that the player can see? */
  isPointLit(px: number, py: number): boolean {
    if (!this.fovEnabled) return true;
    if (this.lightOrigins.length === 0) return false;
    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );
    // Same criteria as `drawDarkness`: light only illuminates if its ORIGIN
    // is in the token's LOS (no range limit, only walls block).
    // The two functions must agree — previously only this one had the gate and
    // `drawDarkness` did not, which left the environment appearing illuminated in the
    // fog with the token hidden inside that same light.
    const inLos = this.lightOriginInLos(sightWalls);
    for (let i = 0; i < this.lightOrigins.length; i++) {
      if (inLos && inLos[i] === false) continue;
      const light = this.lightOrigins[i];
      const activeWalls = light.walls !== false ? sightWalls : [];
      const result = computeFOV(light.x, light.y, activeWalls, light.range);
      if (pointInPolygon(px, py, result.polygon)) return true;
    }
    return false;
  }

  /** For each light: true if the light origin is within the line of sight of controlled tokens. */
  private lightOriginInLos(sightWalls: WallSegment[]): boolean[] | null {
    if (this.controlledOrigins.length === 0) return null;
    const losPolys: { x: number; y: number }[][] = [];
    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, MAX_SIGHT, 360, origin.angle ?? 360, origin.facing ?? 0);
      if (result.polygon.length >= 3) losPolys.push(result.polygon);
    }
    return this.lightOrigins.map(l => losPolys.some(p => pointInPolygon(l.x, l.y, p)));
  }

  getVisible(): boolean {
    return this.fovEnabled;
  }

  destroy() {
    this.container.removeFromParent();
    this.darknessGraphics.destroy();
    for (const pair of this.lightPool) {
      pair.sprite.destroy();
      pair.mask.destroy();
    }
    this.revealContainer.destroy();
    this.exploredRevealGraphics.destroy();
    this.boundsMask.destroy();
    this.container.destroy();
  }
}

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}