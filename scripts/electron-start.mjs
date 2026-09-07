#!/usr/bin/env node
/**
 * Builda client+server e sobe o Electron local (plataforma atual só) apontando
 * pro `electron/main.cjs`, que importa o server compilado e abre a janela
 * quando ele sinaliza 'loom:ready'. Pra gerar instalador de verdade, use
 * `npm run electron:build` (electron-builder).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

console.log('Building client+server...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// better-sqlite3's prebuilt binary targets plain Node's ABI, but Electron
// embeds its own Node with a different ABI — has to be rebuilt for each,
// or requiring it inside Electron crashes with a NODE_MODULE_VERSION mismatch.
console.log('Rebuilding native modules for Electron ABI...');
execSync('npx electron-rebuild -f -w better-sqlite3', { cwd: root, stdio: 'inherit' });

try {
  console.log('Starting Electron...');
  // `npx electron .` não herda um `npm_lifecycle_event` que comece com "dev"
  // (vira "electron:start") — sem isso, LicenseManager.isDevEnvironment()
  // trataria esse teste local do desktop como produção e travaria a chave
  // DEV-LOOM-0000. `app.isPackaged` (electron/main.cjs) já cobre o caso do
  // instalador final; isso aqui cobre só o teste unpacked via este script.
  execSync('npx electron .', { cwd: root, stdio: 'inherit', env: { ...process.env, LOOM_DEV_SERVER: 'true' } });
} finally {
  console.log('Rebuilding native modules back to plain Node ABI (so `npm run dev` keeps working)...');
  execSync('npm rebuild better-sqlite3', { cwd: root, stdio: 'inherit' });
}
