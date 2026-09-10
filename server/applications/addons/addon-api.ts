/*******************************************************************************
 * LoomVTT
 * server/applications/addons/addon-api.ts
 *
 *
 * Lets an addon's own `core.js` expose REST routes without touching the main
 * Express `app` (never exported — an addon getting the raw app instance could
 * override core routes, add middleware ahead of auth, etc). Each addon gets
 * its own namespace instead: `POST registerAddonRoutes('my-addon', router)`
 * mounts that router at `/api/addons/my-addon/...`, with `requireAuth`
 * applied centrally so the addon never has to remember to guard it.
 *
 * Mounted ONCE at boot (see server/index.ts) at a fixed point before the SPA
 * catch-all — `core.js` runs during `loadAllAddons()`, which happens AFTER
 * that mount, so routes registered here take effect immediately without any
 * ordering dance on the addon's side.
 ******************************************************************************/

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

export const addonsRouter = Router();

const registeredNames = new Set<string>();

/** Addon `core.js` calls this once, at import time, with its own Router.
 * Ends up reachable at `/api/addons/<name>/...`. Calling it twice for the
 * same name (e.g. addon reloaded via marketplace install) stacks a second
 * router instead of replacing the first — harmless (the old one just never
 * matches anything new), but not something to rely on; restart the server
 * after changing an addon's route set. */
export function registerAddonRoutes(name: string, router: Router): void {
  addonsRouter.use(`/${name}`, requireAuth, router);
  if (registeredNames.has(name)) {
    logger.warn(`[AddonAPI] "${name}" registered routes more than once this boot — old router stays mounted too`, { name });
  }
  registeredNames.add(name);
  logger.info(`[AddonAPI] Routes registered for addon "${name}" at /api/addons/${name}`);
}
