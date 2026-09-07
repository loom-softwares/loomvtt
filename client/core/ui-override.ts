/*******************************************************************************
 * LoomVTT
 * client/core/ui-override.ts
 *
 *
 * Shared helper for CONFIG.ui.* decoration hooks — lets a registered class
 * attach extra behavior on top of an already-rendered native UI component
 * (hotbar, players list, scene nav, toolbar, pause overlay, toasts) without
 * ever replacing the native template. Mirrors the pattern already used by
 * Sidebar (client/screens/game-hud/sidebar.ts:onRender()).
 ******************************************************************************/

/** Calls `_onRender(context, options)` on the class registered at `CONFIG.ui[key]`, if any. Never throws into the caller. */
export function applyUiOverride(key: string, element: HTMLElement | null, context: Record<string, any> = {}): void {
  const Registered = (window as any).Loom?.config?.ui?.[key];
  if (!Registered || typeof Registered.prototype?._onRender !== 'function') return;
  if (!element) return;
  try {
    const instance = new Registered();
    Object.defineProperty(instance, 'element', { get: () => element });
    const mockOptions = context.options ?? {};
    Promise.resolve(instance._onRender(context, mockOptions)).catch((err: unknown) => {
      console.error(`Error executing async ${key} _onRender:`, err);
    });
  } catch (error) {
    console.warn(`Error in registered ${key} _onRender:`, error);
  }
}
