/**
 * select/textarea/value-input (except checkbox/radio/button/file) — commit on 'change', not on 'click'.
 * 
 * @param el - The HTML element to check
 * @returns true if the element is a value input, false otherwise
 */
export function isValueInput(el: HTMLElement): boolean {
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type);
  }
  return false;
}

/**
 * (anti-blur): saves focus by `name` before re-rendering inside `container`, restores it afterwards.
 * 
 * @param container - The parent container element where the re-render happens
 * @param doRender - The callback function that performs the synchronous DOM replacement
 */
export function preserveFocusAcrossRender(container: HTMLElement, doRender: () => void): void {
  const focusedEl = container.querySelector<HTMLElement>(':focus');
  const focusedName = focusedEl?.getAttribute('name');
  let selStart: number | null = null;
  try {
    selStart = (focusedEl as HTMLInputElement)?.selectionStart ?? null;
  } catch (_e) {
    // selectionStart throws on type="number" inputs
  }
  // The typed draft, not just focus: `doRender()` rebuilds the field with the SERVER
  // value (the last thing saved) — if the user was mid-keystroke when this
  // re-render happened (WS from any change, own or another user's), the typed
  // and unsaved text (auto-save is debounced) disappeared with no error at all. It was
  // exactly the symptom of "typing and the field comes back empty" — the focus came back fine,
  // the value didn't.
  const focusedValue = (focusedEl instanceof HTMLInputElement || focusedEl instanceof HTMLTextAreaElement)
    ? focusedEl.value
    : undefined;

  doRender();

  if (focusedName) {
    const input = container.querySelector<HTMLInputElement>(`[name="${focusedName}"]`);
    if (input) {
      if (focusedValue !== undefined) input.value = focusedValue;
      input.focus();
      try {
        const pos = selStart ?? input.value.length;
        input.setSelectionRange(pos, pos);
      } catch (_e) {
        // setSelectionRange throws on type="number" inputs — ignore
      }
    }
  }
}

/**
 * (event delegation): a single root listener dispatches by [data-action].
 * 
 * @param root - The root container to attach the delegated listeners to
 * @param dispatch - The callback invoked when a data-action is triggered
 */
export function attachDataActionDispatch(
  root: HTMLElement,
  dispatch: (action: string, id: string | null, target: HTMLElement) => void,
): void {
  root.addEventListener('click', (e: MouseEvent) => {
    // select/textarea/text-inputs never trigger data-action on click — only the 'change'
    // listener below, which fires when the value commits. Checks the EXACT element
    // clicked (e.target), not the `btn` resolved by closest() — an <input> without its own
    // data-action inside a <form data-action="save"> makes closest() climb up to the form, and
    // checking isValueInput on that form (never input/select/textarea) always bypassed it:
    // clicking just to focus the field triggered 'save' with everything empty, before typing
    // anything (real finding: MacroEditorWindow showed "required fields not
    // filled" on focus click in the name field, without the user having typed anything).
    if (isValueInput(e.target as HTMLElement)) return;

    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;

    // Do not cancel the click when the data-action element itself is a checkbox/radio —
    // preventDefault() here would cancel the native toggle before it happens.
    const isNativeToggle = btn instanceof HTMLInputElement && (btn.type === 'checkbox' || btn.type === 'radio');
    if (!isNativeToggle) e.preventDefault();

    const action = btn.getAttribute('data-action')!;
    const id = btn.closest<HTMLElement>('[data-id]')?.getAttribute('data-id') ?? null;
    dispatch(action, id, btn);
  });

  root.addEventListener('change', (e: Event) => {
    const el = e.target as HTMLElement;
    if (!isValueInput(el)) return;
    const action = el.getAttribute('data-action');
    if (!action) return;
    const id = el.closest<HTMLElement>('[data-id]')?.getAttribute('data-id') ?? null;
    dispatch(action, id, el);
  });

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Same bug as the 'click' listener above: without this, typing a space (or hitting Enter)
    // inside an <input>/<textarea> without its own data-action, but wrapped by a
    // <form data-action="save">, makes closest() find the form and trigger 'save' mid-
    // typing — real finding: hitting space in the macro name closed the window and,
    // since focus disappeared along with the closing window, the Space "leaked" to the global
    // pause world shortcut (the activeElement guard on INPUT/TEXTAREA in game-hud.ts no longer
    // saw the focused field, because it had just been removed from the DOM).
    if (isValueInput(e.target as HTMLElement)) return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.getAttribute('data-action')!;
    const id = btn.closest<HTMLElement>('[data-id]')?.getAttribute('data-id') ?? null;
    dispatch(action, id, btn);
  });

  // No <form> in this project uses real HTTP submit — all action buttons are
  // type="button" with their own data-action. The keydown above intentionally ignores Enter
  // inside value inputs (see comment right above), but this lets Enter fall
  // into the form's NATIVE submit, which reloads the page (real finding: world login
  // screen reloaded when hitting Enter in the password field, only worked by tabbing to
  // the button). Always prevent and dispatch the first form action, just like clicking the button.
  root.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLElement;
    const btn = form.querySelector<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (!action) return;
    const id = btn.closest<HTMLElement>('[data-id]')?.getAttribute('data-id') ?? null;
    dispatch(action, id, btn);
  });
}