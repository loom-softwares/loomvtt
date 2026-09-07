/*******************************************************************************
 * LoomVTT
 * client/windows/bug-report-window.ts
 * 
 * 
 * Window for submitting bug reports.
 ******************************************************************************/

import { BaseWindow, BaseWindowOptions } from './base-window.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { LoomFormData } from '../core/form-data.js';
import { t } from '../lib/i18n.js';

interface BugReport {
  id: string;
  worldId: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  reporterId: string;
  createdAt: string;
  updatedAt: string;
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['ui', 'mechanics', 'performance', 'network', 'other'];
const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];

export class BugReportWindow extends BaseWindow {
  private bugs: BugReport[] = [];
  private loaded = false;
  private view: 'list' | 'form' = 'list';
  private editingId: string | null = null;
  private worldId: string;

  constructor(props: { worldId: string }) {
    super({
      id: 'bug-report-window',
      title: 'Bug Tracker',
      icon: '<i class="fa-solid fa-bug"></i>',
      width: 640,
      height: 'auto',
    } as BaseWindowOptions);
    this.worldId = props.worldId;
  }

  async mount(): Promise<void> {
    super.mount();
    await this.loadBugs();
    this.rerenderBody();
  }

  private async loadBugs(): Promise<void> {
    try {
      this.bugs = await api.get<BugReport[]>(`/bug-reports?worldId=${this.worldId}`);
    } catch {
      showToast('Erro ao carregar reports', 'error');
    } finally {
      this.loaded = true;
    }
  }

  bodyTemplate(): string {
    if (!this.loaded) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    return this.view === 'form' ? this.formTemplate() : this.listTemplate();
  }

  private listTemplate(): string {
    const items = this.bugs.length === 0
      ? '<div class="empty-state"><p>Nenhum bug reportado</p></div>'
      : this.bugs.map(b => `
        <div class="bug-item" data-id="${b.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--color-border);cursor:pointer">
          <span class="bug-severity sev-${b.severity}" style="width:8px;height:8px;border-radius:50%;background:${this.severityColor(b.severity)};flex-shrink:0"></span>
          <span class="bug-status status-${b.status}" style="font-size:0.75rem;opacity:0.7;text-transform:uppercase;width:80px">${b.status}</span>
          <span class="bug-title" style="flex:1">${this.esc(b.title)}</span>
          <span class="bug-category" style="font-size:0.75rem;opacity:0.5">${b.category}</span>
          <span class="bug-date" style="font-size:0.75rem;opacity:0.5">${this.fmtDate(b.createdAt)}</span>
          <button class="btn btn-small btn-danger" data-action="delete-bug" data-id="${b.id}">✕</button>
        </div>
      `).join('');

    return `
      <div style="padding:8px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0">Bug Reports (${this.bugs.length})</h3>
          <button class="btn" data-action="new-bug">+ Novo Report</button>
        </div>
        <div class="bug-list">${items}</div>
      </div>
    `;
  }

  private formTemplate(): string {
    const isEdit = this.editingId !== null;
    const bug = isEdit ? this.bugs.find(b => b.id === this.editingId) : null;

    const sevOpts = SEVERITIES.map(s =>
      `<option value="${s}" ${bug?.severity === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    const catOpts = CATEGORIES.map(c =>
      `<option value="${c}" ${bug?.category === c ? 'selected' : ''}>${c}</option>`
    ).join('');
    const statusOpts = isEdit ? STATUSES.map(s =>
      `<option value="${s}" ${bug?.status === s ? 'selected' : ''}>${s}</option>`
    ).join('') : '';

    return `
      <div style="padding:8px 0">
        <h3 style="margin:0 0 12px">${isEdit ? 'Editar Report' : 'Novo Bug Report'}</h3>
        <div class="form-group">
          <label>Titulo *</label>
          <input type="text" name="title" value="${bug ? this.esc(bug.title) : ''}" required />
        </div>
        <div class="form-group">
          <label>Descricao</label>
          <textarea name="description" rows="4">${bug ? this.esc(bug.description) : ''}</textarea>
        </div>
        <div class="form-group">
          <label>Severidade</label>
          <select name="severity">${sevOpts}</select>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select name="category">${catOpts}</select>
        </div>
        ${isEdit ? `
        <div class="form-group">
          <label>Status</label>
          <select name="status">${statusOpts}</select>
        </div>
        ` : ''}
      </div>
    `;
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'new-bug') {
      this.editingId = null;
      this.view = 'form';
      this.rerenderBody();
    } else if (action === 'cancel-form') {
      this.view = 'list';
      this.editingId = null;
      this.rerenderBody();
      // 'save' = rodape padrao do BaseWindow. O par Salvar/Cancelar que existia no
      // corpo desta janela era duplicata exata do rodape.
    } else if (action === 'save') {
      void this.saveBug();
    } else if (action === 'delete-bug' && id) {
      void this.deleteBug(id);
    } else if (action === 'edit-bug' && id) {
      this.editingId = id;
      this.view = 'form';
      this.rerenderBody();
    }
  }

  private async saveBug(): Promise<void> {
    const body = this.element.querySelector<HTMLElement>('.loom-window-body')!;
    const fd = new LoomFormData(body);
    const data = fd.object;
    if (fd.missing.length > 0) {
      showToast('Preencha todos os campos obrigatorios', 'error');
      return;
    }
    try {
      if (this.editingId) {
        await api.put(`/bug-reports/${this.editingId}`, {
          title: data.title,
          description: data.description || '',
          severity: data.severity,
          category: data.category,
          status: data.status,
        });
        showToast('Report atualizado', 'success');
      } else {
        await api.post('/bug-reports', {
          worldId: this.worldId,
          title: data.title,
          description: data.description || '',
          severity: data.severity,
          category: data.category,
        });
        showToast('Bug reportado!', 'success');
      }
      this.view = 'list';
      this.editingId = null;
      await this.loadBugs();
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar', 'error');
    }
  }

  private async deleteBug(id: string): Promise<void> {
    try {
      await api.delete(`/bug-reports/${id}`);
      showToast('Report removido', 'success');
      await this.loadBugs();
      this.rerenderBody();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover', 'error');
    }
  }

  private severityColor(s: string): string {
    switch (s) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#22c55e';
    }
  }

  private fmtDate(d: string): string {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString();
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
