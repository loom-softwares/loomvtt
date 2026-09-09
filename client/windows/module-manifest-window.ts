/*******************************************************************************
 * LoomVTT
 * client/windows/module-manifest-window.ts
 *
 *
 * Edits package metadata (version, author, dependencies, conflicts...) direct
 * on the addon.json/ruleset.json on disk — via PUT /marketplace/:type/:name/manifest.
 * Not to be confused with ModuleSettingsWindow, which edits per-world settings
 * (scope: 'world'/'client') the addon itself defines — that one stays untouched,
 * this window never touches those.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { t } from '../lib/i18n.js';

interface PackageManifestInfo {
  type: 'addon' | 'ruleset';
  name: string;
  title?: string;
  version?: string;
  author?: string;
  repository?: string;
  description?: string;
  dependencies?: string[];
  conflicts?: string[];
}

export class ModuleManifestWindow extends BaseWindow {
  private pkg: PackageManifestInfo;

  constructor(private props: { pkg: PackageManifestInfo; onSaved?: () => void }) {
    super({
      id: `module-manifest-${props.pkg.name}`,
      title: props.pkg.title || props.pkg.name,
      icon: '<i class="fa-solid fa-folder-tree"></i>',
      width: 460,
      height: 'auto',
    });
    this.pkg = props.pkg;
  }

  bodyTemplate(): string {
    const p = this.pkg;
    return `
      <form class="module-settings-form" data-action="save">
        <div class="setting-item">
          <label>${t('setupHub.modules.manifestFolder')}</label>
          <input type="text" value="${this.esc(p.name)}" disabled />
        </div>
        <div class="setting-item">
          <label for="mm-title">${t('setupHub.modules.manifestTitle')}</label>
          <input type="text" id="mm-title" name="title" value="${this.esc(p.title || '')}" />
        </div>
        <div class="setting-item">
          <label for="mm-version">${t('setupHub.modules.manifestVersion')}</label>
          <input type="text" id="mm-version" name="version" value="${this.esc(p.version || '')}" />
        </div>
        <div class="setting-item">
          <label for="mm-author">${t('setupHub.modules.manifestAuthor')}</label>
          <input type="text" id="mm-author" name="author" value="${this.esc(p.author || '')}" />
        </div>
        <div class="setting-item">
          <label for="mm-repository">${t('setupHub.modules.manifestRepository')}</label>
          <input type="text" id="mm-repository" name="repository" value="${this.esc(p.repository || '')}" />
        </div>
        <div class="setting-item">
          <label for="mm-description">${t('setupHub.modules.manifestDescription')}</label>
          <textarea id="mm-description" name="description" rows="2">${this.esc(p.description || '')}</textarea>
        </div>
        <div class="setting-item">
          <label for="mm-dependencies">${t('setupHub.modules.manifestDependencies')}</label>
          <input type="text" id="mm-dependencies" name="dependencies" value="${this.esc((p.dependencies || []).join(', '))}" placeholder="addon-a, addon-b" />
        </div>
        <div class="setting-item">
          <label for="mm-conflicts">${t('setupHub.modules.manifestConflicts')}</label>
          <input type="text" id="mm-conflicts" name="conflicts" value="${this.esc((p.conflicts || []).join(', '))}" placeholder="addon-c" />
        </div>
        <div class="window-footer-actions">
          <button type="submit" class="btn btn-primary">${t('common.save')}</button>
        </div>
      </form>
    `;
  }

  onAction(action: string): void {
    if (action === 'save') this.save();
  }

  private async save(): Promise<void> {
    const form = this.element.querySelector('form');
    if (!form) return;

    const fd = new FormData(form as HTMLFormElement);
    const toList = (raw: string): string[] => raw.split(',').map((s) => s.trim()).filter(Boolean);

    const body = {
      title: String(fd.get('title') || ''),
      version: String(fd.get('version') || ''),
      author: String(fd.get('author') || ''),
      repository: String(fd.get('repository') || ''),
      description: String(fd.get('description') || ''),
      dependencies: toList(String(fd.get('dependencies') || '')),
      conflicts: toList(String(fd.get('conflicts') || '')),
    };

    try {
      await api.put(`/marketplace/${this.pkg.type}/${this.pkg.name}/manifest`, body);
      showToast(t('setupHub.modules.manifestSaved'), 'success');
      windowManager.close(`module-manifest-${this.pkg.name}`);
      this.props.onSaved?.();
    } catch (e: any) {
      showToast(e?.message || t('setupHub.modules.manifestSaveError'), 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
