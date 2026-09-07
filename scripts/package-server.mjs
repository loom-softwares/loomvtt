#!/usr/bin/env node
/**
 * Monta uma pasta de release Node standalone: dist/server + dist/client
 * copiados numa estrutura fixa, package.json trimado (só deps de produção),
 * e `npm ci --omit=dev` rodado ali dentro pra baixar o binário nativo correto
 * (better-sqlite3) da plataforma/arquitetura alvo.
 *
 * Uso: node scripts/package-server.mjs [--platform=win32|linux|darwin] [--arch=x64|arm64]
 * Sem flags, usa a plataforma/arquitetura da máquina atual.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const platform = args.platform || process.platform;
const arch = args.arch || process.arch;
const releaseDir = path.join(root, 'release', 'node', `${platform}-${arch}`);

console.log(`Empacotando release Node standalone → ${path.relative(root, releaseDir)}`);

if (!fs.existsSync(path.join(root, 'dist/server/index.js'))) {
  console.error('dist/server/index.js não existe. Rode `npm run build` primeiro.');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'dist/client/index.html'))) {
  console.error('dist/client/index.html não existe. Rode `npm run build` primeiro.');
  process.exit(1);
}

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

// Layout: app/ (compiled server code) and client/ (frontend) as clearly
// separate siblings, node_modules/package.json at the release root — nothing
// runtime-generated (db/config/logs) lands in here, that goes to the OS
// app-data folder instead (see getAppDataPath in db.ts).
fs.cpSync(path.join(root, 'dist/server'), path.join(releaseDir, 'app'), { recursive: true });
fs.cpSync(path.join(root, 'dist/shared'), path.join(releaseDir, 'shared'), { recursive: true });
fs.cpSync(path.join(root, 'dist/client'), path.join(releaseDir, 'client'), { recursive: true });

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const releasePkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  type: 'module',
  main: 'app/index.js',
  dependencies: rootPkg.dependencies,
};
fs.writeFileSync(path.join(releaseDir, 'package.json'), JSON.stringify(releasePkg, null, 2));

const launcherName = platform === 'win32' ? 'LoomVTT-Server.bat' : 'LoomVTT-Server.sh';
const launcher = platform === 'win32'
  ? '@echo off\r\nnode app\\index.js\r\npause\r\n'
  : '#!/usr/bin/env bash\ncd "$(dirname "$0")"\nnode app/index.js\n';
fs.writeFileSync(path.join(releaseDir, launcherName), launcher);
if (platform !== 'win32') fs.chmodSync(path.join(releaseDir, launcherName), 0o755);

console.log('Instalando dependências de produção (npm ci --omit=dev)...');
const installEnv = { ...process.env, npm_config_platform: platform, npm_config_arch: arch };
try {
  execSync('npm install --omit=dev --no-audit --no-fund', { cwd: releaseDir, stdio: 'inherit', env: installEnv });
} catch (err) {
  console.error(
    `\nnpm install falhou dentro da pasta de release para ${platform}/${arch}.\n` +
    'Módulos com binário nativo (ex: better-sqlite3) só baixam o prebuild correto quando ' +
    'rodados na plataforma/arquitetura alvo de verdade (ou via CI com esse alvo) — ' +
    'cross-plataforma a partir de outro SO nem sempre funciona.',
  );
  process.exit(1);
}

console.log(`\nRelease pronta em ${path.relative(root, releaseDir)}`);
console.log(`Rode: ${launcherName}`);
