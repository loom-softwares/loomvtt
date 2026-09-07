import { CORE_ASSETS } from './core-assets.js';

export class AssetResolver {
  private assetsMap: Record<string, string>;

  constructor() {
    // Load default core assets map
    this.assetsMap = { ...CORE_ASSETS };
  }

  /**
   * Register a custom asset or override an existing one (e.g. from rulesets or addons)
   */
  register(alias: string, relativePath: string): void {
    if (this.assetsMap[alias]) {
      console.warn(`[AssetResolver] Overriding asset alias "${alias}" with path: ${relativePath}`);
    }
    this.assetsMap[alias] = relativePath;
  }

  /**
   * Get the relative asset path.
   * If not found, falls back to a placeholder and logs a warning.
   */
  get(alias: string): string {
    const asset = this.assetsMap[alias];
    if (!asset) {
      console.warn(`[AssetResolver] Asset alias "${alias}" not found. Falling back to placeholder-actor.`);
      return this.assetsMap['placeholder-actor'] || 'core/images/placeholder-actor.webp';
    }
    return asset;
  }

  /**
   * Get the full URL path for browser consumption.
   */
  url(alias: string): string {
    const relativePath = this.get(alias);
    // Base URL is origin, e.g. http://localhost:5173/ or http://localhost:3000/
    const baseUrl = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
    return `${baseUrl}/${relativePath}`;
  }
}
