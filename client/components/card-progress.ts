import { wsClient } from '../core/ws-client.js';

export interface CardProgressState {
  percent: number;
  label: string;
  phase: string;
}

export class CardProgressTracker {
  private states = new Map<string, CardProgressState>();
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;

  constructor() {
    this.unsub = wsClient.on('operation.progress', (data: CardProgressState & { operationId: string }) => {
      this.states.set(data.operationId, { percent: data.percent, label: data.label, phase: data.phase });
      this.listeners.forEach(fn => fn());
      if (data.phase === 'done' || data.phase === 'error') {
        setTimeout(() => {
          this.states.delete(data.operationId);
          this.listeners.forEach(fn => fn());
        }, 1500);
      }
    });
  }

  destroy(): void {
    this.unsub?.();
    this.listeners.clear();
    this.states.clear();
  }

  get(operationId: string): CardProgressState | undefined {
    return this.states.get(operationId);
  }

  getActive(): CardProgressState | undefined {
    for (const s of this.states.values()) {
      if (s.phase !== 'done' && s.phase !== 'error') return s;
    }
    return undefined;
  }

  isActive(operationId: string): boolean {
    const s = this.states.get(operationId);
    return !!s && s.phase !== 'done' && s.phase !== 'error';
  }

  set(operationId: string, percent: number, label: string, phase: string = 'running'): void {
    this.states.set(operationId, { percent, label, phase });
    this.listeners.forEach(fn => fn());
  }

  clear(operationId: string): void {
    this.states.delete(operationId);
    this.listeners.forEach(fn => fn());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const cardProgressTracker = new CardProgressTracker();
