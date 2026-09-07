const popoutState = new Map<string, number>();

/**
 * Promote an element to the top visual layer (simulated popout).
 * In the future this could open a real browser window.
 */
export function attachWindow(element: HTMLElement, id: string): void {
  popoutState.set(id, Date.now());
  element.style.zIndex = '9999';
}

/**
 * Return a previously attached element to its normal layer.
 */
export function detachWindow(element: HTMLElement, id: string): void {
  popoutState.delete(id);
  element.style.zIndex = '101';
}

export function isPoppedOut(id: string): boolean {
  return popoutState.has(id);
}

export function getPoppedOutIds(): string[] {
  return Array.from(popoutState.keys());
}
