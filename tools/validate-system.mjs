#!/usr/bin/env node
// Validador de rulesets/addons LoomVTT.
// Checa manifest, refs de arquivo, schema de sheets, uso de API.
//
// Uso:
//   node tools/validate-system.mjs <diretorio-do-ruleset>
//   npm run validate:ruleset -- <diretorio-do-ruleset>

import fs from 'fs';
import path from 'path';

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Uso: node tools/validate-system.mjs <diretorio-do-ruleset>');
  process.exit(1);
}

const absDir = path.resolve(targetDir);
if (!fs.existsSync(absDir)) {
  console.error(`❌ Diretório não encontrado: ${absDir}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

function error(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readFile(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

// ── 1. Detectar tipo (ruleset.json ou addon.json) ────────────────
const isRuleset = fs.existsSync(path.join(absDir, 'ruleset.json'));
const isAddon = fs.existsSync(path.join(absDir, 'addon.json'));

if (!isRuleset && !isAddon) {
  error('Nenhum manifest encontrado — esperado ruleset.json ou addon.json');
  printReport();
  process.exit(1);
}

const manifestName = isRuleset ? 'ruleset.json' : 'addon.json';
const type = isRuleset ? 'ruleset' : 'addon';

// ── 2. Validar manifest ─────────────────────────────────────────
const manifestRaw = readFile(path.join(absDir, manifestName));
if (!manifestRaw) {
  error(`${manifestName} não encontrado ou vazio`);
  printReport();
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (e) {
  error(`${manifestName} — JSON inválido: ${e.message}`);
  printReport();
  process.exit(1);
}

const requiredFields = isRuleset ? ['name', 'title', 'version'] : ['name', 'title', 'version'];
for (const field of requiredFields) {
  if (!manifest[field]) error(`${manifestName} — campo obrigatório "${field}" ausente`);
}

if (manifest.name && /[^a-z0-9-]/.test(manifest.name)) {
  error(`${manifestName} — "name" deve conter apenas letras minúsculas, números e hífen`);
}

if (!manifest.client) {
  warn(`${manifestName} — sem "client": o pacote não terá entry point client-side`);
}

if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
  error(`${manifestName} — "dependencies" deve ser um array`);
}

if (manifest.conflicts && !Array.isArray(manifest.conflicts)) {
  error(`${manifestName} — "conflicts" deve ser um array`);
}

// ── 3. Validar entry point client-side ──────────────────────────
if (manifest.client) {
  const clientPath = path.join(absDir, manifest.client);
  if (!fs.existsSync(clientPath)) {
    error(`entry point "${manifest.client}" não encontrado`);
  } else {
    const clientSrc = readFile(clientPath);
    if (clientSrc) {
      // Verifica imports do SDK
      if (!clientSrc.includes("from '/_loom/sdk/index.js'") && !clientSrc.includes('from "/_loom/sdk/index.js"')) {
        warn(`${manifest.client} — não importa do SDK LoomVTT (import from '/_loom/sdk/index.js')`);
      }

      // Verifica se registra o sistema (ruleset)
      if (isRuleset && !clientSrc.includes('SystemRegistry.register')) {
        error(`${manifest.client} — ruleset precisa chamar SystemRegistry.register()`);
      }

      // Verifica uso de API que não existe
      checkUnknownApi(clientSrc, manifest.client);
    }
  }
}

// ── 4. Validar entry point server-side (addons apenas) ──────────
if (manifest.core) {
  const corePath = path.join(absDir, manifest.core);
  if (!fs.existsSync(corePath)) {
    error(`entry point server-side "${manifest.core}" não encontrado`);
  }
}

// ── 5. Validar sheets/ ──────────────────────────────────────────
const sheetsDir = path.join(absDir, 'sheets');
if (fs.existsSync(sheetsDir)) {
  const sheetFiles = fs.readdirSync(sheetsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  for (const file of sheetFiles) {
    const src = readFile(path.join(sheetsDir, file));
    if (src && src.length < 10) {
      warn(`sheets/${file} — parece vazio ou só template`);
    }
  }
}

// ── 6. Validar styles/ ──────────────────────────────────────────
const stylesDir = path.join(absDir, 'styles');
if (fs.existsSync(stylesDir)) {
  const cssFiles = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css'));
  for (const file of cssFiles) {
    const src = readFile(path.join(stylesDir, file));
    if (src && src.trim().length === 0) {
      warn(`styles/${file} — arquivo CSS vazio`);
    }
  }
}

// ── 7. Validar lang/ ────────────────────────────────────────────
const langDir = path.join(absDir, 'lang');
if (fs.existsSync(langDir)) {
  const langFiles = fs.readdirSync(langDir).filter(f => f.endsWith('.json'));
  for (const file of langFiles) {
    const src = readFile(path.join(langDir, file));
    if (src) {
      try { JSON.parse(src); } catch (e) {
        error(`lang/${file} — JSON inválido: ${e.message}`);
      }
    }
  }
}

// ── 8. Validar templates/ ───────────────────────────────────────
const templatesDir = path.join(absDir, 'templates');
if (fs.existsSync(templatesDir)) {
  const hbsFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.hbs'));
  for (const file of hbsFiles) {
    const src = readFile(path.join(templatesDir, file));
    if (src && src.trim().length === 0) {
      warn(`templates/${file} — template Handlebars vazio`);
    }
  }
}

printReport();

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function checkUnknownApi(src, label) {
  // Lista de APIs conhecidas do SDK
  const knownApis = [
    'SystemRegistry', 'defineSystem', 'LoomHooks', 'api', 'API_PATHS',
    'sheets', 'keybinds', 'diceRegistry', 'wrap', 'getWraps',
    'windowManager', 'showToast', 'showConfirm', 'showPrompt',
    'showAlert', 'showSelectDialog', 'showCreatePageDialog',
    'settings',
    'VERSION',
  ];

  // window.Loom.<qualquer-coisa>
  const loomAccess = src.match(/Loom\.(\w+)/g);
  if (loomAccess) {
    for (const access of loomAccess) {
      const member = access.replace('Loom.', '');
      if (!knownApis.includes(member)) {
        warn(`${label}: window.Loom.${member} — API não reconhecida (talvez não exista)`);
      }
    }
  }

  // Imports do SDK
  const sdkImports = src.match(/import\s+\{([^}]+)\}\s+from\s+['"]\/_loom\/sdk\/index\.js['"]/);
  if (sdkImports) {
    const imported = sdkImports[1].split(',').map(s => s.trim());
    for (const name of imported) {
      const cleanName = name.replace(/ as \w+$/, '');
      if (!knownApis.includes(cleanName)) {
        warn(`${label}: import "${cleanName}" não é um export conhecido do SDK`);
      }
    }
  }
}

function printReport() {
  console.log(`\n📦 ${type}: ${path.basename(absDir)}`);
  console.log(`   ${absDir}\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Nenhum problema encontrado.');
    return;
  }

  if (errors.length > 0) {
    console.log('❌ Erros:');
    errors.forEach(e => console.log(`   • ${e}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log('⚠️  Avisos:');
    warnings.forEach(w => console.log(`   • ${w}`));
    console.log();
  }

  process.exit(errors.length > 0 ? 1 : 0);
}
