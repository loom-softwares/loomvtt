/**
 * Compatible with `Loom.applications.ux.DragDrop`: built already configured
 * (`dragSelector`/`dropSelector`/`permissions`/`callbacks`), rebound to an
 * element via `.bind(element)` whenever the sheet re-renders — unlike
 * `DragDropHandler` (client/lib/drag-drop.ts), which is born already bound to a
 * fixed element. Converted systems (ApplicationV2-style) call
 * `new DragDrop(config)` in the sheet constructor and `.bind(this.element)` on
 * every render — without this class, converted systems that create their own
 * drag-drop (instead of using `options.dragDrop`) break.
 */
export interface LoomDragDropConfig {
  dragSelector?: string | null;
  dropSelector?: string | null;
  permissions?: Record<string, (selector: HTMLElement) => boolean>;
  callbacks?: Record<string, (event: DragEvent) => void>;
}

export class LoomDragDrop {
  dragSelector: string | null;
  dropSelector: string | null;
  permissions: Record<string, (selector: HTMLElement) => boolean>;
  callbacks: Record<string, (event: DragEvent) => void>;

  private boundElement: HTMLElement | null = null;
  private onDragStart = (e: DragEvent) => this.handleDragStart(e);
  private onDragOver = (e: DragEvent) => this.handleDragOver(e);
  private onDrop = (e: DragEvent) => this.handleDrop(e);

  constructor(config: LoomDragDropConfig = {}) {
    this.dragSelector = config.dragSelector ?? null;
    this.dropSelector = config.dropSelector ?? null;
    this.permissions = config.permissions ?? {};
    this.callbacks = config.callbacks ?? {};
  }

  bind(element: HTMLElement): this {
    this.unbind();
    this.boundElement = element;
    if (this.dragSelector) {
      element.querySelectorAll<HTMLElement>(this.dragSelector).forEach((el) => {
        el.setAttribute('draggable', 'true');
        el.addEventListener('dragstart', this.onDragStart);
      });
    }
    // `dropSelector: null` is the convention used by converted systems (e.g.,
    // group-actor-sheet.js) to say "the ENTIRE sheet accepts drop", not "no
    // drop support" — requiring a truthy `dropSelector` here prevented the
    // listeners from rebinding entirely, breaking dragging an Actor into a Group.
    element.addEventListener('dragover', this.onDragOver);
    element.addEventListener('drop', this.onDrop);
    return this;
  }

  unbind(): void {
    if (!this.boundElement) return;
    if (this.dragSelector) {
      this.boundElement.querySelectorAll<HTMLElement>(this.dragSelector).forEach((el) => {
        el.removeEventListener('dragstart', this.onDragStart);
      });
    }
    this.boundElement.removeEventListener('dragover', this.onDragOver);
    this.boundElement.removeEventListener('drop', this.onDrop);
    this.boundElement = null;
  }

  private resolveDropTarget(event: DragEvent): HTMLElement | null {
    // Without `dropSelector` (null), the entire rebound element is the target — same
    // `dragSelector`/`dropSelector` convention used in converted sheets.
    if (!this.dropSelector) return this.boundElement;
    return (event.target as HTMLElement)?.closest<HTMLElement>(this.dropSelector) ?? null;
  }

  private handleDragStart(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (this.permissions.dragstart && !this.permissions.dragstart(target)) return;
    this.callbacks.dragstart?.(event);
  }

  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.callbacks.dragover?.(event);
  }

  private handleDrop(event: DragEvent): void {
    const target = this.resolveDropTarget(event);
    if (!target) return;
    if (this.permissions.drop && !this.permissions.drop(target)) return;
    event.preventDefault();
    this.callbacks.drop?.(event);
  }
}
