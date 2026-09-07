/*******************************************************************************
 * LoomVTT
 * client/core/users-collection.ts
 * 
 * 
 * Collection manager for User documents.
 ******************************************************************************/

import { api } from './api.js';
import { gameContext } from './game-context.js';

interface UserRow {
  id: string;
  name: string;
  role: number;
  color: string;
  colorHex: string;
  avatarUrl: string;
  actorId: string;
  flags: Record<string, Record<string, any>>;
  [key: string]: any;
}

/** Live user document — mirrors the User pattern of converted systems (actual `getFlag`/`setFlag`/
 * `.update()`, persisted via `/api/users/:id` and `/api/users/:id/flags`). */
export class LiveUser {
  private documentClass: any;

  constructor(private row: UserRow, documentClass?: any) {
    if (documentClass && documentClass !== LiveUser) {
      this.documentClass = documentClass;
    }
  }

  /** Calls the registered class's `prepareDerivedData` on this instance, if any. Mirrors LiveActor/LiveItem/LiveMessage. */
  prepareData(): void {
    if (this.documentClass?.prototype?.prepareDerivedData) {
      this.documentClass.prototype.prepareDerivedData.call(this);
    }
  }

  get id(): string { return this.row.id; }
  get name(): string { return this.row.name; }
  get role(): number { return this.row.role; }
  get color(): string { return this.row.colorHex || this.row.color; }
  get actorId(): string { return this.row.actorId; }
  get flags(): Record<string, Record<string, any>> { return this.row.flags || {}; }

  getFlag(scope: string, key: string): any {
    return this.row.flags?.[scope]?.[key];
  }

  async setFlag(scope: string, key: string, value: any): Promise<void> {
    const result = await api.put<{ flags: Record<string, any> }>(`/users/${this.row.id}/flags`, { scope, key, value });
    this.row.flags = result.flags;
  }

  async update(data: Record<string, any>): Promise<void> {
    const updated = await api.put<UserRow>(`/users/${this.row.id}`, data);
    this.row = { ...this.row, ...updated };
  }
}

/** Actual WorldCollection of Users, pre-loaded when joining the
 * world. `.current` is the `LiveUser` of the currently logged-in player. */
class UsersCollection {
  private byId = new Map<string, LiveUser>();

  async load(worldId: string): Promise<void> {
    try {
      const rows = await api.get<UserRow[]>(`/worlds/${worldId}/users`);
      const documentClass = (window as any).Loom?.config?.User?.documentClass;
      this.byId.clear();
      for (const row of rows) {
        const user = new LiveUser(row, documentClass);
        user.prepareData();
        this.byId.set(row.id, user);
      }
    } catch {
      this.byId.clear();
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): LiveUser | undefined {
    return this.byId.get(id);
  }

  getName(name: string): LiveUser | undefined {
    return Array.from(this.byId.values()).find((u) => u.name === name);
  }

  filter(predicate: (user: LiveUser) => boolean): LiveUser[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (user: LiveUser) => boolean): LiveUser | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (user: LiveUser) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (user: LiveUser) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): LiveUser[] {
    return Array.from(this.byId.values());
  }

  get current(): LiveUser | undefined {
    const userId = gameContext.session?.userId;
    return userId ? this.byId.get(userId) : undefined;
  }

  get size(): number {
    return this.byId.size;
  }
}

export const usersCollection = new UsersCollection();
