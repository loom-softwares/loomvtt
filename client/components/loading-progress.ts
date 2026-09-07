export class LoadingProgress {
  private overlay: HTMLElement | null = null;

  show(title: string, subtitle = ''): void {
    this.remove();
    this.overlay = document.createElement('div');
    this.overlay.className = 'loom-loading-overlay';
    this.overlay.innerHTML = `
      <div class="loom-loading-box">
        <div class="loom-loading-text">${this.esc(title)}</div>
        ${subtitle ? `<div class="loom-loading-scene-name">${this.esc(subtitle)}</div>` : ''}
        <div class="loom-loading-step">Preparando...</div>
        <div class="loom-loading-track"><div class="loom-loading-bar" style="width: 0%"></div></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay?.classList.add('active'));
  }

  update(stepLabel: string, done: number, total: number): void {
    if (!this.overlay) return;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const bar = this.overlay.querySelector<HTMLElement>('.loom-loading-bar');
    const step = this.overlay.querySelector<HTMLElement>('.loom-loading-step');
    if (bar) bar.style.width = `${pct}%`;
    if (step) step.textContent = done >= total ? 'Concluído' : `Carregando ${stepLabel}...`;
  }

  hide(): void {
    if (!this.overlay) return;
    this.overlay.classList.remove('active');
    setTimeout(() => this.remove(), 500);
  }

  private remove(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private esc(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
