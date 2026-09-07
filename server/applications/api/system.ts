import { Router } from 'express';
import { requireAdminSession } from './setup.js';
import { compareVersions } from '../addons/installer.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { resolveAppRoot } from '../utils/app-root.js';

export const systemApiRouter = Router();

const GITHUB_OWNER = 'sammore2';
const GITHUB_REPO = 'loom-virtual-tabletop';

systemApiRouter.get('/update-check', requireAdminSession, async (req, res) => {
  try {
    const root = resolveAppRoot();
    const pkgPath = path.join(root, 'package.json');
    const pkgStr = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgStr);
    const localVersion = pkg.version || '0.0.0';

    const channel = req.query.channel === 'preview' ? 'preview' : 'stable';
    const endpoint = channel === 'stable'
      ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
      : `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=1`;

    const githubResponse = await fetch(endpoint, {
      headers: {
        'User-Agent': 'LoomVTT-System-Updater',
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!githubResponse.ok) {
      const friendly = githubResponse.status === 404
        ? 'Nenhuma versão publicada ainda.'
        : `Falha ao buscar release no GitHub: HTTP ${githubResponse.status}`;
      return res.json({
        currentVersion: localVersion,
        latestVersion: localVersion,
        hasUpdate: false,
        changelog: '',
        publishedAt: '',
        channel,
        error: friendly,
      });
    }

    const body = await githubResponse.json();
    const release = channel === 'stable' ? body : body[0];

    if (!release) {
      return res.json({
        currentVersion: localVersion,
        latestVersion: localVersion,
        hasUpdate: false,
        changelog: '',
        publishedAt: '',
        channel,
        error: 'Nenhuma versão publicada ainda.',
      });
    }
    const remoteVersionRaw = release.tag_name || '';
    const remoteVersion = remoteVersionRaw.replace(/^v/i, '');

    const hasUpdate = compareVersions(remoteVersion, localVersion) > 0;

    return res.json({
      currentVersion: localVersion,
      latestVersion: remoteVersion,
      hasUpdate,
      changelog: release.body || '',
      publishedAt: release.published_at,
      channel,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro interno ao verificar atualizações' });
  }
});

systemApiRouter.post('/update', requireAdminSession, (req, res) => {
  const root = resolveAppRoot();

  // Executar git pull, npm install, npm run build
  const command = 'git pull && npm install && npm run build';

  exec(command, { cwd: root }, (error, stdout, stderr) => {
    const log = `> ${command}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
    if (error) {
      return res.json({ success: false, log: log + `\n\nERROR: ${error.message}` });
    }
    return res.json({ success: true, log });
  });
});
