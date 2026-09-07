import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { db } from '../database/db.js';
import { activeWorldId } from '../database/world-db.js';
import crypto from 'crypto';

// Persistido no banco (mesmo esquema do jwtSecret abaixo) — nao regenera a
// cada restart normal do processo (isso derrubava a sessao de admin em TODO
// dispositivo/navegador toda vez que o server reiniciava, ex: apos um crash,
// update, ou simplesmente `tsx watch` recarregando em dev). So muda se
// alguem apagar a linha `boot_id` da tabela `settings` de proposito — ainda
// da pra forcar logout geral assim quando precisar de verdade.
let bootId: string | null = null;

async function getBootId(): Promise<string> {
  if (bootId) return bootId;

  const row = await db('settings').where({ key: 'boot_id' }).first();
  if (row?.value) {
    bootId = row.value as string;
    return bootId;
  }

  const generated = crypto.randomBytes(8).toString('hex');
  await db('settings').insert({ key: 'boot_id', value: generated });
  bootId = generated;
  return bootId;
}

let jwtSecret: string | null = null;

async function getJwtSecret(): Promise<string> {
  if (jwtSecret) return jwtSecret;

  if (process.env.JWT_SECRET) {
    jwtSecret = process.env.JWT_SECRET;
    return jwtSecret;
  }

  const row = await db('settings').where({ key: 'jwt_secret' }).first();
  if (row?.value) {
    jwtSecret = row.value as string;
    return jwtSecret;
  }

  const secret = `jwt-${crypto.randomBytes(32).toString('hex')}`;
  await db('settings').insert({ key: 'jwt_secret', value: secret });
  jwtSecret = secret;
  return jwtSecret;
}

// So' uma sessao de admin valida por vez — duas pessoas (ou a mesma pessoa em
// dois navegadores) editando mundo/config ao mesmo tempo e' um jeito facil de
// corromper coisa (dois PUT concorrentes na mesma linha). Diferente do
// bootId: esse MUDA a cada login novo, de proposito.
//
// Login novo NAO derruba a sessao ativa silenciosamente — se teve atividade
// recente (ADMIN_SESSION_IDLE_MS), o login e' recusado a menos que venha com
// force:true (o dono real sempre consegue confirmar, sabe a senha). Sessao
// abandonada (sem atividade ha' mais tempo que isso) pode ser assumida sem
// forcar — evita trancar o admin de fora pra sempre por causa de um
// navegador que travou/fechou sem "logout" explicito.
const ADMIN_SESSION_IDLE_MS = 5 * 60 * 1000; // 5 min sem /verify = considera abandonada

export async function issueNewAdminSessionId(): Promise<string> {
  const generated = crypto.randomBytes(8).toString('hex');
  const existing = await db('settings').where({ key: 'admin_session_id' }).first();
  if (existing) {
    await db('settings').where({ key: 'admin_session_id' }).update({ value: generated });
  } else {
    await db('settings').insert({ key: 'admin_session_id', value: generated });
  }
  await touchAdminSession();
  return generated;
}

async function getCurrentAdminSessionId(): Promise<string | null> {
  const row = await db('settings').where({ key: 'admin_session_id' }).first();
  return (row?.value as string) || null;
}

// So' em memoria, de proposito (nao persiste no banco como bootId/adminSessionId)
// — um restart do servidor ja destrava sozinho qualquer bloqueio de "sessao
// ativa em outro lugar" sem precisar esperar os 5 min, mesmo que o navegador
// que estava "ativo" tenha sumido de vez.
let adminSessionLastSeenAt = 0;

/** Marca "sessao de admin usada agora" — chamado a cada /verify e a cada rota
 * autenticada como admin, pra saber se a sessao atual ainda esta' viva. */
export async function touchAdminSession(): Promise<void> {
  adminSessionLastSeenAt = Date.now();
}

/** true = existe sessao de admin com atividade recente (outro login deveria
 * pedir confirmacao antes de derrubar). false = nao tem sessao, ou ela esta'
 * abandonada ha' tempo suficiente pra ser assumida sem perguntar. */
export async function hasRecentAdminActivity(): Promise<boolean> {
  const sessionRow = await db('settings').where({ key: 'admin_session_id' }).first();
  if (!sessionRow?.value) return false;
  return Date.now() - adminSessionLastSeenAt < ADMIN_SESSION_IDLE_MS;
}

export interface JwtPayload {
  userId?: string;
  userName?: string;
  userRole?: number;
  userColor?: string;
  worldId?: string;
  admin?: boolean;
  /** Internal — injected by signToken, checked by verifyToken. Not meant to be set by callers. */
  bootId?: string;
  /** Internal, so' presente em token de admin — checado contra o valor atual em
   * `settings` pra permitir so' uma sessao de admin viva por vez. */
  adminSessionId?: string;
}

export async function signToken(payload: JwtPayload, expiresIn: string | number = '24h'): Promise<string> {
  const [secret, boot] = await Promise.all([getJwtSecret(), getBootId()]);
  const extra: Partial<JwtPayload> = {};
  if (payload.admin) {
    extra.adminSessionId = await issueNewAdminSessionId();
  }
  return jwt.sign({ ...payload, ...extra, bootId: boot }, secret, { expiresIn: expiresIn as any });
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const [secret, boot] = await Promise.all([getJwtSecret(), getBootId()]);
    const payload = jwt.verify(token, secret) as JwtPayload;
    if (payload.admin) {
      const currentAdminSessionId = await getCurrentAdminSessionId();
      if (!currentAdminSessionId || payload.adminSessionId !== currentAdminSessionId) return null;
      void touchAdminSession(); // fire-and-forget, nao atrasa a resposta
    }
    if (payload.bootId !== boot) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Distingue "essa sessao de admin foi substituida por um login em outro lugar" de
 * qualquer outro motivo de token invalido (expirado, corrompido, restart) — so' pra
 * dar uma mensagem clara em vez de um "sessao invalida" generico e confuso. */
export async function wasAdminSessionReplaced(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = await getJwtSecret();
    const payload = jwt.verify(token, secret) as JwtPayload;
    if (!payload.admin) return false;
    const currentAdminSessionId = await getCurrentAdminSessionId();
    return !!currentAdminSessionId && payload.adminSessionId !== currentAdminSessionId;
  } catch {
    return false;
  }
}

// Admin (Setup Hub) and world (jogo) são sessões independentes — cookies separados
// para que entrar num mundo como jogador não derrube a sessão de admin, e vice-versa.
export const ADMIN_COOKIE = 'loom_admin_token';
export const WORLD_COOKIE = 'loom_world_token';

export function extractToken(req: any, cookieName: string = ADMIN_COOKIE): string | null {
  // Fallback de header `Authorization: Bearer` removido (security review): nenhum
  // client ou integração interna o usa — sessão sempre vem do cookie HttpOnly.
  // Aceitar Bearer também deixava o token vazar por logs/proxies de request que
  // registram headers, sem nenhum ganho de funcionalidade real.
  return req.cookies?.[cookieName] ?? null;
}

export async function requireAdmin(req: any, res: any, next: any) {
  const token = extractToken(req, ADMIN_COOKIE);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  if (!payload.admin) return res.status(403).json({ error: 'Admin access required' });

  req.auth = payload;
  next();
}

export async function requireAuth(req: any, res: any, next: any) {
  // Sessao de mundo manda dentro do mundo — mesmo um admin logado como
  // "Jogador" numa sessao fica limitado ao papel daquele token ali. Poder de
  // admin so vale fora de sessao de mundo (rotas do Setup Hub usam
  // requireAdmin, que le o cookie de admin direto e nao passa por aqui).
  const worldToken = extractToken(req, WORLD_COOKIE);
  if (worldToken) {
    const payload = await verifyToken(worldToken);
    if (payload) {
      req.auth = payload;
      return next();
    }
  }

  const adminToken = extractToken(req, ADMIN_COOKIE);
  if (!adminToken) return res.status(401).json({ error: 'Authentication required' });

  const payload = await verifyToken(adminToken);
  if (!payload?.admin) return res.status(401).json({ error: 'Invalid or expired token' });

  req.auth = payload;
  next();
}

/**
 * Opcoes de cookie de sessao.
 *
 * `secure` nao pode depender de NODE_ENV: nada no fluxo do Electron/instalador
 * define essa variavel, entao a flag ficava permanentemente falsa — inclusive
 * com o tunnel publico ativo. Passa a derivar do protocolo real da requisicao,
 * que so e confiavel porque `app.set('trust proxy', 1)` esta configurado
 * (Tarefa 1). Sem aquilo, `req.secure` e sempre false atras do cloudflared.
 */
export function sessionCookieOptions(req: Request) {
  const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000,
  };
}

/** Rejects if the request targets a worldId different from the one the token was issued for. Admin tokens bypass this (they have no worldId). Supports worldId in req.params, req.query, and req.body. */
export function requireWorldMatch(req: any, res: any, next: any) {
  if (req.auth?.admin) return next();
  const claimed = req.params?.worldId || req.query?.worldId || req.body?.worldId;
  if (claimed && req.auth?.worldId && claimed !== req.auth.worldId) {
    return res.status(403).json({ error: 'Token does not belong to this world' });
  }
  // O core só roda um mundo ativo por vez — `db(tableName)` sempre resolve pro
  // banco de `activeWorldId` no momento em que a query roda, não pro mundo do
  // token. Se o GM trocou de mundo ativo depois que esta sessão logou, o token
  // ainda é válido mas aponta pro mundo ERRADO — sem essa checagem a query ia
  // silenciosamente parar no banco do mundo novo em vez de falhar. Sessão de
  // admin (sem worldId) e requisições que não miram um mundo específico não
  // se aplicam aqui.
  if (req.auth?.worldId && activeWorldId && req.auth.worldId !== activeWorldId) {
    return res.status(409).json({ error: 'This world is no longer active on the server. Please log in again.' });
  }
  next();
}
