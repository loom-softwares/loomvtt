import { t } from '../lib/i18n.js';
import { LoomDialog, DialogButton } from '../windows/loom-dialog.js';

function escDialogHtml(text: unknown): string {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

interface ConfirmOptions {
  title: string;
  content: string;
  rejectClose?: boolean;
}

interface PromptOptions {
  title: string;
  content: string;
  placeholder?: string;
}

interface WaitOptions {
  title: string;
  content: string;
  buttons: DialogButton[];
  rejectClose?: boolean;
  width?: number;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return LoomDialog.wait({
    window: { title: options.title },
    content: options.content,
    rejectClose: options.rejectClose,
    buttons: [
      { action: 'cancel', label: t('common.cancel') || 'Cancelar', variant: 'ghost', callback: () => false },
      { action: 'confirm', label: t('common.ok') || 'Confirmar', variant: 'primary', callback: () => true },
    ],
  });
}

export function prompt(options: PromptOptions): Promise<string | null> {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;box-sizing:border-box;width:100%;';

  const msg = document.createElement('div');
  msg.style.cssText = 'color:var(--color-text-primary);font-size:0.95rem;font-weight:500;line-height:1.4;';
  msg.innerHTML = options.content;
  container.appendChild(msg);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'loom-dialog-input';
  input.placeholder = options.placeholder ?? '';
  input.style.cssText = 'width:100%;box-sizing:border-box;background:var(--color-bg-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:4px;padding:0.35rem 0.5rem;';
  container.appendChild(input);
  setTimeout(() => input.focus(), 50);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.closest('.loom-dialog')?.querySelector<HTMLButtonElement>('[data-action="submit"]')?.click();
    }
  });

  return LoomDialog.wait({
    window: { title: options.title },
    content: container,
    buttons: [
      { action: 'cancel', label: t('common.cancel') || 'Cancelar', variant: 'ghost', callback: () => null },
      {
        action: 'submit',
        label: t('common.ok') || 'Confirmar',
        variant: 'primary',
        callback: () => input.value,
      },
    ],
  });
}

export function wait<T>(options: WaitOptions): Promise<T> {
  return LoomDialog.wait({
    window: { title: options.title },
    content: options.content,
    rejectClose: options.rejectClose,
    buttons: options.buttons,
    width: options.width,
  });
}

export function showConfirm(title: string, message: string): Promise<boolean> {
  return confirm({ title, content: message });
}

export function showPrompt(title: string, label: string, defaultValue: string = ''): Promise<string | null> {
  return prompt({ title, content: label, placeholder: defaultValue });
}

export function showAlert(title: string, message: string): Promise<void> {
  return LoomDialog.wait({
    window: { title },
    content: message,
    buttons: [
      { action: 'confirm', label: t('common.ok') || 'Confirmar', variant: 'primary', callback: () => {} },
    ],
  });
}

/** Dialog genérico de escolha entre opções (tipo de ator/item, mover pra pasta, etc). */
export function showSelectDialog(
  title: string,
  label: string,
  choices: { value: string; label: string }[],
): Promise<string | null> {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;padding:0.5rem;box-sizing:border-box;';

  const labelEl = document.createElement('label');
  labelEl.style.cssText = 'color:var(--color-text-secondary);font-size:0.95rem;font-weight:500;';
  labelEl.textContent = label;
  container.appendChild(labelEl);

  const select = document.createElement('select');
  select.id = 'loom-select-value';
  select.style.cssText = 'width:100%;box-sizing:border-box;background:var(--color-bg-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:4px;padding:0.35rem 0.5rem;font-size:0.9rem;';
  select.innerHTML = choices.map((c) => `<option value="${escDialogHtml(c.value)}">${escDialogHtml(c.label)}</option>`).join('');
  container.appendChild(select);

  return LoomDialog.wait({
    window: { title },
    content: container,
    width: 360,
    buttons: [
      { action: 'cancel', label: t('common.cancel') || 'Cancelar', variant: 'ghost', callback: () => null },
      { action: 'confirm', label: t('common.ok') || 'Confirmar', variant: 'primary', callback: () => select.value },
    ],
  });
}

/** Dialog de seleção de cor. */
export function showColorDialog(
  title: string,
  label: string,
  defaultValue?: string,
): Promise<string | null> {
  const colorValue = defaultValue || '#ffffff';
  const container = document.createElement('div');
  container.className = 'dialog-content';
  container.innerHTML = `
    <div class="form-group">
      <label>${escDialogHtml(label)}</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="color" name="color-input" value="${colorValue}" style="width: 50px; height: 40px; border: none; border-radius: 4px;">
        <input type="text" name="color-text" value="${colorValue}" placeholder="#ffffff" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
    </div>
  `;

  const colorInput = container.querySelector<HTMLInputElement>('[name="color-input"]')!;
  const colorText = container.querySelector<HTMLInputElement>('[name="color-text"]')!;
  colorInput.addEventListener('input', () => { colorText.value = colorInput.value; });
  colorText.addEventListener('input', () => {
    if (/^#[0-9A-F]{6}$/i.test(colorText.value)) colorInput.value = colorText.value;
  });

  return LoomDialog.wait({
    window: { title },
    content: container,
    width: 400,
    buttons: [
      { action: 'cancel', label: t('common.cancel'), variant: 'ghost', callback: () => null },
      { action: 'confirm', label: t('common.confirm'), variant: 'primary', callback: () => colorInput.value },
    ],
  });
}

/** Dialog padrão de edição de pasta (nome + cor juntos, um só diálogo) — usado por toda
 * pasta do core (atores/itens/diários/cenas/decks/macros/playlists, packs de compêndio
 * do mundo, packs de fonte de addon/ruleset, e o agrupador Sistema/Addon da sidebar).
 * Substitui o fluxo antigo de dois diálogos sequenciais (showPrompt + showColorDialog). */
export function showFolderEditDialog(
  title: string,
  defaultName: string,
  defaultColor?: string,
): Promise<{ name: string; color: string } | null> {
  const colorValue = defaultColor || '#ffffff';
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;box-sizing:border-box;width:100%;';
  container.innerHTML = `
    <div class="form-group">
      <label>Nome da pasta</label>
      <input type="text" name="folder-name" value="${escDialogHtml(defaultName)}" style="width:100%;box-sizing:border-box;background:var(--color-bg-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:4px;padding:0.35rem 0.5rem;">
    </div>
    <div class="form-group">
      <label>Cor da pasta</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="color" name="color-input" value="${colorValue}" style="width: 50px; height: 40px; border: none; border-radius: 4px;">
        <input type="text" name="color-text" value="${colorValue}" placeholder="#ffffff" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
    </div>
  `;

  const nameInput = container.querySelector<HTMLInputElement>('[name="folder-name"]')!;
  const colorInput = container.querySelector<HTMLInputElement>('[name="color-input"]')!;
  const colorText = container.querySelector<HTMLInputElement>('[name="color-text"]')!;
  colorInput.addEventListener('input', () => { colorText.value = colorInput.value; });
  colorText.addEventListener('input', () => {
    if (/^#[0-9A-F]{6}$/i.test(colorText.value)) colorInput.value = colorText.value;
  });
  setTimeout(() => nameInput.focus(), 50);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      container.closest('.loom-dialog')?.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.click();
    }
  });

  return LoomDialog.wait({
    window: { title },
    content: container,
    width: 400,
    buttons: [
      { action: 'cancel', label: t('common.cancel'), variant: 'ghost', callback: () => null },
      { action: 'confirm', label: t('common.confirm'), variant: 'primary', callback: () => ({ name: nameInput.value.trim(), color: colorInput.value }) },
    ],
  });
}

/** Dialog de slider numérico (range input). */
export function showRangeDialog(
  title: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
): Promise<number | null> {
  const container = document.createElement('div');
  container.className = 'dialog-content';
  container.innerHTML = `
    <div class="form-group">
      <label>${escDialogHtml(label)}</label>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <input type="range" name="range-input" min="${min}" max="${max}" step="${step}" value="${defaultValue}" style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>${min}</span>
          <input type="number" name="range-value" value="${defaultValue}" min="${min}" max="${max}" step="${step}" style="width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
          <span>${max}</span>
        </div>
      </div>
    </div>
  `;

  const rangeInput = container.querySelector<HTMLInputElement>('[name="range-input"]')!;
  const rangeValue = container.querySelector<HTMLInputElement>('[name="range-value"]')!;
  rangeInput.addEventListener('input', () => { rangeValue.value = rangeInput.value; });
  rangeValue.addEventListener('input', () => {
    const value = parseFloat(rangeValue.value);
    if (!isNaN(value) && value >= min && value <= max) {
      rangeInput.value = rangeValue.value;
    }
  });

  return LoomDialog.wait({
    window: { title },
    content: container,
    width: 400,
    buttons: [
      { action: 'cancel', label: t('common.cancel'), variant: 'ghost', callback: () => null },
      { action: 'confirm', label: t('common.confirm'), variant: 'primary', callback: () => parseFloat(rangeInput.value) },
    ],
  });
}

export function showCreatePageDialog(): Promise<{
  name: string;
  type: 'text' | 'image' | 'pdf';
} | null> {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;padding:0.75rem;box-sizing:border-box;';
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
      <label style="color: var(--color-text-secondary); font-size: 0.95rem; font-weight: 500;">Nome da Página</label>
      <input type="text" id="page-name-input" placeholder="Nova Página" style="width: 100%; box-sizing: border-box; background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: 4px; padding: 0.35rem 0.5rem;" />
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
      <label style="color: var(--color-text-secondary); font-size: 0.95rem; font-weight: 500;">Tipo de Página</label>
      <select id="page-type-select" style="width: 100%; box-sizing: border-box; background: var(--color-bg-surface); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: 4px; padding: 0.35rem 0.5rem; font-size: 0.9rem;">
        <option value="text">Texto (HTML)</option>
        <option value="image">Imagem</option>
        <option value="pdf">PDF</option>
      </select>
    </div>
  `;

  const nameInput = container.querySelector<HTMLInputElement>('#page-name-input')!;
  const typeSelect = container.querySelector<HTMLSelectElement>('#page-type-select')!;
  setTimeout(() => nameInput.focus(), 50);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.closest('.loom-dialog')?.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();
    }
  });

  return LoomDialog.wait({
    window: { title: t('dialog.createPage.title') },
    content: container,
    width: 360,
    buttons: [
      { action: 'cancel', label: t('common.cancel') || 'Cancelar', variant: 'ghost', callback: () => null },
      {
        action: 'save',
        label: 'Criar Página',
        variant: 'primary',
        callback: () => {
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.style.borderColor = '#ff5252';
            throw new Error('Nome da página é obrigatório');
          }
          return { name, type: typeSelect.value as 'text' | 'image' | 'pdf' };
        },
      },
    ],
  });
}
