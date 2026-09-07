/*******************************************************************************
 * LoomVTT
 * client/core/window-manager.ts
 * 
 * 
 * Manager for window rendering and z-index ordering.
 ******************************************************************************/

import { clog } from '../lib/client-logger.js';

export interface WindowLike {
  setZ(z: number): void;
  mount(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

interface WindowEntry {
  instance: WindowLike;
  z: number;
}

class WindowManager {
  private windows = new Map<string, WindowEntry>();
  private maxZ = 100;
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById('windows')!;
  }

  /**
   * Opens a new window or focuses an existing one if it's already open.
   * 
   * @param id - The unique identifier for the window.
   * @param WindowClass - The class constructor for the window to instantiate.
   * @param props - The properties to pass to the window constructor.
   */
  async open<P>(
    id: string,
    WindowClass: (new (props: P) => WindowLike) | null | undefined,
    props?: P,
  ): Promise<void> {
    // `resolveSheetClass()` returns `null` when the system (ruleset) is still in the middle of
    // loading — opening here anyway would always fall back to the generic sheet permanently
    // (the race condition with the `sheetCatalog` registration always loses). Refusing the open
    // is the only way to make it "impossible to open the sheet" at this instant, instead of silently
    // showing the wrong sheet.
    if (!WindowClass) return;

    if (this.windows.has(id)) {
      this.focus(id);
      return;
    }

    const instance = new WindowClass(props!);
    // Reserves the slot BEFORE the await — without this, two calls to open() for the same id in the same
    // synchronous tick (e.g. double click) both pass `has(id)` seeing `false`, because
    // neither has registered anything yet, and they create two live instances of the same window (same deterministic
    // `id` like `actor-sheet-${actorId}`) — each with its own mount()/listener,
    // doubling every mutation the user triggers on the sheet.
    this.windows.set(id, { instance, z: 0 });
    await instance.mount();
    const z = ++this.maxZ;
    instance.setZ(z);
    this.windows.set(id, { instance, z });
  }

  focus(id: string): void {
    const entry = this.windows.get(id);
    if (entry) {
      const z = ++this.maxZ;
      entry.z = z;
      entry.instance.setZ(z);
    }
  }

  close(id: string): void {
    const entry = this.windows.get(id);
    if (!entry) return;
    // Remove from Map immediately on click (don't wait for destroy() to finish) — clicking
    // close again shouldn't get stuck on a window that should already be
    // closing. But the destroy() itself (async — might have pre-close, confirmation
    // dialog, etc.) needs .catch()/timeout: without this, if it rejects
    // or hangs (a Promise that never resolves), the window would be visually
    // stuck on the screen forever and NO error would appear anywhere.
    this.windows.delete(id);
    const destroyResult = entry.instance.destroy();
    if (destroyResult && typeof (destroyResult as Promise<void>).then === 'function') {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`destroy() travou (>8s) sem resolver nem rejeitar — janela "${id}" pode ter ficado presa na tela`)), 8000),
      );
      Promise.race([destroyResult as Promise<void>, timeout]).catch((err) => {
        clog.error(`[WINDOW] Failed to close window "${id}": ${err instanceof Error ? (err.stack || err.message) : String(err)}`);
      });
    }
  }

  closeAll(): void {
    this.windows.forEach((entry) => entry.instance.destroy());
    this.windows.clear();
    this.maxZ = 100;
  }

  /** Re-renders the window `id` if it's open
   * — no-op if there's no open sheet for this document. */
  rerenderIfOpen(id: string): void {
    const entry = this.windows.get(id);
    (entry?.instance as any)?.rerenderBody?.();
  }

  get(id: string): WindowLike | undefined {
    return this.windows.get(id)?.instance;
  }

  /** All currently open window instances, regardless of type. */
  getAll(): WindowLike[] {
    return [...this.windows.values()].map((entry) => entry.instance);
  }

  /**
   * Mounts a pre-instantiated window into the DOM and manages its z-index.
   * 
   * @param id - The unique identifier for the window.
   * @param instance - The instantiated window object.
   */
  async mountExisting(id: string, instance: WindowLike): Promise<void> {
    if (this.windows.has(id)) return;
    await instance.mount();
    const z = ++this.maxZ;
    instance.setZ(z);
    this.windows.set(id, { instance, z });
  }

  closeTopmost(): boolean {
    let topId: string | null = null;
    let topZ = -1;
    for (const [id, entry] of this.windows) {
      if (entry.z > topZ) { topZ = entry.z; topId = id; }
    }
    if (topId) {
      this.close(topId);
      return true;
    }
    return false;
  }
}

export const windowManager = new WindowManager();
