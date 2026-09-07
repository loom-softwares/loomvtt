#!/usr/bin/env node
/**
 * Audita client/styles/**\/*.css por padrões concretos de CSS redundante/quebrado —
 * parseado de verdade via `postcss` (já é dependência do Vite, zero pacote novo),
 * nada de heurística de LLM. Roda 6 checagens:
 *
 *  1. var(--x) usado mas --x nunca declarado em lugar nenhum (bug real — o browser
 *     cai silenciosamente pro fallback ou pra nada, sem erro visível)
 *  2. --x declarado em tokens.css mas var(--x) nunca é lido em nenhum outro arquivo
 *     (candidato a token morto — mas cuidado: pode ser consumido por classe dinâmica
 *     via JS, confira manualmente antes de apagar)
 *  3. Cor hex/rgb hardcoded que bate exatamente com um valor de tokens.css mas não usa
 *     var() — mesma cor mantida em 2 lugares, uma delas vai dessincronizar cedo ou tarde
 *  4. Mesmo seletor definido em mais de um arquivo (pode ser cascata proposital OU
 *     duplicação por engano — reporta os dois arquivos pra checar)
 *  5. Bloco de declarações idêntico (mesmas propriedades+valores, exceto var()) repetido
 *     em 3+ seletores diferentes — candidato a extrair numa classe/util compartilhada
 *  6. Regra vazia (seletor sem nenhuma declaração) — dead code
 */
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stylesDir = path.join(root, 'client/styles');

const files = execSync('git ls-files -- client/styles', { cwd: root })
  .toString()
  .split('\n')
  .filter((f) => f.endsWith('.css'));

const HEX_RE = /#[0-9a-f]{3,8}\b/gi;
const RGB_RE = /rgba?\([^)]+\)/gi;
const VAR_DEF_RE = /^--[\w-]+$/;

const declaredVars = new Map(); // --nome -> {file, line, value}
const usedVars = new Map(); // --nome -> [{file, line}]
const selectorsBySelector = new Map(); // selector -> [{file, line}]
const declBlocks = new Map(); // "prop:val;prop:val" -> [{file, line, selector}]
const emptyRules = [];
const colorLiterals = []; // {file, line, selector, value}

for (const relPath of files) {
  const filePath = path.join(root, relPath);
  const css = readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = postcss.parse(css, { from: filePath });
  } catch (err) {
    console.log(`⚠️  Erro de parse em ${relPath}: ${err.message}`);
    continue;
  }

  ast.walkRules((rule) => {
    const line = rule.source?.start?.line ?? 0;

    if (rule.nodes.length === 0) {
      emptyRules.push({ file: relPath, line, selector: rule.selector });
      return;
    }

    for (const sel of rule.selector.split(',').map((s) => s.trim())) {
      if (!selectorsBySelector.has(sel)) selectorsBySelector.set(sel, []);
      selectorsBySelector.get(sel).push({ file: relPath, line });
    }

    const declParts = [];
    rule.walkDecls((decl) => {
      const dLine = decl.source?.start?.line ?? line;

      if (VAR_DEF_RE.test(decl.prop)) {
        declaredVars.set(decl.prop, { file: relPath, line: dLine, value: decl.value });
      }

      let m;
      const varRe = /var\((--[\w-]+)/g;
      while ((m = varRe.exec(decl.value))) {
        const name = m[1];
        if (!usedVars.has(name)) usedVars.set(name, []);
        usedVars.get(name).push({ file: relPath, line: dLine });
      }

      if (!decl.value.includes('var(') && !VAR_DEF_RE.test(decl.prop)) {
        const hexMatches = decl.value.match(HEX_RE) || [];
        const rgbMatches = decl.value.match(RGB_RE) || [];
        for (const v of [...hexMatches, ...rgbMatches]) {
          colorLiterals.push({ file: relPath, line: dLine, selector: rule.selector, value: v.toLowerCase() });
        }
      }

      if (!VAR_DEF_RE.test(decl.prop)) {
        declParts.push(`${decl.prop}:${decl.value.replace(/\s+/g, ' ').trim()}`);
      }
    });

    if (declParts.length >= 2) {
      const key = declParts.sort().join(';');
      if (!declBlocks.has(key)) declBlocks.set(key, []);
      declBlocks.get(key).push({ file: relPath, line, selector: rule.selector });
    }
  });
}

console.log(`\n--- audit:css — ${files.length} arquivos, client/styles/ ---\n`);

// 1. var() apontando pra --variável nunca declarada
const undefinedVarUses = [];
for (const [name, uses] of usedVars) {
  if (!declaredVars.has(name)) {
    for (const u of uses) undefinedVarUses.push({ name, ...u });
  }
}
console.log(`1. var(--x) sem --x declarado em lugar nenhum: ${undefinedVarUses.length}`);
for (const u of undefinedVarUses) {
  console.log(`   ${u.file}:${u.line} — var(${u.name})`);
}

// 2. --variável declarada mas nunca lida via var()
const unusedVars = [...declaredVars.entries()].filter(([name]) => !usedVars.has(name));
console.log(`\n2. --variável declarada mas var() nunca usado em nenhum .css: ${unusedVars.length}`);
for (const [name, info] of unusedVars) {
  console.log(`   ${info.file}:${info.line} — ${name}: ${info.value}`);
}
if (unusedVars.length > 0) {
  console.log('   ⚠️  Pode ser falso positivo: confira se algum .ts monta o var() dinamicamente via JS antes de apagar.');
}

// 3. Cor literal que bate com um token existente mas não usa var()
const tokenByValue = new Map();
for (const [name, info] of declaredVars) {
  tokenByValue.set(info.value.toLowerCase().trim(), name);
}
const driftableColors = colorLiterals.filter((c) => tokenByValue.has(c.value));
console.log(`\n3. Cor hardcoded que já existe como token (deveria usar var()): ${driftableColors.length}`);
for (const c of driftableColors) {
  console.log(`   ${c.file}:${c.line} (${c.selector}) — ${c.value} == ${tokenByValue.get(c.value)}`);
}

// 4. Mesmo seletor em mais de um arquivo
const crossFileDupes = [...selectorsBySelector.entries()].filter(
  ([, occurrences]) => new Set(occurrences.map((o) => o.file)).size > 1,
);
console.log(`\n4. Mesmo seletor definido em arquivos diferentes: ${crossFileDupes.length}`);
for (const [sel, occurrences] of crossFileDupes) {
  console.log(`   ${sel}`);
  for (const o of occurrences) console.log(`     - ${o.file}:${o.line}`);
}

// 5. Bloco de declarações idêntico repetido em 3+ seletores
const repeatedBlocks = [...declBlocks.entries()].filter(([, occ]) => occ.length >= 3);
console.log(`\n5. Bloco de declarações idêntico repetido em 3+ seletores (candidato a extrair): ${repeatedBlocks.length}`);
for (const [key, occ] of repeatedBlocks) {
  console.log(`   ${occ.length}x — ${key.slice(0, 90)}${key.length > 90 ? '…' : ''}`);
  for (const o of occ) console.log(`     - ${o.file}:${o.line} (${o.selector})`);
}

// 6. Regra vazia
console.log(`\n6. Seletor sem nenhuma declaração (dead code): ${emptyRules.length}`);
for (const e of emptyRules) {
  console.log(`   ${e.file}:${e.line} — ${e.selector} {}`);
}

const totalProblems = undefinedVarUses.length + crossFileDupes.length + repeatedBlocks.length + emptyRules.length;
console.log(
  `\n${totalProblems > 0 ? '⚠️' : '✅'} ${totalProblems} achado(s) que valem checagem manual (itens 2 e 3 são informativos, não contam aqui).`,
);
process.exit(0);
