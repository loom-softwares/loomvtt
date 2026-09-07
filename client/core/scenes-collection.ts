/*******************************************************************************
 * LoomVTT
 * client/core/scenes-collection.ts
 * 
 * 
 * Collection manager for Scene documents.
 ******************************************************************************/

import { api } from './api.js';

interface TokenSummary {
  id: string;
  actorId?: string;
  actor?: any;
  [key: string]: any;
}

interface StageSummary {
  id: string;
  name: string;
  isActive: boolean;
  tokens: {
    contents: TokenSummary[];
    get: (id: string) => TokenSummary | undefined;
    [Symbol.iterator](): IterableIterator<TokenSummary>;
  };
  [key: string]: any;
}

/** Wraps the raw stage JSON into an object exposing the token collection API
 *  expected by converted systems: `scene.tokens.contents`. */
function makeLiveStage(raw: Record<string, any>): StageSummary {
  const tokenList: TokenSummary[] = (raw.tokens ?? []).map((t: any) => ({ ...t }));
  const tokensById = new Map<string, TokenSummary>(tokenList.map(t => [t.id, t]));

  // Calls CONFIG.<Type>.documentClass.prepareDerivedData() on each canvas placeable, if registered.
  const Loom = (window as any).Loom;
  const hook = (type: string, list: any[] | undefined) => {
    const cls = Loom?.config?.[type]?.documentClass;
    if (cls?.prototype?.prepareDerivedData) {
      for (const entry of list ?? []) cls.prototype.prepareDerivedData.call(entry);
    }
  };
  hook('Cast', tokenList);
  hook('Tile', raw.tiles);
  hook('Wall', raw.walls);
  hook('Drawing', raw.drawings);
  hook('AmbientLight', raw.lights);
  hook('Note', raw.notes);
  hook('Level', raw.levels);
  // `Noise` is not a ChildrenField of the stage (it has its own table, see noises.schema.ts) — loaded
  // separately in game-hud.ts, it doesn't arrive in `raw` here. The corresponding hook is there.
  // CastOverride = per-token actor override — real equivalent in Loom is an
  // unlinked cast member's own systemData. Only unlinked tokens carry
  // an actual delta; linked tokens share the Actor's data as-is.
  const actorDeltaClass = Loom?.config?.CastOverride?.documentClass;
  if (actorDeltaClass?.prototype?.prepareDerivedData) {
    for (const token of tokenList) {
      if (token.isLinked === false) actorDeltaClass.prototype.prepareDerivedData.call(token);
    }
  }

  return {
    ...raw,
    id: raw.id,
    name: raw.name,
    isActive: !!raw.isActive,
    tokens: {
      contents: tokenList,
      get: (id: string) => tokensById.get(id),
      [Symbol.iterator]: () => tokenList.values(),
    },
  };
}

/** Actual WorldCollection of Stages (Loom's equivalent of
 * Scene), pre-loaded when joining the world. Provides mappings for `Loom.scenes.contents`/`.get(id)`/`.active`. */
class ScenesCollection {
  private byId = new Map<string, StageSummary>();
  private loaded = false;

  async load(worldId: string): Promise<void> {
    try {
      const stages = await api.get<Record<string, any>[]>(`/stages?worldId=${worldId}`);
      this.byId.clear();
      const documentClass = (window as any).Loom?.config?.Stage?.documentClass;
      for (const stage of stages) {
        const live = makeLiveStage(stage);
        if (documentClass?.prototype?.prepareDerivedData) documentClass.prototype.prepareDerivedData.call(live);
        this.byId.set(live.id, live);
      }
      this.loaded = true;
    } catch {
      this.loaded = true;
    }
  }

  clear(): void {
    this.byId.clear();
    this.loaded = false;
  }

  get(id: string): StageSummary | undefined {
    return this.byId.get(id);
  }

  getName(name: string): StageSummary | undefined {
    return Array.from(this.byId.values()).find((s) => s.name === name);
  }

  filter(predicate: (stage: StageSummary) => boolean): StageSummary[] {
    return this.contents.filter(predicate);
  }

  find(predicate: (stage: StageSummary) => boolean): StageSummary | undefined {
    return this.contents.find(predicate);
  }

  map<T>(fn: (stage: StageSummary) => T): T[] {
    return this.contents.map(fn);
  }

  forEach(fn: (stage: StageSummary) => void): void {
    this.contents.forEach(fn);
  }

  get contents(): StageSummary[] {
    return Array.from(this.byId.values());
  }

  /** Equivalent to `game.scenes.active`/`.current` — the Stage marked `isActive` in the world. */
  get active(): StageSummary | undefined {
    return Array.from(this.byId.values()).find((s) => s.isActive);
  }

  get current(): StageSummary | undefined {
    return this.active;
  }

  get size(): number {
    return this.byId.size;
  }
}

export const scenesCollection = new ScenesCollection();
