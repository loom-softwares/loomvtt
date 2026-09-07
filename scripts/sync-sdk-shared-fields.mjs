#!/usr/bin/env node
// Copia shared/data/fields.ts pra dentro de packages/sdk/src/ antes do tsc rodar —
// necessário porque o SDK tem rootDir:"src" + declaration:true, e TS não deixa
// emitir declaration de arquivo fora do rootDir. Roda toda vez (build:sdk chama
// isso antes do tsc), então nunca fica desatualizado.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'shared/data/fields.ts');
const destDir = path.join(root, 'packages/sdk/src/vendor');
const dest = path.join(destDir, 'shared-fields.ts');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[sync-sdk-shared-fields] shared/data/fields.ts -> packages/sdk/src/vendor/shared-fields.ts');
