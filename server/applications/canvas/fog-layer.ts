import { Graphics, Container } from 'pixi.js';
import { computeFOV } from './fov-engine.js';
import type { WallSegment } from './fov-engine.js';

export interface ExploredArea {
  id: string;
  stageId: string;
  userId: string;
  polygons: { x: number; y: number }[][];
  updatedAt: string;
}

export class FogLayer {
  public container: Container;
  private darknessGraphics: Graphics;
  private revealGraphics: Graphics;
  private exploredGraphics: Graphics;
  private sceneWidth = 5000;
  private sceneHeight = 5000;
  private darknessLevel = 0;
  private fovEnabled = false;
  private walls: WallSegment[] = [];
  private sightRange = 2000;
  private controlledOrigins: { x: number; y: number; range: number }[] = [];
  private exploredPolygons: { x: number; y: number }[][] = [];
  private stageId: string | null = null;
  private dirty = true;
  private exploredDirty = true;

  constructor() {
    this.container = new Container();
    this.darknessGraphics = new Graphics();
    this.revealGraphics = new Graphics();
    this.revealGraphics.blendMode = 'screen';
    this.exploredGraphics = new Graphics();
    this.exploredGraphics.blendMode = 'screen';

    this.container.addChild(this.darknessGraphics);
    this.container.addChild(this.exploredGraphics);
    this.container.addChild(this.revealGraphics);
  }

  setSceneSize(w: number, h: number) {
    this.sceneWidth = w;
    this.sceneHeight = h;
    this.dirty = true;
  }

  setDarkness(level: number) {
    this.darknessLevel = Math.max(0, Math.min(1, level));
    this.fovEnabled = this.darknessLevel > 0;
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

  setControlledOrigins(origins: { x: number; y: number; range: number }[]) {
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

  update() {
    if (this.exploredDirty) {
      this.drawExplored();
      this.exploredDirty = false;
    }
    if (this.dirty) {
      this.drawDarkness();
      this.drawReveal();
      this.dirty = false;
    }
  }

  private drawDarkness() {
    const g = this.darknessGraphics;
    g.clear();
    g.rect(0, 0, this.sceneWidth, this.sceneHeight);
    g.fill({ color: 0x0a0a1a, alpha: this.darknessLevel });
  }

  private drawReveal() {
    const g = this.revealGraphics;
    g.clear();
    if (!this.fovEnabled || this.controlledOrigins.length === 0) return;

    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );

    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range || this.sightRange);
      if (result.polygon.length < 3) continue;

      g.moveTo(result.polygon[0].x, result.polygon[0].y);
      for (let i = 1; i < result.polygon.length; i++) {
        g.lineTo(result.polygon[i].x, result.polygon[i].y);
      }
      g.closePath();
      g.fill({ color: 0xffffff, alpha: 0.35 });
    }
  }

  private drawExplored() {
    const g = this.exploredGraphics;
    g.clear();
    for (const poly of this.exploredPolygons) {
      if (poly.length < 3) continue;
      g.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        g.lineTo(poly[i].x, poly[i].y);
      }
      g.closePath();
      g.fill({ color: 0xffffff, alpha: 0.15 });
    }
  }

  mergeCurrentIntoExplored() {
    if (!this.fovEnabled || this.controlledOrigins.length === 0) return;
    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );
    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range || this.sightRange);
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

  isPointVisible(px: number, py: number): boolean {
    if (!this.fovEnabled) return true;
    if (this.exploredPolygons.some(poly => pointInPolygon(px, py, poly))) return true;
    const sightWalls = this.walls.filter(
      w => w.sight && !(w.door > 0 && w.doorState === 1)
    );
    for (const origin of this.controlledOrigins) {
      const result = computeFOV(origin.x, origin.y, sightWalls, origin.range || this.sightRange);
      if (pointInPolygon(px, py, result.polygon)) return true;
    }
    return false;
  }

  getVisible(): boolean {
    return this.fovEnabled;
  }

  destroy() {
    this.container.removeFromParent();
    this.darknessGraphics.destroy();
    this.revealGraphics.destroy();
    this.exploredGraphics.destroy();
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
