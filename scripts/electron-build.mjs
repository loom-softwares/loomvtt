#!/usr/bin/env node
/**
 * Empacota o instalador Electron pra uma plataforma, sem deixar o
 * node_modules/ raiz preso no ABI do Electron depois — senão `npm run dev`
 * (Node puro) quebra até alguém lembrar de rodar `npm rebuild` manualmente.
 * Mesma lógica de electron-start.mjs, só que chamando electron-builder em
 * vez de abrir a janela direto.
 *
 * Uso: node scripts/electron-build.mjs --win | --linux
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = process.argv.includes('--linux') ? 'linux' : 'win';
const rawDir = `release/_raw-${target}`; // scaffold do electron-builder (debug yml, blockmap etc) — descartável
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

console.log('Building client+server...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('Rebuilding native modules for Electron ABI...');
execSync('npx electron-rebuild -f -w better-sqlite3', { cwd: root, stdio: 'inherit' });

try {
  console.log(`Packaging Electron (${target}) -> ${rawDir}...`);
  // npmRebuild=false: já rebuildamos acima; deixar o electron-builder rebuildar
  // de novo só arrisca ele mexer no node_modules em outro momento do processo.
  execSync(
    `npx electron-builder --${target} -c.directories.output=${rawDir} -c.npmRebuild=false`,
    { cwd: root, stdio: 'inherit' },
  );
} finally {
  console.log('Rebuilding native modules back to plain Node ABI (so `npm run dev` keeps working)...');
  execSync('npm rebuild better-sqlite3', { cwd: root, stdio: 'inherit' });
}

// Só duas coisas ficam prontas em release/, sem pasta aninhada, sem yml/blockmap
// de debug do electron-builder junto — o que a pessoa recebe é só isso aqui.
console.log('Organizando saída final em release/...');
const rawRoot = path.join(root, rawDir);

if (target === 'win') {
  const platformDir = path.join(root, 'release/windows');
  fs.rmSync(platformDir, { recursive: true, force: true });
  fs.mkdirSync(platformDir, { recursive: true });

  fs.copyFileSync(
    path.join(rawRoot, `LoomVTT Setup ${version}.exe`),
    path.join(platformDir, `LoomVTT-Setup-${version}.exe`),
  );
  fs.cpSync(
    path.join(rawRoot, 'win-unpacked'),
    path.join(platformDir, `LoomVTT-Portable-${version}-win`),
    { recursive: true },
  );

  console.log(`\nPronto em release/windows/:\n  Instalador: LoomVTT-Setup-${version}.exe\n  Portátil:   LoomVTT-Portable-${version}-win/ (roda LoomVTT.exe direto, sem instalar)`);
} else {
  const platformDir = path.join(root, 'release/linux');
  fs.rmSync(platformDir, { recursive: true, force: true });
  fs.mkdirSync(platformDir, { recursive: true });

  const appImageSrc = fs.readdirSync(rawRoot).find(f => f.endsWith('.AppImage'));
  fs.copyFileSync(
    path.join(rawRoot, appImageSrc),
    path.join(platformDir, `LoomVTT-${version}-linux.AppImage`),
  );

  console.log(`\nPronto em release/linux/:\n  LoomVTT-${version}-linux.AppImage (já é portátil — dá permissão de execução e roda)`);
}

fs.rmSync(rawRoot, { recursive: true, force: true });
