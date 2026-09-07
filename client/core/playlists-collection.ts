/*******************************************************************************
 * LoomVTT
 * client/core/playlists-collection.ts
 * 
 * 
 * Collection manager for audio Playlists.
 ******************************************************************************/

import { api } from './api.js';

interface PlaylistSummary {
  id: string;
  name: string;
  worldId: string;
  sounds: any[];
  [key: string]: any;
}

class PlaylistsCollection {
  private byId = new Map<string, PlaylistSummary>();

  async load(worldId: string): Promise<void> {
    try {
      const playlists = await api.get<PlaylistSummary[]>(`/playlists?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.Playlist?.documentClass;
      const soundClass = (window as any).Loom?.config?.PlaylistSound?.documentClass;
      for (const p of playlists) {
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(p);
        if (soundClass?.prototype?.prepareDerivedData) {
          for (const sound of p.sounds ?? []) soundClass.prototype.prepareDerivedData.call(sound);
        }
        this.byId.set(p.id, p);
      }
    } catch {
      // API may fail if no playlists exist
    }
  }

  clear(): void {
    this.byId.clear();
  }

  get(id: string): PlaylistSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): PlaylistSummary | undefined {
    return Array.from(this.byId.values()).find((p) => p.name === name);
  }

  filter(predicate: (playlist: PlaylistSummary) => boolean): PlaylistSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (playlist: PlaylistSummary) => boolean): PlaylistSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (playlist: PlaylistSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (playlist: PlaylistSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): PlaylistSummary[] {
    return Array.from(this.byId.values());
  }

  get size(): number {
    return this.byId.size;
  }
}

export const playlistsCollection = new PlaylistsCollection();
