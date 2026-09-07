import { cardProgressTracker } from './card-progress.js';

export function renderGlobalProgressBar(): string {
  const active = cardProgressTracker.getActive();
  const display = active ? 'block' : 'none';
  const percent = active ? active.percent : 0;
  const label = active ? escapeHtml(active.label) : '';
  
  return `
    <div class="global-progress-container" style="display: ${display}">
      <div class="global-progress-fill" style="width: ${percent}%"></div>
      <div class="global-progress-label">${label} ${active ? `(${percent}%)` : ''}</div>
    </div>
  `;
}

export function updateGlobalProgressBarUI(container: HTMLElement): void {
  const barContainer = container.querySelector('.global-progress-container') as HTMLElement;
  if (!barContainer) return;
  
  const active = cardProgressTracker.getActive();
  if (!active) {
    barContainer.style.display = 'none';
    return;
  }
  
  barContainer.style.display = 'block';
  
  const fill = barContainer.querySelector('.global-progress-fill') as HTMLElement;
  const label = barContainer.querySelector('.global-progress-label') as HTMLElement;
  
  if (fill) fill.style.width = `${active.percent}%`;
  if (label) label.textContent = `${active.label} (${active.percent}%)`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
