/*******************************************************************************
 * LoomVTT
 * client/windows/drawing-config-window.ts
 * 
 * 
 * Window for configuring drawings.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { windowManager } from '../core/window-manager.js';
import { t } from '../lib/i18n.js';

export interface DrawingData {
  id: string;
  stageId: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  rotation?: number;
  levelId?: string;
}

/** Candidate fonts — filtered by real availability in the browser via document.fonts.check() */
const FONT_CANDIDATES = [
  'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Impact',
  'Georgia', 'Times New Roman', 'Palatino Linotype', 'Garamond',
  'Courier New', 'Comic Sans MS',
  'Cinzel', 'Crimson Text', 'Inter', 'JetBrains Mono',
];

function availableFonts(): string[] {
  try {
    return FONT_CANDIDATES.filter((f) => document.fonts.check(`12px "${f}"`));
  } catch {
    return FONT_CANDIDATES;
  }
}

export class DrawingConfigWindow extends BaseWindow {
  private drawing: DrawingData | null = null;
  private activeTab = 'position';

  constructor(private props: { id: string; drawingId: string }) {
    super({
      id: props.id,
      title: 'Configurar Desenho',
      icon: '<i class="fa-solid fa-palette"></i>',
      width: 420,
      height: 'auto',
    });
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
  }

  protected _postRender(): void {
    super._postRender();
    const range = this.element.querySelector<HTMLInputElement>('[name="fontSizeRange"]');
    const number = this.element.querySelector<HTMLInputElement>('[name="fontSize"]');
    const valueLabel = this.element.querySelector<HTMLElement>('#val-fontSize');
    if (range && number) {
      range.addEventListener('input', () => {
        number.value = range.value;
        if (valueLabel) valueLabel.textContent = `${range.value}px`;
      });
      number.addEventListener('input', () => {
        range.value = number.value;
        if (valueLabel) valueLabel.textContent = `${number.value}px`;
      });
    }
  }

  private async load(): Promise<void> {
    try {
      this.drawing = await api.get<DrawingData>(`/drawings/${this.props.drawingId}`);
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar desenho', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.drawing) {
      return `<div class="empty-panel">Carregando...</div>`;
    }

    const d = this.drawing;
    const showText = d.type === 'text' || d.type === 'rectangle' || d.type === 'ellipse' || d.type === 'circle';
    const tabs: { id: string; icon: string; label: string }[] = [
      { id: 'position', icon: '📍', label: 'Posição' },
      { id: 'lines', icon: '🖊️', label: 'Linhas' },
      { id: 'fill', icon: '🎨', label: 'Preencher' },
      ...(showText ? [{ id: 'text', icon: '🅰️', label: 'Texto' }] : []),
    ];
    const sec = (id: string) => `data-config-section="${id}" style="display: ${this.activeTab === id ? 'block' : 'none'};"`;
    const fonts = availableFonts();
    const currentFont = d.fontFamily ?? 'Arial';
    const fontOptions = (fonts.includes(currentFont) ? fonts : [currentFont, ...fonts])
      .map((f) => `<option value="${f}" ${f === currentFont ? 'selected' : ''} style="font-family: '${f}'">${f}</option>`).join('');

    return `
      <div style="display: flex; gap: 0.25rem; padding: 0.5rem 1rem 0; border-bottom: 1px solid var(--color-border);">
        ${tabs.map((t) => `
          <button class="btn" type="button" data-action="config-tab" data-id="${t.id}"
            style="background: none; border: none; cursor: pointer; padding: 0.4rem 0.75rem; font-size: 0.85rem;
              color: ${this.activeTab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)'};
              border-bottom: 2px solid ${this.activeTab === t.id ? 'var(--color-accent)' : 'transparent'};">
            ${t.icon} ${t.label}
          </button>`).join('')}
      </div>
      <form class="drawing-config-form">
        <div ${sec('position')}>
          <div class="form-group">
            <label>Posição X (px)</label>
            <input type="number" name="x" value="${d.x}" />
          </div>
          <div class="form-group">
            <label>Posição Y (px)</label>
            <input type="number" name="y" value="${d.y}" />
          </div>
          <div class="form-group">
            <label>Largura (px)</label>
            <input type="number" name="width" value="${d.width}" />
          </div>
          <div class="form-group">
            <label>Altura (px)</label>
            <input type="number" name="height" value="${d.height}" />
          </div>
          <div class="form-group">
            <label>Rotação (graus)</label>
            <input type="number" name="rotation" value="${d.rotation ?? 0}" />
          </div>
          <div class="form-group">
            <label>Organizar (Z)</label>
            <input type="number" name="z" value="${d.z ?? 0}" />
          </div>
          <div class="form-group">
            <label>${t('common.level') || 'Andar'}</label>
            <select name="levelId">
              <option value="">${t('common.globalLevel') || 'Térreo (Global)'}</option>
              ${(CanvasManager.activeInstance?.levels || []).map(l => `<option value="${l.id}" ${d.levelId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div ${sec('lines')}>
          <div class="form-group">
            <label>Largura da Linha (px)</label>
            <input type="number" name="strokeWidth" value="${d.strokeWidth ?? 1}" min="0" />
          </div>
          <div class="form-group">
            <label>Cor da Linha</label>
            <div class="color-input-group">
              <input type="color" name="strokeColor" value="${d.strokeColor ?? '#ffffff'}" />
              <input type="text" name="strokeColorText" value="${d.strokeColor ?? '#ffffff'}" />
            </div>
          </div>
        </div>
        <div ${sec('fill')}>
          <div class="form-group">
            <label>Cor do Preenchimento</label>
            <div class="color-input-group">
              <input type="color" name="fillColor" value="${d.fillColor ?? '#000000'}" />
              <input type="text" name="fillColorText" value="${d.fillColor ?? '#000000'}" />
            </div>
          </div>
          <div class="form-group">
            <label>Opacidade do Preenchimento</label>
            <input type="number" name="fillOpacity" value="${d.fillOpacity ?? 0.3}" step="0.1" min="0" max="1" />
          </div>
        </div>
        ${showText ? `
        <div ${sec('text')}>
          <div class="form-group">
            <label>Rótulo do Texto</label>
            <textarea name="text" style="min-height: 60px; resize: vertical;">${d.text ?? ''}</textarea>
          </div>
          <div class="form-group">
            <label>Família da Fonte</label>
            <select name="fontFamily">${fontOptions}</select>
          </div>
          <div class="form-group">
            <label>Tamanho da Fonte <span id="val-fontSize">${d.fontSize ?? 48}px</span></label>
            <input type="range" name="fontSizeRange" min="8" max="300" step="1" value="${d.fontSize ?? 48}" />
          </div>
          <div class="form-group">
            <label>Tamanho Exato (px)</label>
            <input type="number" name="fontSize" value="${d.fontSize ?? 48}" min="1" />
          </div>
        </div>` : ''}
      </form>
    `;
  }

  async submit(options: { close?: boolean } = {}): Promise<void> {
    if (!this.drawing) return;
    const body = this.element.querySelector('.loom-window-body');
    if (!body) return;

    const fd = new LoomFormData(body as HTMLElement);
    const data = fd.object;

    const payload = {
      x: Number(data.x),
      y: Number(data.y),
      width: Number(data.width),
      height: Number(data.height),
      rotation: Number(data.rotation),
      z: Number(data.z),
      fillColor: data.fillColor,
      fillOpacity: Number(data.fillOpacity),
      strokeColor: data.strokeColor,
      strokeWidth: Number(data.strokeWidth),
      text: data.text,
      fontFamily: data.fontFamily,
      fontSize: data.fontSize ? Number(data.fontSize) : undefined,
      levelId: data.levelId ?? '',
    };

    try {
      await api.put(`/drawings/${this.props.drawingId}`, payload);
      showToast('Configurações de desenho salvas', 'success');
      if (options.close) {
        windowManager.close(this.options.id);
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar configurações de desenho', 'error');
    }
  }

  protected _getHeaderControls(): Array<{
    icon: string;
    label: string;
    action: string;
    title?: string;
  }> {
    return [
      {
        icon: 'fas fa-trash',
        label: 'Excluir',
        action: 'delete',
        title: 'Excluir Desenho',
      },
    ];
  }

  async deleteDrawing(): Promise<void> {
    try {
      await api.delete(`/drawings/${this.props.drawingId}`);
      showToast('Desenho excluído', 'success');
      windowManager.close(this.options.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir desenho', 'error');
    }
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'config-tab' && id) {
      // Direct tab swap in DOM (without rerender) to not lose typed values
      this.activeTab = id;
      this.element.querySelectorAll<HTMLElement>('[data-config-section]').forEach((el) => {
        el.style.display = el.dataset.configSection === id ? 'block' : 'none';
      });
      this.element.querySelectorAll<HTMLElement>('[data-action="config-tab"]').forEach((btn) => {
        const active = btn.dataset.id === id;
        btn.style.color = active ? 'var(--color-accent)' : 'var(--color-text-secondary)';
        btn.style.borderBottom = `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`;
      });
    } else if (action === 'save') {
      void this.submit({ close: true });
    } else if (action === 'cancel') {
      windowManager.close(this.options.id);
    } else if (action === 'delete') {
      void this.deleteDrawing();
    }
  }
}
