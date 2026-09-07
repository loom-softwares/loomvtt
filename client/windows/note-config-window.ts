/*******************************************************************************
 * LoomVTT
 * client/windows/note-config-window.ts
 * 
 * 
 * Window for configuring map notes.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { windowManager } from '../core/window-manager.js';
import { Tabs } from '../components/tabs.js';
import { t } from '../lib/i18n.js';

export interface NoteData {
  id: string;
  stageId: string;
  journalId: string;
  x: number;
  y: number;
  visibleToPlayers: boolean;
  floors: number;
  visibleGlobally: boolean;
  iconEntry: string;
  iconFontSize: number;
  iconTint: string;
  textLabel: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAnchor: string;
  levelId?: string;
  createdAt: string;
  updatedAt: string;
}

export class NoteConfigWindow extends BaseWindow {
  private note: NoteData | null = null;
  private tabs: Tabs;
  private activeTabId: string = 'general';

  constructor(private props: { id: string; noteId: string }) {
    super({
      id: props.id,
      title: 'Configurar Nota',
      icon: '<i class="fa-solid fa-note-sticky"></i>',
      width: 400,
      height: 450,
    });

    this.tabs = new Tabs(
      [
        { id: 'general', label: 'Geral' },
        { id: 'appearance', label: 'Aparência' },
      ],
      this.activeTabId
    );
  }

  async mount(): Promise<void> {
    super.mount();
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.note = await api.get<NoteData>(`/notes/${this.props.noteId}`);
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar nota', 'error');
    }
  }

  bodyTemplate(): string {
    if (!this.note) {
      return `<div class="empty-panel">Carregando...</div>`;
    }

    const n = this.note;

    const generalHtml = `
      <div class="field-stack-group">
        <div class="field-stack">
          <label class="field-label">Andares</label>
          <select name="floors" class="field-input">
            <option value="0" ${n.floors === 0 ? 'selected' : ''}>Térreo</option>
            <option value="1" ${n.floors === 1 ? 'selected' : ''}>1º Andar</option>
            <option value="2" ${n.floors === 2 ? 'selected' : ''}>2º Andar</option>
            <option value="3" ${n.floors === 3 ? 'selected' : ''}>3º Andar</option>
            <option value="4" ${n.floors === 4 ? 'selected' : ''}>4º Andar</option>
            <option value="5" ${n.floors === 5 ? 'selected' : ''}>5º Andar</option>
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">${t('common.level') || 'Andar'}</label>
          <select name="levelId" class="field-input">
            <option value="">${t('common.globalLevel') || 'Térreo (Global)'}</option>
            ${(CanvasManager.activeInstance?.levels || []).map(l => `<option value="${l.id}" ${n.levelId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>

        <div class="field-row">
          <input type="checkbox" name="visibleGlobally" id="note-visible-global" ${n.visibleGlobally ? 'checked' : ''} style="cursor: pointer;" />
          <label for="note-visible-global" class="checkbox-label">Visível Globalmente</label>
        </div>

        <div class="field-row">
          <input type="checkbox" name="visibleToPlayers" id="note-visible-players" ${n.visibleToPlayers ? 'checked' : ''} style="cursor: pointer;" />
          <label for="note-visible-players" class="checkbox-label">Visível para Jogadores</label>
        </div>
      </div>
    `;

    const appearanceHtml = `
      <div class="field-stack-group">
        <details open>
          <summary class="section-summary">Ícone</summary>
          <div class="section-body">
            <div class="field-stack">
              <label class="field-label">Ícone da Entrada</label>
              <select name="iconEntry" class="field-input">
                <option value="bookmark" ${n.iconEntry === 'bookmark' ? 'selected' : ''}>Bookmark</option>
                <option value="book" ${n.iconEntry === 'book' ? 'selected' : ''}>Book</option>
                <option value="newspaper" ${n.iconEntry === 'newspaper' ? 'selected' : ''}>Newspaper</option>
                <option value="file-alt" ${n.iconEntry === 'file-alt' ? 'selected' : ''}>File</option>
                <option value="sticky-note" ${n.iconEntry === 'sticky-note' ? 'selected' : ''}>Sticky Note</option>
                <option value="map-marker-alt" ${n.iconEntry === 'map-marker-alt' ? 'selected' : ''}>Map Marker</option>
                <option value="flag" ${n.iconEntry === 'flag' ? 'selected' : ''}>Flag</option>
                <option value="star" ${n.iconEntry === 'star' ? 'selected' : ''}>Star</option>
                <option value="heart" ${n.iconEntry === 'heart' ? 'selected' : ''}>Heart</option>
                <option value="exclamation-circle" ${n.iconEntry === 'exclamation-circle' ? 'selected' : ''}>Alert</option>
              </select>
            </div>

            <div class="field-stack">
              <label class="field-label">Tamanho da Fonte (Pixels)</label>
              <input type="number" name="iconFontSize" value="${n.iconFontSize}" min="10" max="100" step="1" class="field-input" />
            </div>

            <div class="field-stack">
              <label class="field-label">Tom do Ícone</label>
              <div class="color-input-group-full">
                <input type="color" name="iconTint" value="${n.iconTint}" />
                <input type="text" name="iconTintText" value="${n.iconTint}" class="field-input input-flex-1" />
              </div>
            </div>
          </div>
        </details>

        <details open>
          <summary class="section-summary">Etiqueta</summary>
          <div class="section-body">
            <div class="field-stack">
              <label class="field-label">Rótulo do Texto</label>
              <input type="text" name="textLabel" value="${n.textLabel}" class="field-input" />
            </div>

            <div class="field-stack">
              <label class="field-label">Família da Fonte</label>
              <select name="fontFamily" class="field-input">
                <option value="Padrão" ${n.fontFamily === 'Padrão' ? 'selected' : ''}>Padrão</option>
                <option value="Arial" ${n.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                <option value="Times New Roman" ${n.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                <option value="Georgia" ${n.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                <option value="Courier New" ${n.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                <option value="Verdana" ${n.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
              </select>
            </div>

            <div class="field-stack">
              <label class="field-label">Tamanho da Fonte</label>
              <input type="number" name="fontSize" value="${n.fontSize}" min="8" max="72" step="1" class="field-input" />
            </div>

            <div class="field-stack">
              <label class="field-label">Cor do Texto</label>
              <div class="color-input-group-full">
                <input type="color" name="textColor" value="${n.textColor}" />
                <input type="text" name="textColorText" value="${n.textColor}" class="field-input input-flex-1" />
              </div>
            </div>

            <div class="field-stack">
              <label class="field-label">Ponto de Ancoragem do Texto</label>
              <select name="textAnchor" class="field-input">
                <option value="center" ${n.textAnchor === 'center' ? 'selected' : ''}>Centro</option>
                <option value="top" ${n.textAnchor === 'top' ? 'selected' : ''}>Superior</option>
                <option value="bottom" ${n.textAnchor === 'bottom' ? 'selected' : ''}>Inferior</option>
                <option value="left" ${n.textAnchor === 'left' ? 'selected' : ''}>Esquerda</option>
                <option value="right" ${n.textAnchor === 'right' ? 'selected' : ''}>Direita</option>
              </select>
            </div>
          </div>
        </details>
      </div>
    `;

    return `
      <div class="panel-column">
        <div style="padding: 0.5rem 1rem 0; border-bottom: 1px solid var(--color-border);">
          ${this.tabs.navTemplate()}
        </div>
        <form class="note-config-form panel-fill">
          ${this.tabs.contentWrapper('general', generalHtml)}
          ${this.tabs.contentWrapper('appearance', appearanceHtml)}
        </form>
      </div>
    `;
  }

  protected onRender(): void {
    const formEl = this.element.querySelector('.note-config-form') as HTMLElement;
    if (formEl) {
      this.tabs.bind(this.element);
    }

    // Color picker synchronization
    const iconColorPicker = this.element.querySelector('[name="iconTint"]') as HTMLInputElement;
    const iconColorText = this.element.querySelector('[name="iconTintText"]') as HTMLInputElement;

    if (iconColorPicker && iconColorText) {
      iconColorPicker.addEventListener('input', () => {
        iconColorText.value = iconColorPicker.value;
      });

      iconColorText.addEventListener('input', () => {
        if (/^#[0-9A-F]{6}$/i.test(iconColorText.value)) {
          iconColorPicker.value = iconColorText.value;
        }
      });
    }

    const textColorPicker = this.element.querySelector('[name="textColor"]') as HTMLInputElement;
    const textColorText = this.element.querySelector('[name="textColorText"]') as HTMLInputElement;

    if (textColorPicker && textColorText) {
      textColorPicker.addEventListener('input', () => {
        textColorText.value = textColorPicker.value;
      });

      textColorText.addEventListener('input', () => {
        if (/^#[0-9A-F]{6}$/i.test(textColorText.value)) {
          textColorPicker.value = textColorText.value;
        }
      });
    }
  }

  async submit(options: { close?: boolean } = {}): Promise<void> {
    if (!this.note) return;
    const body = this.element.querySelector('.note-config-form');
    if (!body) return;

    const fd = new LoomFormData(body as HTMLElement);
    const data = fd.object;

    const payload = {
      journalId: data.journalId || '',
      x: Number(data.x || 0),
      y: Number(data.y || 0),
      visibleToPlayers: Boolean(data.visibleToPlayers),
      floors: Number(data.floors || 0),
      visibleGlobally: Boolean(data.visibleGlobally),
      iconEntry: data.iconEntry || 'bookmark',
      iconFontSize: Number(data.iconFontSize || 40),
      iconTint: data.iconTint || '#ffffff',
      textLabel: data.textLabel || '',
      fontFamily: data.fontFamily || 'Padrão',
      fontSize: Number(data.fontSize || 32),
      textColor: data.textColor || '#ffffff',
      textAnchor: data.textAnchor || 'center',
      levelId: data.levelId ?? '',
    };

    try {
      await api.put(`/notes/${this.props.noteId}`, payload);
      showToast('Configurações da nota salvas', 'success');
      if (options.close) {
        windowManager.close(this.options.id);
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar configurações da nota', 'error');
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
        icon: 'fas fa-undo',
        label: 'Redefinir',
        action: 'reset',
        title: 'Redefinir para padrões',
      },
    ];
  }

  async resetToDefaults(): Promise<void> {
    if (!this.note) return;

    const defaultPayload = {
      journalId: '',
      x: this.note.x,
      y: this.note.y,
      visibleToPlayers: false,
      floors: 0,
      visibleGlobally: false,
      iconEntry: 'bookmark',
      iconFontSize: 40,
      iconTint: '#ffffff',
      textLabel: '',
      fontFamily: 'Padrão',
      fontSize: 32,
      textColor: '#ffffff',
      textAnchor: 'center',
    };

    try {
      await api.put(`/notes/${this.props.noteId}`, defaultPayload);
      showToast('Configurações redefinidas para padrões', 'success');
      await this.load();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao redefinir configurações', 'error');
    }
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      void this.submit({ close: true });
    } else if (action === 'cancel') {
      windowManager.close(this.options.id);
    } else if (action === 'reset') {
      void this.resetToDefaults();
    }
  }
}