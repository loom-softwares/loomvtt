import { Sprite, Assets, Ticker } from 'pixi.js';
import { CanvasManager } from './canvas-manager.js';
import { soundManager } from './sound-manager.js';
import { wsClient } from '../core/ws-client.js';

interface Step {
  action: string;
  [key: string]: any;
}

interface EffectConfig {
  imgUrl?: string;
  soundUrl?: string;
  x?: number;
  y?: number;
  attachTo?: string;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  scale: number;
  rotate: number;
}

export class CombatAnimation {
  private steps: Step[] = [];

  constructor() {}

  static fromPayload(payload: { steps: Step[] }): CombatAnimation {
    const anim = new CombatAnimation();
    anim.steps = payload.steps;
    return anim;
  }

  effect(imgUrl: string): this {
    this.steps.push({ action: 'effect', imgUrl });
    return this;
  }

  sound(soundUrl: string): this {
    this.steps.push({ action: 'sound', soundUrl });
    return this;
  }

  atLocation(x: number, y: number): this {
    this.steps.push({ action: 'atLocation', x, y });
    return this;
  }

  attachTo(tokenId: string): this {
    this.steps.push({ action: 'attachTo', tokenId });
    return this;
  }

  wait(ms: number): this {
    this.steps.push({ action: 'wait', ms });
    return this;
  }

  duration(ms: number): this {
    this.steps.push({ action: 'duration', ms });
    return this;
  }

  fadeIn(ms: number): this {
    this.steps.push({ action: 'fadeIn', ms });
    return this;
  }

  fadeOut(ms: number): this {
    this.steps.push({ action: 'fadeOut', ms });
    return this;
  }

  scale(n: number): this {
    this.steps.push({ action: 'scale', n });
    return this;
  }

  rotate(deg: number): this {
    this.steps.push({ action: 'rotate', deg });
    return this;
  }

  async play(broadcast: boolean = true): Promise<void> {
    if (broadcast) {
      wsClient.send('combat.animation', { steps: this.steps });
    }
    await this.executeLocal();
  }

  private createEmptyConfig(): EffectConfig {
    return {
      duration: 1000,
      fadeIn: 0,
      fadeOut: 0,
      scale: 1,
      rotate: 0,
    };
  }

  private async executeLocal(): Promise<void> {
    const cm = CanvasManager.activeInstance;
    if (!cm) return;
    
    let currentConfig = this.createEmptyConfig();
    const promises: Promise<void>[] = [];

    const flushEffect = () => {
      if (currentConfig.imgUrl || currentConfig.soundUrl) {
        promises.push(this.runEffectConfig(currentConfig, cm));
      }
      currentConfig = this.createEmptyConfig();
    };

    for (const step of this.steps) {
      if (step.action === 'effect' || step.action === 'sound') {
        if (currentConfig.imgUrl || currentConfig.soundUrl) {
          flushEffect();
        }
      }

      if (step.action === 'wait') {
        flushEffect();
        await new Promise(r => setTimeout(r, step.ms));
        continue;
      }

      switch (step.action) {
        case 'effect': currentConfig.imgUrl = step.imgUrl; break;
        case 'sound': currentConfig.soundUrl = step.soundUrl; break;
        case 'atLocation': 
          currentConfig.x = step.x; 
          currentConfig.y = step.y; 
          break;
        case 'attachTo': currentConfig.attachTo = step.tokenId; break;
        case 'duration': currentConfig.duration = step.ms; break;
        case 'fadeIn': currentConfig.fadeIn = step.ms; break;
        case 'fadeOut': currentConfig.fadeOut = step.ms; break;
        case 'scale': currentConfig.scale = step.n; break;
        case 'rotate': currentConfig.rotate = step.deg; break;
      }
    }
    flushEffect();

    await Promise.all(promises);
  }

  private async runEffectConfig(config: EffectConfig, cm: CanvasManager): Promise<void> {
    if (config.soundUrl) {
      soundManager.playSoundEffect(config.soundUrl);
    }

    if (!config.imgUrl) {
      // If it's just a sound, wait for duration so the promise resolves
      await new Promise(r => setTimeout(r, config.duration));
      return;
    }

    const effectsLayer = cm.layers?.effects;
    if (!effectsLayer) return;

    let sprite: Sprite;
    try {
      const texture = await Assets.load(config.imgUrl);
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
    } catch (e) {
      console.warn('[CombatAnimation] Failed to load texture:', config.imgUrl);
      return;
    }

    sprite.scale.set(config.scale);
    sprite.angle = config.rotate;

    if (config.fadeIn > 0) {
      sprite.alpha = 0;
    }

    effectsLayer.addChild(sprite);

    const startTime = performance.now();

    return new Promise<void>((resolve) => {
      const updateFn = () => {
        const now = performance.now();
        const elapsed = now - startTime;

        // Follow token
        if (config.attachTo) {
          const token = cm.getTokens().get(config.attachTo);
          if (token) {
            sprite.x = (token.x as number);
            sprite.y = (token.y as number);
          }
        } else {
          sprite.x = config.x || 0;
          sprite.y = config.y || 0;
        }

        // Fade In
        if (config.fadeIn > 0 && elapsed < config.fadeIn) {
          sprite.alpha = elapsed / config.fadeIn;
        } else if (config.fadeIn > 0 && elapsed >= config.fadeIn && elapsed < config.duration - config.fadeOut) {
          sprite.alpha = 1;
        }

        // Fade Out
        if (config.fadeOut > 0 && elapsed > config.duration - config.fadeOut) {
          const fadeOutElapsed = elapsed - (config.duration - config.fadeOut);
          sprite.alpha = Math.max(0, 1 - (fadeOutElapsed / config.fadeOut));
        }

        if (elapsed >= config.duration) {
          Ticker.shared.remove(updateFn);
          if (sprite.parent) {
            sprite.parent.removeChild(sprite);
          }
          sprite.destroy();
          resolve();
        }
      };

      Ticker.shared.add(updateFn);
    });
  }
}
wsClient.on('combat.animation', (payload) => { CombatAnimation.fromPayload(payload).play(false); });
