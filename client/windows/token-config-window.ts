/*******************************************************************************
 * LoomVTT
 * client/windows/token-config-window.ts
 * 
 * 
 * Window for configuring tokens.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { Tabs } from '../components/tabs.js';
import { FilePickerWindow } from './file-picker-window.js';
import { showConfirm } from '../components/dialog.js';
import { t } from '../lib/i18n.js';
import { usersCollection } from '../core/users-collection.js';
import { actorsCollection } from '../core/actors-collection.js';
import { systemRegistry } from '../core/system-registry.js';
import { flatSheetFields, handleDotsClick, handleSquareCounterClick } from '../components/sheet-schema.js';
import { getDefaultRingScale } from '../canvas/canvas-manager.js';

interface DetectionModeEntry {
  id: string;
  type: string;
  range: number;
  enabled: boolean;
}

interface CastMember {
  id: string;
  name: string;
  kind?: string;
  avatarUrl: string;
  colorHex: string;
  ringColor: string;
  ringUrl?: string;
  ringEffect?: string;
  ringScale?: number;
  shape: string;
  tintColor?: string;
  opacity?: number;
  rotation?: number;
  scale?: number;
  x: number;
  y: number;
  actorId?: string;
  isLinked?: boolean;
  sightEnabled?: boolean;
  sightRange?: number;
  sightAngle?: number;
  sightMode?: string;
  detectionModes?: DetectionModeEntry[];
  lightDimRange?: number;
  lightBrightRange?: number;
  lightColor?: string;
  lightAnimation?: string;
  systemData?: Record<string, any>;
  barGridSize?: number;
  bar1?: { attribute: string; color?: string };
  bar2?: { attribute: string; color?: string };
  displayBars?: number;
  movementAction?: string;
  elevation?: number;
  locked?: boolean;
  hidden?: boolean;
  ownership?: Record<string, number>;
}

const MOVEMENT_ACTIONS = ['walk', 'fly', 'swim', 'burrow', 'climb', 'teleport'];
const LIGHT_ANIMATIONS = ['none', 'torch', 'pulse', 'flicker', 'chroma', 'wave'];
const SHAPES = ['circle', 'square'];

const DETECTION_TYPES = [
  { value: 'basicSight', labelKey: 'tokenConfig.detectBasicSight' },
  { value: 'darkvision', labelKey: 'tokenConfig.detectDarkvision' },
  { value: 'seeInvisibility', labelKey: 'tokenConfig.detectSeeInvisibility' },
  { value: 'seeAll', labelKey: 'tokenConfig.detectSeeAll' },
  { value: 'tremorsense', labelKey: 'tokenConfig.detectTremorsense' },
];

const VISION_MODES = [
  { value: 'basic', label: 'Basic (cor normal)' },
  { value: 'darkvision', label: 'Darkvision (esverdeado, reduz cor)' },
  { value: 'monochrome', label: 'Monocromático (escala de cinza)' },
];

const BAR_DISPLAY_MODES = [
  { value: 0, labelKey: 'tokenConfig.barDisplayNever' },
  { value: 10, labelKey: 'tokenConfig.barDisplayControl' },
  { value: 20, labelKey: 'tokenConfig.barDisplayOwnerHover' },
  { value: 30, labelKey: 'tokenConfig.barDisplayHover' },
  { value: 40, labelKey: 'tokenConfig.barDisplayOwner' },
  { value: 50, labelKey: 'tokenConfig.barDisplayAlways' },
];

// Common enough across many RPGs (not just one system) to be worth a nicer
// label than the raw path — genuinely system-specific concepts (e.g. D&D's
// spell slots) don't belong here; they'd only ever help D&D-shaped systems
// and everything else already gets a readable generic fallback below.
function formatResourceLabel(path: string, val?: number, max?: number): string {
  const FRIENDLY_NAMES: Record<string, string> = {
    'resources.health': t('tokenConfig.resourceHealth'),
    'attributes.hp': t('tokenConfig.resourceHealth'),
    'hp': t('tokenConfig.resourceHealth'),
    'health': t('tokenConfig.resourceHealth'),
    'resources.mana': t('tokenConfig.resourceMana'),
    'attributes.mana': t('tokenConfig.resourceMana'),
    'mana': t('tokenConfig.resourceMana'),
    'mp': t('tokenConfig.resourceMana'),
  };

  let friendly = FRIENDLY_NAMES[path];
  if (!friendly) {
    const clean = path.replace(/^(system|resources|attributes)\./, '');
    const parts = clean.split('.');
    friendly = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' > ');
  }

  if (val !== undefined && max !== undefined) {
    return `${friendly} (${val}/${max}) [${path}]`;
  }
  return `${friendly} [${path}]`;
}

function findResourceAttributes(obj: Record<string, any>, prefix = ''): Array<{ path: string; label: string }> {
  const result: Array<{ path: string; label: string }> = [];
  if (!obj || typeof obj !== 'object') return result;

  for (const [k, v] of Object.entries(obj)) {
    const currPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      if ('value' in v && 'max' in v && typeof (v as any).value === 'number') {
        result.push({ path: currPath, label: formatResourceLabel(currPath, (v as any).value, (v as any).max) });
      } else {
        result.push(...findResourceAttributes(v, currPath));
      }
    }
  }
  return result;
}

export class TokenConfigWindow extends BaseWindow {
  private castMember: CastMember | null = null;
  private tabs: Tabs;

  constructor(private props: { castMember: CastMember; onUpdated: (castMember: CastMember) => void; isPrototype?: boolean }) {
    super({
      id: `token-config-${props.castMember.id}`,
      title: t('tokenConfig.title', { name: props.castMember.name }),
      icon: '<i class="fa-solid fa-gear"></i>',
      width: 'auto',
      height: 'auto',
      bannerImage: '/images/general-banners/ruins-banner.png',
    } as BaseWindowOptions);
    this.castMember = {
      ...props.castMember,
      bar1: typeof props.castMember.bar1 === 'string' ? (() => { try { return JSON.parse(props.castMember.bar1 as any); } catch { return null; } })() : props.castMember.bar1,
      bar2: typeof props.castMember.bar2 === 'string' ? (() => { try { return JSON.parse(props.castMember.bar2 as any); } catch { return null; } })() : props.castMember.bar2,
      displayBars: props.castMember.displayBars !== undefined ? Number(props.castMember.displayBars) : 20,
    };
    this.tabs = new Tabs([
      { id: 'identity', label: 'Identidade', icon: 'fa-solid fa-id-card' },
      { id: 'appearance', label: 'Aparência', icon: 'fa-solid fa-image' },
      { id: 'vision', label: 'Visão', icon: 'fa-solid fa-eye' },
      { id: 'light', label: 'Luz', icon: 'fa-solid fa-lightbulb' },
      { id: 'resources', label: 'Recursos', icon: 'fa-solid fa-heart' },
      { id: 'movement', label: 'Movimento', icon: 'fa-solid fa-person-running' },
      { id: 'permissions', label: 'Permissões', icon: 'fa-solid fa-lock' },
    ]);
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-tabs-fixed');
    }
  }

  bodyTemplate(): string {
    if (!this.castMember) {
      return '<div class="empty-state"><p>Carregando...</p></div>';
    }
    const c = this.castMember;

    const identityHtml = `
      <fieldset>
        <legend>Identidade</legend>
        <div class="form-group">
          <label>Nome do Token</label>
          <input type="text" name="name" value="${this.esc(c.name)}" />
        </div>
        <div class="form-group">
          <label>Tipo (Kind)</label>
          <input type="text" name="kind" value="${this.esc(c.kind || 'adventurer')}" />
        </div>
        <div class="form-group">
          <label>ID do Ator (Actor Link)</label>
          <input type="text" name="actorId" value="${this.esc(c.actorId || '')}" placeholder="UUID do ator vinculado" />
        </div>
        <div class="form-group form-group-checkbox">
          <label><input type="checkbox" name="isLinked" ${c.isLinked ? 'checked' : ''} /> Vinculado ao Ator</label>
        </div>
        <div class="form-group">
          <label>Imagem do Token (Avatar)</label>
          <div class="input-with-button">
            <input type="text" name="avatarUrl" value="${this.esc(c.avatarUrl || '')}" placeholder="/assets/tokens/..." />
            <button type="button" class="btn btn-secondary btn-pick-file" data-action="pick-avatar">📁</button>
          </div>
        </div>
      </fieldset>
    `;

    const appearanceHtml = `
      <fieldset>
        <legend>Aparência</legend>
        <div class="form-group">
          <label>Cor do Anel</label>
          <div class="color-input-group">
            <input type="color" name="colorHex" value="${c.colorHex || '#e74c3c'}" oninput="this.nextElementSibling.value = this.value" />
            <input type="text" value="${c.colorHex || '#e74c3c'}" oninput="this.previousElementSibling.value = this.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Cor do Anel de Identidade (ringColor)</label>
          <div class="color-input-group">
            <input type="color" name="ringColor" value="${c.ringColor || c.colorHex || '#e74c3c'}" oninput="this.nextElementSibling.value = this.value" />
            <input type="text" value="${c.ringColor || c.colorHex || '#e74c3c'}" oninput="this.previousElementSibling.value = this.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Moldura / Anel Gráfico</label>
          <select name="ringPreset" class="ring-preset-select">
            <option value="" ${!c.ringUrl ? 'selected' : ''}>Padrão (Cor Sólida)</option>
            <option value="none" ${c.ringUrl === 'none' ? 'selected' : ''}>Sem Anel (Nenhum)</option>
            <option value="/canvas/tokens/ring-01.png" ${c.ringUrl === '/canvas/tokens/ring-01.png' ? 'selected' : ''}>Anel 01 — Dourado Fantasia</option>
            <option value="/canvas/tokens/ring-02.png" ${c.ringUrl === '/canvas/tokens/ring-02.png' ? 'selected' : ''}>Anel 02 — Ornado Nobre</option>
            <option value="/canvas/tokens/ring-03.png" ${c.ringUrl === '/canvas/tokens/ring-03.png' ? 'selected' : ''}>Anel 03 — Aço & Ouro</option>
            <option value="/canvas/tokens/ring-04.png" ${c.ringUrl === '/canvas/tokens/ring-04.png' ? 'selected' : ''}>Anel 04 — Rúnico Arcano</option>
            <option value="/canvas/tokens/ring-05.png" ${c.ringUrl === '/canvas/tokens/ring-05.png' ? 'selected' : ''}>Anel 05 — Guardião Élfico</option>
            <option value="/canvas/tokens/ring-06.png" ${c.ringUrl === '/canvas/tokens/ring-06.png' ? 'selected' : ''}>Anel 06 — Coroa Celestial</option>
            <option value="custom" ${c.ringUrl && !c.ringUrl.startsWith('/canvas/tokens/ring-') && c.ringUrl !== 'none' ? 'selected' : ''}>Personalizado (Arquivo/URL)</option>
          </select>
        </div>
        <div class="form-group ring-custom-group" style="${c.ringUrl && !c.ringUrl.startsWith('/canvas/tokens/ring-') && c.ringUrl !== 'none' ? '' : 'display: none;'}">
          <label>URL do Anel Personalizado</label>
          <div class="file-picker-group" style="display: flex; gap: 0.5rem;">
            <input type="text" name="ringUrl" value="${c.ringUrl || ''}" placeholder="Caminho do arquivo de anel..." style="flex: 1;" />
            <button type="button" class="btn btn-secondary" data-action="pick-ring">Arquivo</button>
          </div>
        </div>
        <div class="form-group ring-scale-group" style="${c.ringUrl && c.ringUrl !== 'none' ? '' : 'display: none;'}">
          <label>Escala do Anel</label>
          <div class="range-input-group">
            <input type="range" name="ringScale" min="100" max="240" step="5" value="${Math.round((c.ringScale || getDefaultRingScale(c.ringUrl)) * 100)}" data-debounce="ringScale" oninput="this.nextElementSibling.value = this.value + '%'" />
            <input type="text" class="range-value ring-scale-val" value="${Math.round((c.ringScale || getDefaultRingScale(c.ringUrl)) * 100)}%" readonly />
          </div>
        </div>
        <div class="form-group">
          <label>Efeito do Anel</label>
          <select name="ringEffect">
            <option value="none" ${(!c.ringEffect || c.ringEffect === 'none') ? 'selected' : ''}>Nenhum (Estático)</option>
            <option value="spin" ${c.ringEffect === 'spin' ? 'selected' : ''}>Girar (Rotação Contínua)</option>
            <option value="pulse" ${c.ringEffect === 'pulse' ? 'selected' : ''}>Pulsar (Brilho & Respiração)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Formato</label>
          <select name="shape">
            ${SHAPES.map(s => `<option value="${s}" ${c.shape === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Matiz (Tint)</label>
          <div class="color-input-group">
            <input type="color" name="tintColor" value="${c.tintColor || '#ffffff'}" oninput="this.nextElementSibling.value = this.value" />
            <input type="text" value="${c.tintColor || '#ffffff'}" oninput="this.previousElementSibling.value = this.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Opacidade</label>
          <div class="range-input-group">
            <input type="range" name="opacity" min="0" max="100" step="1" value="${Math.round((c.opacity ?? 1) * 100)}" data-debounce="opacity" oninput="this.nextElementSibling.value = this.value + '%'" />
            <input type="text" class="range-value opacity-val" value="${Math.round((c.opacity ?? 1) * 100)}%" readonly />
          </div>
        </div>
        <div class="form-group" style="display: flex; flex-direction: row; gap: 0.5rem;">
          <div style="flex: 1;">
            <label>Rotação (graus)</label>
            <input type="number" name="rotation" value="${c.rotation ?? 0}" min="0" max="360" step="1" />
          </div>
          <div style="flex: 1;">
            <label>Escala (×)</label>
            <input type="number" name="scale" value="${c.scale ?? 1}" min="0.1" max="10" step="0.1" />
          </div>
        </div>
      </fieldset>
    `;

    const visionHtml = `
      <fieldset>
        <legend>Visão do Token</legend>
        <div class="form-group form-group-checkbox">
          <label><input type="checkbox" name="sightEnabled" ${c.sightEnabled !== false ? 'checked' : ''} /> Visão Habilitada</label>
        </div>
        <div class="form-group">
          <label>Alcance da Visão (ft)</label>
          <input type="number" name="sightRange" value="${c.sightRange ?? 0}" min="0" step="5" />
          <small>A distância que o token enxerga sem luz nenhuma. 0 = ilimitado.</small>
        </div>
        <div class="form-group">
          <label>Modo de Visão</label>
          <select name="sightMode">
            ${VISION_MODES.map((o) => `<option value="${o.value}" ${(c.sightMode || 'basic') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
          <small>Altera a aparência do campo de visão (Basic = cores normais, Darkvision/Monocromático = reduz a cor).</small>
        </div>
        <div class="form-group">
          <label>Ângulo da Visão (graus)</label>
          <div class="range-input-group">
            <input type="range" name="sightAngle" min="0" max="360" step="15" value="${c.sightAngle ?? 360}" data-debounce="sightAngle" oninput="this.nextElementSibling.value = this.value + '°'" />
            <input type="text" class="range-value sight-angle-val" value="${c.sightAngle ?? 360}°" readonly />
          </div>
        </div>
        <div class="form-group">
          <label>${t('tokenConfig.detectionModes')}</label>
          <div class="detection-modes-list">
            ${(c.detectionModes ?? []).map((m, i) => `
              <div class="detection-mode-row" style="display:flex; align-items:center; gap:6px; margin-bottom:4px; padding:4px 0; border-bottom:1px solid var(--color-border);">
                <input type="hidden" name="detectionModes:${i}:id" value="${this.esc(m.id)}" />
                <select name="detectionModes:${i}:type" style="width:130px;">
                  ${DETECTION_TYPES.map(o => `<option value="${o.value}" ${m.type === o.value ? 'selected' : ''}>${t(o.labelKey)}</option>`).join('')}
                </select>
                <input type="number" name="detectionModes:${i}:range" value="${m.range ?? 0}" min="0" step="10" style="width:70px;" placeholder="${t('tokenConfig.detectionRange')}" />
                <label style="white-space:nowrap; font-size:0.85rem;">
                  <input type="checkbox" name="detectionModes:${i}:enabled" ${m.enabled !== false ? 'checked' : ''} /> ${t('tokenConfig.detectionEnabled')}
                </label>
                <button type="button" class="btn btn-small btn-danger btn-sm" data-action="remove-detection-mode" data-index="${i}">✕</button>
              </div>
            `).join('')}
            ${(c.detectionModes ?? []).length === 0 ? `<p class="field-empty">${t('tokenConfig.noDetectionModes')}</p>` : ''}
          </div>
          <button type="button" class="btn btn-secondary btn-small" data-action="add-detection-mode" style="margin-top:4px;">+ ${t('tokenConfig.detectionAdd')}</button>
        </div>
      </fieldset>
    `;

    const lightHtml = `
      <fieldset>
        <legend>Luz do Token</legend>
        <p style="margin: 0 0 0.5rem; font-size: 0.8rem; color: var(--color-text-muted);">Define a luz emitida pelo token (0 = sem emissão).</p>
        <div class="form-group" style="display: flex; flex-direction: row; gap: 0.5rem;">
          <div style="flex: 1;">
            <label>Claridade Total (px)</label>
            <input type="number" name="lightBrightRange" value="${c.lightBrightRange ?? 0}" min="0" step="10" />
          </div>
          <div style="flex: 1;">
            <label>Claridade Parcial (px)</label>
            <input type="number" name="lightDimRange" value="${c.lightDimRange ?? 0}" min="0" step="10" />
          </div>
        </div>
        <div class="form-group">
          <label>Cor da Luz</label>
          <div class="color-input-group">
            <input type="color" name="lightColor" value="${c.lightColor || '#ffffff'}" oninput="this.nextElementSibling.value = this.value" />
            <input type="text" value="${c.lightColor || '#ffffff'}" oninput="this.previousElementSibling.value = this.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Animação da Luz</label>
          <select name="lightAnimation">
            ${LIGHT_ANIMATIONS.map(a => `<option value="${a}" ${(c.lightAnimation || 'none') === a ? 'selected' : ''}>${a.charAt(0).toUpperCase() + a.slice(1)}</option>`).join('')}
          </select>
        </div>
      </fieldset>
    `;

    const schema = systemRegistry.getActive()?.getSheetSchema?.(this.castMember.kind ?? '') ?? null;

    const actor = c.actorId ? (actorsCollection.get ? (actorsCollection.get(c.actorId) as any) : null) : null;
    const actorSystem = actor?.system || actor?.systemData || {};
    const mergedSystem = { ...c.systemData, ...actorSystem };
    const resources = findResourceAttributes(mergedSystem);

    const hasHp = resources.some(r => ['attributes.hp', 'resources.health', 'hp', 'health'].includes(r.path));
    const hasMana = resources.some(r => ['attributes.mana', 'resources.mana', 'mana', 'mp'].includes(r.path));

    if (!hasHp) {
      resources.unshift({ path: 'attributes.hp', label: formatResourceLabel('attributes.hp') });
    }
    if (!hasMana) {
      resources.push({ path: 'attributes.mana', label: formatResourceLabel('attributes.mana') });
    }

    const defaultHpPath = resources.find(r => ['attributes.hp', 'resources.health', 'hp', 'health'].includes(r.path))?.path ?? 'attributes.hp';

    const bar1Attr = c.bar1?.attribute !== undefined ? c.bar1.attribute : defaultHpPath;
    const bar1Color = c.bar1?.color ?? 'dynamic';
    const bar2Attr = c.bar2?.attribute ?? '';
    const bar2Color = c.bar2?.color ?? '#3498db';
    const displayBars = Number(c.displayBars ?? 20);

    const resourcesHtml = `
      <fieldset>
        <legend>${t('tokenConfig.resourceBars')}</legend>
        <div class="form-group">
          <label>${t('tokenConfig.barDisplay')}</label>
          <select name="displayBars">
            ${BAR_DISPLAY_MODES.map(m => `<option value="${m.value}" ${displayBars === m.value ? 'selected' : ''}>${t(m.labelKey)}</option>`).join('')}
          </select>
          <small>${t('tokenConfig.barDisplayHint')}</small>
        </div>

        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
          <div style="flex: 1; padding: 0.75rem; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-heart" style="color: #e74c3c;"></i> ${t('tokenConfig.bar1Title')}</div>
            <div class="form-group">
              <label>${t('tokenConfig.monitoredAttr')}</label>
              <select name="bar1Attribute">
                <option value="" ${!bar1Attr ? 'selected' : ''}>${t('tokenConfig.noneOption')}</option>
                ${resources.map(r => `<option value="${r.path}" ${bar1Attr === r.path ? 'selected' : ''}>${r.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>${t('tokenConfig.colorStyle')}</label>
              <select name="bar1Color">
                <option value="dynamic" ${bar1Color === 'dynamic' ? 'selected' : ''}>${t('tokenConfig.dynamicColor')}</option>
                <option value="#2ecc71" ${bar1Color === '#2ecc71' ? 'selected' : ''}>${t('tokenConfig.greenColor')}</option>
                <option value="#e74c3c" ${bar1Color === '#e74c3c' ? 'selected' : ''}>${t('tokenConfig.redColor')}</option>
                <option value="#3498db" ${bar1Color === '#3498db' ? 'selected' : ''}>${t('tokenConfig.blueColor')}</option>
              </select>
            </div>
          </div>

          <div style="flex: 1; padding: 0.75rem; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-bolt" style="color: #3498db;"></i> ${t('tokenConfig.bar2Title')}</div>
            <div class="form-group">
              <label>${t('tokenConfig.monitoredAttr')}</label>
              <select name="bar2Attribute">
                <option value="" ${!bar2Attr ? 'selected' : ''}>${t('tokenConfig.noneOption')}</option>
                ${resources.map(r => `<option value="${r.path}" ${bar2Attr === r.path ? 'selected' : ''}>${r.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>${t('tokenConfig.barColor')}</label>
              <div class="color-input-group">
                <input type="color" name="bar2Color" value="${bar2Color === 'dynamic' ? '#3498db' : bar2Color}" oninput="this.nextElementSibling.value = this.value" />
                <input type="text" value="${bar2Color}" oninput="this.previousElementSibling.value = this.value" />
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>${t('tokenConfig.systemData')}</legend>
        ${schema
        ? flatSheetFields(schema, c.systemData)
        : `<p class="field-empty">${t('tokenConfig.noSystemData')}</p>`
      }
        <div class="form-group">
          <label>${t('tokenConfig.barGridSize')}</label>
          <input type="number" name="barGridSize" value="${c.barGridSize ?? 1}" min="0" max="3" step="1" />
          <small>${t('tokenConfig.barGridSizeHint')}</small>
        </div>
        <div class="form-group form-group-checkbox">
          <label><input type="checkbox" name="hidden" ${c.hidden ? 'checked' : ''} /> ${t('tokenConfig.hidden')}</label>
          <small>${t('tokenConfig.hiddenHint')}</small>
        </div>
        <div class="form-group form-group-checkbox">
          <label><input type="checkbox" name="locked" ${c.locked ? 'checked' : ''} /> ${t('tokenConfig.locked')}</label>
          <small>${t('tokenConfig.lockedHint')}</small>
        </div>
      </fieldset>
    `;

    const movementHtml = `
      <fieldset>
        <legend>Movimento</legend>
        <div class="form-group">
          <label>Ação de Movimento</label>
          <select name="movementAction">
            ${MOVEMENT_ACTIONS.map(m => `<option value="${m}" ${(c.movementAction || 'walk') === m ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Elevação (px)</label>
          <input type="number" name="elevation" value="${c.elevation ?? 0}" min="-1000" max="1000" step="10" />
          <small>Altura do token acima do solo. Positivo = voando, negativo = subterrâneo.</small>
        </div>
      </fieldset>
    `;

    const ownershipMap = c.ownership || {};
    const defaultPerm = ownershipMap['default'] ?? 3;
    const PERM_LEVELS = [0, 1, 2, 3];
    const PERM_LABEL_KEYS = ['tokenConfig.permNone', 'tokenConfig.permLimited', 'tokenConfig.permObserver', 'tokenConfig.permOwner'];
    const users = usersCollection.contents;

    const permissionsHtml = `
      <fieldset>
        <legend>${t('tokenConfig.permissions')}</legend>
        <div class="form-group">
          <label>${t('tokenConfig.defaultPermission')}</label>
          <select name="ownership:default">
            ${PERM_LEVELS.map(l => `<option value="${l}" ${defaultPerm === l ? 'selected' : ''}>${t(PERM_LABEL_KEYS[l])}</option>`).join('')}
          </select>
          <small>${t('tokenConfig.defaultPermissionHint')}</small>
        </div>
        <div class="form-group">
          <label>${t('tokenConfig.perUser')}</label>
          ${users.length === 0 ? `<p class="field-empty">${t('tokenConfig.noUsers')}</p>` : ''}
          ${users.map(u => {
      const level = ownershipMap[u.id] ?? -1;
      return `
              <div class="ownership-user-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="flex:1;">${this.esc(u.name)}</span>
                <select name="ownership:${u.id}">
                  <option value="-1" ${level === -1 ? 'selected' : ''}>${t('tokenConfig.inherit')}</option>
                  ${PERM_LEVELS.map(l => `<option value="${l}" ${level === l ? 'selected' : ''}>${t(PERM_LABEL_KEYS[l])}</option>`).join('')}
                </select>
              </div>
            `;
    }).join('')}
        </div>
      </fieldset>
    `;

    return `
      <div class="banner-spacer"></div>
      ${this.tabs.navTemplate()}
      <form class="loom-form" id="token-form" style="display: flex; flex-direction: column; flex: auto; min-height: 0;">
          ${this.tabs.contentWrapper('identity', identityHtml)}
          ${this.tabs.contentWrapper('appearance', appearanceHtml)}
          ${this.tabs.contentWrapper('vision', visionHtml)}
          ${this.tabs.contentWrapper('light', lightHtml)}
          ${this.tabs.contentWrapper('resources', resourcesHtml)}
          ${this.tabs.contentWrapper('movement', movementHtml)}
          ${this.tabs.contentWrapper('permissions', permissionsHtml)}
      </form>
    `;
  }

  protected onRender(): void {
    this.tabs.bind(this.element);

    const pickAvatarBtn = this.element.querySelector('[data-action="pick-avatar"]');
    pickAvatarBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (url: string) => {
          const input = this.element.querySelector('[name="avatarUrl"]') as HTMLInputElement;
          if (input) input.value = url;
        },
      });
    });

    const ringPresetSelect = this.element.querySelector<HTMLSelectElement>('.ring-preset-select');
    const ringCustomGroup = this.element.querySelector<HTMLElement>('.ring-custom-group');
    const ringScaleGroup = this.element.querySelector<HTMLElement>('.ring-scale-group');
    const ringUrlInput = this.element.querySelector<HTMLInputElement>('input[name="ringUrl"]');
    const ringScaleInput = this.element.querySelector<HTMLInputElement>('input[name="ringScale"]');
    const ringScaleVal = this.element.querySelector<HTMLInputElement>('.ring-scale-val');

    ringPresetSelect?.addEventListener('change', () => {
      const val = ringPresetSelect.value;
      const isRingActive = Boolean(val && val !== 'none');
      if (ringScaleGroup) ringScaleGroup.style.display = isRingActive ? '' : 'none';
      if (val === 'custom') {
        if (ringCustomGroup) ringCustomGroup.style.display = '';
      } else {
        if (ringCustomGroup) ringCustomGroup.style.display = 'none';
        if (ringUrlInput) ringUrlInput.value = val;
      }
      if (isRingActive && ringScaleInput) {
        const defaultScale = Math.round(getDefaultRingScale(val) * 100);
        ringScaleInput.value = String(defaultScale);
        if (ringScaleVal) ringScaleVal.value = `${defaultScale}%`;
      }
    });

    const pickRingBtn = this.element.querySelector('[data-action="pick-ring"]');
    pickRingBtn?.addEventListener('click', () => {
      this.renderChild(FilePickerWindow, 'file-picker', {
        onSelect: (url: string) => {
          if (ringUrlInput) ringUrlInput.value = url;
          if (ringPresetSelect) ringPresetSelect.value = 'custom';
          if (ringCustomGroup) ringCustomGroup.style.display = '';
          if (ringScaleGroup) ringScaleGroup.style.display = '';
        },
      });
    });

    this.bindRangeFeedback('ringScale', '.ring-scale-val', (v) => `${Math.round(v)}%`);
    this.bindRangeFeedback('opacity', '.opacity-val', (v) => `${Math.round(v)}%`);
    this.bindRangeFeedback('sightAngle', '.sight-angle-val', (v) => `${Math.round(v)}°`);

    this.element.querySelectorAll<HTMLElement>('[data-action="pick-sheet-image"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (!key) return;
        this.renderChild(FilePickerWindow, 'file-picker', {
          onSelect: (url: string) => {
            const input = this.element.querySelector<HTMLInputElement>(`input[name="sd:${key}"]`);
            if (input) input.value = url;
          },
        });
      });
    });
  }

  private bindRangeFeedback(name: string, selector: string, format: (v: number) => string): void {
    const range = this.element.querySelector<HTMLInputElement>(`[name="${name}"]`);
    const display = this.element.querySelector<HTMLElement>(selector);
    if (range && display) {
      range.addEventListener('input', () => {
        display.textContent = format(parseFloat(range.value));
      });
    }
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (this.tabs.handleAction(action)) return;

    if (action === 'save') {
      void this.save();
    } else if (action === 'delete') {
      void this.deleteToken();
    } else if (action === 'set-dots' && target.dataset.key && target.dataset.value) {
      handleDotsClick(this.element, target.dataset.key, Number(target.dataset.value));
    } else if (action === 'cycle-square' && target.dataset.key && target.dataset.index) {
      handleSquareCounterClick(this.element, target.dataset.key, Number(target.dataset.index));
    } else if (action === 'add-detection-mode') {
      if (!this.castMember) return;
      this.castMember.detectionModes = [
        ...(this.castMember.detectionModes ?? []),
        { id: `mode-${Date.now()}`, type: 'basicSight', range: 0, enabled: true },
      ];
      this.rerenderBody();
    } else if (action === 'remove-detection-mode') {
      const idx = Number(target.dataset.index);
      if (!this.castMember || isNaN(idx)) return;
      this.castMember.detectionModes = (this.castMember.detectionModes ?? []).filter((_, i) => i !== idx);
      this.rerenderBody();
    }
  }

  private async save(): Promise<void> {
    if (!this.castMember) return;

    const body = this.element.querySelector('.loom-window-body') as HTMLElement;
    if (!body) return;

    const fd = new LoomFormData(body);
    const data = fd.object;

    const detectionModes: DetectionModeEntry[] = Object.values(data.detectionModes ?? {}).map((m: any) => ({
      id: String(m.id ?? ''),
      type: String(m.type ?? 'basicSight'),
      range: Number(m.range ?? 0),
      enabled: m.enabled !== false,
    }));

    const formSystemData = data.sd ?? {};
    const systemData = { ...(this.castMember.systemData ?? {}), ...formSystemData } as Record<string, any>;

    const ownership: Record<string, number> = {};
    for (const [key, val] of Object.entries(data.ownership ?? {})) {
      const n = Number(val);
      if (n >= 0) ownership[key] = n;
    }

    try {
      const ringPreset = data.ringPreset;
      let finalRingUrl = data.ringUrl || '';
      if (ringPreset !== 'custom') {
        finalRingUrl = ringPreset || '';
      }
      const finalRingEffect = data.ringEffect || 'none';
      const finalRingScale = data.ringScale !== undefined && Number(data.ringScale) > 0
        ? Number(data.ringScale) / 100
        : getDefaultRingScale(finalRingUrl);

      const bar1 = {
        attribute: data.bar1Attribute !== undefined ? data.bar1Attribute : (this.castMember.bar1?.attribute ?? 'attributes.hp'),
        color: data.bar1Color ?? (this.castMember.bar1?.color ?? 'dynamic'),
      };
      const bar2 = {
        attribute: data.bar2Attribute !== undefined ? data.bar2Attribute : (this.castMember.bar2?.attribute ?? ''),
        color: data.bar2Color ?? (this.castMember.bar2?.color ?? '#3498db'),
      };
      const displayBars = Number(data.displayBars ?? (this.castMember.displayBars ?? 20));

      const isProto = this.props.isPrototype || this.castMember.id.startsWith('actor-');
      if (!isProto) {
        await api.put(`/cast/${this.castMember.id}`, {
          name: data.name,
          kind: data.kind,
          colorHex: data.colorHex,
          actorId: data.actorId || '',
          isLinked: !!data.isLinked,
          ownership,
        });

        await api.put(`/cast/${this.castMember.id}/token`, {
          avatarUrl: data.avatarUrl || '',
          ringColor: data.ringColor || data.colorHex || '#e74c3c',
          ringUrl: finalRingUrl,
          ringEffect: finalRingEffect,
          ringScale: finalRingScale,
          shape: data.shape || 'circle',
          tintColor: data.tintColor || '#ffffff',
          opacity: Number(data.opacity ?? 100) / 100,
          rotation: Number(data.rotation ?? 0),
          scale: Number(data.scale ?? 1),
          sightEnabled: data.sightEnabled !== false,
          sightRange: Number(data.sightRange ?? 0),
          sightAngle: Number(data.sightAngle ?? 360),
          sightMode: data.sightMode || 'basic',
          detectionModes,
          lightDimRange: Number(data.lightDimRange ?? 0),
          lightBrightRange: Number(data.lightBrightRange ?? 0),
          lightColor: data.lightColor || '#ffffff',
          lightAnimation: data.lightAnimation || 'none',
          systemData,
          barGridSize: Number(data.barGridSize ?? 1),
          bar1,
          bar2,
          displayBars,
          movementAction: data.movementAction || 'walk',
          elevation: Number(data.elevation ?? 0),
          locked: !!data.locked,
          hidden: !!data.hidden,
        });
      }

      const updated: CastMember = {
        ...this.castMember,
        name: data.name,
        kind: data.kind,
        colorHex: data.colorHex,
        ringColor: data.ringColor || data.colorHex || '#e74c3c',
        ringUrl: finalRingUrl,
        ringEffect: finalRingEffect,
        ringScale: finalRingScale,
        shape: data.shape,
        avatarUrl: data.avatarUrl || '',
        tintColor: data.tintColor || '#ffffff',
        opacity: Number(data.opacity ?? 100) / 100,
        rotation: Number(data.rotation ?? 0),
        scale: Number(data.scale ?? 1),
        actorId: data.actorId || '',
        isLinked: !!data.isLinked,
        sightEnabled: data.sightEnabled !== false,
        sightRange: Number(data.sightRange ?? 0),
        sightAngle: Number(data.sightAngle ?? 360),
        sightMode: data.sightMode || 'basic',
        detectionModes,
        lightDimRange: Number(data.lightDimRange ?? 0),
        lightBrightRange: Number(data.lightBrightRange ?? 0),
        lightColor: data.lightColor || '#ffffff',
        lightAnimation: data.lightAnimation || 'none',
        systemData,
        barGridSize: Number(data.barGridSize ?? 1),
        bar1,
        bar2,
        displayBars,
        movementAction: data.movementAction || 'walk',
        elevation: Number(data.elevation ?? 0),
        locked: !!data.locked,
        hidden: !!data.hidden,
        ownership,
      };

      this.castMember = updated;
      this.props.onUpdated(updated);
      showToast(t('tokenConfig.tokenUpdated'), 'success');
      windowManager.close(this.options.id);
    } catch (err: any) {
      showToast(err?.message || t('tokenConfig.tokenUpdateError'), 'error');
    }
  }

  private async deleteToken(): Promise<void> {
    if (!this.castMember) return;
    const confirmed = await showConfirm(
      'Excluir Token',
      `Deseja remover "${this.castMember.name}" do mapa?`,
    );
    if (!confirmed) return;
    try {
      await api.delete(`/cast/${this.castMember.id}`);
      showToast('Token excluído', 'success');
      windowManager.close(this.options.id);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir token', 'error');
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
        label: t('common.delete'),
        action: 'delete',
        title: t('tokenConfig.deleteTooltip'),
      },
    ];
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
