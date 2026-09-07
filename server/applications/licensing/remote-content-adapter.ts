/**
 * Adapter de leitura reforçada — conteúdo licenciado (ex.: Phandelver) nunca
 * materializa completo no SQLite do comprador. Busca sob demanda no Supabase
 * com token curto escopado (RLS), cacheia só em memória com TTL curto. Ver
 * .planning/Handoffs/HANDOFF-marketplace-fase3-adapter-supabase.md.
 */
import logger from '../utils/logger.js';

const LOOMSITE = process.env.LOOM_SITE_URL || 'https://loomsite.vercel.app';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — revalida sem martelar o Supabase a cada leitura

export interface RemoteAdapter {
  /** Nome do pacote licenciado (bate com `packageName` da Fase 1 / `activation_codes`). */
  packageName: string;
  /** Tabela remota no Supabase que guarda o conteúdo de verdade. */
  remoteTable: string;
}

interface CacheEntry { data: any; fetchedAt: number }
const cache = new Map<string, CacheEntry>(); // chave: `${packageName}:${id}` — só em memória, nunca no SQLite

/**
 * Token curto (minutos, não dias) escopado por RLS pra UM registro. Pedido ao
 * LOOMSITE usando o token de conta da Fase 2 — nunca a service_role do Supabase
 * roda fora do LOOMSITE.
 */
async function getScopedToken(accountToken: string, remoteTable: string, id: string): Promise<string> {
  const res = await fetch(`${LOOMSITE}/api/content-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ table: remoteTable, id }),
  });
  if (!res.ok) throw new Error(`LOOMSITE recusou token de conteudo: HTTP ${res.status}`);
  const { scopedToken } = await res.json();
  return scopedToken;
}

/**
 * Busca um registro remoto, com cache em memória de `CACHE_TTL_MS`. `accountToken`
 * vem de `loom-account.ts` (Fase 2) — sem conta conectada, isto lança e o chamador
 * decide o fallback (ver PASSO 2).
 */
export async function fetchRemoteRecord(
  adapter: RemoteAdapter,
  id: string,
  accountToken: string,
): Promise<any | null> {
  const cacheKey = `${adapter.packageName}:${id}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  try {
    const scopedToken = await getScopedToken(accountToken, adapter.remoteTable, id);
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${adapter.remoteTable}?id=eq.${id}`, {
      headers: { Authorization: `Bearer ${scopedToken}`, apikey: scopedToken },
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
    const rows = await res.json();
    const data = rows[0] ?? null;
    if (data) cache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err: any) {
    logger.warn('Falha ao buscar conteudo remoto licenciado', { table: adapter.remoteTable, id, error: err.message });
    // Fail-closed aqui, ao contrario da Fase 2: e' conteudo pago, sem token valido
    // nao mostra nada — nao e' um gate de sessao (nao derruba o mundo), e' so' esse
    // registro que fica indisponivel ate a rede/token voltar.
    return null;
  }
}
