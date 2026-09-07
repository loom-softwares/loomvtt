import { BaseComponent } from '../../components/base-component.js';
import { api } from '../../core/api.js';
import { router } from '../../core/screen-router.js';
import { showToast } from '../../components/toast.js';
import { copyTextToClipboard } from '../../lib/clipboard.js';
import { clog } from '../../lib/client-logger.js';
import { openOAuthPopup } from '../../lib/oauth-popup.js';

interface World {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  backgroundUrl?: string;
  system?: string;
  systemTitle?: string;
  nextSession?: string;
}

interface User {
  id: string;
  name: string;
  role: number;
  /** Already comes from `GET /worlds/:id/users` — they are in the user schema and
   * were only missing from the local type. Without `avatarUrl`, it falls back to the circle with the
   * initial painted in the user's own color. */
  avatarUrl?: string;
  color?: string;
  colorHex?: string;
  /** 'loom_site' = vinculado a conta Google — nunca tem senha local, precisa
   * usar o botão "Entrar com Google", não o formulário nome+senha. */
  authProvider?: string;
}

const PALETA_PADRAO = '#5f73d8';

/** How many faces the presence stack shows before turning into "+N". */
const MAX_EMPILHADOS = 8;

/** Ceiling for drawn suggestions per search. Nobody reads the 30th line of a
 * list, and rendering hundreds of <li> on every keystroke freezes typing. */
const MAX_SUGESTOES = 8;

export class WorldLoginScreen extends BaseComponent {
  private world: World | null = null;
  private users: User[] = [];
  private onlineUserIds: string[] = [];
  private hasAdminSession = false;
  private tunnelUrl: string | null = null;
  private selectedUserId = '';

  constructor(
    container: HTMLElement,
    private props: { worldId: string; session?: any },
  ) {
    super(container);
    this.load();
  }

  private async load(): Promise<void> {
    // Já tem sessão de mundo válida nesse navegador (ex: logou com Google antes,
    // ou é o próprio Admin com sessão de jogo aberta) — pula a tela de login e
    // entra direto, igual o bootstrap já faz em client/main.ts no F5. Sem isso,
    // "Entrar na mesa" sempre mostrava o formulário de novo mesmo já logado.
    try {
      const existing = await api.get<{ valid: boolean; session?: any }>('/worlds/session/verify');
      if (existing.valid && existing.session?.worldId === this.props.worldId) {
        await router.navigate('game-hud', { session: existing.session, worldId: this.props.worldId });
        return;
      }
    } catch {
      // sem sessão válida — segue pro fluxo normal de login abaixo
    }

    try {
      this.world = await api.get<World>(`/worlds/${this.props.worldId}`);
      const world = this.world;
      if (world?.system) {
        try {
          const { packages } = await api.get<{ packages: { name: string; title?: string }[] }>('/marketplace/packages');
          const pkg = packages.find((p) => p.name === world.system);
          if (pkg?.title) {
            world.systemTitle = pkg.title;
          } else {
            clog.warn(`[WORLD-LOGIN] Sistema "${world.system}" do mundo não foi encontrado em /marketplace/packages`);
          }
        } catch (e) {
          clog.error(`[WORLD-LOGIN] Falha ao buscar título do sistema "${world.system}": ${e instanceof Error ? (e.stack || e.message) : String(e)}`);
        }
      }
      this.users = await api.get<User[]>(`/worlds/${this.props.worldId}/users`);
      this.onlineUserIds = await api.get<string[]>(`/worlds/${this.props.worldId}/online-users`);
    } catch (e) {
      // Fallback screen no template() já trata este erro visualmente com botão de retorno
    }
    try {
      const verify = await api.get<{ valid: boolean; admin: boolean }>('/setup/verify');
      this.hasAdminSession = !!(verify.valid && verify.admin);
    } catch {
      this.hasAdminSession = false;
    }
    // Only admin sees the tunnel URL (the route requires admin session) — they are
    // the one who shares the link with players.
    if (this.hasAdminSession) {
      try {
        const st = await api.get<{ running: boolean; url: string | null }>('/tunnel/status');
        this.tunnelUrl = st.running ? st.url : null;
      } catch {
        this.tunnelUrl = null;
      }
    }
    this.render();
  }

  protected template(): string {
    if (!this.world) {
      return `
        <div class="world-gate">
          <div class="wg-art is-blank"></div>
          <div class="wg-failure">
            <h1>Mundo não carregou</h1>
            <p>A conexão com o servidor falhou. Verifique se ele ainda está no ar e tente de novo.</p>
            <button type="button" class="wg-btn wg-btn-quiet" data-action="back">Voltar à configuração</button>
          </div>
        </div>
      `;
    }

    const bgUrl = this.world.backgroundUrl || this.world.coverUrl || '';
    const onlineCount = this.onlineUserIds.length;
    const totalCount = this.users.length;
    const nextSessionLabel = this.world.nextSession
      ? new Date(this.world.nextSession).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'Não agendada';
    const descricao = this.descriptionText(this.world.description);

    // Presence is read-only and never exceeds the table size, so it fits
    // stacked. Choosing who you are became a search, on the other side of the banner.
    const online = this.users.filter((u) => this.onlineUserIds.includes(u.id));
    const presenca =
      online.length === 0
        ? '<p class="wg-nobody">Ninguém entrou ainda. Você seria o primeiro.</p>'
        : `<ul class="wg-stack">
            ${online
              .slice(0, MAX_EMPILHADOS)
              .map((u) => `<li title="${this.escapeHtml(u.name)}">${this.faceHtml(u)}</li>`)
              .join('')}
            ${online.length > MAX_EMPILHADOS
              ? `<li><span class="wg-more">+${online.length - MAX_EMPILHADOS}</span></li>`
              : ''}
          </ul>`;

    return `
      <div class="world-gate">
        <div class="wg-art ${bgUrl ? '' : 'is-blank'}"
             ${bgUrl ? `style="background-image: url('${this.escapeHtml(bgUrl)}')"` : ''}></div>

        <header class="wg-top">
          <span class="wg-mark">
            <img src="/images/loom-logo.png" alt="" />
            <span class="wg-brand">LOOM</span>
          </span>
          <span class="wg-rule"></span>
          <div class="wg-exit">
            ${this.hasAdminSession ? '' : `
              <input type="password" name="adminPassword" placeholder="Senha do administrador" />
            `}
            <button type="button" class="wg-link" data-action="back">Voltar à configuração</button>
          </div>
          ${this.tunnelUrl ? `
          <div class="wg-tunnel">
            <span class="wg-tunnel-label">Link externo</span>
            <input type="text" readonly value="${this.escapeHtml(this.tunnelUrl)}" />
            <button type="button" class="wg-link" data-action="copy-tunnel">Copiar</button>
          </div>` : ''}
        </header>

        <div class="wg-mid">
          <div class="wg-world">
            <p class="wg-kicker">Sessão aberta</p>
            <h1 class="wg-name">${this.escapeHtml(this.world.name)}</h1>
            ${descricao ? `<p class="wg-desc">${this.escapeHtml(descricao)}</p>` : ''}
            <dl class="wg-facts">
              ${this.world.system ? `
              <div class="wg-fact">
                <dt>Sistema</dt>
                <dd>${this.escapeHtml(this.world.systemTitle || this.world.system)}</dd>
              </div>` : ''}
              <div class="wg-fact">
                <dt>Próxima sessão</dt>
                <dd>${nextSessionLabel}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="wg-gate">
          <div class="wg-roster-side">
            <p class="wg-gate-label">Na sessão agora — <b>${onlineCount}</b> de ${totalCount}</p>
            ${presenca}
          </div>

          <div class="wg-form-side">
            <div class="wg-entry">
              <div class="wg-combo">
                <label for="wg-search">Quem é você?</label>
                <ul class="wg-suggest" id="wg-suggest" data-part="suggest" role="listbox" hidden></ul>
                <input type="text" id="wg-search" class="wg-search" placeholder="Digite seu nome"
                       autocomplete="off" role="combobox" aria-expanded="false"
                       aria-controls="wg-suggest" aria-autocomplete="list" />
                <div class="wg-chosen" data-part="chosen" hidden>
                  <span class="wg-face" data-part="chosen-face"></span>
                  <span class="wg-chosen-name" data-part="chosen-name"></span>
                  <button type="button" class="wg-link" data-action="clear-user">Trocar</button>
                </div>
              </div>
              <div class="wg-field">
                <label for="wg-pass">Senha</label>
                <input type="password" id="wg-pass" name="password"
                       placeholder="Escolha seu nome primeiro" disabled />
              </div>
              <div class="wg-actions-row">
                <button type="button" class="wg-btn" data-part="enter" data-action="join" disabled>Entrar</button>
                <button type="button" class="wg-btn-google-icon" data-action="google-login-icon" title="Entrar com Google" aria-label="Entrar com Google">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </button>
                <button type="button" class="wg-btn-discord-icon" data-action="discord-login-icon" title="Entrar com Discord" aria-label="Entrar com Discord">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#5865F2" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.86-.61 1.25a18.27 18.27 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C1.05 8.6.32 12.7.65 16.76a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.24.2.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.37 1.23 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.4-4.7-.66-8.76-2.79-12.36a.06.06 0 0 0-.03-.03zM8.68 14.3c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42zm6.65 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42z"/>
                  </svg>
                </button>
              </div>
            </div>
            <p class="wg-hint" data-part="hint">
              Comece a digitar seu nome. Quem já está na sessão não pode entrar de novo.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  render(): void {
    super.render();

    // Typing does not go through `data-action` dispatch, which only handles click and
    // change — the combo listeners are bound here, after each render.
    const busca = this.element.querySelector<HTMLInputElement>('.wg-search');
    if (!busca) return;

    busca.addEventListener('input', () => this.sugerir(busca.value));
    busca.addEventListener('focus', () => this.sugerir(busca.value));

    busca.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.fecharSugestoes();
      } else if (e.key === 'Enter') {
        // Enter picks the first usable suggestion — without this, whoever types
        // the entire name and presses Enter doesn't get anywhere.
        e.preventDefault();
        const primeira = this.element.querySelector<HTMLButtonElement>('.wg-opt:not(:disabled)');
        if (primeira) this.pickUser(primeira.dataset.id ?? null);
      }
    });

    // Clicking outside closes the list. Bound to the document because the click can
    // happen anywhere on the screen, outside the component's root.
    document.addEventListener('click', this.aoClicarFora);
  }

  private aoClicarFora = (e: MouseEvent): void => {
    if (!this.element.querySelector('.wg-combo')?.contains(e.target as Node)) {
      this.fecharSugestoes();
    }
  };

  /** Draws suggestions that match the typed text. Comparison without
   * accents and case-insensitive: "tereza" finds "Terêza". */
  private sugerir(texto: string): void {
    const lista = this.element.querySelector<HTMLElement>('[data-part="suggest"]');
    const campo = this.element.querySelector<HTMLInputElement>('.wg-search');
    if (!lista || !campo) return;

    const alvo = this.normalizar(texto);
    const achados = this.users.filter((u) => !alvo || this.normalizar(u.name).includes(alvo));

    if (achados.length === 0) {
      lista.innerHTML = '<li class="wg-suggest-empty">Nenhum nome com esse texto.</li>';
    } else {
      lista.innerHTML = achados
        .slice(0, MAX_SUGESTOES)
        .map((u) => {
          const conectado = this.onlineUserIds.includes(u.id);
          const papel = ['Nenhum', 'Jogador', 'Jogador Confiável', 'Assistente GM', 'Gamemaster'][u.role] || '';
          return `
            <li>
              <button type="button" class="wg-opt" role="option" data-action="pick-user"
                      data-id="${this.escapeHtml(u.id)}" ${conectado ? 'disabled' : ''}>
                ${this.faceHtml(u)}
                <span class="wg-opt-name">${this.escapeHtml(u.name)}</span>
                <span class="wg-opt-tag">${conectado ? 'já na sessão' : this.escapeHtml(papel)}</span>
              </button>
            </li>
          `;
        })
        .join('');
    }

    lista.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
  }

  private fecharSugestoes(): void {
    const lista = this.element.querySelector<HTMLElement>('[data-part="suggest"]');
    if (lista) lista.hidden = true;
    this.element.querySelector('.wg-search')?.setAttribute('aria-expanded', 'false');
  }

  /** Avatar circle. Without `avatarUrl`, it turns into the initial in the person's color. */
  private faceHtml(u: User): string {
    const cor = u.colorHex || u.color || PALETA_PADRAO;
    const corpo = u.avatarUrl
      ? `<img src="${this.escapeHtml(u.avatarUrl)}" alt="" />`
      : this.escapeHtml((u.name || '?').trim().charAt(0).toUpperCase());
    return `<span class="wg-face" style="background: ${this.escapeHtml(cor)}">${corpo}</span>`;
  }

  private normalizar(texto: string): string {
    return (texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  protected onAction(
    action: string,
    id: string | null,
    target: HTMLElement,
  ): void {
    if (action === 'join') {
      this.joinGame();
    } else if (action === 'pick-user') {
      this.pickUser(id);
    } else if (action === 'clear-user') {
      this.clearUser();
    } else if (action === 'back') {
      this.goBack();
    } else if (action === 'copy-tunnel') {
      const ok = this.tunnelUrl ? copyTextToClipboard(this.tunnelUrl) : false;
      showToast(ok ? 'Copiado para área de transferência' : 'Falha ao copiar', ok ? 'success' : 'error');
    } else if (action === 'google-login' || action === 'google-login-icon') {
      void this.loginWithProvider('google');
    } else if (action === 'discord-login' || action === 'discord-login-icon') {
      void this.loginWithProvider('discord');
    }
  }

  /** Chooses who will enter. The search field gives way to the avatar with the name,
   * and the password only unlocks after that. */
  private pickUser(id: string | null): void {
    if (!id) return;
    const user = this.users.find((u) => u.id === id);
    if (!user || this.onlineUserIds.includes(user.id)) return;

    this.selectedUserId = id;
    this.fecharSugestoes();

    const campo = this.element.querySelector<HTMLInputElement>('.wg-search');
    if (campo) campo.hidden = true;

    const escolhido = this.element.querySelector<HTMLElement>('[data-part="chosen"]');
    if (escolhido) escolhido.hidden = false;

    const rosto = this.element.querySelector<HTMLElement>('[data-part="chosen-face"]');
    if (rosto) rosto.outerHTML = this.faceHtml(user).replace('class="wg-face"', 'class="wg-face" data-part="chosen-face"');

    const nome = this.element.querySelector<HTMLElement>('[data-part="chosen-name"]');
    if (nome) nome.textContent = user.name;

    const senha = this.element.querySelector<HTMLInputElement>('[name="password"]');
    const dica = this.element.querySelector<HTMLElement>('[data-part="hint"]');

    this.setGoogleEntryMode(user.authProvider === 'loom_site');

    if (user.authProvider === 'loom_site') {
      // Conta vinculada ao Google nunca tem senha local — formulário nome+senha
      // é um beco sem saída pra ela. O botão ENTRAR virou o botão do Google
      // (setGoogleEntryMode acima); o campo de senha nem aparece mais.
      if (dica) dica.textContent = `${user.name} está vinculado à conta Google.`;
      return;
    }

    if (senha) {
      senha.disabled = false;
      senha.placeholder = 'Senha';
      senha.focus();
    }
    const entrar = this.element.querySelector<HTMLButtonElement>('[data-part="enter"]');
    if (entrar) entrar.disabled = false;
    if (dica) dica.textContent = `Entrando como ${user.name}.`;
  }

  /** Alterna o botão principal entre "Entrar" (nome+senha) e "Entrar com Google"
   * (conta vinculada) — evita ter dois botões de entrar visíveis ao mesmo tempo,
   * já que fazem a mesma coisa (autenticar) por caminhos diferentes. */
  private setGoogleEntryMode(isGoogle: boolean): void {
    const entrar = this.element.querySelector<HTMLButtonElement>('[data-part="enter"]');
    const campoSenha = this.element.querySelector<HTMLElement>('.wg-field');
    const btnGoogleIcon = this.element.querySelector<HTMLElement>('.wg-btn-google-icon');

    // style.display direto, nao o atributo `hidden` — o CSS dessas classes
    // tem `display: flex` proprio que ganha do `[hidden] { display: none }`
    // padrao do navegador (mesma especificidade, ordem no stylesheet decide).
    if (campoSenha) campoSenha.style.display = isGoogle ? 'none' : '';
    // Quando o proprio ENTRAR vira o botao do Google, o iconzinho ao lado fica
    // redundante — os dois fariam a mesma coisa.
    if (btnGoogleIcon) btnGoogleIcon.style.display = isGoogle ? 'none' : '';

    if (!entrar) return;
    if (isGoogle) {
      entrar.dataset.action = 'google-login';
      entrar.disabled = false;
      entrar.innerHTML = `
        <svg class="google-icon" width="16" height="16" viewBox="0 0 24 24" style="vertical-align: -3px; margin-right: 6px;">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Entrar com Google`;
    } else {
      entrar.dataset.action = 'join';
      entrar.textContent = 'Entrar';
    }
  }

  /** Goes back to the search field without reloading the screen. */
  private clearUser(): void {
    this.selectedUserId = '';
    this.setGoogleEntryMode(false);

    const escolhido = this.element.querySelector<HTMLElement>('[data-part="chosen"]');
    if (escolhido) escolhido.hidden = true;

    const campo = this.element.querySelector<HTMLInputElement>('.wg-search');
    if (campo) {
      campo.hidden = false;
      campo.value = '';
      campo.focus();
    }

    const senha = this.element.querySelector<HTMLInputElement>('[name="password"]');
    if (senha) {
      senha.value = '';
      senha.disabled = true;
      senha.placeholder = 'Escolha seu nome primeiro';
    }

    const entrar = this.element.querySelector<HTMLButtonElement>('[data-part="enter"]');
    if (entrar) entrar.disabled = true;

    const dica = this.element.querySelector<HTMLElement>('[data-part="hint"]');
    if (dica) dica.textContent = 'Comece a digitar seu nome. Quem já está na sessão não pode entrar de novo.';
  }

  private async joinGame(): Promise<void> {
    const userId = this.selectedUserId;
    const password = this.element.querySelector<HTMLInputElement>(
      '[name="password"]',
    )?.value;

    if (!userId) {
      showToast('Escolha seu nome na lista', 'error');
      return;
    }

    try {
      const result = await api.post<{ session: any }>(
        `/worlds/${this.props.worldId}/join`,
        { userId, password: password || '' },
      );

      showToast('Conectado com sucesso', 'success');
      setTimeout(() => window.location.reload(), 200);
    } catch (e: any) {
      if (e?.status === 401) {
        showToast(e?.message || 'Senha incorreta', 'error');
      } else if (e?.status === 403) {
        const msg = e?.message || 'Acesso negado: aguardando aprovação do Mestre';
        showToast(msg, 'info');
        this.showPendingApproval(msg);
      } else {
        showToast(e?.message || 'Erro ao conectar ao jogo', 'error');
      }
    }
  }

  private showPendingApproval(message: string): void {
    const hint = this.element.querySelector<HTMLElement>('[data-part="hint"]');
    if (hint) {
      hint.innerHTML = `<span style="color: var(--color-warning, #fbbf24); font-weight: 500;">⏳ ${message}</span>`;
    }
  }

  /** Login via provider social (Google ou Discord) — o servidor não distingue qual foi
   * usado, só valida a sessão Supabase que o popup devolve (exchange.js é agnóstico de
   * provider), então os dois caminhos convergem pro mesmo /oauth-join. */
  private async loginWithProvider(provider: 'google' | 'discord'): Promise<void> {
    // Pode ser o ícone pequeno (conta local ainda não escolhida) ou o próprio ENTRAR
    // (conta já vinculada) — desabilita todos os botões de provider, só um existe
    // visível por vez mas não custa nada cobrir todos.
    const btns = this.element.querySelectorAll<HTMLButtonElement>(
      '[data-action="google-login"], [data-action="google-login-icon"], [data-action="discord-login"], [data-action="discord-login-icon"]',
    );
    btns.forEach((b) => { b.disabled = true; });

    const providerLabel = provider === 'discord' ? 'Discord' : 'Google';

    try {
      const res = await openOAuthPopup<{ exchangeCode?: string }>({
        mode: 'player_login',
        worldId: this.props.worldId,
        provider,
      });

      if (!res?.exchangeCode) {
        throw new Error('Código de autorização não recebido.');
      }

      const joinRes = await api.post<{ pending: boolean; message?: string; session?: any }>(
        `/worlds/${this.props.worldId}/oauth-join`,
        { exchangeCode: res.exchangeCode },
      );

      if (joinRes.pending) {
        const msg = joinRes.message || 'Solicitação enviada. Aguardando aprovação do Mestre.';
        showToast(msg, 'info');
        this.showPendingApproval('Sua conta foi vinculada e está aguardando aprovação do Mestre desta mesa.');
      } else {
        showToast('Conectado com sucesso!', 'success');
        setTimeout(() => window.location.reload(), 200);
      }
    } catch (err: any) {
      showToast(err?.message || `Falha ao autenticar com ${providerLabel}`, 'error');
    } finally {
      btns.forEach((b) => { b.disabled = false; });
    }
  }

  private async goBack(): Promise<void> {
    // A rota /worlds/deactivate ja exige sessao de admin valida no servidor
    // (requireAdminSession) — se o navegador ja tem o cookie, tenta direto,
    // sem pedir senha de novo por cima (isso derrubava sessao valida sem
    // necessidade, chamando /setup/login e regenerando sessao a toa).
    try {
      await api.post('/worlds/deactivate', {});
      setTimeout(() => window.location.reload(), 200);
      return;
    } catch (e: any) {
      if (e?.status !== 401) {
        showToast(e?.message || 'Erro ao desativar mundo', 'error');
        return;
      }
      // Sem sessao de admin nenhuma — precisa da senha mesmo.
    }

    const password = this.element.querySelector<HTMLInputElement>(
      '[name="adminPassword"]',
    )?.value;
    if (!password) {
      showToast('Digite a senha do administrador', 'error');
      return;
    }
    try {
      await api.post('/setup/login', { password });
      await api.post('/worlds/deactivate', {});
      setTimeout(() => window.location.reload(), 200);
    } catch (e: any) {
      if (e?.status === 401) {
        showToast('Senha incorreta', 'error');
      } else {
        showToast(e?.message || 'Erro ao desativar mundo', 'error');
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Pure text of a description that might come as HTML or plain text.
   *
   * Uses DOMParser intentionally, and not `innerHTML` in a detached element: detached
   * element still triggers resource loading, so `<img src=x onerror=...>`
   * would execute. This matters here because this screen is seen by every player BEFORE
   * authenticating, and the description is written by the GM — rendering raw HTML would cause XSS.
   */
  private descriptionText(raw?: string): string {
    if (!raw) return '';
    try {
      return new DOMParser().parseFromString(raw, 'text/html').body.textContent?.trim() ?? '';
    } catch {
      return raw.trim();
    }
  }

  destroy(): void {
    // The "click outside" listener lives on the document, not on the component's root:
    // without removing it here, every opening of this screen would leave one more behind.
    document.removeEventListener('click', this.aoClicarFora);
    super.destroy();
  }
}
