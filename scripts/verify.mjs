#!/usr/bin/env node
/**
 * Consolida a verificação que se repete a cada handoff: typecheck client+server
 * e checagem de gaps na sequência de migrations. Um comando em vez de 3-4.
 */
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkResponsiveGates } from './check-responsive-gates.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Passe um caminho/regex como argumento pra filtrar só os arquivos que você tocou,
// ex: `npm run verify -- sidebar.ts`. Sem argumento, mostra tudo (inclui ruído pré-existente).
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
let hasError = false;

function runTsc(label, tsconfig) {
  console.log(`\n--- ${label} ---`);
  try {
    execSync(`npx tsc --noEmit -p ${tsconfig}`, { cwd: root, stdio: 'pipe' });
    console.log('0 erros.');
  } catch (err) {
    const output = err.stdout?.toString() || err.message;
    const lines = filter ? output.split('\n').filter((l) => filter.test(l)) : output.split('\n');
    const relevant = lines.filter(Boolean).join('\n');
    if (relevant) {
      hasError = true;
      console.log(relevant);
    } else {
      console.log(filter ? '0 erros nos arquivos filtrados (ruído pré-existente ignorado).' : '0 erros.');
    }
  }
}

function checkMigrations() {
  console.log('\n--- migrations ---');
  const dir = path.join(root, 'server/applications/database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const numbers = [...new Set(
    files.map((f) => parseInt(f.split('_')[0], 10)).filter((n) => !Number.isNaN(n)),
  )].sort((a, b) => a - b);

  const gaps = [];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i - 1] + 1) {
      gaps.push(`gap entre ${numbers[i - 1]} e ${numbers[i]}`);
    }
  }
  console.log(`${files.length} arquivos, sequência ${numbers[0]}-${numbers[numbers.length - 1]} (${numbers.length} números únicos).`);
  if (gaps.length) {
    hasError = true;
    console.log('⚠️  ' + gaps.join(', '));
  } else {
    console.log('Sem gaps.');
  }
}

runTsc('tsc client', 'tsconfig.json');
runTsc('tsc server', 'tsconfig.server.json');
checkMigrations();

console.log('\n--- gates de responsividade ---');
const gates = checkResponsiveGates();
console.log(gates.summary);
gates.offenders.forEach((o) => console.log('⚠️  ' + o));
if (!gates.ok) hasError = true;
else console.log('Todo CSS mobile está atrás de "pointer: coarse" — desktop intacto.');

console.log('\n' + (hasError ? '❌ Verificação encontrou problemas.' : '✅ Tudo limpo.'));
process.exit(hasError ? 1 : 0);
