/*******************************************************************************
 * LoomVTT
 * client/core/hooks.ts
 * 
 * 
 * Event hook system for the client.
 ******************************************************************************/

type HookCallback = (...args: any[]) => void | boolean | Promise<any>;

class HooksRegistry {
  private listeners = new Map<string, HookCallback[]>();

  on(hookName: string, callback: HookCallback): void {
    if (!this.listeners.has(hookName)) {
      this.listeners.set(hookName, []);
    }
    this.listeners.get(hookName)!.push(callback);
  }

  once(hookName: string, callback: HookCallback): void {
    const wrapper = (...args: any[]) => {
      callback(...args);
      this.off(hookName, wrapper);
    };
    this.on(hookName, wrapper);
  }

  off(hookName: string, callback: HookCallback): void {
    const list = this.listeners.get(hookName);
    if (!list) return;
    const index = list.indexOf(callback);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  callAll(hookName: string, ...args: any[]): void {
    const list = this.listeners.get(hookName) || [];
    for (const callback of list) {
      try {
        // Async hooks (most converted systems, e.g., `LoomHooks.once('ready',
        // async function () {...})`) reject AFTER this synchronous try/catch block exits —
        // without catching it here, it becomes an unhandled promise rejection.
        // Other platforms never await hooks here either —
        // just log the error and proceed to the next one.
        const result = callback(...args);
        if (result && typeof (result as any).then === 'function') {
          (result as Promise<any>).catch((err) => {
            console.error(`Error in async hook ${hookName}:`, err);
          });
        }
      } catch (err) {
        console.error(`Error in hook ${hookName}:`, err);
      }
    }
  }
  call(hookName: string, ...args: any[]): boolean {
    const list = this.listeners.get(hookName) || [];
    for (const callback of list) {
      try {
        const result = callback(...args);
        if (result === false) return false;
      } catch (err) {
        console.error(`Error in hook ${hookName}:`, err);
      }
    }
    return true;
  }
}

export const LoomHooks = new HooksRegistry();
(window as any).LoomHooks = LoomHooks;
