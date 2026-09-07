/*******************************************************************************
 * LoomVTT
 * client/core/handlebars-helpers.ts
 * 
 * 
 * Handlebars helper registrations, applied as side effects on import.
 ******************************************************************************/

import { Handlebars } from './render-template.js';

/**
 * Subset of standard Handlebars helpers expected to be globally registered
 * by converted systems. These are public, stable behaviors (re-implemented,
 * not copied). Without these, standard system UI elements will fail to render.
 *
 * Missing helpers that produce complex form widgets (`formGroup`/`formInput`/
 * `numberInput`/`radioBoxes`/`editor`/`object`) — add on demand as needed
 * by templates.
 */

Handlebars.registerHelper('localize', function (value: string, options: Handlebars.HelperOptions) {
  const hash = options?.hash ?? {};
  const i18n = (window as any).Loom?.i18n;
  if (!i18n) return value;
  return Object.keys(hash).length ? i18n.format(value, hash) : i18n.localize(value);
});

Handlebars.registerHelper('concat', function (...args: unknown[]) {
  return args.slice(0, -1).join('');
});

Handlebars.registerHelper('ifThen', function (criteria: unknown, ifTrue: unknown, ifFalse: unknown) {
  return criteria ? ifTrue : ifFalse;
});

Handlebars.registerHelper('numberFormat', function (value: unknown, options: Handlebars.HelperOptions) {
  const hash = options?.hash ?? {};
  const decimals = hash.decimals ?? 0;
  const sign = hash.sign ?? false;
  const num = Number(value ?? 0);
  let str = num.toFixed(decimals);
  if (sign && num >= 0) str = `+${str}`;
  return str;
});

Handlebars.registerHelper('checked', function (value: unknown) {
  return value ? 'checked' : '';
});

Handlebars.registerHelper('disabled', function (value: unknown) {
  return value ? 'disabled' : '';
});

Handlebars.registerHelper('selectOptions', function (choices: unknown, options: Handlebars.HelperOptions) {
  const hash = options?.hash ?? {};
  const selected = hash.selected;
  const shouldLocalize = !!hash.localize;
  const i18n = (window as any).Loom?.i18n;
  const entries: [string, string][] = Array.isArray(choices)
    ? choices.map((c, i) => [String(i), String(c)])
    : Object.entries((choices ?? {}) as Record<string, string>);

  let html = '';
  for (const [key, label] of entries) {
    const isSelected = Array.isArray(selected) ? selected.includes(key) : String(selected) === String(key);
    const text = shouldLocalize && i18n ? i18n.localize(label) : label;
    html += `<option value="${key}"${isSelected ? ' selected' : ''}>${text}</option>`;
  }
  return new Handlebars.SafeString(html);
});

function localize(str: string): string {
  const i18n = (window as any).Loom?.i18n;
  return i18n ? i18n.localize(str) : str;
}

Handlebars.registerHelper('formGroup', function (this: any, options: Handlebars.HelperOptions) {
  const hash = options.hash;
  const classes = hash.classes ? ` ${hash.classes}` : '';
  const labelText = hash.label ? localize(hash.label) : '';
  const hintText = hash.hint ? localize(hash.hint) : '';
  const localizeHint = hash.localize !== false;

  let html = `<div class="form-group${classes}">`;
  if (labelText) {
    html += `<label>${labelText}</label>`;
  }

  html += '<div class="form-fields">';
  // If called as a block ({{#formGroup}}...{{/formGroup}}), use the block content
  if (options.fn) {
    html += options.fn(this as any);
  } else {
    // If called inline (we still need to mock formInput internally if they use via hash.fields, but generally they use it in a block)
    // Input injection is possible, but block usage is most common
  }
  html += '</div>';

  if (hintText) {
    html += `<p class="hint">${hintText}</p>`;
  }
  html += '</div>';

  return new Handlebars.SafeString(html);
});

Handlebars.registerHelper('formInput', function (options: Handlebars.HelperOptions) {
  const hash = options.hash;
  const type = hash.type || 'text';
  const name = hash.name || '';
  const value = hash.value ?? '';
  const id = hash.id ? ` id="${hash.id}"` : '';
  const cls = hash.classes ? ` class="${hash.classes}"` : '';
  const placeholder = hash.placeholder ? ` placeholder="${localize(hash.placeholder)}"` : '';
  const disabled = hash.disabled ? ' disabled' : '';
  const required = hash.required ? ' required' : '';

  if (type === 'checkbox') {
    const checked = value ? ' checked' : '';
    return new Handlebars.SafeString(`<input type="checkbox" name="${name}"${id}${cls}${checked}${disabled}${required}>`);
  }

  if (type === 'select' && hash.options) {
    let optsHtml = '';
    const choices = hash.options;
    const entries: [string, string][] = Array.isArray(choices)
      ? choices.map((c, i) => [String(i), String(c)])
      : Object.entries((choices ?? {}) as Record<string, string>);

    for (const [key, label] of entries) {
      const isSelected = String(value) === String(key);
      const text = hash.localize !== false ? localize(label) : label;
      optsHtml += `<option value="${key}"${isSelected ? ' selected' : ''}>${text}</option>`;
    }
    return new Handlebars.SafeString(`<select name="${name}"${id}${cls}${disabled}${required}>${optsHtml}</select>`);
  }

  return new Handlebars.SafeString(`<input type="${type}" name="${name}" value="${value}"${id}${cls}${placeholder}${disabled}${required}>`);
});

Handlebars.registerHelper('numberInput', function (value: unknown, options: Handlebars.HelperOptions) {
  const hash = options.hash;
  const name = hash.name || '';
  const id = hash.id ? ` id="${hash.id}"` : '';
  const cls = hash.classes ? ` class="${hash.classes}"` : '';
  const step = hash.step ? ` step="${hash.step}"` : '';
  const min = hash.min !== undefined ? ` min="${hash.min}"` : '';
  const max = hash.max !== undefined ? ` max="${hash.max}"` : '';
  const placeholder = hash.placeholder ? ` placeholder="${localize(hash.placeholder)}"` : '';
  const disabled = hash.disabled ? ' disabled' : '';
  const required = hash.required ? ' required' : '';

  return new Handlebars.SafeString(`<input type="number" name="${name}" value="${value ?? ''}"${id}${cls}${step}${min}${max}${placeholder}${disabled}${required}>`);
});

Handlebars.registerHelper('eq', function (a: unknown, b: unknown) {
  return a === b;
});

Handlebars.registerHelper('ne', function (a: unknown, b: unknown) {
  return a !== b;
});

Handlebars.registerHelper('lt', function (a: any, b: any) {
  return a < b;
});

Handlebars.registerHelper('gt', function (a: any, b: any) {
  return a > b;
});

Handlebars.registerHelper('lte', function (a: any, b: any) {
  return a <= b;
});

Handlebars.registerHelper('gte', function (a: any, b: any) {
  return a >= b;
});

/**
 * Core Foundry helpers that converted systems assume exist globally
 * (they do not register them themselves) — without this Handlebars drops the entire block
 * where they appear (`Missing helper`), emptying templates that use them.
 */
Handlebars.registerHelper('and', function (...args: unknown[]) {
  const values = args.slice(0, -1); // último arg é o HelperOptions do Handlebars
  return values.every(Boolean);
});

Handlebars.registerHelper('or', function (...args: unknown[]) {
  const values = args.slice(0, -1);
  return values.some(Boolean);
});

Handlebars.registerHelper('not', function (value: unknown) {
  return !value;
});

/**
 * Replica of the native Foundry `numLoop`: iterates `niter` times, exposing `this` as the
 * index (offset by `start`, default 0) inside the block. Used to generate series of
 * repeated elements (e.g. discipline dots) without a real array.
 * 
 * @param niter - The number of iterations
 * @param options - Handlebars options, optionally containing `hash.start` and `hash.step`
 */
Handlebars.registerHelper('numLoop', function (niter: number, options: Handlebars.HelperOptions) {
  const start = Number(options.hash?.start ?? 0);
  const step = Number(options.hash?.step ?? 1);
  let html = '';
  for (let i = 0; i < Number(niter); i++) {
    html += options.fn(start + i * step);
  }
  return new Handlebars.SafeString(html);
});

Handlebars.registerHelper('radioBoxes', function (name: string, choices: unknown, options: Handlebars.HelperOptions) {
  const hash = options.hash;
  const checked = hash.checked;
  const entries: [string, string][] = Array.isArray(choices)
    ? choices.map((c, i) => [String(i), String(c)])
    : Object.entries((choices ?? {}) as Record<string, string>);

  let html = '<div class="radio-boxes">';
  for (const [key, label] of entries) {
    const isChecked = String(checked) === String(key);
    const text = hash.localize !== false ? localize(label) : label;
    const uid = `${name}-${key}`;
    html += `<label><input type="radio" name="${name}" value="${key}"${isChecked ? ' checked' : ''}> ${text}</label>`;
  }
  html += '</div>';
  return new Handlebars.SafeString(html);
});
