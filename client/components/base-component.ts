import { clog } from '../lib/client-logger.js';
import { preserveFocusAcrossRender, attachDataActionDispatch } from '../lib/dom-render.js';

export abstract class BaseComponent {
  protected element: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = container;
    this.attachHandlers();
  }

  protected abstract template(): string;
  protected abstract onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void;

  render(): void {
    clog.debug(`Renderizando <${this.constructor.name}>`);
    preserveFocusAcrossRender(this.element, () => {
      this.element.innerHTML = this.template();
    });
  }

  private attachHandlers(): void {
    attachDataActionDispatch(this.element, (action, id, target) => {
      this.onAction(action, id, target);
    });
  }

  destroy(): void {
    this.element.innerHTML = '';
  }
}