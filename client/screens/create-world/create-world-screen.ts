import { t, getLocale } from '../../lib/i18n.js';
import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { showToast } from '../../components/toast.js';
import { windowManager } from '../../core/window-manager.js';
import { FilePickerWindow } from '../../windows/file-picker-window.js';
import '../../lib/prose-mirror-element.js';

interface System {
  id: string;
  title: string;
  version: string;
  backgroundUrl?: string;
  author?: string;
  description?: string;
}

const ART_PADRAO = '/bgs/05_ancient_library.png';



export class CreateWorldScreen extends BaseComponent {
  private systems: System[] = [];
  private selectedSystem = '';
  private step = 1;
  private get editorEl(): (HTMLElement & { value: string }) | null {
    return this.element.querySelector<HTMLElement & { value: string }>('#wf-desc');
  }
  /** While false, the data path is derived from the name on every keystroke.
   * After the user edits the path manually, we stop overwriting it. */
  private caminhoEditadoManualmente = false;

  constructor(
    container: HTMLElement,
    private props: { onCreated: (worldId: string) => void; onClose: () => void },
  ) {
    super(container);
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.systems = await api.get<System[]>('/systems');
    } catch (e) {
      this.systems = [];
    }
    this.render();
  }

  protected template(): string {
    return `
      <div class="world-forge">
        <div class="wf-warp"></div>
        <div class="wf-shell">

          <nav class="wf-rail" aria-label="Etapas">
            <div class="wf-mark">
              <img src="/images/loom-logo.png" alt="" />
              <span>LOOM</span>
            </div>
            ${this.railStep(1, 'system')}
            ${this.railStep(2, 'identity')}
            ${this.railStep(3, 'create')}
          </nav>

          <div class="wf-weave">
            <header class="wf-head">
              <div>
                <p class="wf-eyebrow" data-part="eyebrow">${t('createWorld.rail.stepOf', { step: '1' })}</p>
                <h1 class="wf-title" data-part="title">${t('createWorld.step1.title')}</h1>
              </div>
              <p class="wf-note" data-part="note">${t('createWorld.step1.desc')}</p>
              <button type="button" class="wf-close" data-action="close">${t('createWorld.buttons.cancel')}</button>
            </header>

            ${this.panelSistemas()}
            ${this.panelIdentidade()}
            ${this.panelResumo()}

            <footer class="wf-actions">
              <span class="wf-state" data-part="state">${t('createWorld.state.noSystem')}</span>
              <div class="wf-btn-row">
                <button type="button" class="wf-btn" data-part="back" data-action="step-back" disabled>${t('createWorld.buttons.back')}</button>
                <button type="button" class="wf-btn wf-btn-primary" data-part="next" data-action="step-next" disabled>${t('createWorld.buttons.continue')}</button>
              </div>
            </footer>
          </div>

        </div>
      </div>
    `;
  }

  private railStep(n: number, rotulo: string): string {
    const atual = n === this.step;
    return `
      <button type="button" class="wf-step" data-action="step-go" data-step="${n}"
              ${atual ? 'aria-current="step"' : ''} ${n > 1 ? 'disabled' : ''}>
        <span class="wf-step-num">0${n}</span><span>${t(`createWorld.rail.${rotulo}` as any)}</span>
      </button>
    `;
  }

  private panelSistemas(): string {
    if (this.systems.length === 0) {
      return `
        <section class="wf-panel is-active" data-panel="1">
          <p class="wf-shelf-empty">
            ${t('createWorld.empty.noSystemInstalled')}<br />
            ${t('createWorld.empty.installSystemFirst')}
          </p>
        </section>
      `;
    }

    const cartoes = this.systems
      .map(
        (s) => `
        <button type="button" class="wf-sys" data-action="pick-system" data-id="${this.escapeHtml(s.id)}" aria-pressed="false">
          <span class="wf-sys-art" style="background-image: url('${this.escapeHtml(s.backgroundUrl || ART_PADRAO)}')"></span>
          <span class="wf-sys-version">v${this.escapeHtml(s.version)}</span>
          <span class="wf-sys-body">
            <span class="wf-sys-name">${this.escapeHtml(s.title || s.id)}</span>
            ${s.author ? `<span class="wf-sys-author">${t('createWorld.step1.by')} ${this.escapeHtml(s.author)}</span>` : ''}
            ${s.description ? `<p class="wf-sys-desc">${this.escapeHtml(s.description)}</p>` : ''}
          </span>
          <span class="wf-sys-thread"></span>
        </button>
      `,
      )
      .join('');

    return `
      <section class="wf-panel is-active" data-panel="1">
        <div class="wf-shelf" role="group" aria-label="Installed systems">${cartoes}</div>
      </section>
    `;
  }

  private panelIdentidade(): string {
    return `
      <section class="wf-panel" data-panel="2">
        <div class="wf-identity">
          <div class="wf-fields">
            <div class="wf-field">
              <label for="wf-name">${t('createWorld.form.worldName')}</label>
              <input type="text" id="wf-name" name="name" placeholder="${t('createWorld.form.worldNamePlaceholder')}" autocomplete="off" required />
              <span class="wf-hint">Data path: <b data-part="slug">Data/worlds/</b></span>
            </div>

            <div class="wf-field">
              <label for="wf-path">${t('createWorld.form.dataPath')}</label>
              <input type="text" id="wf-path" name="dataPathName" placeholder="${t('createWorld.form.dataPathPlaceholder')}" autocomplete="off" />
              <span class="wf-hint" data-part="path-hint">${t('createWorld.form.dataPathHint')}</span>
            </div>

            <div class="wf-field">
              <label for="wf-desc">${t('createWorld.form.description')}</label>
              <prose-mirror class="wf-editor" id="wf-desc" compact></prose-mirror>
              <span class="wf-hint">${t('createWorld.form.descriptionHint')}</span>
            </div>

            <div class="wf-field">
              <label for="wf-session">${t('createWorld.form.nextSession')}</label>
              <input type="datetime-local" id="wf-session" name="nextSession" />
            </div>

            <div class="wf-field">
              <label for="wf-bg">${t('createWorld.form.coverArt')}</label>
              <div class="wf-file">
                <input type="text" id="wf-bg" name="backgroundUrl"
                       placeholder="${t('createWorld.form.coverArtPlaceholder')}" readonly />
                <button type="button" class="wf-file-btn" data-action="pick-background">${t('createWorld.buttons.select')}</button>
              </div>
            </div>
          </div>

          <aside class="wf-preview">
            <span class="wf-preview-label">${t('createWorld.preview.title')}</span>
            <div class="wf-card">
              <span class="wf-card-art" data-part="card-art"></span>
              <span class="wf-card-body">
                <span class="wf-card-title" data-part="card-title">${t('createWorld.preview.unnamed')}</span>
                <span class="wf-card-sub" data-part="card-sub">—</span>
                <p class="wf-card-desc" data-part="card-desc">${t('createWorld.preview.noDesc')}</p>
              </span>
            </div>
            <p class="wf-preview-note">
              ${t('createWorld.preview.hint')}
            </p>
          </aside>
        </div>
      </section>
    `;
  }

  private panelResumo(): string {
    return `
      <section class="wf-panel" data-panel="3">
        <dl class="wf-summary">
          <div class="wf-weft"><dt>${t('createWorld.summary.system')}</dt><dd data-part="sum-system">—</dd></div>
          <div class="wf-weft"><dt>${t('createWorld.summary.worldName')}</dt><dd data-part="sum-name">—</dd></div>
          <div class="wf-weft"><dt>${t('createWorld.summary.dataPath')}</dt><dd><span class="wf-mono" data-part="sum-path">—</span></dd></div>
          <div class="wf-weft"><dt>${t('createWorld.summary.nextSession')}</dt><dd><span class="wf-mono" data-part="sum-session">${t('createWorld.summary.notScheduled')}</span></dd></div>
          <div class="wf-weft"><dt>${t('createWorld.summary.coverArt')}</dt><dd><span class="wf-mono" data-part="sum-bg">${t('createWorld.summary.inheritsSystem')}</span></dd></div>
        </dl>
      </section>
    `;
  }

  render(): void {
    super.render();

    // Typing listeners do not go through data-action dispatch (which only
    // handles click/change), so they are attached here. Since the steps change without
    // re-render, they are attached only once and survive navigation.
    this.campo('name')?.addEventListener('input', () => {
      if (!this.caminhoEditadoManualmente) {
        const campoPath = this.campo('dataPathName');
        if (campoPath) campoPath.value = this.slugify(this.campo('name')?.value || '');
      }
      this.atualizarPrevia();
    });

    const campoPath = this.campo('dataPathName');
    campoPath?.addEventListener('input', () => {
      this.caminhoEditadoManualmente = true;
      const val = campoPath.value.trim();
      const hint = this.parte('path-hint');
      if (val && !/^[a-z0-9-]+$/.test(val)) {
        campoPath.style.borderBottomColor = 'var(--color-danger, #ef4444)';
        if (hint) {
          hint.style.color = 'var(--color-danger, #ef4444)';
          hint.textContent = t('createWorld.toasts.invalidDataPath');
        }
      } else {
        campoPath.style.borderBottomColor = '';
        if (hint) {
          hint.style.color = '';
          hint.textContent = t('createWorld.form.dataPathHint');
        }
      }
      this.atualizarPrevia();
    });

    // `<prose-mirror>` only emits 'change' (bubbles/composed) on blur —
    // it intercepts 'input' internally so keys don't leak to the rest of the
    // page. The preview updates when switching fields, not on every keystroke.
    this.editorEl?.addEventListener('change', () => this.atualizarPrevia());

    this.atualizarPrevia();
  }

  protected onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'close') {
      this.closeScreen();
    } else if (action === 'pick-background') {
      this.pickBackground();
    } else if (action === 'pick-system') {
      this.pickSystem(id);
    } else if (action === 'create') {
      this.createWorld();
    } else if (action === 'step-next') {
      this.irParaEtapa(this.step + 1);
    } else if (action === 'step-back') {
      this.irParaEtapa(this.step - 1);
    } else if (action === 'step-go') {
      this.irParaEtapa(Number(target.dataset.step || '1'));
    }
  }

  private pickSystem(id: string | null): void {
    if (!id) return;
    this.selectedSystem = id;
    this.element.querySelectorAll<HTMLElement>('.wf-sys').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.getAttribute('data-id') === id));
    });
    this.destravarTrilho();
    this.atualizarPrevia();
  }

  /** Next steps only exist after a system is chosen.
   * Called both on system pick and on step change — without this,
   * the rail would only unlock when clicking "Continue". */
  private destravarTrilho(): void {
    this.element.querySelectorAll<HTMLButtonElement>('.wf-step').forEach((s) => {
      s.disabled = Number(s.dataset.step) > 1 && !this.selectedSystem;
    });
  }

  /**
   * Change step by manipulating only classes and attributes.
   *
   * Never call `render()` here: `BaseComponent.render()` replaces the
   * entire innerHTML, which would destroy the ProseMirror instance mounted
   * on step 2 and erase what was already typed.
   */
  private irParaEtapa(n: number): void {
    if (n < 1 || n > 3) return;
    if (n > 1 && !this.selectedSystem) return;
    if (n === 3) this.preencherResumo();

    this.step = n;

    this.element.querySelectorAll<HTMLElement>('.wf-panel').forEach((p) => {
      p.classList.toggle('is-active', Number(p.dataset.panel) === n);
    });

    this.element.querySelectorAll<HTMLButtonElement>('.wf-step').forEach((s) => {
      const i = Number(s.dataset.step);
      if (i === n) s.setAttribute('aria-current', 'step');
      else s.removeAttribute('aria-current');
      s.dataset.done = String(i < n);
    });
    this.destravarTrilho();

    this.parte('title')!.textContent = t(`createWorld.step${n}.title` as any);
    this.parte('note')!.textContent = t(`createWorld.step${n}.desc` as any);
    this.parte('eyebrow')!.textContent = t('createWorld.rail.stepOf', { step: String(n) });

    this.atualizarBarra();
  }

  private atualizarBarra(): void {
    // Anchored by `data-part`, not `data-action`: the action of the right button
    // changes to "create" on step 3, and a selector by action would fail to
    // find it exactly in the step where it matters most.
    const btnNext = this.parte('next') as HTMLButtonElement | null;
    const btnBack = this.parte('back') as HTMLButtonElement | null;
    const estado = this.parte('state');
    if (!btnNext || !btnBack || !estado) return;

    btnBack.disabled = this.step === 1;
    btnNext.disabled = !this.selectedSystem;
    btnNext.textContent = this.step === 3 ? t('createWorld.buttons.createWorld') : t('createWorld.buttons.continue');

    // Step 3 is the only one where the button saves — in the others it just advances.
    btnNext.setAttribute('data-action', this.step === 3 ? 'create' : 'step-next');

    if (!this.selectedSystem) {
      estado.textContent = t('createWorld.state.noSystem');
      return;
    }
    const sistema = this.systems.find((s) => s.id === this.selectedSystem);
    if (this.step === 1) {
      estado.textContent = `${t('createWorld.state.systemPrefix')}${sistema?.title || this.selectedSystem} v${sistema?.version || '?'}`;
    } else if (this.step === 2) {
      estado.textContent = `${t('createWorld.state.namePrefix')}${this.campo('name')?.value.trim() || '—'}`;
    } else {
      estado.textContent = t('createWorld.state.ready');
    }
  }

  private atualizarPrevia(): void {
    const sistema = this.systems.find((s) => s.id === this.selectedSystem);
    const nome = this.campo('name')?.value.trim() || '';
    const capa = this.campo('backgroundUrl')?.value.trim() || '';

    const titulo = this.parte('card-title');
    if (titulo) titulo.textContent = nome || t('createWorld.preview.unnamed');

    const sub = this.parte('card-sub');
    if (sub) sub.textContent = sistema ? `${sistema.title || sistema.id} · v${sistema.version}` : t('createWorld.state.noSystem');

    const desc = this.parte('card-desc');
    if (desc) desc.textContent = this.descricaoTexto() || t('createWorld.preview.noDesc');

    const art = this.parte('card-art');
    if (art) art.style.backgroundImage = `url('${capa || sistema?.backgroundUrl || ART_PADRAO}')`;

    const slug = this.parte('slug');
    if (slug) slug.textContent = `Data/worlds/${this.campo('dataPathName')?.value.trim() || this.slugify(nome)}`;

    this.atualizarBarra();
  }

  private preencherResumo(): void {
    const sistema = this.systems.find((s) => s.id === this.selectedSystem);
    const capa = this.campo('backgroundUrl')?.value.trim() || '';
    const sessao = this.campo('nextSession')?.value || '';

    this.parte('sum-system')!.textContent = sistema
      ? `${sistema.title || sistema.id} v${sistema.version}`
      : '—';
    this.parte('sum-name')!.textContent = this.campo('name')?.value.trim() || t('createWorld.preview.unnamed');
    this.parte('sum-path')!.textContent = `Data/worlds/${this.caminhoAtual()}`;
    this.parte('sum-session')!.textContent = sessao
      ? new Date(sessao).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' })
      : t('createWorld.summary.notScheduled');
    this.parte('sum-bg')!.textContent = capa || t('createWorld.summary.inheritsSystem');
  }

  private caminhoAtual(): string {
    return this.campo('dataPathName')?.value.trim() || this.slugify(this.campo('name')?.value || '');
  }

  private descricaoTexto(): string {
    const html = this.editorEl?.value ?? '';
    return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
  }

  private slugify(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || ''
    );
  }

  private campo(nome: string): HTMLInputElement | null {
    return this.element.querySelector<HTMLInputElement>(`[name="${nome}"]`);
  }

  private parte(nome: string): HTMLElement | null {
    return this.element.querySelector<HTMLElement>(`[data-part="${nome}"]`);
  }

  private pickBackground(): void {
    windowManager.open('file-picker', FilePickerWindow, {
      onSelect: (path: string) => {
        const input = this.campo('backgroundUrl');
        if (input) {
          input.value = path;
          this.atualizarPrevia();
        }
      },
    });
  }

  private async createWorld(): Promise<void> {
    const name = this.campo('name')?.value.trim();
    const caminho = this.caminhoAtual();
    const backgroundUrl = this.campo('backgroundUrl')?.value.trim();
    const nextSession = this.campo('nextSession')?.value;

    if (!name) {
      showToast(t('createWorld.toasts.provideName'), 'error');
      this.irParaEtapa(2);
      this.campo('name')?.focus();
      return;
    }
    const rawCaminho = this.campo('dataPathName')?.value.trim();
    if (rawCaminho && !/^[a-z0-9-]+$/.test(rawCaminho)) {
      showToast(t('createWorld.toasts.invalidDataPath'), 'error');
      this.irParaEtapa(2);
      this.campo('dataPathName')?.focus();
      return;
    }
    if (!this.selectedSystem) {
      showToast(t('createWorld.toasts.chooseSystem'), 'error');
      this.irParaEtapa(1);
      return;
    }

    const btnNext = this.parte('next') as HTMLButtonElement | null;
    const btnBack = this.parte('back') as HTMLButtonElement | null;
    if (btnNext) {
      btnNext.disabled = true;
      btnNext.textContent = t('createWorld.buttons.creating');
    }
    if (btnBack) {
      btnBack.disabled = true;
    }

    try {
      const description = this.editorEl?.value ?? '';
      const created = await api.post<{ id: string }>('/worlds', {
        name,
        system: this.selectedSystem,
        description,
        backgroundUrl: backgroundUrl || '',
        dataPath: caminho ? `Data/worlds/${caminho}` : '',
        nextSession: nextSession || '',
      });
      showToast(t('createWorld.toasts.worldCreated'), 'success');
      this.props.onCreated(created.id);
      this.closeScreen();
    } catch (e: any) {
      // The server already provides the reason (folder in use, duplicate name, permissions).
      // Swallowing this in an "unable to create" leaves the user with no way out.
      const motivo = e?.message ? `: ${e.message}` : '. Check the name and data path.';
      showToast(`${t('createWorld.toasts.notCreated')}${motivo}`, 'error');
    } finally {
      this.atualizarBarra();
    }
  }

  private closeScreen(): void {
    this.destroy();
    this.props.onClose();
  }

  destroy(): void {
    // The File Picker is a window-manager window, so it doesn't die along with
    // this screen's DOM — without this it would stay open over the Setup Hub after
    // leaving here.
    windowManager.close('file-picker');

    super.destroy();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
