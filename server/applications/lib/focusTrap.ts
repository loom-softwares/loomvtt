export function focusTrap(node: HTMLElement) {
  const focusable = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const elements = node.querySelectorAll(focusable);
    if (!elements.length) return;
    const first = elements[0] as HTMLElement;
    const last = elements[elements.length - 1] as HTMLElement;
    
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  
  node.addEventListener('keydown', onKeyDown);
  // Initial focus
  const first = node.querySelector(focusable) as HTMLElement;
  first?.focus();
  
  return {
    destroy() { node.removeEventListener('keydown', onKeyDown); }
  };
}
