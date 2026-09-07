export interface TourStep {
  selector: string;
  title: string;
  text: string;
}

export class Tour {
  private currentStep = 0;
  private steps: TourStep[];
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private isActive = false;

  constructor(steps: TourStep[]) {
    this.steps = steps;
  }

  async start(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    this.createOverlay();
    this.showStep(0);
  }

  private createOverlay(): void {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'tour-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
      border-radius: 8px;
      z-index: 9999;
      pointer-events: none;
      transition: all 0.3s ease;
    `;

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tour-tooltip';

    // Add buttons
    const buttons = document.createElement('div');
    buttons.className = 'tour-buttons';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary';
    prevBtn.textContent = 'Anterior';
    prevBtn.style.pointerEvents = 'auto';
    prevBtn.setAttribute('data-action', 'prev');
    if (this.currentStep === 0) {
      prevBtn.style.display = 'none';
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn';
    nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Concluir' : 'Próximo';
    nextBtn.style.pointerEvents = 'auto';
    nextBtn.setAttribute('data-action', 'next');

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-secondary';
    skipBtn.textContent = 'Pular';
    skipBtn.style.pointerEvents = 'auto';
    skipBtn.setAttribute('data-action', 'skip');

    buttons.appendChild(prevBtn);
    buttons.appendChild(nextBtn);
    buttons.appendChild(skipBtn);

    // Add content
    const content = document.createElement('div');
    content.className = 'tour-content';

    const title = document.createElement('h3');
    title.className = 'tour-title';

    const text = document.createElement('p');
    text.className = 'tour-text';

    content.appendChild(title);
    content.appendChild(text);
    this.tooltip.appendChild(content);
    this.tooltip.appendChild(buttons);

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);

    // Add event listeners
    this.tooltip.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).getAttribute('data-action');
      if (action === 'next') {
        this.nextStep();
      } else if (action === 'prev') {
        this.prevStep();
      } else if (action === 'skip') {
        this.end();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      
      if (e.key === 'ArrowRight') {
        this.nextStep();
      } else if (e.key === 'ArrowLeft') {
        this.prevStep();
      } else if (e.key === 'Escape') {
        this.end();
      }
    });
  }

  private showStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;

    this.currentStep = index;
    const step = this.steps[index];

    // Update tooltip content
    const title = this.tooltip!.querySelector('.tour-title')!;
    const text = this.tooltip!.querySelector('.tour-text')!;
    const prevBtn = this.tooltip!.querySelector<HTMLElement>('[data-action="prev"]')!;
    const nextBtn = this.tooltip!.querySelector<HTMLElement>('[data-action="next"]')!;

    title.textContent = step.title;
    text.textContent = step.text;
    prevBtn.style.display = index === 0 ? 'none' : 'block';
    nextBtn.textContent = index === this.steps.length - 1 ? 'Concluir' : 'Próximo';

    // Apply overlay highlight
    this.applyHighlight(step.selector);

    // Position tooltip
    this.positionTooltip(step.selector);
  }

  private applyHighlight(selector: string): void {
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });

    const target = document.querySelector(selector) as HTMLElement;
    if (!target) return;

    if (this.overlay) {
      const rect = target.getBoundingClientRect();
      const padding = 6;
      this.overlay.style.top = `${rect.top - padding}px`;
      this.overlay.style.left = `${rect.left - padding}px`;
      this.overlay.style.width = `${rect.width + padding * 2}px`;
      this.overlay.style.height = `${rect.height + padding * 2}px`;
    }

    target.classList.add('tour-highlight');
  }

  private positionTooltip(selector: string): void {
    if (!this.tooltip) return;

    const target = document.querySelector(selector) as HTMLElement;

    let left: number, top: number;

    if (target) {
      const rect = target.getBoundingClientRect();
      const tooltipRect = this.tooltip.getBoundingClientRect();

      left = rect.right + 20;
      top = rect.top + (rect.height - tooltipRect.height) / 2;

      if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 20;
      }
      if (top < 0) {
        top = 10;
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - 10;
      }
    } else {
      left = window.innerWidth / 2 - 150;
      top = window.innerHeight / 2 - 100;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;

    // Animate in
    requestAnimationFrame(() => {
      this.tooltip!.style.opacity = '1';
      this.tooltip!.style.transform = 'translateY(0)';
    });
  }

  private nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.end();
    }
  }

  private prevStep(): void {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  private end(): void {
    this.isActive = false;

    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });

    // Clean up
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    // Mark tour as seen
    this.markTourAsSeen();
  }

  private hasTourBeenSeen(): boolean {
    return localStorage.getItem('loom-tour-seen') === 'true';
  }

  private markTourAsSeen(): void {
    localStorage.setItem('loom-tour-seen', 'true');
  }

  destroy(): void {
    if (this.isActive) {
      this.end();
    }
  }
}