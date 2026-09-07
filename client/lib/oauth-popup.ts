/*******************************************************************************
 * LoomVTT
 * client/lib/oauth-popup.ts
 *
 * Secure OAuth popup relay handler. Opens an external authentication window
 * to loomvtt.site, listens for postMessage results, and validates origin strictly.
 ******************************************************************************/

import { api } from '../core/api.js';

export interface OAuthPopupOptions {
  mode: 'player_login' | 'activation' | 'admin_connect';
  worldId?: string;
  /** Provider Supabase a usar no popup. Omitido = 'google' (comportamento anterior). */
  provider?: 'google' | 'discord';
}

export interface OAuthLoginResult {
  exchangeCode: string;
  /** Só preenchido em modo admin_connect — vínculo de instalação renovável. */
  refreshToken?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface OAuthLicensesResult {
  licenses: Array<{
    key: string;
    label?: string;
    createdAt?: string;
  }>;
}

// Nunca hardcoded — o server e' quem sabe qual LOOMSITE usar (LOOM_SITE_URL env
// var, ver server/applications/api/setup.ts /status), pra client e server
// nunca apontarem pra sites diferentes (dev/staging vs producao). Cacheado
// apos a primeira chamada.
let cachedSiteUrl: string | null = null;

async function resolveSiteUrl(): Promise<string> {
  if (cachedSiteUrl) return cachedSiteUrl;
  try {
    const status = await api.get<{ loomSiteUrl?: string }>('/setup/status');
    cachedSiteUrl = status.loomSiteUrl || 'https://loomsite.vercel.app';
  } catch {
    cachedSiteUrl = 'https://loomsite.vercel.app';
  }
  return cachedSiteUrl;
}

// Aquece o cache assim que este módulo é importado — sem isso o primeiro
// clique em "Entrar com Google" faria um fetch antes de abrir a janela, e o
// window.open() deixaria de contar como resposta direta ao gesto do usuário
// (popup bloqueado pelo navegador). Nas chamadas seguintes o cache já resolve
// sem rede nenhuma.
void resolveSiteUrl();

export function openOAuthPopup<T = any>(options: OAuthPopupOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    resolveSiteUrl().then((siteUrl) => {
      const width = 520;
      const height = 680;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

      const siteOrigin = new URL(siteUrl).origin;
      const query = new URLSearchParams({ mode: options.mode });
      if (options.worldId) {
        query.set('worldId', options.worldId);
      }
      if (options.provider) {
        query.set('provider', options.provider);
      }

      const popupUrl = `${siteOrigin}/auth/popup?${query.toString()}`;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no`;

      const popup = window.open(popupUrl, 'loom_oauth_popup', features);
      if (!popup) {
        reject(new Error('Bloqueador de popups impediu a abertura da janela. Por favor, permita popups para este site.'));
        return;
      }

      let isCleanedUp = false;
      let timer: number | null = null;

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        window.removeEventListener('message', onMessage);
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      };

      const onMessage = (event: MessageEvent) => {
        // Validate origin strictly
        if (event.origin !== siteOrigin) {
          return;
        }

        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'LOOM_OAUTH_CANCEL') {
          cleanup();
          reject(new Error('Autenticação cancelada.'));
          return;
        }

        if (data.type === 'LOOM_OAUTH_ERROR') {
          cleanup();
          reject(new Error(data.error || 'Falha na autenticação.'));
          return;
        }

        if (data.type === 'LOOM_OAUTH_SUCCESS' || data.type === 'loom_oauth_result') {
          cleanup();
          resolve(data.payload || data);
        }
      };

      window.addEventListener('message', onMessage);

      // Watch for window being closed by the user
      timer = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('A janela de autenticação foi fechada antes de concluir.'));
        }
      }, 500);
    });
  });
}
