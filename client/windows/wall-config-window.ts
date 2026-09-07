/*******************************************************************************
 * LoomVTT
 * client/windows/wall-config-window.ts
 * 
 * 
 * Window for configuring walls.
 ******************************************************************************/

import { t } from '../lib/i18n.js';
import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { CanvasManager } from '../canvas/canvas-manager.js';

export class WallConfigWindow extends BaseWindow {
  private wall: any;
  private wallId: string;
  private onSaved: () => void;

  constructor(props: { wall: any; wallId: string; onSaved?: () => void }) {
    super({
      id: `wall-config-${props.wallId}`,
      title: t('wallConfig.title'),
      icon: '<i class="fa-solid fa-bars"></i>',
      width: 380,
      height: 'auto',
    } as BaseWindowOptions);
    this.wall = props.wall;
    this.wallId = props.wallId;
    this.onSaved = props.onSaved || (() => { });
  }

  bodyTemplate(): string {
    if (!this.wall) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    const isDoor = this.wall.door > 0;
    return `
      <div class="form-group">
        <label>${t('wallConfig.blocksSight')}</label>
        <input type="checkbox" name="sight" ${this.wall.sight ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label>${t('wallConfig.blocksLight')}</label>
        <input type="checkbox" name="light" ${this.wall.light ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label>${t('wallConfig.blocksMovement')}</label>
        <input type="checkbox" name="movement" ${this.wall.movement ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label>${t('wallConfig.blocksSound')}</label>
        <input type="checkbox" name="sound" ${this.wall.sound ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label>${t('wallConfig.direction')}</label>
        <select name="direction">
          <option value="0" ${this.wall.direction === 0 ? 'selected' : ''}>${t('wallConfig.directionBoth')}</option>
          <option value="1" ${this.wall.direction === 1 ? 'selected' : ''}>${t('wallConfig.directionLeft')}</option>
          <option value="2" ${this.wall.direction === 2 ? 'selected' : ''}>${t('wallConfig.directionRight')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${t('wallConfig.type')}</label>
        <select name="wallType">
          <option value="normal" ${(this.wall.wallType || 'normal') === 'normal' ? 'selected' : ''}>${t('wallConfig.typeNormal')}</option>
          <option value="invisible" ${this.wall.wallType === 'invisible' ? 'selected' : ''}>${t('wallConfig.typeInvisible')}</option>
          <option value="terrain" ${this.wall.wallType === 'terrain' ? 'selected' : ''}>${t('wallConfig.typeTerrain')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${t('common.level') || 'Andar'}</label>
        <select name="levelId">
          <option value="">${t('common.globalLevel') || 'Térreo (Global)'}</option>
          ${(CanvasManager.activeInstance?.levels || []).map(l => `<option value="${l.id}" ${this.wall.levelId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${t('wallConfig.isDoor')}</label>
        <input type="checkbox" name="isDoor" ${isDoor ? 'checked' : ''} data-action="toggle-door-section" />
      </div>
      <fieldset id="door-section" class="door-section" style="${isDoor ? '' : 'display:none;'}">
        <div class="form-group">
          <label>${t('wallConfig.doorType')}</label>
          <select name="door">
            <option value="0" ${this.wall.door === 0 ? 'selected' : ''}>${t('wallConfig.doorNone')}</option>
            <option value="1" ${this.wall.door === 1 ? 'selected' : ''}>${t('wallConfig.doorNormal')}</option>
            <option value="2" ${this.wall.door === 2 ? 'selected' : ''}>${t('wallConfig.doorSecret')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${t('wallConfig.doorState')}</label>
          <select name="doorState">
            <option value="0" ${this.wall.doorState === 0 ? 'selected' : ''}>${t('wallConfig.doorClosed')}</option>
            <option value="1" ${this.wall.doorState === 1 ? 'selected' : ''}>${t('wallConfig.doorOpen')}</option>
            <option value="2" ${this.wall.doorState === 2 ? 'selected' : ''}>${t('wallConfig.doorLocked')}</option>
          </select>
        </div>
      </fieldset>
    `;
  }

  protected onRender(): void {
    const isDoorCheck = this.element.querySelector('[name="isDoor"]') as HTMLInputElement;
    const doorSelect = this.element.querySelector('[name="door"]') as HTMLSelectElement;
    const doorSection = this.element.querySelector('#door-section') as HTMLElement;
    if (isDoorCheck && doorSection) {
      isDoorCheck.addEventListener('change', () => {
        if (isDoorCheck.checked) {
          doorSection.style.display = '';
          if (doorSelect) doorSelect.value = '1';
        } else {
          doorSection.style.display = 'none';
          if (doorSelect) doorSelect.value = '0';
        }
      });
    }
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'save') {
      this.saveWall();
    }
  }

  private async saveWall(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    try {
      await api.put(`/walls/${this.wallId}`, {
        sight: !!data.sight,
        light: !!data.light,
        movement: !!data.movement,
        sound: !!data.sound,
        direction: parseInt(data.direction ?? '0'),
        wallType: data.wallType || 'normal',
        door: parseInt(data.door ?? '0'),
        doorState: parseInt(data.doorState ?? '0'),
        levelId: data.levelId ?? '',
      });
      showToast(t('wallConfig.updated'), 'success');
      windowManager.close(this.options.id);
      this.onSaved();
    } catch (e: any) {
      showToast(e?.message || t('wallConfig.saveError'), 'error');
    }
  }
}
