type Callback = (...args: any[]) => void;

class ClientSignalEngine {
  private listeners: Record<string, Callback[]> = {};

  listen(event: string, callback: Callback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  deafen(event: string, callback: Callback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  broadcast(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }
}

export const Signal = new ClientSignalEngine();
export default Signal;
