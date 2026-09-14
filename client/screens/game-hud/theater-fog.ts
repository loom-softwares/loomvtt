/*******************************************************************************
 * LoomVTT
 * client/screens/game-hud/theater-fog.ts
 *
 * Billowing atmospheric fog/smoke particle animation for theater mode.
 * Uses hardware-accelerated 2D canvas with smoke sprites (/weather/smoke_*.png)
 * drifting, rotating, and pulsing alpha across the screen.
 ******************************************************************************/

export class TheaterFog {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId: number | null = null;
  private particles: Array<{
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    baseAlpha: number;
    rot: number;
    vRot: number;
    img: HTMLImageElement;
  }> = [];
  private images: HTMLImageElement[] = [];
  private resizeHandler: (() => void) | null = null;

  constructor(private container: HTMLElement) {
    const urls = [
      '/weather/smoke_01.png',
      '/weather/smoke_02.png',
      '/weather/smoke_03.png',
      '/weather/smoke_04.png',
      '/weather/smoke_05.png',
    ];
    this.images = urls.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
  }

  public start(): void {
    if (this.animId !== null) return;

    let canvas = this.container.querySelector<HTMLCanvasElement>('.theater-fog-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'theater-fog-canvas';
      this.container.appendChild(canvas);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();

    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);

    this.initParticles();
    this.loop();
  }

  public stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
    this.particles = [];
  }

  private resize(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initParticles(): void {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const count = Math.max(10, Math.min(18, Math.round((w * h) / 120000)));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const img = this.images[i % this.images.length];
      const size = Math.max(w, h) * (0.65 + Math.random() * 0.55);
      this.particles.push({
        x: Math.random() * (w + size) - size / 2,
        y: Math.random() * (h + size) - size / 2,
        size,
        vx: 0.18 + Math.random() * 0.32,
        vy: (Math.random() - 0.5) * 0.08,
        baseAlpha: 0.2 + Math.random() * 0.18,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.0012,
        img,
      });
    }
  }

  private loop = (): void => {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    const t = Date.now() * 0.0005;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;

      const alpha = Math.max(0.04, Math.min(0.42, p.baseAlpha + Math.sin(t + p.x * 0.001) * 0.08));

      if (p.x - p.size / 2 > w) {
        p.x = -p.size / 2;
        p.y = Math.random() * h;
      }
      if (p.y - p.size / 2 > h) p.y = -p.size / 2;
      if (p.y + p.size / 2 < 0) p.y = h + p.size / 2;

      if (p.img.complete && p.img.naturalWidth > 0) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rot);
        this.ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
    }

    this.animId = requestAnimationFrame(this.loop);
  };
}
