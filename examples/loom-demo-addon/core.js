// ══════════════════════════════════════════════════════════════
// Loom Demo Addon — core.js (server-side entry point)
// ══════════════════════════════════════════════════════════════
//
// Only runs because addon.json declares `"core": "core.js"`. This is an
// addon-only capability — rulesets never get a `core.js` executed (see
// server/applications/addons/loader.ts: `if (!manifest.core || type ===
// 'ruleset') { ...skip... }`). It runs ONCE, at server boot, in the same
// Node process as the rest of the app — full access to the database and
// every internal module, no sandbox. That's real power (and real
// responsibility): see the addon-creation.md "Server-side & Database"
// section for what that means for a third-party addon you didn't write.
//
// Two server-side extension points are demonstrated here:
//   1. registerAddonRoutes() — your own REST API, namespaced under
//      /api/addons/loom-demo-addon/*, so the client can persist real data.
//   2. Signal.listen() — react to something the CORE already broadcasts,
//      no route needed for this half.
import { Router } from 'express';
import { registerAddonRoutes } from '../../../server/applications/addons/addon-api.js';
import { db } from '../../../server/applications/database/db.js';
import { Signal } from '../../../server/applications/signals/index.js';

const ADDON_NAME = 'loom-demo-addon';
const TABLE = 'loom_demo_addon_notes';

// ── Database ─────────────────────────────────────────────────
// `db` is a knex instance that always points at whichever world is
// currently active (see server/applications/database/db.ts) — the server
// runs one world's database at a time, so there's no worldId to filter by
// in the query itself, just like every other per-world table in core
// (compendium_packs, actors, etc). No hook fires specifically for "a
// world's DB just became ready", so this checks/creates the table lazily,
// the first time it's actually needed — cheap after that first call.
//
// LoomVTT is relational-only end to end (knex/SQLite or knex/Postgres,
// depending on the world's config) — never reach for a NoSQL client here,
// there isn't one wired into the app to reach for.
async function ensureTable() {
  if (!(await db.schema.hasTable(TABLE))) {
    await db.schema.createTable(TABLE, (t) => {
      t.string('worldId').primary();
      t.text('text').defaultTo('');
      t.timestamps(true, true, true);
    });
  }
}

// ── REST API ──────────────────────────────────────────────────
// A plain Express Router — nothing addon-specific about its shape. What
// makes it an ADDON's router (vs. a core one) is only how it gets mounted:
// registerAddonRoutes() below puts it at /api/addons/loom-demo-addon/*,
// with `requireAuth` already applied for you. `req.auth` (worldId/admin) is
// there the same way it is in every core route.
const router = Router();

router.get('/notes', async (req, res) => {
  try {
    const worldId = req.auth?.worldId;
    if (!worldId) return res.status(400).json({ error: 'No active world session.' });
    await ensureTable();
    const row = await db(TABLE).where({ worldId }).first();
    res.json({ text: row?.text ?? '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/notes', async (req, res) => {
  try {
    const worldId = req.auth?.worldId;
    if (!worldId) return res.status(400).json({ error: 'No active world session.' });
    await ensureTable();
    const text = String(req.body?.text ?? '');
    const existing = await db(TABLE).where({ worldId }).first();
    if (existing) {
      await db(TABLE).where({ worldId }).update({ text, updatedAt: new Date().toISOString() });
    } else {
      await db(TABLE).insert({ worldId, text });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

registerAddonRoutes(ADDON_NAME, router);

// ── Reacting to a core Signal ────────────────────────────────
// The OTHER server extension point: no route at all, just listening to
// something the core already fires. `Signal` is a plain in-process
// EventEmitter (server/applications/signals/index.ts) — it never reaches
// the browser by itself; it's for server-side code reacting to server-side
// events. Swap 'cast.created' for any Signal.broadcast(...) call you find
// elsewhere in server/applications/api/*.ts.
Signal.listen('cast.created', (data) => {
  console.log(`[${ADDON_NAME}] A cast member was created:`, data?.id);
});

console.log(`[${ADDON_NAME}] core.js loaded (server-side)`);
