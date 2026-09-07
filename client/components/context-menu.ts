export interface ContextMenuItem {
  icon?: string;
  label: string;
  action?: () => void;
  danger?: boolean;
  divider?: boolean;
}

export function showContextMenu(
  event: MouseEvent,
  items: ContextMenuItem[],
): void {
  event.preventDefault();

  // Remove existing menu
  document.querySelector('.context-menu')?.remove();

  // Create menu element
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.setAttribute('role', 'menu');
  menu.tabIndex = -1;

  // Add items
  items.forEach((item) => {
    if (item.divider) {
      const divider = document.createElement('hr');
      divider.className = 'context-menu-divider';
      menu.appendChild(divider);
      return;
    }

    const el = document.createElement('div');
    el.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    el.innerHTML = `<span>${item.icon ?? ''}</span><span>${item.label}</span>`;
    el.setAttribute('role', 'menuitem');
    el.setAttribute('tabindex', '0');

    const activate = () => {
      item.action?.();
      menu.remove();
    };

    el.addEventListener('click', activate);
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });

    menu.appendChild(el);
  });

  document.body.appendChild(menu);

  // Adjust position if menu would go off-screen
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }
  });

  // Close menu on click elsewhere or Escape
  const closeMenu = () => {
    menu.classList.add('closing');
    menu.addEventListener('animationend', () => menu.remove(), { once: true });
    setTimeout(() => menu.remove(), 100);
    document.removeEventListener('click', closeMenu);
    document.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', handleKey);
  }, 0);
}
