import { clog } from '../lib/client-logger.js';

/** Reads `field.key` (e.g. "abilities.dex.value") in `values`, nested by dot.
 * `f.key` was always documented as a path (matches `name="sd:${f.key}"`, which
 * form-data.ts already nests by ":" on save, and with `@path` from resolveFormula) —
 * but reading it here used direct bracket-access (`values?.[f.key]`), which only
 * works for 1-level keys. Any ruleset with nested fields (the most common
 * way to declare `getSheetSchema`) would always see an empty input, even with
 * saved data — no published ruleset hit this path yet (they all use
 * custom sheet classes), so it went unnoticed. */
function getFieldValue(values: Record<string, any> | undefined, key: string): unknown {
  if (!values) return undefined;
  if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
  return key.split('.').reduce<any>((v, part) => (v == null ? undefined : v[part]), values);
}

export interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean' | 'dots' | 'actions'
    | 'select' | 'color' | 'image' | 'square-counter';
  /** Used by 'dots' (pip count) and 'square-counter' (total squares). */
  max?: number;
  /** Only for type 'select' — list of options. */
  options?: { value: string; label: string }[];
  /**
   * 'dots' and 'number' only (attribute/skill): if true, the label becomes clickable and
   * triggers a roll with `formula` (resolved against the document's systemData
   * via resolveFormula, same engine as item "actions"). Without this,
   * there was NO way to roll directly from the sheet by attribute —
   * only item actions had roll, which breaks the basic expectation of
   * any RPG sheet (click on the skill to roll).
   */
  rollable?: boolean;
  /** Dice formula for the roll (e.g. "1d10 + @attributes.strength"). Only used when rollable is true. */
  formula?: string;
}

export interface SheetTab {
  id: string;
  label: string;
  icon?: string;
  fields: SheetField[];
}

export interface SheetSchema {
  tabs: SheetTab[];
}

function esc(text: unknown): string {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

/** Normal label, or clickable button (data-action="roll-sheet-field") when the field is `rollable`. */
function fieldLabel(f: SheetField): string {
  if (!f.rollable) return esc(f.label);
  return `<button type="button" class="field-label-roll" data-action="roll-sheet-field" data-key="${esc(f.key)}" draggable="true" title="Roll ${esc(f.label)} (drag to hotbar to create a macro)">${esc(f.label)} 🎲</button>`;
}

const KNOWN_FIELD_TYPES: SheetField['type'][] = [
  'text', 'number', 'textarea', 'boolean', 'dots', 'actions', 'select', 'color', 'image', 'square-counter',
];

function fieldTemplate(f: SheetField, value: unknown, documentId?: string, documentType?: 'actor' | 'item'): string {
  // Converted systems are pure JS without type checking — a `type: 'dot'`
  // (typo of 'dots') would previously fall directly into the plain text fallback, without
  // ANY warning. This is exactly the kind of invisible error that causes a
  // field to "do nothing when clicked": it looks rendered, but is another widget.
  if (!KNOWN_FIELD_TYPES.includes(f.type)) {
    clog.error(`[SHEET-SCHEMA] Field "${f.key}" declares type "${f.type}", which does not exist — valid types: [${KNOWN_FIELD_TYPES.join(', ')}]. Rendering as plain text (fallback), not as the intended widget.`);
  }
  if (f.type === 'actions') {
    const actions = Array.isArray(value) ? value : [];
    return `
      <div class="form-group">
        <label>${esc(f.label)}</label>
        <div class="actions-field">
          ${actions.map((a: any) => {
            const itemIdAttr = documentType === 'item' && documentId ? `data-item-id="${esc(documentId)}"` : '';
            return `
              <div class="action-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <button type="button" class="btn btn-small btn-action" data-action="run-item-action" ${itemIdAttr} data-action-id="${esc(a.id)}">${esc(a.label || a.id)}</button>
                <code class="action-formula" style="font-size:0.85em; opacity:0.8;">${esc(a.formula || '')}</code>
              </div>
            `;
          }).join('')}
          ${actions.length === 0 ? '<span class="field-empty">No actions defined</span>' : ''}
        </div>
      </div>`;
  }
  if (f.type === 'dots') {
    const max = f.max ?? 5;
    const current = Math.max(0, Math.min(max, Number(value) || 0));
    const pips = Array.from({ length: max }, (_, i) => i + 1)
      .map(
        (n) =>
          `<button type="button" class="dot-pip ${n <= current ? 'filled' : ''}" data-action="set-dots" data-key="${esc(f.key)}" data-value="${n}" aria-label="${n}"></button>`,
      )
      .join('');
    return `
      <div class="form-group">
        <label>${fieldLabel(f)}</label>
        <div class="dots-field" data-dots-key="${esc(f.key)}">${pips}</div>
        <input type="hidden" name="sd:${f.key}" value="${current}" />
      </div>`;
  }
  if (f.type === 'boolean') {
    return `
      <div class="form-group form-group-checkbox">
        <label><input type="checkbox" name="sd:${f.key}" ${value ? 'checked' : ''} /> ${esc(f.label)}</label>
      </div>`;
  }
  if (f.type === 'textarea') {
    return `
      <div class="form-group">
        <label>${esc(f.label)}</label>
        <textarea name="sd:${f.key}">${esc(value ?? '')}</textarea>
      </div>`;
  }
  if (f.type === 'select') {
    const options = f.options ?? [];
    return `
      <div class="form-group">
        <label>${esc(f.label)}</label>
        <select name="sd:${f.key}">
          ${options.map(o => `<option value="${esc(o.value)}" ${value === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
      </div>`;
  }
  if (f.type === 'color') {
    const v = typeof value === 'string' && value ? value : '#ffffff';
    return `
      <div class="form-group">
        <label>${esc(f.label)}</label>
        <div class="color-input-group">
          <input type="color" name="sd:${f.key}" value="${esc(v)}" />
          <input type="text" name="sd:${f.key}Text" value="${esc(v)}" />
        </div>
      </div>`;
  }
  if (f.type === 'image') {
    return `
      <div class="form-group file-picker-group">
        <label>${esc(f.label)}</label>
        <div class="input-with-button">
          <input type="text" name="sd:${f.key}" value="${esc(value ?? '')}" placeholder="No file selected" />
          <button type="button" class="btn btn-secondary" data-action="pick-sheet-image" data-key="${esc(f.key)}">📂</button>
        </div>
      </div>`;
  }
  if (f.type === 'square-counter') {
    const max = f.max ?? 5;
    const v = (value ?? {}) as { superficial?: number; aggravated?: number };
    const superficial = v.superficial ?? 0;
    const aggravated = v.aggravated ?? 0;
    const squares = Array.from({ length: max }, (_, i) => {
      const n = i + 1;
      const state = n <= aggravated ? 'aggravated' : n <= aggravated + superficial ? 'superficial' : 'empty';
      return `<button type="button" class="square-pip ${state}" data-action="cycle-square" data-key="${esc(f.key)}" data-index="${n}" aria-label="${n}"></button>`;
    }).join('');
    return `
      <div class="form-group">
        <label>${esc(f.label)}</label>
        <div class="square-counter-field" data-square-key="${esc(f.key)}" data-square-max="${max}">${squares}</div>
        <input type="hidden" name="sd:${f.key}" value="${esc(JSON.stringify({ max, superficial, aggravated }))}" />
      </div>`;
  }
  return `
    <div class="form-group">
      <label>${f.type === 'number' ? fieldLabel(f) : esc(f.label)}</label>
      <input type="${f.type === 'number' ? 'number' : 'text'}" name="sd:${f.key}" value="${esc(value ?? '')}" />
    </div>`;
}

/**
 * Click on a 'dots' field pip: clicking on the pip already filled to the current value
 * zeroes it (standard toggle for WoD-like systems), otherwise fills up to there.
 * Updates DOM in-place (no re-render) and the <input type="hidden"> that
 * serializeForm reads on submit.
 */
export function handleDotsClick(root: HTMLElement, key: string, clickedValue: number): void {
  const container = root.querySelector<HTMLElement>(`.dots-field[data-dots-key="${key}"]`);
  const hidden = root.querySelector<HTMLInputElement>(`input[type="hidden"][name="sd:${key}"]`);
  if (!container || !hidden) return;
  const current = Number(hidden.value) || 0;
  const next = clickedValue === current ? clickedValue - 1 : clickedValue;
  hidden.value = String(next);
  container.querySelectorAll<HTMLElement>('.dot-pip').forEach((pip) => {
    const n = Number(pip.dataset.value);
    pip.classList.toggle('filled', n <= next);
  });
}

/**
 * Click on a 'square-counter' square: cycles empty → superficial → aggravated → empty
 * at its own index (unlike dots, does not fill linearly up to the click).
 * Updates DOM in-place and the <input type="hidden"> that serializeForm reads.
 */
export function handleSquareCounterClick(root: HTMLElement, key: string, clickedIndex: number): void {
  const container = root.querySelector<HTMLElement>(`.square-counter-field[data-square-key="${key}"]`);
  const hidden = root.querySelector<HTMLInputElement>(`input[type="hidden"][name="sd:${key}"]`);
  if (!container || !hidden) return;
  const max = Number(container.dataset.squareMax) || 5;
  const current = (() => {
    try { return JSON.parse(hidden.value) as { max: number; superficial: number; aggravated: number }; }
    catch { return { max, superficial: 0, aggravated: 0 }; }
  })();
  const n = clickedIndex;
  const isAggravated = n <= current.aggravated;
  const isSuperficial = !isAggravated && n <= current.aggravated + current.superficial;
  let next: { max: number; superficial: number; aggravated: number };
  if (isAggravated) {
    next = { max, superficial: current.superficial, aggravated: current.aggravated - 1 };
  } else if (isSuperficial) {
    next = { max, superficial: current.superficial - 1, aggravated: current.aggravated + 1 };
  } else {
    next = { max, superficial: current.superficial + 1, aggravated: current.aggravated };
  }
  hidden.value = JSON.stringify(next);
  container.querySelectorAll<HTMLElement>('.square-pip').forEach((pip) => {
    const idx = Number(pip.dataset.index);
    const state = idx <= next.aggravated ? 'aggravated' : idx <= next.aggravated + next.superficial ? 'superficial' : 'empty';
    pip.className = `square-pip ${state}`;
  });
}

/**
 * Renders tabs + fields for any system-provided SheetSchema (LoomSystem.getSheetSchema()/
 * getItemSheetSchema()). Swapping RPG system only means swapping which schema is passed in here
 * — mirrors the system.getSheetSchema() pattern of converted systems. Shared by actor and item sheets so a
 * new document type's sheet doesn't need to reimplement tab/field rendering.
 */
/**
 * Renders all fields from all tabs flat (no tab navigation).
 * Used by token config's systemData section and any other context
 * where the host already provides its own tab structure.
 */
export function flatSheetFields(schema: SheetSchema, values: Record<string, any> | undefined): string {
  return schema.tabs.flatMap(tab => tab.fields).map(f => fieldTemplate(f, getFieldValue(values, f.key))).join('');
}

export function dynamicSheetBodyTemplate(
  schema: SheetSchema,
  values: Record<string, any> | undefined,
  activeTabId: string | null,
  documentId?: string,
  documentType?: 'actor' | 'item',
  /** `actor-sheet-window.ts`/`item-sheet-window.ts` already render their own
   * nav (`itemsTabs.navTemplate()`, merging schema tabs with "Items"/
   * "Effects"). Before this flag, this function ALWAYS drew the `.actor-sheet-tabs`
   * again inside — two tab-switching UIs stacked on the same sheet,
   * for any ruleset with 2+ tabs in `getSheetSchema`. Default `true`
   * keeps the old behavior for those using this standalone. */
  showNav = true
): string {
  const tabs = schema.tabs;
  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  return `
    ${showNav ? `
    <div class="actor-sheet-tabs">
      ${tabs
        .map(
          (t) =>
            `<button class="tab-button ${t.id === active.id ? 'active' : ''}" data-action="switch-tab" data-id="${t.id}">${esc(t.label)}</button>`,
        )
        .join('')}
    </div>` : ''}
    <div class="actor-sheet-fields">
      ${active.fields.map((f) => fieldTemplate(f, getFieldValue(values, f.key), documentId, documentType)).join('')}
    </div>
  `;
}

