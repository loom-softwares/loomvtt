/**
 * Vínculo com a Conta Loom central (LOOMSITE) — Fase 2 do marketplace. Guarda
 * token/refresh no loom.config.json do mundo, nunca senha. Ver
 * .planning/Handoffs/HANDOFF-marketplace-fase2-conta-loom-central.md.
 */
import fs from 'fs/promises';
import crypto from 'crypto';
import { getConfigPath } from '../database/db.js';
import { LicenseManager } from './license-manager.js';
import logger from '../utils/logger.js';

// Token/refreshToken da Conta Loom não podem ficar em texto plano no
// loom.config.json (achado de security review: qualquer leitura do arquivo
// no disco expunha a conta vinculada). Chave derivada do mesmo machineId já
// usado pelo Soft Lock de licença — não é segredo forte (reconstruível por
// quem já tem acesso à máquina), mas impede que copiar/abrir o arquivo sozinho
// baste para roubar a conta. Prefixo "enc:v1:" marca o novo formato, o resto
// dos campos do link continuam legíveis normalmente.
const ENC_PREFIX = 'enc:v1:';

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(LicenseManager.getMachineId()).digest();
}

function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decryptField(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value; // link salvo antes desta correção
  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Config copiado de outra maquina (machineId diferente) ou corrompido —
    // tratar como desconectado em vez de derrubar o app.
    return '';
  }
}

// TODO: trocar o fallback pra 'https://loomvtt.site' quando o dominio de
// producao existir de verdade. Por enquanto aponta pro deploy de teste na
// Vercel — loomvtt.site nao resolve ainda (DNS_PROBE_FINISHED_NXDOMAIN).
const LOOMSITE = process.env.LOOM_SITE_URL || 'https://loomsite.vercel.app';
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias offline = "stale", nao desconecta

export type LoomAccountRole = 'comprador' | 'editora' | 'admin';

interface LoomAccountLink {
  accountId: string;
  role: LoomAccountRole;
  displayName: string;
  avatarUrl: string;
  token: string;
  refreshToken: string;
  lastVerifiedAt: number; // epoch ms
}

async function readLink(): Promise<LoomAccountLink | null> {
  try {
    const config = JSON.parse(await fs.readFile(getConfigPath(), 'utf8'));
    const link = config.loomAccount ?? null;
    if (!link) return null;
    return { ...link, token: decryptField(link.token), refreshToken: decryptField(link.refreshToken) };
  } catch {
    return null;
  }
}

async function writeLink(link: LoomAccountLink | null): Promise<void> {
  let config: any = {};
  try {
    config = JSON.parse(await fs.readFile(getConfigPath(), 'utf8'));
  } catch {
    // loom.config.json ainda nao existe — segue com config vazio
  }
  config.loomAccount = link
    ? { ...link, token: encryptField(link.token), refreshToken: encryptField(link.refreshToken) }
    : null;
  await fs.writeFile(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export async function getAccountStatus(): Promise<
  | { connected: false }
  | { connected: true; accountId: string; role: LoomAccountRole; displayName: string; avatarUrl: string; stale: boolean }
> {
  const link = await readLink();
  if (!link) return { connected: false };
  return {
    connected: true,
    accountId: link.accountId,
    role: link.role,
    displayName: link.displayName,
    avatarUrl: link.avatarUrl || '',
    stale: Date.now() - link.lastVerifiedAt > STALE_AFTER_MS,
  };
}

/** true = ok pra prosseguir com uma acao que exige entitlement pago (compra/ativacao). */
export async function isFreshEnoughForPurchase(): Promise<boolean> {
  const link = await readLink();
  if (!link) return false;
  return Date.now() - link.lastVerifiedAt <= STALE_AFTER_MS;
}

/**
 * Conecta a conta central via popup OAuth (um clique, sem colar codigo) — o
 * client so manda um exchangeCode opaco de uso unico devolvido pelo popup;
 * quem verifica e resolve pra accountId/token de verdade e' sempre o
 * LOOMSITE, nunca o client. Mesmo padrao anti-spoofing do oauth-join de
 * jogador, mas devolvendo token/refreshToken (vinculo de instalacao de
 * verdade, nao so identidade).
 */
export async function connectWithGoogleExchange(exchangeCode: string, refreshToken?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${LOOMSITE}/api/oauth/admin-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeCode, refreshToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as any);
      return { ok: false, error: body.error || 'Codigo OAuth invalido ou expirado' };
    }
    const data = await res.json();
    await writeLink({
      accountId: data.accountId,
      role: data.role,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || '',
      token: data.token,
      refreshToken: data.refreshToken,
      lastVerifiedAt: Date.now(),
    });
    return { ok: true };
  } catch (err: any) {
    // Node/undici embrulha a causa real em err.cause — logar so' err.message
    // sempre dava so' "fetch failed", sem dizer se foi DNS, TLS, timeout, etc.
    logger.error('Falha ao conectar Conta Loom via Google', {
      error: err.message,
      cause: err.cause ? String(err.cause) : undefined,
      loomsite: LOOMSITE,
    });
    return { ok: false, error: `Sem conexao com ${LOOMSITE}` };
  }
}

export async function disconnectAccount(): Promise<void> {
  await writeLink(null);
}

/**
 * Renovacao silenciosa em background. Fail-open: qualquer erro de rede so'
 * deixa a conta "stale" (ver STALE_AFTER_MS) — nunca desconecta sozinha. Um
 * `401` explicito do LOOMSITE (refresh token revogado) e' o unico gatilho de
 * desconexao automatica.
 */
export async function backgroundRenewAccount(): Promise<void> {
  const link = await readLink();
  if (!link) return;

  try {
    const res = await fetch(`${LOOMSITE}/api/account-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: link.refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) {
      logger.warn('Conta Loom revogada pelo site — desconectando');
      await writeLink(null);
      return;
    }

    if (res.ok) {
      const data = await res.json();
      await writeLink({ ...link, token: data.token, refreshToken: data.refreshToken, lastVerifiedAt: Date.now() });
    }
    // 5xx e outros — ignora, fail-open, link atual continua valendo ate ficar stale.
  } catch {
    // Timeout, DNS, sem internet — fail-open.
  }
}
