/*******************************************************************************
 * LoomVTT
 * server/applications/middleware/mutation-loop-guard.ts
 *
 *
 * Component Version 1.0.0
 * Disjuntor por recurso: nenhum bug de sistema convertido (render/WS que
 * realimenta submit → broadcast → re-render → submit) pode martelar o mesmo
 * documento indefinidamente e travar o navegador do cliente. O rate limit
 * global de /api (server/index.ts) é permissivo demais pra pegar isso a
 * tempo — esse guard é bem mais estreito e corta por recurso específico.
 ******************************************************************************/

import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 1000;
const LIMIT = 3;
const hits = new Map<string, number[]>();

// Limpeza periódica pra não vazar memória com IDs antigos.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((ts) => ts > cutoff);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, WINDOW_MS).unref();

/** Aplicar em rotas de mutação (PUT/PATCH/DELETE) que recebem `:id` — chave por método+caminho,
 * então cada documento tem seu próprio contador, sem afetar tráfego legítimo de outros. */
export function mutationLoopGuard(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.method} ${req.baseUrl}${req.path}`;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (hits.get(key) || []).filter((ts) => ts > cutoff);
  timestamps.push(now);
  hits.set(key, timestamps);

  if (timestamps.length > LIMIT) {
    // Log do payload real na primeira vez que o disjuntor abre pra esse recurso nesta
    // janela — sem isto o toast avisa QUE tem loop mas nunca O QUE está sendo escrito
    // repetidamente, obrigando a adivinhar. Só loga uma vez por estouro (não a cada
    // request bloqueada) pra não inundar o terminal.
    if (timestamps.length === LIMIT + 1) {
      console.warn(`[mutation-loop-guard] ${key} — payload do request que estourou:`, JSON.stringify(req.body));
    }
    res.status(429).json({
      error: `Loop de atualização detectado neste recurso (${timestamps.length}x em ${WINDOW_MS}ms) — bloqueado para proteger o servidor e o navegador do cliente.`,
    });
    return;
  }
  next();
}
