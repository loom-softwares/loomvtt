#!/usr/bin/env node
/**
 * Garante que client/styles/responsive.css não consegue afetar o desktop.
 *
 * A operação de responsividade tem uma regra inegociável: toda regra vive
 * dentro de um `@media` que carrega `pointer: coarse` — que só casa quando o
 * apontador primário é o dedo. Um desktop com mouse nunca entra, por mais
 * estreita que a janela fique.
 *
 * Sem esta checagem, essa garantia dependeria de quem escreve lembrar da regra
 * a cada CSS novo. Com ela, o build quebra. É a diferença entre convenção e
 * invariante — inclusive para regras que outra pessoa (ou outra LLM) adicionar
 * depois.
 *
 * Roda junto do `npm run verify`, ou sozinho: `node scripts/check-responsive-gates.mjs`
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = 'client/styles/responsive.css';

/** @returns {{ok: boolean, summary: string, offenders: string[]}} */
export function checkResponsiveGates() {
  const file = path.join(root, TARGET);
  if (!existsSync(file)) {
    return { ok: true, summary: `${TARGET} não existe — nada a checar.`, offenders: [] };
  }

  // Comentários viram espaço em branco do mesmo tamanho para os números de
  // linha continuarem batendo com o arquivo real.
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );

  const offenders = [];
  let depth = 0;
  let prelude = '';
  let preludeLine = 1;
  let line = 1;
  let gatedBlocks = 0;

  for (const ch of src) {
    if (ch === '\n') line++;

    if (ch === '{') {
      if (depth === 0) {
        const p = prelude.trim().replace(/\s+/g, ' ');
        gatedBlocks++;
        if (!/^@media\b/.test(p)) {
          offenders.push(`linha ${preludeLine}: bloco no nível raiz não é @media → "${p.slice(0, 70)}"`);
        } else if (!/pointer\s*:\s*coarse/.test(p)) {
          offenders.push(`linha ${preludeLine}: @media sem "pointer: coarse" → "${p.slice(0, 70)}"`);
        }
        prelude = '';
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth <= 0) {
        if (depth < 0) {
          offenders.push(`linha ${line}: "}" sem abertura correspondente`);
          depth = 0;
        }
        prelude = '';
        preludeLine = line;
      }
    } else if (depth === 0) {
      if (ch === ';') {
        // @import, @charset ou declaração solta: nada disso pode existir aqui,
        // porque não estaria protegido por gate nenhum.
        offenders.push(`linha ${line}: at-rule ou declaração solta no nível raiz`);
        prelude = '';
      } else {
        if (prelude.trim() === '' && ch.trim() !== '') preludeLine = line;
        prelude += ch;
      }
    }
  }

  if (depth > 0) offenders.push(`fim do arquivo com ${depth} bloco(s) sem fechar`);

  return {
    ok: offenders.length === 0,
    summary: `${gatedBlocks} bloco(s) no nível raiz verificado(s) em ${TARGET}.`,
    offenders,
  };
}

// Execução direta (fora do verify.mjs)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { ok, summary, offenders } = checkResponsiveGates();
  console.log(summary);
  offenders.forEach((o) => console.log('  ⚠️  ' + o));
  console.log(ok ? '✅ Desktop protegido.' : '❌ Regra fora de gate de toque.');
  process.exit(ok ? 0 : 1);
}
