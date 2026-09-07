/**
 * FOV (Field of View) Engine for LoomVTT
 *
 * Uses raycasting 2D to compute visibility polygons.
 * Walls block sight/light rays; doors can be open/closed.
 * Outputs a polygon that can be used as a PIXI mask or drawn as a reveal.
 */

export type WallType = 'normal' | 'invisible' | 'terrain';

export interface WallSegment {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  sight: boolean;   // blocks sight
  light: boolean;   // blocks light
  movement: boolean;
  sound: boolean;   // blocks sound
  direction: number; // 0=both, 1=left, 2=right
  door: number;      // 0=none, 1=regular, 2=secret
  doorState: number; // 0=closed, 1=open
  wallType?: WallType;
}

export interface FOVResult {
  /** Vertices of the visible polygon (screen coords) */
  polygon: { x: number; y: number }[];
  /** Whether the token has any vision at all */
  hasVision: boolean;
}

const RAY_COUNT = 360;       // rays per full circle
const MAX_DIST = 3000;       // max sight range in px
const EPSILON = 0.001;

/**
 * Compute the visible polygon from an origin point, given walls.
 */
export function computeFOV(
  ox: number, oy: number,
  walls: WallSegment[],
  sightRange: number = MAX_DIST,
  rayCount: number = RAY_COUNT,
): FOVResult {
  const activeWalls = walls.filter(w => w.sight && !(w.door > 0 && w.doorState === 1));

  // Collect all candidate angles: ray directions + wall endpoints
  const angles = new Set<number>();
  const step = (2 * Math.PI) / rayCount;
  for (let i = 0; i < rayCount; i++) {
    angles.add(i * step);
  }

  for (const w of activeWalls) {
    const a1 = Math.atan2(w.y1 - oy, w.x1 - ox);
    const a2 = Math.atan2(w.y2 - oy, w.x2 - ox);
    angles.add(a1);
    angles.add(a2);
    // Add tiny offsets around endpoints for precision
    angles.add(a1 + EPSILON);
    angles.add(a1 - EPSILON);
    angles.add(a2 + EPSILON);
    angles.add(a2 - EPSILON);
  }

  const sortedAngles = Array.from(angles).sort((a, b) => a - b);
  const vertices: { x: number; y: number }[] = [];

  for (const angle of sortedAngles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const endX = ox + dx * sightRange;
    const endY = oy + dy * sightRange;

    let closestDist = sightRange;
    let hitX = endX;
    let hitY = endY;

    for (const w of activeWalls) {
      const hit = raySegmentIntersection(ox, oy, endX, endY, w.x1, w.y1, w.x2, w.y2);
      if (hit && shouldBlockRayFromDirection(w, ox, oy)) {
        const dist = Math.sqrt((hit.x - ox) ** 2 + (hit.y - oy) ** 2);
        if (dist < closestDist) {
          closestDist = dist;
          hitX = hit.x;
          hitY = hit.y;
        }
      }
    }

    vertices.push({ x: hitX, y: hitY });
  }

  return {
    polygon: vertices,
    hasVision: vertices.length > 2,
  };
}

/**
 * Compute combined FOV for multiple tokens (party vision).
 * Merges multiple visibility polygons into one.
 */
export function computeCombinedFOV(
  origins: { x: number; y: number; range: number }[],
  walls: WallSegment[],
): FOVResult {
  if (origins.length === 0) {
    return { polygon: [], hasVision: false };
  }

  // For simplicity, compute individual FOVs and merge by taking the union
  // Since PIXI mask can handle multiple polygons, we return the largest one
  // and store individual ones for layered rendering
  const results = origins.map(o => computeFOV(o.x, o.y, walls, o.range));

  // Merge all polygons into one (approximate union via convex hull of all points)
  // For a proper union we'd need a polygon clipping lib, but this works for most cases
  const allPoints = results.flatMap(r => r.polygon);
  if (allPoints.length < 3) return { polygon: [], hasVision: false };

  // Simple approach: return the polygon with most vertices (likely the most complex)
  const best = results.reduce((a, b) => (a.polygon.length > b.polygon.length ? a : b));
  return best;
}

/**
 * Check if a wall with a direction setting should block a ray from origin.
 * direction: 0=both, 1=left, 2=right.
 */
function shouldBlockRayFromDirection(
  wall: WallSegment,
  ox: number, oy: number,
): boolean {
  if (wall.direction === 0) return true;
  const cross = (wall.x2 - wall.x1) * (oy - wall.y1) - (wall.y2 - wall.y1) * (ox - wall.x1);
  if (wall.direction === 1) return cross > 0;
  if (wall.direction === 2) return cross < 0;
  return true;
}

/**
 * Ray-segment intersection test.
 * Returns the intersection point or null.
 */
function raySegmentIntersection(
  rx: number, ry: number, rEndX: number, rEndY: number,
  sx1: number, sy1: number, sx2: number, sy2: number,
): { x: number; y: number } | null {
  const dx = rEndX - rx;
  const dy = rEndY - ry;
  const sdx = sx2 - sx1;
  const sdy = sy2 - sy1;

  const denom = dx * sdy - dy * sdx;
  if (Math.abs(denom) < 1e-10) return null; // parallel

  const t = ((sx1 - rx) * sdy - (sy1 - ry) * sdx) / denom;
  const u = ((sx1 - rx) * dy - (sy1 - ry) * dx) / denom;

  if (t >= 0 && u >= 0 && u <= 1) {
    return {
      x: rx + t * dx,
      y: ry + t * dy,
    };
  }

  return null;
}

/**
 * Compute a light polygon from a light source bounded by walls.
 * Only walls with `light: true` block the light rays.
 */
export function computeLightFOV(
  ox: number, oy: number,
  walls: WallSegment[],
  lightRange: number,
  rayCount: number = RAY_COUNT,
): FOVResult {
  const activeWalls = walls.filter(w => w.light && !(w.door > 0 && w.doorState === 1));

  const angles = new Set<number>();
  const step = (2 * Math.PI) / rayCount;
  for (let i = 0; i < rayCount; i++) {
    angles.add(i * step);
  }

  for (const w of activeWalls) {
    const a1 = Math.atan2(w.y1 - oy, w.x1 - ox);
    const a2 = Math.atan2(w.y2 - oy, w.x2 - ox);
    angles.add(a1);
    angles.add(a2);
    angles.add(a1 + EPSILON);
    angles.add(a1 - EPSILON);
    angles.add(a2 + EPSILON);
    angles.add(a2 - EPSILON);
  }

  const sortedAngles = Array.from(angles).sort((a, b) => a - b);
  const vertices: { x: number; y: number }[] = [];

  for (const angle of sortedAngles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const endX = ox + dx * lightRange;
    const endY = oy + dy * lightRange;

    let closestDist = lightRange;
    let hitX = endX;
    let hitY = endY;

    for (const w of activeWalls) {
      const hit = raySegmentIntersection(ox, oy, endX, endY, w.x1, w.y1, w.x2, w.y2);
      if (hit && shouldBlockRayFromDirection(w, ox, oy)) {
        const dist = Math.sqrt((hit.x - ox) ** 2 + (hit.y - oy) ** 2);
        if (dist < closestDist) {
          closestDist = dist;
          hitX = hit.x;
          hitY = hit.y;
        }
      }
    }

    vertices.push({ x: hitX, y: hitY });
  }

  return {
    polygon: vertices,
    hasVision: vertices.length > 2,
  };
}

/**
 * Get walls that are invisible (terrain/ethereal) — block movement but not sight/light.
 */
export function getTerrainWalls(walls: WallSegment[]): WallSegment[] {
  return walls.filter(w => w.wallType === 'terrain');
}

/**
 * Check if a point is inside a polygon (ray casting algorithm).
 */
export function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
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