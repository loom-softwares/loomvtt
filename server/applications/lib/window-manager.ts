export interface WindowInstance {
  id: string;
  title: string;
  zIndex: number;
  focused: boolean;
  minimized: boolean;
  maximized: boolean;
  options: Record<string, any>;
}

class WindowManagerClass {
  private _windows: WindowInstance[] = [];
  private listeners = new Set<() => void>();

  get windows(): WindowInstance[] {
    return this._windows;
  }

  set windows(value: WindowInstance[]) {
    this._windows = value;
  }
  private currentHighestZ = 100;

  /** Subscribe to changes in the window list. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Snapshot getter for use with useSyncExternalStore. */
  getSnapshot = (): WindowInstance[] => {
    return this._windows;
  };

  private notify(): void {
    // Reassign to a new array reference so consumers relying on referential
    // equality (e.g. useSyncExternalStore) detect the change.
    this._windows = [...this._windows];
    this.listeners.forEach((listener) => listener());
  }

  register(windowData: Omit<WindowInstance, 'zIndex' | 'focused'>): void {
    const existing = this.windows.find(w => w.id === windowData.id);
    if (existing) {
      this.focus(windowData.id);
      return;
    }

    this.currentHighestZ += 1;

    // De-focus others
    this.windows.forEach(w => {
      w.focused = false;
    });

    const newWindow: WindowInstance = {
      ...windowData,
      zIndex: this.currentHighestZ,
      focused: true
    };

    this.windows.push(newWindow);
    this.notify();
  }

  unregister(id: string): void {
    this.windows = this.windows.filter(w => w.id !== id);
    if (this.windows.length > 0) {
      const highest = [...this.windows].sort((a, b) => b.zIndex - a.zIndex)[0];
      this.focus(highest.id);
    } else {
      this.notify();
    }
  }

  focus(id: string): void {
    const target = this.windows.find(w => w.id === id);
    if (!target) return;

    this.currentHighestZ += 1;
    target.zIndex = this.currentHighestZ;

    this.windows.forEach(w => {
      w.focused = w.id === id;
    });
    this.notify();
  }

  minimize(id: string, state?: boolean): void {
    const target = this.windows.find(w => w.id === id);
    if (!target) return;
    target.minimized = state !== undefined ? state : !target.minimized;
    if (!target.minimized) {
      this.focus(id);
    } else {
      this.notify();
    }
  }

  maximize(id: string, state?: boolean): void {
    const target = this.windows.find(w => w.id === id);
    if (!target) return;
    target.maximized = state !== undefined ? state : !target.maximized;
    if (target.maximized) {
      target.minimized = false;
      this.focus(id);
    } else {
      this.notify();
    }
  }
}

export const WindowManager = new WindowManagerClass();
export default WindowManager;
