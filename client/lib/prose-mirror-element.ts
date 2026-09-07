/*******************************************************************************
 * LoomVTT
 * client/lib/prose-mirror-element.ts
 * Component Version: 1.4.0 (Performance & Shadow Isolation Fix)
 ******************************************************************************/

import { mountRichTextEditor, type RichTextEditorHandle } from './rich-text-registry.js';
import proseMirrorViewCSS from 'prosemirror-view/style/prosemirror.css?raw';
import proseMirrorMenuCSS from 'prosemirror-menu/style/menu.css?raw';
import proseMirrorExampleCSS from 'prosemirror-example-setup/style/style.css?raw';

const HOST_STYLE = `
:host {
  display: block;
  contain: layout;
}
.loom-pm {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.loom-pm__content { min-height: 2em; }
.loom-pm__content:empty::before {
  content: attr(data-placeholder);
  opacity: 0.5;
}
.loom-pm__editor { display: none; }
.loom-pm[data-mode="edit"] .loom-pm__content { display: none; }
.loom-pm[data-mode="edit"] .loom-pm__editor { display: block; }
.loom-pm__toggle {
  align-self: flex-end;
  cursor: pointer;
  background: none;
  border: 1px solid currentColor;
  border-radius: 3px;
  color: inherit;
  font: inherit;
  font-size: 0.85em;
  line-height: 1;
  padding: 3px 8px;
  opacity: 0.7;
}
.loom-pm__toggle:hover { opacity: 1; }
.ProseMirror {
  min-height: 6em;
  outline: none;
  background: var(--color-bg-deep, transparent);
  color: var(--color-text-primary, #ddd);
  font-family: var(--font-ui, sans-serif);
  padding: 0.5rem;
  /* Evita recálculos de fonte durante digitação rápida */
  font-synthesis: none;
  text-rendering: optimizeSpeed;
}
.loom-pm--compact .ProseMirror { min-height: 4em; }

.ProseMirror-menubar {
  border-bottom: 1px solid var(--color-border, #444);
  background: var(--color-bg-surface, transparent);
  color: var(--color-text-primary, #ddd);
}
.ProseMirror-icon { color: var(--color-text-primary, #ddd); }
.ProseMirror-icon:hover { color: var(--color-accent, #fff); }
.ProseMirror-menu-active { background: var(--color-bg-surface-hover, rgba(255,255,255,0.1)); }
`;

let sharedSheet: CSSStyleSheet | null = null;
function getStyleSheet(): CSSStyleSheet {
  if (sharedSheet) return sharedSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync([proseMirrorViewCSS, proseMirrorMenuCSS, proseMirrorExampleCSS, HOST_STYLE].join('\n'));
  sharedSheet = sheet;
  return sheet;
}

function attrIsOn(el: HTMLElement, name: string): boolean {
  if (!el.hasAttribute(name)) return false;
  return el.getAttribute(name) !== 'false';
}

export class LoomProseMirrorElement extends HTMLElement {
  static observedAttributes = ['value', 'name', 'data-path', 'disabled', 'readonly'];

  public document: any = null;

  private _value = '';
  private _lastSavedValue = '';
  private _editing = false;
  private _built = false;
  private _handle: RichTextEditorHandle | null = null;

  private _shadow: ShadowRoot;
  private _root!: HTMLDivElement;
  private _hidden!: HTMLInputElement;
  private _content!: HTMLDivElement;
  private _editorHost!: HTMLDivElement;
  private _toggle!: HTMLButtonElement;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._shadow.adoptedStyleSheets = [getStyleSheet()];
  }

  connectedCallback(): void {
    if (this._built) {
      this._syncFromAttributes();
      return;
    }

    const inlineHTML = this.innerHTML.trim();
    this._value = this.getAttribute('value') ?? inlineHTML ?? '';
    this._lastSavedValue = this._value;

    this._build();
    this._built = true;
    this._render();
  }

  disconnectedCallback(): void {
    this._destroyEditor();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this._built || oldValue === newValue) return;

    if (name === 'value') {
      if (this._editing) return;
      this._value = newValue ?? '';
      this._lastSavedValue = this._value;
    }

    this._syncFromAttributes();
    this._render();
  }

  get value(): string {
    if (this._editing && this._handle) return this._handle.getHTML();
    return this._value;
  }

  set value(html: string) {
    const next = html ?? '';
    if (this._value === next) return;
    this._value = next;
    this._lastSavedValue = next;
    if (this._built && !this._editing) this._render();
  }

  private get fieldName(): string {
    return this.getAttribute('name') ?? this.getAttribute('data-path') ?? '';
  }

  get name(): string {
    return this.fieldName;
  }

  set name(value: string) {
    this.setAttribute('name', value);
  }

  private get isEditable(): boolean {
    return !attrIsOn(this, 'disabled') && !attrIsOn(this, 'readonly');
  }

  private get isToggled(): boolean {
    return attrIsOn(this, 'toggled');
  }

  private _build(): void {
    this.innerHTML = '';

    this._root = document.createElement('div');
    this._root.className = 'loom-pm';
    if (attrIsOn(this, 'compact')) this._root.classList.add('loom-pm--compact');

    this._hidden = document.createElement('input');
    this._hidden.type = 'hidden';

    this._content = document.createElement('div');
    this._content.className = 'loom-pm__content';
    this._content.setAttribute('data-placeholder', this.getAttribute('placeholder') ?? '');

    this._editorHost = document.createElement('div');
    this._editorHost.className = 'loom-pm__editor';
    this._editorHost.spellcheck = false; // Desativa varredura ortográfica síncrona que congela o cursor

    // Interrompe eventos de borbulhamento na saída do editor
    const stopPropagationEvents = [
      'input',
      'beforeinput',
      'change',
      'keydown',
      'keyup',
      'keypress',
      'focusout',
      'blur'
    ];

    for (const type of stopPropagationEvents) {
      this._editorHost.addEventListener(type, (event: Event) => {
        event.stopPropagation();
      });
    }

    this._editorHost.addEventListener('focusout', (event: FocusEvent) => {
      if (this.isToggled || !this._editing || !this._handle) return;

      const related = event.relatedTarget as Node | null;
      if (related && this._shadow.contains(related)) return;

      const currentHTML = this._handle.getHTML();
      if (currentHTML !== this._lastSavedValue) {
        this._value = currentHTML;
        this._lastSavedValue = currentHTML;
        this._emitChange();
      }
    });

    this._toggle = document.createElement('button');
    this._toggle.type = 'button';
    this._toggle.className = 'loom-pm__toggle';
    this._toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this._editing) this.save();
      else this.edit();
    });

    this._root.append(this._hidden, this._content, this._editorHost, this._toggle);
    this._shadow.appendChild(this._root);

    this._syncFromAttributes();
  }

  private _syncFromAttributes(): void {
    const name = this.fieldName;
    if (name) {
      this._hidden.name = name;
      this._hidden.setAttribute('data-path', this.getAttribute('data-path') ?? name);
    } else {
      this._hidden.removeAttribute('name');
      this._hidden.removeAttribute('data-path');
    }
    if (attrIsOn(this, 'compact')) this._root?.classList.add('loom-pm--compact');
  }

  private _render(): void {
    this._hidden.value = this._value;
    this._content.innerHTML = this._value;
    this._root.dataset.mode = this._editing ? 'edit' : 'read';
    this._toggle.textContent = this._editing ? 'Salvar' : 'Editar';
    this._toggle.hidden = !this.isEditable || !this.isToggled;

    if (!this.isToggled && this.isEditable && !this._editing) {
      this.edit(false);
    }
  }

  edit(shouldFocus = true): void {
    if (this._editing || !this.isEditable) return;
    this._editing = true;
    this._root.dataset.mode = 'edit';
    this._toggle.textContent = 'Salvar';
    this._editorHost.innerHTML = '';
    
    // Passa a shadowRoot como contexto de seleção
    this._handle = mountRichTextEditor(this._editorHost, this._value, this._shadow);
    if (shouldFocus) {
      this._handle.view.focus();
    }
  }

  save(): void {
    if (!this._editing) return;
    const html = this._handle ? this._handle.getHTML() : this._value;
    const hasChanged = html !== this._lastSavedValue;

    this._destroyEditor();
    this._editing = false;
    this._value = html;
    this._lastSavedValue = html;
    this._render();

    if (hasChanged) {
      this._emitChange();
    }
  }

  cancel(): void {
    if (!this._editing) return;
    this._destroyEditor();
    this._editing = false;
    this._render();
  }

  private _emitChange(): void {
    this._hidden.value = this._value;
    this.dispatchEvent(
      new Event('change', {
        bubbles: true,
        composed: true
      })
    );
  }

  private _destroyEditor(): void {
    if (this._handle) {
      this._handle.destroy();
      this._handle = null;
    }
    this._editorHost.innerHTML = '';
  }
}

if (!customElements.get('prose-mirror')) {
  customElements.define('prose-mirror', LoomProseMirrorElement);
}