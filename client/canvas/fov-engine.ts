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
  doorState: number; // 0=closed, 1=open, 2=locked
  levelId?: string;
  bottomElevation?: number;
  topElevation?: number;
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
 * Fixes the end point of a ray to the scene rectangle.  Returns null when the
 * ray does not cross the rectangle (outside the origin's "field"). Assumes that
 * the given end point is already outside/bordering the rectangle and the
 * origin is inside.
 */
function clampSegmentToRect(
  ox: number, oy: number,
  x: number, y: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
): { x: number; y: number } | null {
  const dx = x - ox;
  const dy = y - oy;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-12) {
    if (ox < bounds.x0 || ox > bounds.x1) return null;
  } else {
    let t1 = (bounds.x0 - ox) / dx;
    let t2 = (bounds.x1 - ox) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (Math.abs(dy) < 1e-12) {
    if (oy < bounds.y0 || oy > bounds.y1) return null;
  } else {
    let t1 = (bounds.y0 - oy) / dy;
    let t2 = (bounds.y1 - oy) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  return { x: ox + dx * tMax, y: oy + dy * tMax };
}

/**
 * Compute the visible polygon from an origin point, given walls.
 *
 * `sightAngleDeg` restricts vision to a cone (e.g.: 60) centered on `facingDeg`.
 * 360 (default) = full circle vision. `facingDeg` follows the token's `rotation`
 * (in degrees), mirroring how the sprite is rotated on the canvas.
 * 
 * @param ox - Origin X coordinate
 * @param oy - Origin Y coordinate
 * @param walls - Array of wall segments in the scene
 * @param sightRange - Maximum vision range in pixels
 * @param rayCount - Number of rays to cast for full circle
 * @param sightAngleDeg - Vision cone angle in degrees (360 for full circle)
 * @param facingDeg - Direction the token is facing in degrees
 * @param bounds - Optional rectangular boundary to clamp rays to [x0, y0, x1, y1]
 * @returns Object containing the visible polygon and a boolean indicating if vision exists
 */
export function computeFOV(
  ox: number, oy: number,
  walls: WallSegment[],
  sightRange: number = MAX_DIST,
  rayCount: number = RAY_COUNT,
  sightAngleDeg: number = 360,
  facingDeg: number = 0,
  /** 
   * Scene rectangular limit [x0,y0,x1,y1]; when informed, rays that do not
   * hit a wall are fixed to this rectangle, causing a light close to/outside
   * the border to cover the scene corner instead of stopping at the ray.
   */
  bounds?: { x0: number; y0: number; x1: number; y1: number },
): FOVResult {
  const activeWalls = walls.filter(w => w.sight && !(w.door > 0 && w.doorState === 1));

  const fullCircle = sightAngleDeg >= 360 || sightAngleDeg <= 0;
  const cone = Math.min(Math.max(sightAngleDeg, 1), 360) * (Math.PI / 180);
  const facing = normalizeRad(facingDeg * (Math.PI / 180));
  const halfCone = cone / 2;

  // Collect all candidate angles: ray directions + wall endpoints
  const angles = new Set<number>();
  if (fullCircle) {
    const step = (2 * Math.PI) / rayCount;
    for (let i = 0; i < rayCount; i++) {
      angles.add(i * step);
    }
  } else {
    const step = cone / rayCount;
    for (let i = 0; i <= rayCount; i++) {
      angles.add(normalizeRad(facing - halfCone + i * step));
    }
  }

  for (const w of activeWalls) {
    const a1 = Math.atan2(w.y1 - oy, w.x1 - ox);
    const a2 = Math.atan2(w.y2 - oy, w.x2 - ox);
    if (fullCircle) {
      // `Math.atan2` returns -PI..+PI, but the full circle rays are
      // generated in 0..2PI. Without normalizing, the negative angles sort
      // before zero and the polygon is traversed out of order, folding onto itself
      // - and this fold was what appeared as a triangle inside the vision.
      angles.add(normalizeRad(a1));
      angles.add(normalizeRad(a2));
      // Add tiny offsets around endpoints for precision
      angles.add(normalizeRad(a1 + EPSILON));
      angles.add(normalizeRad(a1 - EPSILON));
      angles.add(normalizeRad(a2 + EPSILON));
      angles.add(normalizeRad(a2 - EPSILON));
    } else {
      if (angleWithinCone(a1, facing, halfCone)) angles.add(normalizeRad(a1));
      if (angleWithinCone(a2, facing, halfCone)) angles.add(normalizeRad(a2));
    }
  }

  // Exact angles of the 4 scene corners, when there is a limit (`bounds`). Without
  // this, the ray that "sticks" to the border (below, `clampSegmentToRect`) only
  // occurs at the angles already generated by `rayCount`, none of them hitting
  // exactly the corner - the polygon cuts diagonally BEFORE the real corner,
  // leaving a triangular gap uncovered (map appearing where it should
  // be 100% dark).
  if (bounds) {
    const corners = [
      { x: bounds.x0, y: bounds.y0 },
      { x: bounds.x1, y: bounds.y0 },
      { x: bounds.x1, y: bounds.y1 },
      { x: bounds.x0, y: bounds.y1 },
    ];
    for (const c of corners) {
      const a = normalizeRad(Math.atan2(c.y - oy, c.x - ox));
      angles.add(a);
      angles.add(normalizeRad(a + EPSILON));
      angles.add(normalizeRad(a - EPSILON));
    }
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

    // Applies the scene limit (bounds) to ALL rays leaving the scene,
    // whether they hit a wall outside or reached the maximum limit.
    if (bounds && (hitX < bounds.x0 || hitX > bounds.x1 || hitY < bounds.y0 || hitY > bounds.y1)) {
      const clamped = clampSegmentToRect(ox, oy, hitX, hitY, bounds);
      if (clamped) {
        hitX = clamped.x;
        hitY = clamped.y;
      } else {
        // If the ray does not cross the limits (eg: origin outside the map and ray 
        // pointing outwards), we flatten the vertex to the nearest border.
        // This ensures the "straight cut" at the map edge.
        hitX = Math.max(bounds.x0, Math.min(bounds.x1, hitX));
        hitY = Math.max(bounds.y0, Math.min(bounds.y1, hitY));
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
 * 
 * @param origins - Array of origin points with ranges
 * @param walls - Array of wall segments in the scene
 * @returns Combined visibility polygon
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
 * Uses cross product of wall vector and observer-to-wall-start vector.
 * 
 * @param wall - The wall segment to check
 * @param ox - Ray origin X
 * @param oy - Ray origin Y
 * @returns true if the wall should block the ray, false otherwise
 */
export function shouldBlockRayFromDirection(
  wall: WallSegment,
  ox: number, oy: number,
): boolean {
  if (wall.direction === 0) return true;
  const cross = (wall.x2 - wall.x1) * (oy - wall.y1) - (wall.y2 - wall.y1) * (ox - wall.x1);
  if (wall.direction === 1) return cross > 0;  // block left side
  if (wall.direction === 2) return cross < 0;  // block right side
  return true;
}

/**
 * Ray-segment intersection test.
 * Returns the intersection point or null.
 * 
 * @param rx - Ray start X
 * @param ry - Ray start Y
 * @param rEndX - Ray end X
 * @param rEndY - Ray end Y
 * @param sx1 - Segment start X
 * @param sy1 - Segment start Y
 * @param sx2 - Segment end X
 * @param sy2 - Segment end Y
 * @returns The intersection point, or null if they don't intersect
 */
export function raySegmentIntersection(
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

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
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
 * 
 * @param ox - Light origin X
 * @param oy - Light origin Y
 * @param walls - Array of wall segments
 * @param lightRange - Maximum range of the light
 * @param rayCount - Number of rays to cast
 * @returns Object containing the light polygon and a boolean indicating if it illuminates anything
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
    const a1 = normalizeRad(Math.atan2(w.y1 - oy, w.x1 - ox));
    const a2 = normalizeRad(Math.atan2(w.y2 - oy, w.x2 - ox));
    angles.add(a1);
    angles.add(a2);
    angles.add(normalizeRad(a1 + EPSILON));
    angles.add(normalizeRad(a1 - EPSILON));
    angles.add(normalizeRad(a2 + EPSILON));
    angles.add(normalizeRad(a2 - EPSILON));
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
 * 
 * @param walls - Complete list of wall segments
 * @returns Filtered list of terrain walls
 */
export function getTerrainWalls(walls: WallSegment[]): WallSegment[] {
  return walls.filter(w => w.wallType === 'terrain');
}

/**
 * Check if a point is inside a polygon (ray casting algorithm).
 * 
 * @param px - Point X
 * @param py - Point Y
 * @param polygon - Array of polygon vertices
 * @returns true if the point is inside the polygon
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

/** Normalizes an angle in radians to the [0, 2π) interval. */
function normalizeRad(a: number): number {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/** True if angle `a` is within the cone centered on `facing` with half-angle `halfCone`. */
function angleWithinCone(a: number, facing: number, halfCone: number): boolean {
  const d = Math.abs(normalizeRad(a - facing));
  return d <= halfCone || d >= 2 * Math.PI - halfCone;
}