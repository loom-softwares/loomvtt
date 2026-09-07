type HookCallback = (...args: any[]) => any | Promise<any>;

export class LoomHooks {
  private static events: Map<string, HookCallback[]> = new Map();

  /**
   * Register a listener for a specific event
   */
  static on(event: string, callback: HookCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  /**
   * Remove a listener for a specific event
   */
  static off(event: string, callback: HookCallback): void {
    const list = this.events.get(event);
    if (!list) return;
    const index = list.indexOf(callback);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  /**
   * Trigger all listeners for an event sequentially (supports async)
   */
  static async call(event: string, ...args: any[]): Promise<void> {
    const callbacks = this.events.get(event) || [];
    for (const callback of callbacks) {
      try {
        await callback(...args);
      } catch (err: any) {
        console.error(`[LoomHooks] Error executing callback for event "${event}":`, err.message);
      }
    }
  }

  /**
   * Trigger all listeners and return results
   */
  static async callAll(event: string, ...args: any[]): Promise<any[]> {
    const callbacks = this.events.get(event) || [];
    const results: any[] = [];
    for (const callback of callbacks) {
      try {
        results.push(await callback(...args));
      } catch (err: any) {
        console.error(`[LoomHooks] Error executing callback for event "${event}":`, err.message);
        results.push(null);
      }
    }
    return results;
  }
}
