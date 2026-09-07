/*******************************************************************************
 * LoomVTT
 * client/windows/save-tile-tool-window.ts
 * 
 * 
 * Window for saving a tile as a tool.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';

/** Tool icon options. Font Awesome, never emoji. */
const TOOL_ICONS: { value: string; label: string }[] = [
  { value: '<i class="fa-solid fa-bolt"></i>', label: 'Raio' },
  { value: '<i class="fa-solid fa-triangle-exclamation"></i>', label: 'Perigo' },
  { value: '<i class="fa-solid fa-door-open"></i>', label: 'Porta' },
  { value: '<i class="fa-solid fa-fire"></i>', label: 'Fogo' },
  { value: '<i class="fa-solid fa-skull"></i>', label: 'Caveira' },
  { value: '<i class="fa-solid fa-key"></i>', label: 'Chave' },
  { value: '<i class="fa-solid fa-eye"></i>', label: 'Olho' },
  { value: '<i class="fa-solid fa-arrows-turn-to-dots"></i>', label: 'Teleporte' },
  { value: '<i class="fa-solid fa-volume-high"></i>', label: 'Som' },
  { value: '<i class="fa-solid fa-star"></i>', label: 'Estrela' },
];

/**
 * Replaces the two native `prompt()` that asked for tool name and icon.
 * Only collects data; what saves it is `saveTileAsTool` in game-hud, via
 * `onConfirm` callback.
 */
export class SaveTileToolWindow extends BaseWindow {
  constructor(
    private props: { defaultName: string; onConfirm: (name: string, icon: string) => void },
  ) {
    super({
      id: 'save-tile-tool',
      title: 'Salvar Tile como Ferramenta',
      icon: '<i class="fa-solid fa-stamp"></i>',
      width: 420,
      height: 'auto',
    } as BaseWindowOptions);
  }

  bodyTemplate(): string {
    return `
      <div class="form-group">
        <label>Nome da Ferramenta</label>
        <input type="text" name="tool-name" value="${this.esc(this.props.defaultName)}" required />
      </div>

      <div class="form-group">
        <label>Ícone</label>
        <select name="tool-icon">
          ${TOOL_ICONS.map((o) => `<option value="${this.esc(o.value)}">${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <small>
          A ferramenta guarda os gatilhos, condições e ações deste tile. Depois de salva,
          ela aparece na aba de Tiles da toolbox e cria tiles novos já configurados.
        </small>
      </div>
    `;
  }

  // Returns void indeed: no IO here. The base `_onAction` closes the window
  // sozinho depois (`closeOnSave`), entao nao chame windowManager.close.
  protected onAction(action: string): void {
    if (action !== 'save') return;

    const name = this.element.querySelector<HTMLInputElement>('[name="tool-name"]')?.value.trim();
    const icon = this.element.querySelector<HTMLSelectElement>('[name="tool-icon"]')?.value;

    if (!name) {
      // `throw` and not `return`: a normal return the base would read as success and
      // close the window, discarding what was typed.
      throw new Error('nome obrigatorio');
    }

    this.props.onConfirm(name, icon || TOOL_ICONS[0].value);
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
