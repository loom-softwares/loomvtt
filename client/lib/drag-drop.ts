export interface DragDropConfig {
  dragSelector: string;
  dropSelector: string;
  getDragData: (el: HTMLElement) => Record<string, any> | null;
  onDrop: (data: Record<string, any>, targetEl: HTMLElement, event: DragEvent) => void;
}

export class DragDropHandler {
  private _onDragStart: (e: DragEvent) => void;
  private _onDragOver: (e: DragEvent) => void;
  private _onDrop: (e: DragEvent) => void;

  constructor(private root: HTMLElement, private config: DragDropConfig) {
    this._onDragStart = this.handleDragStart.bind(this);
    this._onDragOver = this.handleDragOver.bind(this);
    this._onDrop = this.handleDrop.bind(this);
    this.root.addEventListener('dragstart', this._onDragStart);
    this.root.addEventListener('dragover', this._onDragOver);
    this.root.addEventListener('drop', this._onDrop);
  }

  private handleDragStart(e: DragEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>(this.config.dragSelector);
    if (!target) return;
    const data = this.config.getDragData(target);
    if (!data) return;
    e.dataTransfer?.setData('text/plain', JSON.stringify(data));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  private handleDragOver(e: DragEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>(this.config.dropSelector);
    if (!target) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  private handleDrop(e: DragEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>(this.config.dropSelector);
    if (!target) return;
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    e.preventDefault();
    let data: Record<string, any>;
    try { data = JSON.parse(raw); } catch { return; }
    this.config.onDrop(data, target, e);
  }

  destroy(): void {
    this.root.removeEventListener('dragstart', this._onDragStart);
    this.root.removeEventListener('dragover', this._onDragOver);
    this.root.removeEventListener('drop', this._onDrop);
  }
}
