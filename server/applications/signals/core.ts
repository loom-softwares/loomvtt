import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

class SignalEngine {
  private emitter = new EventEmitter();

  constructor() {
    // Maximize limit of listeners for extensions
    this.emitter.setMaxListeners(100);
  }

  /**
   * Listen to an event signal
   */
  listen(event: string, callback: (...args: any[]) => void): void {
    logger.debug('Signal listener registered', { event });
    this.emitter.on(event, callback);
  }

  /**
   * Stop listening to an event signal
   */
  deafen(event: string, callback: (...args: any[]) => void): void {
    logger.debug('Signal listener removed', { event });
    this.emitter.off(event, callback);
  }

  /**
   * Fire a signal to all listeners
   */
  broadcast(event: string, ...args: any[]): void {
    logger.debug('Signal broadcast fired', { event, argsCount: args.length });
    this.emitter.emit(event, ...args);
  }
}

export const Signal = new SignalEngine();
export default Signal;
