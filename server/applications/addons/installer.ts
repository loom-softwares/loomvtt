/**
 * core/src/addons/installer.ts
 *
 * Downloads and installs addons/rulesets from GitHub releases.
 *
 * Manifest contract (addon.json / ruleset.json):
 *   "manifest"  — URL to the raw manifest JSON on GitHub (used to check updates & resolve releases)
 *   "download"  — URL to a .zip release archive (direct download or GitHub release asset)
 *
 * GitHub Release flow:
 *   1. Fetch the manifest URL → parse it to get "download" (or auto-resolve from GitHub API)
 *   2. Download the .zip to a temp directory
 *   3. Extract into marketplace/addons/<name>/ or marketplace/rulesets/<name>/
 *   4. Validate the extracted manifest exists
 *   5. Clean up temp files
 */

import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWriteStream, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { getDataRoot } from '../database/db.js';

interface RemoteManifest {
  name: string;
  title?: string;
  version?: string;
  author?: string;
  description?: string;
  download?: string;
  manifest?: string;
  /** Marcador obrigatorio — ver validateLoomManifest(). */
  engine?: string;
  /** Faixa de versao do Loom exigida pelo pacote (ex.: ">=0.1.0"). */
  engineVersion?: string;
  /** 'addon' | 'ruleset' — conferido contra o tipo escolhido pelo usuario. */
  type?: string;
}

/**
 * Marcador positivo obrigatorio no manifest. O portao e allowlist, nao blocklist:
 * so instala o que se declara do Loom. Detectar "os outros VTTs" nao funciona —
 * sempre aparece um novo, e os campos comuns (name/version/download) sao iguais
 * em todos.
 */
export const LOOM_ENGINE = 'loom';

/**
 * Impressao digital de manifests de outros VTTs.
 *
 * Usado SO para montar a mensagem de erro — nunca para decidir. A decisao e o
 * marcador positivo acima. Isso existe porque a confusao e legitima: o formato e
 * parecido o bastante para alguem colar um system.json, e
 * recusar com "manifest invalido" faz parecer bug nosso.
 */
function detectForeignVTT(manifest: Record<string, unknown>): boolean {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(manifest, k);
  return has('compatibility') || has('esmodules') || has('packs') || has('relationships');
}

/** Versao do proprio Loom, para conferir `engineVersion`. `null` = nao descobriu. */
let _appVersion: string | null | undefined;
function getAppVersion(): string | null {
  if (_appVersion !== undefined) return _appVersion;
  _appVersion = null;
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    // Sobe procurando o package.json da raiz — funciona tanto rodando de
    // server/ quanto de dist/, sem depender do layout de build.
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
        if (pkg?.name === 'loomvtt' && pkg?.version) {
          _appVersion = pkg.version;
          break;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Fica null de proposito: sem versao conhecida, a checagem de engineVersion
    // vira no-op em vez de barrar pacote legitimo.
  }
  if (!_appVersion) logger.warn('Nao foi possivel resolver a versao do Loom — engineVersion nao sera checado');
  return _appVersion ?? null;
}

/** Compara "1.2.10" vs "1.2.9" numericamente, campo a campo. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Portao de instalacao — roda ANTES de baixar qualquer byte.
 *
 * Antes disso existir, um manifest de outro VTT passava batido: o zip inteiro era
 * baixado e extraido em disco, e so entao a ausencia de addon.json reprovava.
 */
export function validateLoomManifest(
  manifest: RemoteManifest,
  expectedType: 'addon' | 'ruleset',
): { ok: true; warning?: string } | { ok: false; error: string } {
  const raw = manifest as unknown as Record<string, unknown>;

  if (manifest.engine !== LOOM_ENGINE) {
    if (detectForeignVTT(raw)) {
      return {
        ok: false,
        error:
          `Este manifest parece ser de outro VTT, nao do LoomVTT. O formato e parecido, mas ` +
          `a API que o pacote usa em tempo de execucao e outra — instalar nao faria ele funcionar.`,
      };
    }
    return {
      ok: false,
      error:
        `Manifest sem o campo "engine": "${LOOM_ENGINE}". Pacotes do LoomVTT precisam se ` +
        `declarar explicitamente; sem isso nao ha como saber se o pacote e compativel.`,
    };
  }

  if (!manifest.name || !/^[a-zA-Z0-9_-]+$/.test(manifest.name)) {
    return { ok: false, error: 'Nome de pacote invalido no manifest (use apenas letras, numeros, hifen e underscore).' };
  }

  if (manifest.type && manifest.type !== expectedType) {
    return {
      ok: false,
      error: `Este pacote e do tipo "${manifest.type}", mas foi escolhido instalar como "${expectedType}".`,
    };
  }

  if (manifest.engineVersion) {
    const appVersion = getAppVersion();
    // Aceita 1 ou 2 clausulas separadas por espaco (min e/ou max), ex.:
    // ">=1.0.0", "<2.0.0" ou ">=1.0.0 <2.0.0". Vale igual pra addon e ruleset
    // — os dois passam por essa mesma funcao.
    // `engineVersion` e informativo (pra saber contra qual versao do Loom o pacote foi
    // feito), nao um portao rigido — uma clausula fora do formato esperado so vira
    // warning no log e e ignorada, nunca bloqueia a instalacao inteira por causa disso.
    const clauses = manifest.engineVersion.trim().split(/\s+/);
    const parsed: Array<{ op: '>=' | '<=' | '>' | '<' | '='; version: string }> = [];
    for (const clause of clauses) {
      const m = clause.match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+)*)$/);
      if (!m) {
        logger.warn(`Clausula de engineVersion ignorada (formato invalido): "${clause}" em "${manifest.engineVersion}"`, { package: manifest.name });
        continue;
      }
      parsed.push({ op: (m[1] as any) || '>=', version: m[2] });
    }
    if (appVersion) {
      for (const { op, version: required } of parsed) {
        const cmp = compareVersions(appVersion, required);
        const satisfied = op === '=' ? cmp === 0 : op === '>' ? cmp > 0 : op === '<' ? cmp < 0 : op === '<=' ? cmp <= 0 : cmp >= 0;
        if (!satisfied) {
          // Fora da faixa declarada NAO bloqueia — so avisa. Um addon feito pra
          // Loom 1.x pode funcionar perfeitamente no 2.x (ou nao); quem decide se
          // instala mesmo assim e quem esta instalando, nao esse portao.
          return {
            ok: true,
            warning: `Este pacote foi feito para LoomVTT ${op} ${required}, mas esta instalacao e a ${appVersion} — pode haver incompatibilidade.`,
          };
        }
      }
    }
  }

  return { ok: true };
}

export interface InstallResult {
  success: boolean;
  name: string;
  type: 'addon' | 'ruleset';
  version?: string;
  error?: string;
  /** Aviso não-bloqueante (ex: engineVersion fora da faixa declarada). */
  warning?: string;
}

function getMarketplaceRoot(): string {
  return path.join(getDataRoot(), 'marketplace');
}

const MAX_REDIRECTS = 5;

/** Teto do .zip baixado. Pacote legitimo nao chega perto disso. */
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500 MB
/** Teto por arquivo extraido — trava zip bomb (KB comprimidos viram GB inflados). */
const MAX_ENTRY_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Hosts de onde o servidor aceita buscar manifest e pacote.
 * Sem isso, `installFromUrl` aceita URL arbitrario e o servidor vira sonda da rede
 * interna de quem hospeda (SSRF). Conferido a cada salto de redirect, porque host
 * permitido pode redirecionar para host interno.
 */
const ALLOWED_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'api.github.com',
  'codeload.github.com',
]);

function assertAllowedHost(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`URL invalida: ${url}`);
  }
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `Host nao permitido: ${host}. O Loom so instala pacotes hospedados no GitHub.`,
    );
  }
}

function httpGet(
  url: string,
  headers: Record<string, string> = {},
  depth = 0,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      assertAllowedHost(url);
    } catch (e) {
      return reject(e);
    }
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (depth >= MAX_REDIRECTS) {
          return reject(new Error(`Excesso de redirecionamentos (${MAX_REDIRECTS}) ao buscar ${url}`));
        }
        return httpGet(res.headers.location, headers, depth + 1).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

async function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  const parsed = new URL(url);
  const mod = parsed.protocol === 'https:' ? https : http;

  await fs.mkdir(path.dirname(destPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    let redirects = 0;
    const request = (targetUrl: string) => {
      try {
        assertAllowedHost(targetUrl);
      } catch (e) {
        file.close();
        fs.unlink(destPath).catch(() => { });
        return reject(e);
      }
      mod.get(targetUrl, { headers: { 'User-Agent': 'LoomVTT-Installer' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects >= MAX_REDIRECTS) {
            file.close();
            fs.unlink(destPath).catch(() => { });
            return reject(new Error(`Excesso de redirecionamentos (${MAX_REDIRECTS}) ao baixar`));
          }
          redirects++;
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath).catch(() => { });
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        const total = Number(res.headers['content-length']) || 0;
        if (total > MAX_DOWNLOAD_BYTES) {
          file.close();
          fs.unlink(destPath).catch(() => { });
          return reject(new Error(`Pacote grande demais: ${Math.round(total / 1048576)} MB (limite 500 MB)`));
        }
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          // Content-Length pode mentir ou faltar — conferir tambem o que chega de fato.
          if (received > MAX_DOWNLOAD_BYTES) {
            res.destroy();
            file.close();
            fs.unlink(destPath).catch(() => { });
            return reject(new Error('Pacote excedeu o limite de 500 MB durante o download'));
          }
          if (total > 0 && onProgress) onProgress(Math.round((received / total) * 100));
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', reject);
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath).catch(() => { });
        reject(err);
      });
    };
    request(url);
  });
}

// ---------------------------------------------------------------------------
// GitHub API: resolve manifest + release URLs
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub manifest URL into owner/repo/path components.
 * Supports:
 *   https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}
 *   https://github.com/{owner}/{repo}/raw/{ref}/{path}
 *   https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}
 */
function parseGitHubUrl(rawUrl: string): { owner: string; repo: string; ref: string; filePath: string } | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'raw.githubusercontent.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      return { owner: parts[0], repo: parts[1], ref: parts[2], filePath: parts.slice(3).join('/') };
    }
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[2] === 'raw') {
        return { owner: parts[0], repo: parts[1], ref: parts[3], filePath: parts.slice(4).join('/') };
      }
      // .../releases/download/<tag>/<arquivo> e .../releases/latest/download/<arquivo>.
      // So owner/repo importam aqui: o resto vem da API de releases.
      if (parts[2] === 'releases' && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1], ref: 'latest', filePath: parts.slice(3).join('/') };
      }
    }
    if (u.hostname === 'api.github.com') {
      const match = u.pathname.match(/repos\/([^/]+)\/([^/]+)\/contents\/(.+)/);
      if (match) {
        return { owner: match[1], repo: match[2], ref: u.searchParams.get('ref') || 'main', filePath: match[3] };
      }
    }
  } catch { }
  return null;
}

/**
 * Resolve the download URL for the latest release of a GitHub repo.
 * Uses GitHub API: GET /repos/{owner}/{repo}/releases/latest
 */
async function resolveLatestReleaseUrl(owner: string, repo: string): Promise<string | null> {
  try {
    const { statusCode, body } = await httpGet(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { 'User-Agent': 'LoomVTT-Installer', 'Accept': 'application/vnd.github+json' }
    );
    if (statusCode !== 200) return null;
    const release = JSON.parse(body);
    const asset = (release.assets || []).find((a: any) =>
      a.name.endsWith('.zip') || a.name.endsWith('.tar.gz')
    );
    return asset?.browser_download_url || release.zipball_url || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Zip extraction (no external deps — uses Node's zlib + manual ZIP parsing)
// ---------------------------------------------------------------------------

/**
 * Minimal ZIP extractor supporting stored and deflated entries.
 * Covers >99% of GitHub release zips.
 */
import zlib from 'zlib';

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const data = await fs.readFile(zipPath);

  // Find End of Central Directory
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');

  const cdEntries = data.readUInt16LE(eocdOffset + 10);
  const cdOffset = data.readUInt32LE(eocdOffset + 16);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) break;

    const comprMethod = data.readUInt16LE(offset + 10);
    const compSize = data.readUInt32LE(offset + 20);
    data.readUInt32LE(offset + 24);
    const nameLen = data.readUInt16LE(offset + 28);
    const extraLen = data.readUInt16LE(offset + 30);
    const commentLen = data.readUInt16LE(offset + 32);
    const localHeaderOffset = data.readUInt32LE(offset + 42);

    const nameBuf = data.subarray(offset + 46, offset + 46 + nameLen);
    const entryName = nameBuf.toString('utf8');

    offset += 46 + nameLen + extraLen + commentLen;

    // Skip directories — they'll be created by file entries
    if (entryName.endsWith('/')) continue;

    // Security: prevent path traversal
    const cleanName = entryName.replace(/\.\./g, '').replace(/\\/g, '/');
    if (!cleanName) continue;

    // Strip top-level folder if the zip has a single root dir (common for GitHub archives)
    const parts = cleanName.split('/');
    const filePath = path.join(destDir, ...parts);
    // Checagem final: o caminho resolvido TEM que ficar dentro de destDir. A limpeza
    // de ".." por regex acima segura na pratica, mas depende de detalhe do path.join —
    // isto aqui e a garantia que nao depende de sorte.
    const resolved = path.resolve(filePath);
    if (resolved !== path.resolve(destDir) && !resolved.startsWith(path.resolve(destDir) + path.sep)) {
      logger.warn('Entrada de ZIP tentou escapar do diretorio de destino, ignorada', { entryName });
      continue;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Find file data from local header
    const lhNameLen = data.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLen = data.readUInt16LE(localHeaderOffset + 28);
    const fileDataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const raw = data.subarray(fileDataStart, fileDataStart + compSize);

    if (comprMethod === 0) {
      await fs.writeFile(filePath, raw);
    } else if (comprMethod === 8) {
      let inflated: Buffer;
      try {
        inflated = zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
      } catch (e: any) {
        throw new Error(`Entrada "${entryName}" excede o limite de 100 MB ou esta corrompida: ${e.message}`);
      }
      await fs.writeFile(filePath, inflated);
    } else {
      logger.warn('ZIP entry uses unsupported compression, skipping', { entryName, comprMethod });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and read a remote manifest JSON from a URL.
 */
export async function fetchRemoteManifest(manifestUrl: string): Promise<RemoteManifest> {
  const { statusCode, body } = await httpGet(manifestUrl, {
    'User-Agent': 'LoomVTT-Installer',
    'Accept': 'application/json',
  });
  if (statusCode !== 200) {
    throw new Error(`Failed to fetch manifest from ${manifestUrl}: HTTP ${statusCode}`);
  }
  return JSON.parse(body);
}

/**
 * Resolve the download URL for a package.
 *
 * Priority:
 *   1. manifest.download field (explicit URL)
 *   2. Auto-resolve from GitHub API (latest release .zip asset)
 */
export async function resolveDownloadUrl(manifest: RemoteManifest): Promise<string> {
  if (manifest.download) return manifest.download;

  const gh = parseGitHubUrl(manifest.manifest || '');
  if (gh) {
    const url = await resolveLatestReleaseUrl(gh.owner, gh.repo);
    if (url) return url;
  }

  throw new Error('No download URL available: manifest has no "download" field and could not resolve from GitHub');
}

export interface ProgressInfo {
  percent: number;
  phase: string;
  label: string;
}

/**
 * Install an addon or ruleset from a manifest URL.
 *
 * @param manifestUrl  URL to the remote addon.json or ruleset.json
 * @param type         'addon' | 'ruleset'
 * @param onProgress   Optional callback for real-time progress reporting
 * @returns InstallResult
 */
export async function installFromUrl(
  manifestUrl: string,
  type: 'addon' | 'ruleset',
  onProgress?: (p: ProgressInfo) => void,
): Promise<InstallResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loomvtt-install-'));
  const zipPath = path.join(tmpDir, 'package.zip');

  try {
    // 1. Fetch remote manifest
    onProgress?.({ percent: 5, phase: 'manifest', label: 'Buscando manifest...' });
    logger.info('Fetching remote manifest', { manifestUrl });
    const manifest = await fetchRemoteManifest(manifestUrl);

    // Portao ANTES do download: manifest de outro VTT (ou sem declaracao de engine)
    // e recusado aqui, sem baixar nem escrever nada em disco.
    const gate = validateLoomManifest(manifest, type);
    if (!gate.ok) {
      logger.warn('Manifest recusado pelo portao de instalacao', { manifestUrl, error: gate.error });
      onProgress?.({ percent: 0, phase: 'rejected', label: gate.error });
      return { success: false, name: manifest.name || 'unknown', type, error: gate.error };
    }
    const name = manifest.name;

    const root = getMarketplaceRoot();
    const subfolder = type === 'addon' ? 'addons' : 'rulesets';
    const pkgDir = path.join(root, subfolder, name);

    // 2. Resolve download URL
    onProgress?.({ percent: 10, phase: 'resolve', label: 'Resolvendo URL de download...' });
    const downloadUrl = await resolveDownloadUrl(manifest);
    logger.info('Downloading package', { name, downloadUrl });

    // 3. Download
    await downloadFile(downloadUrl, zipPath, (pct) => {
      onProgress?.({ percent: 10 + Math.round(pct * 0.7), phase: 'downloading', label: `Baixando... ${pct}%` });
    });
    logger.debug('Download complete', { name, zipPath });

    // 4. Remove existing installation if present
    try {
      await fs.access(pkgDir);
      await fs.rm(pkgDir, { recursive: true, force: true });
      logger.debug('Removed existing installation', { name, pkgDir });
    } catch {
      // Not installed yet — fine
    }

    // 5. Extract
    onProgress?.({ percent: 85, phase: 'extracting', label: 'Extraindo pacote...' });
    logger.debug('Extracting package', { name, destDir: pkgDir });
    await extractZip(zipPath, pkgDir);

    // 6. Validate — ensure manifest exists in extracted dir
    const manifestFilename = type === 'addon' ? 'addon.json' : 'ruleset.json';
    const extractedManifestPath = path.join(pkgDir, manifestFilename);
    try {
      await fs.access(extractedManifestPath);
    } catch {
      // Manifest might be nested in a subfolder (GitHub archives have a root dir)
      // Find it
      const entries = await fs.readdir(pkgDir);
      if (entries.length === 1) {
        const subDir = path.join(pkgDir, entries[0]);
        const subStat = await fs.stat(subDir);
        if (subStat.isDirectory()) {
          // Move contents up one level
          const subEntries = await fs.readdir(subDir);
          for (const entry of subEntries) {
            await fs.rename(path.join(subDir, entry), path.join(pkgDir, entry));
          }
          await fs.rmdir(subDir);
        }
      }
      // Validate again
      try {
        await fs.access(path.join(pkgDir, manifestFilename));
      } catch {
        return { success: false, name, type, error: `Extracted package missing ${manifestFilename}` };
      }
    }

    // 7. Write resolved manifest and download URLs back into extracted manifest
    onProgress?.({ percent: 100, phase: 'done', label: 'Instalado.' });
    const finalManifestPath = path.join(pkgDir, manifestFilename);
    const rawManifest = await fs.readFile(finalManifestPath, 'utf8');
    const finalManifest = JSON.parse(rawManifest);
    finalManifest.manifest = manifestUrl;
    finalManifest.download = downloadUrl;
    await fs.writeFile(finalManifestPath, JSON.stringify(finalManifest, null, 2) + '\n', 'utf8');

    logger.info('Package installed successfully', { name, type, version: manifest.version });
    return { success: true, name, type, version: manifest.version, warning: gate.warning };

  } catch (err: any) {
    logger.error('Package installation failed', { manifestUrl, error: err.message });
    onProgress?.({ percent: 0, phase: 'error', label: err.message || 'Falha na instalação' });
    return { success: false, name: 'unknown', type, error: err.message };
  } finally {
    // Clean up temp dir
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { }
  }
}

/**
 * Uninstall an addon or ruleset by name.
 */
export async function uninstallPackage(name: string, type: 'addon' | 'ruleset'): Promise<InstallResult> {
  const root = getMarketplaceRoot();
  const subfolder = type === 'addon' ? 'addons' : 'rulesets';
  const pkgDir = path.join(root, subfolder, name);

  try {
    await fs.access(pkgDir);
    await fs.rm(pkgDir, { recursive: true, force: true });
    logger.info('Package uninstalled', { name, type });
    return { success: true, name, type };
  } catch {
    return { success: false, name, type, error: 'Package not found' };
  }
}

export async function checkForUpdate(
  name: string,
  type: 'addon' | 'ruleset',
): Promise<{ hasUpdate: boolean; localVersion?: string; remoteVersion?: string; error?: string }> {
  const root = getMarketplaceRoot();
  const subfolder = type === 'addon' ? 'addons' : 'rulesets';
  const manifestFilename = type === 'addon' ? 'addon.json' : 'ruleset.json';
  const localManifestPath = path.join(root, subfolder, name, manifestFilename);

  let local: RemoteManifest;
  try {
    local = JSON.parse(await fs.readFile(localManifestPath, 'utf8'));
  } catch {
    return { hasUpdate: false, error: 'Manifest local nao encontrado' };
  }

  const lv = local.version || '0.0.0';

  try {
    let remoteVersion: string | null = null;

    // 1) Preferir a API do GitHub: e a unica fonte que sabe qual release e a mais
    //    recente. O campo `manifest` do proprio pacote costuma vir fixado na versao
    //    em que foi publicado (ver cabecalho da Tarefa 4) e por isso nao serve.
    const gh = parseGitHubUrl(local.manifest || '');
    if (gh) {
      const assetUrl = await resolveLatestReleaseUrl(gh.owner, gh.repo);
      if (assetUrl) {
        const m = assetUrl.match(/\/releases\/download\/([^/]+)\//);
        if (m) remoteVersion = m[1].replace(/^v/i, '');
      }
    }

    // 2) Sem GitHub (ou sem tag legivel), cair para o manifest remoto.
    if (!remoteVersion && local.manifest) {
      const remote = await fetchRemoteManifest(local.manifest);
      remoteVersion = remote.version || null;
    }

    if (!remoteVersion) {
      return { hasUpdate: false, localVersion: lv, error: 'Nao foi possivel determinar a versao remota' };
    }

    return {
      hasUpdate: compareVersions(remoteVersion, lv) > 0,
      localVersion: lv,
      remoteVersion,
    };
  } catch (err: any) {
    // NAO engolir calado: falha de rede ficava identica a "esta atualizado", e esse
    // mesmo padrao ja escondeu dois bugs do catalogo de fontes neste projeto (ver
    // CHANGELOG). A API do GitHub sem token da 60 req/hora por IP, entao esgotar
    // cota e um caso real e frequente.
    logger.warn('Falha ao checar atualizacao de pacote', { name, type, error: err.message });
    return { hasUpdate: false, localVersion: lv, error: err.message };
  }
}
