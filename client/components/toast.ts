import { applyUiOverride } from '../core/ui-override.js';

export type ToastType = 'success' | 'error' | 'info';

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration = 4000,
): void {
  const container = document.getElementById('toasts');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close btn-icon';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.onclick = () => el.remove();

  el.appendChild(msgSpan);
  el.appendChild(closeBtn);
  container.appendChild(el);
  // CONFIG.ui.notifications: lets a registered class decorate this individual
  // toast (e.g. add an icon/sound) — never replaces it, native toast always shows.
  applyUiOverride('notifications', el, { message, type, options: { duration } });

  const timeoutId = setTimeout(() => el.remove(), duration);

  // If user clicks, clear timeout so it doesn't cause errors though it's safe
  closeBtn.addEventListener('click', () => clearTimeout(timeoutId));
}
