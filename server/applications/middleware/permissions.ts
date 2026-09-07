import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db.js';

/**
 * Express middleware to enforce a world-configurable permission (e.g. "compendiumEdit").
 * GM (role >= 4) always passes. Others need their role listed in world.permissions[key] (an
 */
export function requirePermission(key: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if ((req as any).auth?.admin || isGM(req)) return next();
      const worldId = (req as any).auth?.worldId;
      if (!worldId) return res.status(403).json({ error: `Permission "${key}" requires Gamemaster.` });
      const world = await db('worlds').where({ id: worldId }).first();
      let perms: Record<string, number[]> = {};
      try { perms = typeof world?.permissions === 'string' ? JSON.parse(world.permissions) : (world?.permissions || {}); } catch { perms = {}; }
      const grantedRoles = Array.isArray(perms[key]) ? perms[key] : [];
      if (!grantedRoles.includes(getUserRole(req))) {
        return res.status(403).json({ error: `Permission "${key}" required.` });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}

export function getUserId(req: any): string | null {
  return req.auth?.userId ?? null;
}

export function getUserRole(req: any): number {
  return req.auth?.userRole !== undefined ? Number(req.auth.userRole) : 0;
}

export function isGM(req: any): boolean {
  // Admin session (Setup Hub cookie) outranks every in-game role but carries no userRole
  // of its own — requireAuth prefers it over the world token whenever both cookies exist,
  // so without this it silently 403s a real GM whose browser also has the admin cookie set.
  if (req.auth?.admin) return true;
  return getUserRole(req) >= 4;
}

export function buildOwnership(userId: string): string {
  return JSON.stringify({ [userId]: 3 });
}

function parseOwnership(ownership: string | Record<string, number> | null | undefined): Record<string, number> | null {
  if (!ownership) return null;
  if (typeof ownership === 'object') return ownership;
  try {
    return JSON.parse(ownership);
  } catch {
    return null;
  }
}

export function canView(ownership: string | Record<string, number> | null | undefined, defaultPerm: number, userId: string | null): boolean {
  const map = parseOwnership(ownership);
  // Ownership vazio (documento sem dono definido) usa o defaultPerm do
  // caller, nao acesso liberado — sem isso todo documento sem dono vira
  // publico pra qualquer jogador (ver document.ts create()).
  if (!map || Object.keys(map).length === 0) return defaultPerm >= 2;
  const effectiveDefault = map.default ?? defaultPerm;
  if (!userId) return effectiveDefault >= 2;
  const userPerm = map[userId] ?? 0;
  return userPerm >= 1 || effectiveDefault >= 2;
}

/**
 * Nivel efetivo de visao (0 Nenhum, 1 Limitado, 2 Observador, 3 Proprietario).
 * Mesma regra do canView, mas devolve o numero em vez de sim/nao — usado
 * pra decidir o quanto do documento mostrar (visao recortada em nivel 1).
 */
export function getPermLevel(ownership: string | Record<string, number> | null | undefined, defaultPerm: number, userId: string | null): number {
  const map = parseOwnership(ownership);
  if (!map || Object.keys(map).length === 0) return defaultPerm;
  const effectiveDefault = map.default ?? defaultPerm;
  const userPerm = userId ? (map[userId] ?? 0) : 0;
  if (userPerm >= 1) return userPerm;
  if (effectiveDefault >= 2) return effectiveDefault;
  return 0;
}

export function canEdit(ownership: string | Record<string, number> | null | undefined, userId: string | null): boolean {
  const map = parseOwnership(ownership);
  // Ownership vazio = ninguem alem do GM edita (isGM ja e checado antes de
  // canEdit em todo call site) — nao "liberado geral".
  if (!map || Object.keys(map).length === 0) return false;
  if (!userId) return false;
  return (map[userId] ?? map.default ?? 0) >= 3;
}

/**
 * Express middleware to enforce GM-only routes
 */
export function requireGM(req: Request, res: Response, next: NextFunction) {
  if (!isGM(req)) {
    return res.status(403).json({ error: 'Gamemaster permission required' });
  }
  next();
}

/**
 * Express middleware to enforce Ownership check for a record in a database table
 */
export function requireOwnership(table: string, idParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params[idParam];
      const userId = getUserId(req);
      if (isGM(req)) return next();

      const record = await db(table).where({ id }).first();
      if (!record) return res.status(404).json({ error: 'Record not found' });

      if (!canEdit(record.ownership, userId)) {
        return res.status(403).json({ error: 'Access denied: you do not own this document' });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
