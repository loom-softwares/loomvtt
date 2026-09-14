/*******************************************************************************
 * LoomVTT
 * client/lib/folder-color.ts
 *
 *
 * Shared color helpers for folder headers (world folders in sidebar.ts, and
 * compendium source-pack folders in compendium-source-window.ts) — extracted
 * so both consumers render an identical look from the same hex string instead
 * of two copies of the same 3-line regex drifting apart.
 ******************************************************************************/

/** `#RRGGBB` -> `"r, g, b"` (no `rgb()` wrapper — callers interpolate it into
 * `rgba(${rgb}, alpha)`). Returns `null` for anything that isn't a clean
 * 6-digit hex, so callers can fall back to the unstyled/default look. */
export function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

/** Style attributes for a folder header colored by the user: solid-ish
 * background from the folder's own color, white text with a shadow so it
 * stays legible over any hue. Empty strings (not `null`) so callers can
 * always interpolate directly into a template without an extra `?? ''`. */
export function folderColorStyles(color: string | undefined): { folderStyle: string; textStyle: string } {
  const rgb = color ? hexToRgb(color) : null;
  if (!rgb) return { folderStyle: '', textStyle: '' };
  return {
    folderStyle: `style="background: rgba(${rgb}, 0.85); color: #fff; border-radius: 4px;"`,
    textStyle: `style="color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"`,
  };
}
