export function createSearchFilter(
  label: string,
  count: number,
  onInput: (value: string) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-filter';
  wrapper.innerHTML = `<i class="fa-solid fa-magnifying-glass search-icon"></i><input type="text" placeholder="${label} (${count})" />`;

  const input = wrapper.querySelector('input')!;
  let debounceTimer: number;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => onInput(input.value), 200);
  });

  return wrapper;
}
