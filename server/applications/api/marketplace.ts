import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

import { requireAdminSession } from './setup.js';
import { SettingsDocument } from '../schemas/settings.schema.js';
import { PackagesDocument } from '../schemas/packages.schema.js';
import { getDataRoot, db } from '../database/db.js';
import { installFromUrl, uninstallPackage, checkForUpdate, fetchRemoteManifest, validateLoomManifest } from '../addons/installer.js';
import { Signal } from '../signals/index.js';
import { loadAllAddons } from '../addons/loader.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import { ActivationCodesDocument } from '../schemas/activation_codes.schema.js';
import { PackageManager } from '../database/managers/package-manager.js';

const packageManagerForCodes = PackageManager.getInstance();

/** `LOOM-XXXX-XXXX-XXXX`, alfanumérico maiúsculo — fácil de digitar, difícil de adivinhar. */
function generateCode(): string {
  const chunk = () => crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 4);
  return `LOOM-${chunk()}-${chunk()}-${chunk()}`;
}

export const marketplaceRouter = Router();

const DEFAULT_MARKETPLACE_ROOT = path.join(getDataRoot(), 'marketplace');

async function getMarketplaceRoot(): Promise<string> {
  try {
    const row = await SettingsDocument.findOne<any>({ key: 'data_root' });
    if (row?.value && typeof row.value === 'string' && row.value.trim()) {
      return row.value.trim();
    }
  } catch {
    // settings table may not exist yet during first boot — fall through
  }
  return DEFAULT_MARKETPLACE_ROOT;
}


/**
 * `Dirent.isDirectory()` reflete o tipo bruto devolvido pelo `readdir` — pra
 * Junctions/symlinks do Windows (o jeito normal de um dev linkar uma pasta
 * de trabalho pra dentro do marketplace) isso vem `false`, mesmo apontando
 * pra um diretório de verdade. Sem seguir o link com `stat`, o pacote inteiro
 * era ignorado antes até de tentar ler o manifesto — silenciosamente, sem
 * nenhum log em lugar nenhum.
 */
async function isEffectivelyDirectory(dirent: import('fs').Dirent, fullPath: string): Promise<boolean> {
  if (dirent.isDirectory()) return true;
  if (!dirent.isSymbolicLink()) return false;
  try {
    return (await fs.stat(fullPath)).isDirectory();
  } catch {
    return false;
  }
}

async function readManifest(root: string, type: 'addon' | 'ruleset', name: string) {
  const folder = type === 'addon' ? 'addons' : 'rulesets';
  const filename = type === 'addon' ? 'addon.json' : 'ruleset.json';
  const manifestPath = path.join(root, folder, name, filename);
  const raw = await fs.readFile(manifestPath, 'utf-8');
  return { manifestPath, manifest: JSON.parse(raw) };
}

/** `ruleset.json` pode declarar `backgroundUrl` (arte de capa do sistema) — usado como
 * fallback quando um mundo ainda não definiu a própria arte (tela de login, cards do
 * Setup Hub). Retorna '' se o ruleset não existir ou não declarar o campo. */
export async function getRulesetBackgroundUrl(systemName: string): Promise<string> {
  if (!systemName) return '';
  try {
    const root = await getMarketplaceRoot();
    const { manifest } = await readManifest(root, 'ruleset', systemName);
    return typeof manifest.backgroundUrl === 'string' ? manifest.backgroundUrl : '';
  } catch {
    return '';
  }
}

async function writeManifest(manifestPath: string, manifest: any) {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

/**
 * Espelha os addon.json do disco pra dentro da tabela `packages`, que é a
 * fonte de verdade pra ativação POR MUNDO via `world_packages`. Sem isso,
 * `POST /api/worlds/:worldId/packages` nunca encontra o pacote (tabela vazia).
 * Só addons são sincronizados — rulesets são escolhidos via `world.system`,
 * não têm toggle por mundo.
 */
export async function syncPackagesTable(): Promise<void> {
  const root = await getMarketplaceRoot();
  const addonDirs = await fs.readdir(path.join(root, 'addons'), { withFileTypes: true }).catch(() => []);

  for (const dirent of addonDirs) {
    if (!(await isEffectivelyDirectory(dirent, path.join(root, 'addons', dirent.name)))) continue;
    try {
      const { manifest } = await readManifest(root, 'addon', dirent.name);
      const id = manifest.name ?? dirent.name;
      const data = {
        name: manifest.title ?? id,
        type: 'addon',
        version: manifest.version ?? '1.0.0',
        description: manifest.description ?? '',
        manifest: manifest,
        author: manifest.author ?? '',
        isActive: manifest.active !== false,
        updatedAt: new Date().toISOString(),
      };
      const existing = await PackagesDocument.findById(id);
      if (existing) {
        await PackagesDocument.update(id, data);
      } else {
        await PackagesDocument.create({ id, ...data });
      }
    } catch (err: any) {
      logger.warn(`[Marketplace] Failed to sync package "${dirent.name}" into packages table`, { error: err.message });
    }
  }
}

marketplaceRouter.get('/packages', async (req, res) => {
  try {
    const root = await getMarketplaceRoot();
    const [addonDirs, rulesetDirs] = await Promise.all([
      fs.readdir(path.join(root, 'addons'), { withFileTypes: true }).catch(() => []),
      fs.readdir(path.join(root, 'rulesets'), { withFileTypes: true }).catch(() => []),
    ]);

    // Per-world addon toggle (Setup Hub / in-game "Gerenciamento de Módulos",
    // world_packages table) is opt-in per world — "Gerenciamento de Módulos"
    // itself already shows every addon UNCHECKED by default (0 enabled) the
    // moment it's installed, before anyone touches anything. loadClientAddons()
    // used to ignore that entirely and just load anything with manifest
    // `active !== false`, so an addon loaded (and registered its settings)
    // for every world regardless of what that screen showed. With `worldId`,
    // an addon is only active here if this world has an EXPLICIT
    // enabled:true row — no row (never toggled) means off, matching the
    // toggle screen's own default. Without `worldId` (e.g. Setup Hub's
    // global package list, not scoped to a world) it still falls back to
    // the manifest's own `active` flag.
    const worldId = typeof req.query.worldId === 'string' ? req.query.worldId : undefined;
    let worldEnabled: Set<string> | null = null;
    if (worldId) {
      const associations = await db('world_packages').where({ worldId, enabled: true });
      worldEnabled = new Set(associations.map((a: any) => a.packageId));
    }

    const packages: Array<Record<string, any>> = [];

    for (const dirent of addonDirs) {
      if (!(await isEffectivelyDirectory(dirent, path.join(root, 'addons', dirent.name)))) continue;
      try {
        const { manifest } = await readManifest(root, 'addon', dirent.name);
        const name = manifest.name ?? dirent.name;
        const active = worldEnabled ? worldEnabled.has(name) : manifest.active;
        packages.push({ type: 'addon', name: dirent.name, ...manifest, active });
      } catch (err: any) {
        logger.warn(`[Marketplace] Failed to read addon manifest for "${dirent.name}"`, { error: err.message });
      }
    }

    for (const dirent of rulesetDirs) {
      if (!(await isEffectivelyDirectory(dirent, path.join(root, 'rulesets', dirent.name)))) continue;
      try {
        const { manifest } = await readManifest(root, 'ruleset', dirent.name);
        packages.push({ type: 'ruleset', name: dirent.name, ...manifest });
      } catch (err: any) {
        logger.warn(`[Marketplace] Failed to read ruleset manifest for "${dirent.name}"`, { error: err.message });
      }
    }

    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Catálogo da comunidade (Loom Hub) — CONSULTA apenas, nunca baixa nada
// daqui. Isto so' devolve `manifest_url`; o download em si continua indo
// pelo pipeline existente `installFromUrl` (installer.ts), que ja' restringe
// hosts a github.com/raw.githubusercontent.com/etc — o Supabase e' so' um
// indice de busca, nao um host de download.
// ---------------------------------------------------------------------------

const CATALOG_SUPABASE_URL = 'https://lrujswcjzetqhehznnwd.supabase.co';
const CATALOG_SUPABASE_ANON_KEY = 'sb_publishable_kqSbS1iegyBfXnqXJ5nT2g_mFV2fsoc';
const CATALOG_SELECT = 'id,title,short_description,type,category,version,min_loom_version,manifest_url,banner_url,profiles(username)';

marketplaceRouter.get('/catalog', async (req, res) => {
  try {
    const { type, category, q } = req.query as { type?: string; category?: string; q?: string };

    const params = new URLSearchParams();
    params.set('select', CATALOG_SELECT);
    params.set('status', 'eq.approved');
    params.set('order', 'created_at.desc');
    if (type && type !== 'all') params.set('type', `eq.${type}`);
    if (category && category !== 'all') params.set('category', `eq.${category}`);
    if (q && q.trim()) {
      const term = q.trim().replace(/[%,]/g, '');
      params.set('or', `(title.ilike.*${term}*,short_description.ilike.*${term}*)`);
    }

    const response = await fetch(`${CATALOG_SUPABASE_URL}/rest/v1/packages?${params.toString()}`, {
      headers: {
        apikey: CATALOG_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CATALOG_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Loom Hub respondeu HTTP ${response.status}`);
    }

    const rows = await response.json();
    res.json({ packages: rows });
  } catch (err: any) {
    logger.warn('[Marketplace] Failed to fetch community catalog', { error: err.message });
    res.status(502).json({ error: 'Não foi possível carregar o catálogo do Loom Hub.' });
  }
});

marketplaceRouter.post('/:type/:name/activate', requireAdminSession, async (req, res) => {
  try {
    const root = await getMarketplaceRoot();
    const type = req.params.type === 'ruleset' ? 'ruleset' : 'addon';
    const { manifestPath, manifest } = await readManifest(root, type, req.params.name);
    manifest.active = true;
    await writeManifest(manifestPath, manifest);
    res.json({ success: true, type, name: req.params.name, active: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

marketplaceRouter.post('/:type/:name/deactivate', requireAdminSession, async (req, res) => {
  try {
    const root = await getMarketplaceRoot();
    const type = req.params.type === 'ruleset' ? 'ruleset' : 'addon';
    const { manifestPath, manifest } = await readManifest(root, type, req.params.name);
    manifest.active = false;
    await writeManifest(manifestPath, manifest);
    res.json({ success: true, type, name: req.params.name, active: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/marketplace/:type/:name/manifest — edita metadado do pacote instalado
// (versão, autor, dependências, conflitos...) direto no addon.json/ruleset.json.
// Nunca aceita `core`/`client`/`name`/`settings`/`compendiums` — isso é código/
// estrutura do addon, não metadado editável pelo Setup Hub.
const EDITABLE_MANIFEST_FIELDS = ['title', 'version', 'author', 'repository', 'description', 'dependencies', 'conflicts'] as const;

marketplaceRouter.put('/:type/:name/manifest', requireAdminSession, async (req, res) => {
  try {
    const root = await getMarketplaceRoot();
    const type = req.params.type === 'ruleset' ? 'ruleset' : 'addon';
    const { manifestPath, manifest } = await readManifest(root, type, req.params.name);

    for (const field of EDITABLE_MANIFEST_FIELDS) {
      if (req.body[field] === undefined) continue;
      if (field === 'dependencies' || field === 'conflicts') {
        if (!Array.isArray(req.body[field])) return res.status(400).json({ error: `${field} must be an array.` });
        manifest[field] = req.body[field].filter((v: any) => typeof v === 'string');
      } else {
        manifest[field] = String(req.body[field]);
      }
    }

    await writeManifest(manifestPath, manifest);
    res.json({ success: true, type, name: req.params.name, manifest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Códigos de ativação (Fase 1 do marketplace pago) ─────────────────────
// Gerar código: acao de admin, sem consumidor de UI ainda (venda e' manual,
// fora do app). Resgatar: por-mundo, uso unico, ja ativa o pacote no passo.
marketplaceRouter.post('/codes/generate', requireAdminSession, async (req, res) => {
  try {
    const { packageName, quantity } = req.body as { packageName?: string; quantity?: number };
    if (!packageName || typeof packageName !== 'string') {
      return res.status(400).json({ error: 'packageName is required' });
    }
    const qty = Math.min(Math.max(Number(quantity) || 1, 1), 100);
    const now = new Date().toISOString();
    const codes: string[] = [];
    for (let i = 0; i < qty; i++) {
      const code = generateCode();
      await ActivationCodesDocument.create({
        id: `code-${crypto.randomUUID()}`,
        code,
        packageName,
        used: false,
        worldId: '',
        redeemedAt: '',
        createdAt: now,
      });
      codes.push(code);
    }
    res.json({ codes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

marketplaceRouter.post('/redeem', requireAdminSession, async (req, res) => {
  try {
    const { code, worldId } = req.body as { code?: string; worldId?: string };
    if (!code || !worldId) {
      return res.status(400).json({ error: 'code and worldId are required' });
    }

    const row = await ActivationCodesDocument.findOne<any>({ code: code.trim() });
    if (!row) {
      return res.status(404).json({ error: 'Codigo nao encontrado' });
    }
    if (row.used) {
      return res.status(409).json({ error: 'Codigo ja foi usado' });
    }

    const root = await getMarketplaceRoot();
    // O pacote precisa existir no disco/tabela packages pra ativar de verdade —
    // codigo valido nao basta se o addon nao foi instalado no servidor ainda.
    const pkg = await PackagesDocument.findById<any>(row.packageName).catch(() => null);
    if (!pkg) {
      return res.status(404).json({ error: `Pacote "${row.packageName}" nao esta instalado neste servidor` });
    }

    await ActivationCodesDocument.update(row.id, {
      used: true,
      worldId,
      redeemedAt: new Date().toISOString(),
    });

    await packageManagerForCodes.addWorldPackage(worldId, row.packageName, {});

    res.json({ success: true, packageName: row.packageName, worldId });
  } catch (err: any) {
    logger.error('Redeem endpoint error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Install from URL ──────────────────────────────────────────────────────
marketplaceRouter.post('/install', requireAdminSession, async (req, res) => {
  try {
    const { manifestUrl, type, operationId } = req.body;
    if (!manifestUrl) {
      return res.status(400).json({ error: 'manifestUrl is required' });
    }
    const pkgType: 'addon' | 'ruleset' = type === 'ruleset' ? 'ruleset' : 'addon';

    const opId = operationId || manifestUrl;

    const result = await installFromUrl(manifestUrl, pkgType, (p) => {
      Signal.broadcast('operation.progress', { operationId: opId, ...p });
    });

    if (result.success) {
      Signal.broadcast('addon.installed', { type: pkgType, name: result.name, version: result.version });
      void loadAllAddons();
    }

    res.json(result);
  } catch (err: any) {
    logger.error('Install endpoint error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Uninstall ─────────────────────────────────────────────────────────────
marketplaceRouter.delete('/:type/:name', requireAdminSession, async (req, res) => {
  try {
    const type = req.params.type === 'ruleset' ? 'ruleset' : 'addon';
    const name = req.params.name;
    const result = await uninstallPackage(name, type);

    if (result.success) {
      Signal.broadcast('addon.uninstalled', { type, name });
      void loadAllAddons();
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Check for updates ────────────────────────────────────────────────────
marketplaceRouter.get('/:type/:name/update-check', requireAdminSession, async (req, res) => {
  try {
    const type = req.params.type === 'ruleset' ? 'ruleset' : 'addon';
    const result = await checkForUpdate(req.params.name, type);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Check for updates across every installed package (usado pelo sino de
// notificações do Setup Hub) ──────────────────────────────────────────────
marketplaceRouter.get('/updates', requireAdminSession, async (_req, res) => {
  try {
    const root = await getMarketplaceRoot();
    const [addonDirs, rulesetDirs] = await Promise.all([
      fs.readdir(path.join(root, 'addons'), { withFileTypes: true }).catch(() => []),
      fs.readdir(path.join(root, 'rulesets'), { withFileTypes: true }).catch(() => []),
    ]);

    const installed: Array<{ type: 'addon' | 'ruleset'; name: string; title?: string }> = [];
    for (const dirent of addonDirs) {
      if (!(await isEffectivelyDirectory(dirent, path.join(root, 'addons', dirent.name)))) continue;
      try {
        const { manifest } = await readManifest(root, 'addon', dirent.name);
        installed.push({ type: 'addon', name: dirent.name, title: manifest.title });
      } catch { /* pacote sem manifest legivel, ignora na checagem */ }
    }
    for (const dirent of rulesetDirs) {
      if (!(await isEffectivelyDirectory(dirent, path.join(root, 'rulesets', dirent.name)))) continue;
      try {
        const { manifest } = await readManifest(root, 'ruleset', dirent.name);
        installed.push({ type: 'ruleset', name: dirent.name, title: manifest.title });
      } catch { /* pacote sem manifest legivel, ignora na checagem */ }
    }

    const results = await Promise.all(
      installed.map(async (pkg) => ({ ...pkg, ...(await checkForUpdate(pkg.name, pkg.type)) })),
    );

    res.json({ updates: results.filter((r) => r.hasUpdate) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fetch remote manifest (preview before installing) ────────────────────
marketplaceRouter.post('/fetch-manifest', requireAdminSession, async (req, res) => {
  try {
    const { manifestUrl } = req.body;
    if (!manifestUrl) {
      return res.status(400).json({ error: 'manifestUrl is required' });
    }
    const manifest = await fetchRemoteManifest(manifestUrl);
    // Mesmo portao da instalacao: sem isso o preview mostraria um pacote de outro
    // VTT como instalavel e a recusa so apareceria depois do clique em instalar.
    const pkgType = req.body?.type === 'ruleset' ? 'ruleset' : 'addon';
    const gate = validateLoomManifest(manifest, pkgType);
    if (!gate.ok) {
      return res.status(400).json({ error: gate.error });
    }
    res.json({ manifest, warning: gate.warning });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
