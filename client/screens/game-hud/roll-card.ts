import { createWrappable } from '../../core/wrappable.js';

// Duplicated from sidebar.ts following cross-tree type pattern
type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

interface DiceTermResult {
  kind: 'dice';
  count: number;
  faces: number;
  rolls: number[];
  dropped: boolean[];
  subtotal: number;
  modifier?: string;
}

interface ModifierTerm {
  kind: 'modifier';
  value: number;
}

type RollTerm = DiceTermResult | ModifierTerm;

export interface RollResult {
  formula: string;
  terms: RollTerm[];
  total: number;
  flavor?: string;
  mode: RollMode;
  meta?: Record<string, any>;
}

function renderRollCard(roll: RollResult, esc: (s: string) => string): string {
  const dieFace = (faces: number): string => {
    const icons: Record<number, string> = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20', 100: 'd100' };
    return icons[faces] || `d${faces}`;
  };
  const termHtml = roll.terms.map(t => {
    if (t.kind === 'modifier') {
      const v = t.value;
      return `<span class="roll-modifier">${v > 0 ? '+' : ''}${v}</span>`;
    }
    const dieLabel = t.faces === -1 ? 'dF' : dieFace(t.faces);
    return `<span class="roll-dice-group">
      <span class="roll-dice-label">${t.count}${dieLabel}</span>
      <span class="roll-dice-list">${t.rolls.map((r, i) => {
        const isDropped = t.dropped?.[i];
        return `<span class="roll-die${isDropped ? ' roll-die-dropped' : ''}">${r}</span>`;
      }).join('')}</span>
      ${t.modifier ? `<span class="roll-modifier-badge">${t.modifier}</span>` : ''}
    </span>`;
  }).join(' ');

  const tooltipHtml = roll.terms.map(t => {
    if (t.kind === 'modifier') {
      return `<div class="roll-tooltip-term">
        <span class="roll-tooltip-label">Modifier</span>
        <span class="roll-tooltip-value">${t.value > 0 ? '+' : ''}${t.value}</span>
      </div>`;
    }
    const dieLabel = t.faces === -1 ? 'dF' : dieFace(t.faces);
    const rollsHtml = t.rolls.map((r, i) => {
      const isDropped = t.dropped?.[i];
      return `<span class="roll-tooltip-die${isDropped ? ' roll-tooltip-die-dropped' : ''}">${r}</span>`;
    }).join(' ');
    return `<div class="roll-tooltip-term">
      <span class="roll-tooltip-label">${t.count}${dieLabel}</span>
      <span class="roll-tooltip-rolls">${rollsHtml}</span>
      <span class="roll-tooltip-subtotal">= ${t.subtotal}</span>
    </div>`;
  }).join('');

  const modeIcon: Record<string, string> = { gmroll: '<i class="fa-solid fa-eye"></i>', blindroll: '<i class="fa-solid fa-masks-theater"></i>', selfroll: '<i class="fa-solid fa-lock"></i>' };
  const modeTag = roll.mode !== 'public'
    ? `<span class="roll-mode-tag">${modeIcon[roll.mode] || ''} ${roll.mode}</span>`
    : '';
  const applyTo = roll.meta?.applyTo;
  const hiddenMetaKeys = new Set(['applyTo', 'system', 'formula', 'name', 'actor', 'modifier', 'total', 'ability']);
  const metaHtml = roll.meta
    ? `<div class="roll-meta">
        ${Object.entries(roll.meta)
          .filter(([k]) => !hiddenMetaKeys.has(k))
          .map(([k, v]) => {
            if (k === 'label') return `<span class="roll-meta-badge">${esc(String(v))}</span>`;
            return `<span class="roll-meta-badge">${esc(k)}: ${esc(String(v))}</span>`;
          })
          .join('')}
      </div>`
    : '';
  const applyButton = applyTo
    ? `<button class="btn btn-small btn-apply-roll" data-action="apply-roll" data-apply-to="${esc(applyTo)}" data-roll-total="${roll.total}">Aplicar ${esc(applyTo)}</button>`
    : '';
  return `<div class="roll-card">
    <div class="roll-card-header">
      <span class="roll-formula">${esc(roll.formula)}</span>
      ${modeTag}
      <span class="roll-total roll-total-hoverable">= ${roll.total}</span>
    </div>
    <div class="roll-card-terms">${termHtml}</div>
    ${metaHtml}
    ${applyButton}
    <div class="roll-tooltip">
      <div class="roll-tooltip-header">Roll Breakdown</div>
      <div class="roll-tooltip-content">${tooltipHtml}</div>
      <div class="roll-tooltip-total">Total: ${roll.total}</div>
    </div>
    ${roll.flavor ? `<div class="roll-card-flavor">${esc(roll.flavor)}</div>` : ''}
  </div>`;
}

export const renderRollCardWrap = createWrappable(renderRollCard);
