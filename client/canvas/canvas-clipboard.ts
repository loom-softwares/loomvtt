/**
 * Canvas clipboard (Ctrl+C/X/V) — client-side, in-memory, DOES NOT use
 * the operating system clipboard (avoids browser permission and the risk
 * of pasting malicious JSON from outside the tab).
 */

export type ClipboardKind = 'cast' | 'tile' | 'drawing' | 'light';

export interface ClipboardEntry {
  kind: ClipboardKind;
  data: Record<string, any>;
}

class CanvasClipboard {
  private entries: ClipboardEntry[] = [];

  set(entries: ClipboardEntry[]): void {
    this.entries = entries;
  }

  get(): ClipboardEntry[] {
    return this.entries;
  }

  get hasItems(): boolean {
    return this.entries.length > 0;
  }

  clear(): void {
    this.entries = [];
  }
}

export const canvasClipboard = new CanvasClipboard();
