/*******************************************************************************
 * LoomVTT
 * client/core/messages-collection.ts
 * 
 * 
 * Collection manager for Chat Messages.
 ******************************************************************************/

import { api } from './api.js';
import { wsClient } from './ws-client.js';
import { gameContext } from './game-context.js';

interface MessageRow {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: string;
  flags: Record<string, Record<string, any>>;
  speaker: { actor?: string; token?: string; alias?: string };
  createdAt: string;
  worldId?: string;
  roll?: Record<string, any>;
  [key: string]: any;
}

/** Live ChatMessage document — mirrors the ChatMessage pattern of converted systems
 * (actual `getFlag`/`setFlag`, persisted via `/api/chat-messages/:id/flags`). */
export class LiveMessage {
  private documentClass: any;

  constructor(private row: MessageRow, documentClass?: any) {
    // Same registration pattern as LiveActor/LiveItem: if a class was
    // registered via `CONFIG.ChatMessage.documentClass`, invoke its
    // lifecycle methods when present. Rendering itself stays on
    // `Loom.wraps.renderMessage` (this doesn't affect what gets drawn in chat).
    if (documentClass && documentClass !== LiveMessage) {
      this.documentClass = documentClass;
    }
  }

  get id(): string { return this.row.id; }
  get content(): string { return this.row.content; }
  get speaker(): { actor?: string; token?: string; alias?: string } { return this.row.speaker || {}; }
  get flags(): Record<string, Record<string, any>> { return this.row.flags || {}; }
  get timestamp(): number { return new Date(this.row.createdAt).getTime(); }
  get roll(): Record<string, any> | undefined { return this.row.roll; }
  get worldId(): string | undefined { return this.row.worldId; }

  getFlag(scope: string, key: string): any {
    return this.row.flags?.[scope]?.[key];
  }

  async setFlag(scope: string, key: string, value: any): Promise<void> {
    const result = await api.put<{ flags: Record<string, any> }>(`/chat-messages/${this.row.id}/flags`, { scope, key, value });
    this.row.flags = result.flags;
  }

  /**
   * Replaces the `roll` (data + meta) of an already posted message and propagates
   * it to everyone — native equivalent to `message.update({rolls: ...})`
   * that converted systems try to use to edit a roll card already in the
   * chat (e.g. Willpower reroll in wod5e). The local card only reflects the
   * swap when `chat.messageUpdated` returns via WS, just like any other
   * client — no optimistic updates here.
   * 
   * @param roll - The new roll object
   */
  async setRoll(roll: Record<string, any>): Promise<void> {
    const worldId = this.row.worldId || gameContext.worldId;
    if (!worldId) throw new Error(`[LiveMessage.setRoll] Mensagem ${this.row.id} sem worldId conhecido.`);
    await api.put(`/chat-messages/${this.row.id}/roll?worldId=${worldId}`, { roll });
  }

  /**
   * Applies locally a `roll` that has already arrived via `chat.messageUpdated` — does not make a request.
   * 
   * @param roll - The incoming roll object
   */
  patchRoll(roll: Record<string, any>): void {
    this.row.roll = roll;
    if (roll?.mode) {
      this.row.rollMode = roll.mode;
    }
  }

  /** Calls the registered class's `prepareDerivedData` on this instance, if any. Mirrors LiveActor/LiveItem. */
  prepareData(): void {
    if (this.documentClass?.prototype?.prepareDerivedData) {
      this.documentClass.prototype.prepareDerivedData.call(this);
    }
  }
}

/** Chat message collection — populated from `chatHistory` arriving
 * in the WebSocket init payload (see GameHudScreen.handleInit), avoiding extra round-trips. */
class MessagesCollection {
  private byId = new Map<string, LiveMessage>();

  load(rows: MessageRow[]): void {
    this.byId.clear();
    const documentClass = (window as any).Loom?.config?.ChatMessage?.documentClass;
    for (const row of rows) {
      const message = new LiveMessage(row, documentClass);
      message.prepareData();
      this.byId.set(row.id, message);
    }
  }

  add(row: MessageRow): void {
    const documentClass = (window as any).Loom?.config?.ChatMessage?.documentClass;
    const message = new LiveMessage(row, documentClass);
    message.prepareData();
    this.byId.set(row.id, message);
  }

  clear(): void {
    this.byId.clear();
  }

  /**
   * Creates and transmits a chat message — native equivalent to `ChatMessage.create`
   * that converted systems expect. `worldId`/`userId` come from the authenticated
   * socket session on the server, not the payload; only `content`/`speaker`/`flags` are from the caller.
   * 
   * @param data - Message creation payload containing content, speaker, and flags
   */
  create(data: { content?: string; speaker?: Record<string, any>; flags?: Record<string, Record<string, any>> } = {}): void {
    wsClient.send('chat.message', {
      content: data.content ?? '',
      speaker: data.speaker,
      flags: data.flags,
    });
  }

  get(id: string): LiveMessage | undefined {
    return this.byId.get(id);
  }

  /**
   * Applies a `roll` received via `chat.messageUpdated` to the already loaded message.
   * 
   * @param id - The ID of the message
   * @param roll - The roll object to apply
   */
  patchRoll(id: string, roll: Record<string, any>): void {
    this.byId.get(id)?.patchRoll(roll);
  }

  filter(predicate: (message: LiveMessage) => boolean): LiveMessage[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (message: LiveMessage) => boolean): LiveMessage | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (message: LiveMessage) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (message: LiveMessage) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): LiveMessage[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const messagesCollection = new MessagesCollection();
