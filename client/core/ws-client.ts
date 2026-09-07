/*******************************************************************************
 * LoomVTT
 * client/core/ws-client.ts
 * 
 * 
 * WebSocket client — connection lifecycle, reconnection backoff, and typed event dispatch to the rest of the client.
 ******************************************************************************/

import { io, Socket } from 'socket.io-client';
import { clog } from '../lib/client-logger.js';

export class WsClient {
  public socket: Socket | null = null;
  private handlers = new Map<string, Set<(data: any) => void>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000];

  constructor() {
    // Auto-realigns the stage room reacting to the server's OWN event.
    // The server broadcasts `stage.activated` to everyone (whether it was caused
    // by this client or not) — and the client reacts to that event.
    this.on('stage.activated', (data: { stageId?: string }) => {
      if (this.session?.worldId && data?.stageId) {
        this.updateContext(this.session.worldId, data.stageId);
      }
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${protocol}://${location.host}`;

      this.socket = io(url, {
        path: '/ws',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 16000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.reconnectAttempts = 0;
        clog.success('WebSocket connected');
        resolve();
      });

      this.socket.on('disconnect', (reason: string) => {
        clog.warn(`WebSocket disconnected (${reason})`);
        // `reconnection: true` above (with `reconnectionAttempts`/`reconnectionDelay`) already makes
        // socket.io try to reconnect on its own, IN THE SAME socket. This handler used to call
        // `this.connect()` again on top of that — it created a SECOND entirely new `io(...)`,
        // with its own `onAny()` registered in the same `this.handlers`. After any
        // disconnection (server restarting for a dev restart, for example), the
        // tab ended up with TWO live sockets in the same world room — the server emitted to
        // both and every event (`actor.updated` etc.) was processed twice on the client,
        // each re-render overwriting what the other had just restored (this was the real
        // cause of the "type and the field comes back empty" bug: it was never a loop, it was
        // duplicate delivery of the same event treated as two independent changes).
        if (reason === 'io server disconnect') {
          // Disconnection initiated BY the server — socket.io's automatic reconnection does not
          // trigger on its own in this case (documented behavior of the lib), so here we do
          // need to reconnect manually, but still without stacking attempts: `connect()`
          // should only be called once.
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelays[this.reconnectAttempts] || 16000;
            this.reconnectAttempts++;
            clog.info(`WebSocket - Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect().catch(clog.error), delay);
          }
        }
        // Any other reason: let socket.io reconnect on its own (same instance).
      });

      this.socket.on('connect_error', (err: Error) => {
        clog.error('WebSocket error', err);
        reject(new Error('WebSocket connection failed'));
      });

      // Socket.IO: the server emits typed events (e.g., 'init', 'chat.message',
      // 'tile.triggered', 'users.online'). `onAny` catches all and forwards to
      // handlers registered by event name.
      this.socket.onAny((event: string, ...args: unknown[]) => {
        try {
          clog.debug('WS event received', event);
          const handlers = this.handlers.get(event);
          if (handlers) {
            handlers.forEach((handler) => handler(args[0]));
          }
        } catch (e) {
          clog.error('WebSocket - Error parsing typed event:', e as Error);
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Emits a typed event over the WebSocket connection.
   * 
   * @param type - The event name.
   * @param data - The payload to send.
   */
  send(type: string, data: unknown): void {
    if (!this.socket || !this.socket.connected) {
      clog.warn(`WebSocket - Not connected, dropping message of type "${type}"`);
      return;
    }
    this.socket.emit('message', { type, data });
  }

  /**
   * Registers a handler for a specific WebSocket event.
   * 
   * @param type - The event name to listen for.
   * @param handler - The callback invoked when the event is received.
   * @returns A function that unregisters the handler.
   */
  on(type: string, handler: (data: any) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  off(type: string, handler: (data: any) => void): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  session: { worldId?: string; userId?: string; userName?: string; userColor?: string; userRole?: number } | null = null;

  identify(
    worldId: string,
    userId: string,
    userName: string,
    userColor: string,
    userRole: number,
  ): void {
    this.session = { worldId, userId, userName, userColor, userRole };
    this.send('user.identify', {
      worldId,
      userId,
      userName,
      userColor,
      userRole,
    });
  }

  /**
   * Updates the room context (world + active stage) on the Socket.IO server.
   * Without this, the client only joins the world room (`world:<id>`) on `user.identify`
   * and misses out on stage-scoped broadcasts. Must be called on initial login
   * and whenever the player switches scenes (maps).
   * 
   * @param worldId - The ID of the current world.
   * @param stageId - The ID of the currently active stage/scene (optional).
   */
  updateContext(worldId: string, stageId?: string): void {
    this.send('context.update', { worldId, stageId: stageId || '' });
  }
}

export const wsClient = new WsClient();
