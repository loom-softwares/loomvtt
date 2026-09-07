import { raySegmentIntersection, type WallSegment } from './fov-engine.js';

export interface NoiseInfo {
  id: string;
  src: string;
  x: number;
  y: number;
  radius: number;
  volume: number;
  easing: boolean;
  hidden: boolean;
  darknessMin: number;
  darknessMax: number;
  wallsBlock: boolean;
}

interface AudioNodes {
  source: MediaElementAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
}

export class SoundManager {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private activeNoises: Set<string> = new Set();
  private masterVolume = 0.5;
  private currentStageId: string | null = null;
  private noises: NoiseInfo[] = [];
  private audioCtx: AudioContext | null = null;
  private audioNodes: Map<string, AudioNodes> = new Map();
  private sourceNodeMap: Map<string, MediaElementAudioSourceNode> = new Map();
  private listenerPosition: { x: number; y: number } | null = null;
  private darknessLevel = 0;
  private walls: WallSegment[] = [];
  private lastWallCheck = 0;
  private lastListenerPos: { x: number; y: number } | null = null;
  private wallBlockCache: Map<string, boolean> = new Map();

  constructor() {
    window.addEventListener('volume-change', ((e: CustomEvent) => {
      this.setMasterVolume(e.detail.volume);
    }) as EventListener);
    this.initAudioContext();
  }

  private initAudioContext(): void {
    if (this.audioCtx) return;
    this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') {
      const resume = () => {
        this.audioCtx?.resume();
        document.removeEventListener('pointerdown', resume);
      };
      document.addEventListener('pointerdown', resume, { once: true });
    }
  }

  private ensureAudioContext(): void {
    this.initAudioContext();
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private getOrCreateAudioNodes(noiseId: string, audio: HTMLAudioElement): AudioNodes | null {
    if (this.audioNodes.has(noiseId)) {
      return this.audioNodes.get(noiseId)!;
    }
    if (!this.audioCtx) return null;
    try {
      let source = this.sourceNodeMap.get(noiseId);
      if (!source) {
        source = this.audioCtx.createMediaElementSource(audio);
        this.sourceNodeMap.set(noiseId, source);
      }
      const panner = this.audioCtx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.rolloffFactor = 1;
      const gain = this.audioCtx.createGain();
      gain.gain.value = 1;
      source.connect(panner);
      panner.connect(gain);
      gain.connect(this.audioCtx.destination);
      const nodes: AudioNodes = { source, panner, gain };
      this.audioNodes.set(noiseId, nodes);
      return nodes;
    } catch {
      return null;
    }
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    for (const noiseId of Array.from(this.activeNoises)) {
      const audio = this.audioElements.get(noiseId);
      if (audio && !audio.paused) {
        audio.volume = this.getNoiseVolume(noiseId) * this.masterVolume;
      }
    }
  }

  setListenerPosition(pos: { x: number; y: number } | null): void {
    this.listenerPosition = pos;
    if (pos && this.audioCtx) {
      this.audioCtx.listener.positionX.value = pos.x;
      this.audioCtx.listener.positionY.value = pos.y;
      this.audioCtx.listener.positionZ.value = 0;
    }
    this.recheckNoiseVolumes();
  }

  setDarkness(level: number): void {
    this.darknessLevel = level;
    this.recheckNoiseVolumes();
  }

  setWalls(walls: WallSegment[]): void {
    this.walls = walls;
    this.wallBlockCache.clear();
    this.lastWallCheck = 0;
    this.recheckNoiseVolumes();
  }

  private recheckNoiseVolumes(): void {
    if (!this.currentStageId) return;
    const positions = this.getAllTokens();
    this.updateTokenPositions(positions);
  }

  private getAllTokens(): { id: string; x: number; y: number }[] {
    return [];
  }

  private shouldPlayByDarkness(noise: NoiseInfo): boolean {
    return this.darknessLevel >= noise.darknessMin && this.darknessLevel <= noise.darknessMax;
  }

  private shouldPlay(noise: NoiseInfo): boolean {
    if (noise.hidden) return false;
    if (!this.shouldPlayByDarkness(noise)) return false;
    return true;
  }

  private isBlockedByWall(noiseId: string, noise: NoiseInfo, listenerPos: { x: number; y: number }): boolean {
    if (!noise.wallsBlock) return false;
    if (this.walls.length === 0) return false;
    const now = Date.now();
    if (now - this.lastWallCheck < 150 && this.wallBlockCache.has(noiseId)) {
      return this.wallBlockCache.get(noiseId)!;
    }
    for (const wall of this.walls) {
      if (!wall.sound) continue;
      if (wall.wallType === 'invisible') continue;
      if (wall.door > 0 && wall.doorState === 1) continue;
      const hit = raySegmentIntersection(
        listenerPos.x, listenerPos.y, noise.x, noise.y,
        wall.x1, wall.y1, wall.x2, wall.y2,
      );
      if (hit) {
        this.wallBlockCache.set(noiseId, true);
        return true;
      }
    }
    this.wallBlockCache.set(noiseId, false);
    return false;
  }

  updateTokenPositions(tokenPositions: { id: string; x: number; y: number }[]): void {
    if (!this.currentStageId) return;
    this.ensureAudioContext();
    const hasTokensInNoise = new Set<string>();
    const now = Date.now();
    if (this.listenerPosition) {
      const posChanged = !this.lastListenerPos || this.lastListenerPos.x !== this.listenerPosition.x || this.lastListenerPos.y !== this.listenerPosition.y;
      if (!posChanged && now - this.lastWallCheck < 150) {
        return;
      }
      if (posChanged) {
        this.lastWallCheck = now;
        this.wallBlockCache.clear();
      }
      this.lastListenerPos = { ...this.listenerPosition };
    }
    for (const token of tokenPositions) {
      const noisesAtPoint = this.getNoisesAtPoint(token.x, token.y);
      for (const noise of noisesAtPoint) {
        hasTokensInNoise.add(noise.id);
        if (this.activeNoises.has(noise.id)) {
          this.updateSpatial(noise.id, noise);
        } else if (noise.src && this.shouldPlay(noise)) {
          this.playNoise(noise.id);
        }
      }
    }
    for (const noiseId of Array.from(this.activeNoises)) {
      if (!hasTokensInNoise.has(noiseId)) {
        this.stopNoise(noiseId);
      }
    }
  }

  private updateSpatial(noiseId: string, noise: NoiseInfo): void {
    const audio = this.audioElements.get(noiseId);
    if (!audio) return;
    const nodes = this.audioNodes.get(noiseId);
    if (!nodes) return;
    if (noise.hidden || !this.shouldPlayByDarkness(noise)) {
      if (!audio.paused) {
        this.fadeOut(audio, 1000, () => {
          audio.pause();
          audio.volume = 0;
        });
      }
      return;
    }
    if (!noise.easing || !this.listenerPosition) {
      const targetVol = noise.volume;
      audio.volume = targetVol * this.masterVolume;
      return;
    }
    const blocked = this.isBlockedByWall(noiseId, noise, this.listenerPosition);
    if (blocked) {
      if (!audio.paused && audio.volume > 0.01) {
        this.fadeOut(audio, 800, () => {
          audio.pause();
          audio.volume = 0;
        });
      }
      return;
    }
    nodes.panner.positionX.value = noise.x;
    nodes.panner.positionY.value = noise.y;
    nodes.panner.positionZ.value = 0;
    const gridSize = 50;
    nodes.panner.refDistance = gridSize;
    nodes.panner.maxDistance = noise.radius;
    const dist = Math.hypot(this.listenerPosition.x - noise.x, this.listenerPosition.y - noise.y);
    const attenuation = dist <= noise.radius ? 1 - (dist / noise.radius) * 0.7 : 0;
    const targetVol = Math.max(0, Math.min(1, noise.volume * (0.3 + 0.7 * attenuation)));
    audio.volume = targetVol * this.masterVolume;
  }

  setStageId(stageId: string | null): void {
    if (this.currentStageId !== stageId) {
      this.stopAllNoises();
      this.currentStageId = stageId;
    }
  }

  addNoise(noise: NoiseInfo): void {
    if (this.audioElements.has(noise.id)) {
      this.updateNoise(noise);
      return;
    }
    const audio = new Audio(noise.src);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.volume = 0;
    this.audioElements.set(noise.id, audio);
    try {
      this.getOrCreateAudioNodes(noise.id, audio);
    } catch {
    }
  }

  updateNoise(noise: NoiseInfo): void {
    const audio = this.audioElements.get(noise.id);
    if (!audio) {
      this.addNoise(noise);
      return;
    }
    if (audio.src !== noise.src) {
      audio.src = noise.src;
    }
  }

  removeNoise(noiseId: string): void {
    this.stopNoise(noiseId);
    const nodes = this.audioNodes.get(noiseId);
    if (nodes) {
      try {
        nodes.source.disconnect();
        nodes.panner.disconnect();
        nodes.gain.disconnect();
      } catch {
      }
      this.audioNodes.delete(noiseId);
    }
    this.sourceNodeMap.delete(noiseId);
    const audio = this.audioElements.get(noiseId);
    if (audio) {
      audio.src = '';
      this.audioElements.delete(noiseId);
    }
    this.wallBlockCache.delete(noiseId);
  }

  private playNoise(noiseId: string): void {
    const audio = this.audioElements.get(noiseId);
    if (!audio || !audio.src) return;
    if (!this.shouldPlay(this.noises.find(n => n.id === noiseId)!)) return;
    try {
      audio.volume = 0;
      this.ensureAudioContext();
      const nodes = this.getOrCreateAudioNodes(noiseId, audio);
      if (!nodes && this.audioCtx) {
        this.getOrCreateAudioNodes(noiseId, audio);
      }
      audio.play();
      this.activeNoises.add(noiseId);
      const noise = this.noises.find(n => n.id === noiseId);
      const targetVol = noise ? noise.volume : 0.3;
      this.fadeIn(audio, 2000, targetVol);
    } catch (err) {
      console.warn('[SoundManager] Failed to play noise:', noiseId, err);
    }
  }

  private stopNoise(noiseId: string): void {
    const audio = this.audioElements.get(noiseId);
    if (!audio || !this.activeNoises.has(noiseId)) return;
    this.fadeOut(audio, 1000, () => {
      audio.pause();
      audio.volume = 0;
      this.activeNoises.delete(noiseId);
    });
  }

  private stopAllNoises(): void {
    for (const noiseId of Array.from(this.activeNoises)) {
      this.stopNoise(noiseId);
    }
  }

  private fadeIn(audio: HTMLAudioElement, durationMs: number, targetVol: number): void {
    const steps = 20;
    const stepTime = durationMs / steps;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= steps) {
        clearInterval(interval);
        audio.volume = targetVol * this.masterVolume;
      } else {
        audio.volume = (targetVol * i / steps) * this.masterVolume;
      }
    }, stepTime);
  }

  private fadeOut(audio: HTMLAudioElement, durationMs: number, callback: () => void): void {
    const startVol = audio.volume;
    const steps = 20;
    const stepTime = durationMs / steps;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= steps) {
        clearInterval(interval);
        callback();
      } else {
        audio.volume = startVol * (1 - i / steps);
      }
    }, stepTime);
  }

  setNoises(noises: NoiseInfo[]): void {
    this.noises = noises;
    for (const noise of noises) {
      this.addNoise(noise);
    }
    const newIds = new Set(noises.map((n) => n.id));
    for (const [id] of this.audioElements) {
      if (!newIds.has(id)) {
        this.removeNoise(id);
      }
    }
  }

  private getNoiseVolume(noiseId: string): number {
    const noise = this.noises.find(n => n.id === noiseId);
    return noise ? noise.volume : 0.3;
  }

  private getNoisesAtPoint(x: number, y: number): NoiseInfo[] {
    return this.noises.filter((noise) => {
      const dist = Math.hypot(x - noise.x, y - noise.y);
      return dist <= noise.radius;
    });
  }

  playSoundEffect(url: string, volume: number = 1): void {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      audio.volume = Math.max(0, Math.min(1, volume)) * this.masterVolume;
      audio.play().catch(err => {
        console.warn('[SoundManager] Failed to play sound effect:', url, err);
      });
    } catch (err) {
      console.warn('[SoundManager] Error setting up sound effect:', err);
    }
  }

  destroy(): void {
    this.stopAllNoises();
    for (const [, nodes] of this.audioNodes) {
      try {
        nodes.source.disconnect();
        nodes.panner.disconnect();
        nodes.gain.disconnect();
      } catch {
      }
    }
    this.audioNodes.clear();
    this.sourceNodeMap.clear();
    this.audioElements.forEach((audio) => {
      audio.src = '';
      audio.pause();
    });
    this.audioElements.clear();
    this.activeNoises.clear();
    this.wallBlockCache.clear();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export const soundManager = new SoundManager();
