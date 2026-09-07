import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let cachedRoot: string | null = null;

/**
 * Walks up from this file's location until it finds a `package.json`.
 * Works identically whether running via `tsx client/index.ts` (dev) or the
 * compiled entry (`dist/server/index.js` in the release layout, or inside
 * an Electron app.asar) — unlike fixed `../../` counts, which break the
 * moment the compiled output sits at a different depth than the source.
 */
export function resolveAppRoot(): string {
  if (cachedRoot) return cachedRoot;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Fell off the filesystem root without finding package.json — fall back
      // to cwd rather than throwing, callers already guard with existsSync.
      cachedRoot = process.cwd();
      return cachedRoot;
    }
    dir = parent;
  }
}
