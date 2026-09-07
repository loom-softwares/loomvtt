/**
 * AmbientAudioManager — gerencia a reprodução automática de playlists
 * por cena (stage). Quando uma cena é ativada, toca a playlist associada.
 * Quando outra cena é ativada, para a anterior e toca a nova.
 */
import { Signal } from '../signals/client-signals.js';

interface SoundData {
  id: string;
  playlistId: string;
  name: string;
  path: string;
  volume: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
  sortOrder: number;
}

interface PlaylistData {
  id: string;
  name: string;
  sounds: SoundData[];
}

export class AmbientAudioManager {
  private currentStageId: string | null = null;
  private audioElements: HTMLAudioElement[] = [];
  private masterVolume = 0.5;
  private fadeDuration = 2000; // ms

  constructor() {
    // Escuta ativação de cena
    Signal.listen('stage.activated', (data: any) => {
      const playlistId = data.ambientPlaylistId || '';
      const stageId = data.stageId || '';
      this.handleStageActivated(stageId, playlistId);
    });
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.audioElements.forEach((el) => {
      el.volume = this.masterVolume;
    });
  }

  private async handleStageActivated(stageId: string, playlistId: string) {
    // Mesma cena — não faz nada
    if (stageId === this.currentStageId) return;

    // Para a playlist anterior
    await this.stopAll();

    this.currentStageId = stageId;

    if (!playlistId) return;

    // Carrega e toca a nova playlist
    try {
      const res = await fetch(`/api/playlists/${playlistId}`);
      if (!res.ok) return;
      const playlist: PlaylistData = await res.json();
      if (!playlist.sounds || playlist.sounds.length === 0) return;

      // Ordena por sortOrder
      const sorted = [...playlist.sounds].sort((a, b) => a.sortOrder - b.sortOrder);

      for (const sound of sorted) {
        const audio = new Audio(sound.path);
        audio.loop = sound.loop ?? false;
        audio.volume = (sound.volume ?? 1) * this.masterVolume;
        audio.crossOrigin = 'anonymous';

        // Fade in
        const fadeIn = sound.fadeIn ?? 0;
        if (fadeIn > 0) {
          audio.volume = 0;
          audio.play();
          this.fadeIn(audio, fadeIn * 1000, (sound.volume ?? 1) * this.masterVolume);
        } else {
          audio.play();
        }

        this.audioElements.push(audio);
      }
    } catch (err) {
      console.warn('[AmbientAudio] Failed to load playlist:', playlistId, err);
    }
  }

  private async stopAll(): Promise<void> {
    const promises = this.audioElements.map((el) => {
      return new Promise<void>((resolve) => {
        try {
          // Fade out rápido
          const startVol = el.volume;
          const steps = 20;
          const stepTime = this.fadeDuration / steps;
          let i = 0;
          const interval = setInterval(() => {
            i++;
            if (i >= steps) {
              clearInterval(interval);
              el.pause();
              el.src = '';
              resolve();
            } else {
              el.volume = startVol * (1 - i / steps);
            }
          }, stepTime);
        } catch {
          resolve();
        }
      });
    });

    await Promise.all(promises);
    this.audioElements = [];
  }

  private fadeIn(audio: HTMLAudioElement, durationMs: number, targetVol: number) {
    const steps = 20;
    const stepTime = durationMs / steps;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= steps) {
        clearInterval(interval);
        audio.volume = targetVol;
      } else {
        audio.volume = targetVol * (i / steps);
      }
    }, stepTime);
  }

  /** Libera recursos */
  destroy() {
    Signal.deafen('stage.activated', () => {});
    this.stopAll();
  }
}