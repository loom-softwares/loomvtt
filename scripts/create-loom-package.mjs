#!/usr/bin/env node
// Scaffolding CLI: gera ruleset ou addon com estrutura completa, didática,
// pronta pra ser detectada no próximo boot do servidor.
//
// Uso:
//   node scripts/create-loom-package.mjs ruleset meu-sistema
//   node scripts/create-loom-package.mjs addon meu-addon
// ou via npm:
//   npm run create:ruleset -- meu-sistema
//   npm run create:addon -- meu-addon

import fs from 'fs';
import path from 'path';
import os from 'os';

const [, , type, rawName] = process.argv;

if (!['ruleset', 'addon'].includes(type) || !rawName) {
  console.error('Uso: node scripts/create-loom-package.mjs <ruleset|addon> <nome>');
  process.exit(1);
}

const name = rawName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
if (!name) {
  console.error('Nome inválido — use letras, números e hífen.');
  process.exit(1);
}

function getAppDataPath() {
  const appData =
    process.env.LOCALAPPDATA ||
    (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library/Application Support')
      : path.join(os.homedir(), '.config'));
  const isDev = (process.env.npm_lifecycle_event || '').startsWith('dev') || process.env.npm_lifecycle_event?.startsWith('create');
  return path.join(appData, isDev ? 'LoomVTT-Dev' : 'LoomVTT');
}

function getDataRoot() {
  const configPath = path.join(getAppDataPath(), 'Config', 'loom.config.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (cfg.dataPath && cfg.dataPath.trim()) return path.resolve(cfg.dataPath.trim());
  } catch {
    // sem config ainda — cai no default abaixo
  }
  return path.join(getAppDataPath(), 'Data');
}

const folderName = type === 'ruleset' ? 'rulesets' : 'addons';
const manifestName = type === 'ruleset' ? 'ruleset.json' : 'addon.json';
const targetDir = path.join(getDataRoot(), 'marketplace', folderName, name);

if (fs.existsSync(targetDir)) {
  console.error(`Já existe algo em: ${targetDir}\nEscolha outro nome ou apague a pasta antes.`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

// ═══════════════════════════════════════════
// MANIFEST
// ═══════════════════════════════════════════

const manifest = {
  name,
  title: rawName,
  version: '0.1.0',
  description: '',
  author: '',
  client: 'client.js',
  active: true,
};

fs.writeFileSync(path.join(targetDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

// ═══════════════════════════════════════════
// RULESET
// ═══════════════════════════════════════════

if (type === 'ruleset') {
  const sheetsDir = path.join(targetDir, 'sheets');
  const templatesDir = path.join(targetDir, 'templates');
  const stylesDir = path.join(targetDir, 'styles');
  const langDir = path.join(targetDir, 'lang');

  fs.mkdirSync(sheetsDir, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.mkdirSync(langDir, { recursive: true });

  // ── client.js (didático, comentado linha a linha) ──────────────────────
  const clientJs = `// ══════════════════════════════════════════════════════════════
// ${rawName} — Entry point client-side
// ══════════════════════════════════════════════════════════════
//
// Este arquivo é carregado automaticamente pelo LoomVTT quando um
// mundo com este sistema é acessado. Use o SDK (importado abaixo)
// para registrar o sistema, hooks, wrappers e tudo mais que seu
// sistema precisa.
//
// Documentação completa: https://loomvtt.app/docs/
// SDK Reference: docs/sdk/

// ── 1. Importe o que precisar do SDK ──────────────────────────
// O SDK é servido pelo próprio LoomVTT em /_loom/sdk/index.js.
import { SystemRegistry, defineSystem, Hooks, keybinds } from '/_loom/sdk/index.js';

// ── 2. Defina o sistema ───────────────────────────────────────
// Use defineSystem() para ter autocomplete (seu editor vai
// mostrar os campos disponíveis).
SystemRegistry.register(defineSystem({
  id: '${name}',
  title: '${rawName}',
  version: '0.1.0',                     // incremente a cada mudança

  // ── 2a. Tipos de actor que este sistema define ──────────────
  actorTypes: ['character', 'npc'],

  // ── 2b. Tipos de item que este sistema define ───────────────
  itemTypes: ['weapon', 'armor', 'consumable'],

  // ── 3. Dados padrão para cada tipo ──────────────────────────
  // Retorna o objeto systemData inicial quando um novo actor/item
  // é criado com o type informado.
  getDefaultData(type) {
    if (type === 'character') {
      return {
        hp: { value: 10, max: 10 },
        attributes: { str: 10, dex: 10, con: 10 },
        level: 1,
      };
    }
    if (type === 'npc') {
      return { hp: { value: 5, max: 5 }, attributes: { str: 10, dex: 10, con: 10 } };
    }
    return {};
  },

  // ── 4. Validação opcional ───────────────────────────────────
  // Retorne { valid, errors[] } — o LoomVTT bloqueia save se inválido.
  validateData(type, data) {
    const errors = [];
    if (data.hp?.value > data.hp?.max) errors.push('HP não pode exceder o máximo');
    return { valid: errors.length === 0, errors };
  },

  // ── 5. Preparação de dados (opcional) ───────────────────────
  // Roda antes de qualquer uso do actor (render, roll, etc).
  // Use para derivar campos calculados (modifiers, etc).
  prepareData(actor) {
    const data = { ...actor };
    data._modifiers = {
      str: Math.floor((data.attributes?.str || 10) / 2) - 5,
      dex: Math.floor((data.attributes?.dex || 10) / 2) - 5,
      con: Math.floor((data.attributes?.con || 10) / 2) - 5,
    };
    return data;
  },

  // ── 6. Rolagem de iniciativa (opcional) ─────────────────────
  rollInitiative(actor) {
    const mod = Math.floor(((actor.attributes?.dex || 10) / 2) - 5);
    return { formula: \`1d20\${mod >= 0 ? '+' : ''}\${mod}\`, total: 0 };
  },

  // ── 7. Schema da ficha de actor ─────────────────────────────
  getSheetSchema(actorType) {
    if (actorType === 'npc') {
      return { tabs: [{ id: 'main', label: 'Geral', fields: [
        { key: 'hp.value', label: 'HP', type: 'number' },
      ]}]};
    }
    return {
      tabs: [
        {
          id: 'attributes',
          label: 'Atributos',
          fields: [
            { key: 'attributes.str', label: 'Força', type: 'number' },
            { key: 'attributes.dex', label: 'Destreza', type: 'number' },
            { key: 'attributes.con', label: 'Constituição', type: 'number' },
            { key: 'level', label: 'Nível', type: 'number' },
            // type: 'dots' — pips (útil para WoD / Storyteller)
            // { key: 'willpower', label: 'Força de Vontade', type: 'dots', max: 10 },
          ],
        },
        {
          id: 'combat',
          label: 'Combate',
          fields: [
            { key: 'hp.value', label: 'HP Atual', type: 'number' },
            { key: 'hp.max', label: 'HP Máximo', type: 'number' },
          ],
        },
      ],
    };
  },

  // ── 8. Schema da ficha de item ──────────────────────────────
  getItemSheetSchema(itemType) {
    if (itemType === 'weapon') {
      return { tabs: [{ id: 'main', label: 'Arma', fields: [
        { key: 'damage', label: 'Dano', type: 'text' },
        { key: 'damageType', label: 'Tipo de Dano', type: 'text' },
      ]}]};
    }
    return null; // schema padrão (campos genéricos)
  },

  getItemDefaultData(itemType) {
    if (itemType === 'weapon') return { damage: '1d6', damageType: 'physical' };
    if (itemType === 'armor') return { defense: 1 };
    return {};
  },
}));

// ── 9. Hooks — exemplos ──────────────────────────────────────
// Hooks permitem reagir a eventos. Descomente para testar:

// Hooks.on('createActor', (actor) => {
//   console.log(\`[${rawName}] Actor criado: \${actor.name}\`);
// });
//
// Hooks.on('preRoll', (ctx) => {
//   console.log(\`[${rawName}] Rolagem: \${ctx.formula}\`);
//   // ctx.formula — você pode modificar antes do roll ser enviado
//   // ctx.meta = { ... } — dados extras que aparecem no card
// });

// ── 10. Keybinds — exemplos ──────────────────────────────────
// keybinds.register({
//   id: '${name}-special-action',
//   label: 'Ação Especial',
//   description: 'Dispara uma ação do sistema',
//   defaultKey: 'Ctrl+Shift+Z',
//   category: '${rawName}',
//   onPress: () => console.log('Ação do sistema disparada!'),
// });

// ── 11. Wraps — interceptação de funções core ────────────────
// import { wrap } from '/_loom/sdk/index.js';
//
// const unsub = wrap(resolveFOVOrigins).wrap((original, token) => {
//   console.log('Calculando FOV para', token.id);
//   return original(token);
// });

console.log('[${rawName}] Sistema carregado com sucesso!');
`;

  // ── sheets/character.mjs ──────────────────────────────────────
  const characterSheet = `// Sheet personalizada para o tipo "character".
// Se getSheetSchema() não for suficiente, estenda a classe base:

// import { sheets } from '/_loom/sdk/index.js';
//
// const BaseActorSheet = sheets.get('actor', '*');
//
// class ${rawName.replace(/[^a-zA-Z0-9]/g, '')}CharacterSheet extends BaseActorSheet {
//   // Personalize aqui — veja docs/sdk/sheets.md
// }
//
// sheets.catalog('actor', 'character', ${rawName.replace(/[^a-zA-Z0-9]/g, '')}CharacterSheet);
`;

  // ── sheets/item.mjs ──────────────────────────────────────────
  const itemSheet = `// Sheet personalizada para itens (se necessário).
// import { sheets } from '/_loom/sdk/index.js';
//
// const BaseItemSheet = sheets.get('item', '*');
//
// class MeuItemSheet extends BaseItemSheet {
// }
//
// sheets.catalog('item', 'weapon', MeuItemSheet);
`;

  // ── templates/example.hbs ─────────────────────────────────────
  const exampleHbs = `{{! Exemplo de template Handlebars para sheet customizada }}
{{! Referencie via getSheetSchema() → a engine renderiza automático }}

<div class="meu-sistema-sheet">
  <div class="sheet-header">
    <h2>{{name}}</h2>
    <span class="sheet-type">{{type}}</span>
  </div>

  <div class="sheet-body">
    <div class="stat-block">
      <label>HP</label>
      <span>{{systemData.hp.value}} / {{systemData.hp.max}}</span>
    </div>

    {{#each systemData.attributes as |value key|}}
      <div class="stat-row">
        <span class="stat-label">{{key}}</span>
        <span class="stat-value">{{value}}</span>
      </div>
    {{/each}}
  </div>
</div>
`;

  // ── styles/system.css ─────────────────────────────────────────
  const systemCss = `/* ${rawName} — estilos do sistema */
/* Este CSS é injetado automaticamente quando o sistema é carregado. */

.meu-sistema-sheet {
  padding: 0.5rem;
  font-family: 'Inter', sans-serif;
}

.meu-sistema-sheet .sheet-header {
  border-bottom: 1px solid var(--color-border, #333);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
}

.meu-sistema-sheet .sheet-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-text-primary, #e0e0e0);
}

.meu-sistema-sheet .stat-block {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border-subtle, #222);
}

.meu-sistema-sheet .stat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
}

.meu-sistema-sheet .stat-label {
  color: var(--color-text-secondary, #999);
  text-transform: uppercase;
  font-size: 0.8rem;
}
`;

  // ── lang/pt-BR.json ───────────────────────────────────────────
  const langPtBr = JSON.stringify({
    [`${name}.title`]: rawName,
    [`${name}.sheet.attributes`]: 'Atributos',
    [`${name}.sheet.combat`]: 'Combate',
    [`${name}.sheet.hp`]: 'HP',
    [`${name}.sheet.hpMax`]: 'HP Máximo',
    [`${name}.character`]: 'Personagem',
    [`${name}.npc`]: 'NPC',
    [`${name}.weapon`]: 'Arma',
    [`${name}.armor`]: 'Armadura',
    [`${name}.consumable`]: 'Consumível',
  }, null, 2);

  // ── README.md ─────────────────────────────────────────────────
  const readme = `# ${rawName}

Sistema de RPG para LoomVTT.

## Estrutura

\`\`\`
${name}/
├── ruleset.json          ← manifesto (nome, versão, entry point)
├── client.js             ← entry point (registra sistema, hooks, etc.)
├── sheets/
│   ├── character.mjs     ← sheet customizada (opcional)
│   └── item.mjs          ← sheet de item customizada (opcional)
├── templates/
│   └── example.hbs       ← template Handlebars (opcional)
├── styles/
│   └── system.css        ← estilos do sistema (opcional)
└── lang/
    └── pt-BR.json        ← traduções (opcional)
\`\`\`

## Tipos definidos

| Tipo | Categoria |
|------|-----------|
| \`character\` | Actor |
| \`npc\` | Actor |
| \`weapon\` | Item |
| \`armor\` | Item |
| \`consumable\` | Item |

## Atalhos de teclado

Nenhum atalho registrado ainda. Adicione via \`keybinds.register()\` em \`client.js\`.

## Links

- Documentação do SDK: https://loomvtt.app/docs/sdk/
`;

  // ── Escrever todos os arquivos ────────────────────────────────
  fs.writeFileSync(path.join(targetDir, 'client.js'), clientJs, 'utf-8');
  fs.writeFileSync(path.join(sheetsDir, 'character.mjs'), characterSheet, 'utf-8');
  fs.writeFileSync(path.join(sheetsDir, 'item.mjs'), itemSheet, 'utf-8');
  fs.writeFileSync(path.join(templatesDir, 'example.hbs'), exampleHbs, 'utf-8');
  fs.writeFileSync(path.join(stylesDir, 'system.css'), systemCss, 'utf-8');
  fs.writeFileSync(path.join(langDir, 'pt-BR.json'), langPtBr, 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'README.md'), readme, 'utf-8');
}

// ═══════════════════════════════════════════
// ADDON
// ═══════════════════════════════════════════

if (type === 'addon') {
  const stylesDir = path.join(targetDir, 'styles');
  const langDir = path.join(targetDir, 'lang');
  const templatesDir = path.join(targetDir, 'templates');

  fs.mkdirSync(stylesDir, { recursive: true });
  fs.mkdirSync(langDir, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });

  const addonClientJs = `// ══════════════════════════════════════════════════════════════
// ${rawName} — Addon entry point
// ══════════════════════════════════════════════════════════════

import { Hooks, api, showToast, showConfirm, keybinds, sheets, wrap } from '/_loom/sdk/index.js';

console.log('[${rawName}] addon carregado');

// ── Hooks ──────────────────────────────────────────────────
// Hooks.on('actor.created', (actor) => {
//   showToast(\`\${actor.name} foi criado!\`, 'success');
// });
//
// Hooks.on('preRoll', (ctx) => {
//   ctx.meta = { fonte: '${rawName}' };
// });

// ── Keybinds ───────────────────────────────────────────────
// keybinds.register({
//   id: '${name}-toggle',
//   label: 'Alternar ${rawName}',
//   description: 'Ativa/desativa funcionalidade do addon',
//   defaultKey: 'Ctrl+Shift+${name.charAt(0).toUpperCase()}',
//   category: '${rawName}',
//   onPress: () => showToast('${rawName} ativado!', 'info'),
// });

// ── Wraps ──────────────────────────────────────────────────
// import { getWraps } from '/_loom/sdk/index.js';
// const wraps = getWraps();
// if (wraps.renderRollCard) {
//   wraps.renderRollCard.wrap((original, roll, esc) => {
//     // Personaliza o card de rolagem
//     return original(roll, esc);
//   });
// }

// ── API ────────────────────────────────────────────────────
// const actors = await api.get('/actors?worldId=meu-mundo');
`;

  const readme = `# ${rawName}

Addon para LoomVTT.

## Estrutura

\`\`\`
${name}/
├── addon.json        ← manifesto
├── client.js         ← entry point client-side
├── styles/           ← CSS opcional
├── templates/        ← Handlebars opcional
└── lang/             ← traduções opcionais
\`\`\`

## API usada

- Hooks, api, showToast, showConfirm, keybinds, sheets, wrap
`;

  fs.writeFileSync(path.join(targetDir, 'client.js'), addonClientJs, 'utf-8');
  fs.writeFileSync(path.join(stylesDir, '.gitkeep'), '', 'utf-8');
  fs.writeFileSync(path.join(langDir, '.gitkeep'), '', 'utf-8');
  fs.writeFileSync(path.join(templatesDir, '.gitkeep'), '', 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'README.md'), readme, 'utf-8');
}

// ═══════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════

console.log(`✅ ${type === 'ruleset' ? 'Ruleset' : 'Addon'} "${name}" criado em:`);
console.log(`   ${targetDir}`);
console.log('');
if (type === 'ruleset') {
  console.log('Arquivos gerados:');
  console.log(`   ruleset.json    — manifesto`);
  console.log(`   client.js       — entry point (didático, comentado)`);
  console.log(`   sheets/         — schemas de ficha`);
  console.log(`   templates/      — templates Handlebars`);
  console.log(`   styles/         — CSS do sistema`);
  console.log(`   lang/           — arquivos de tradução`);
  console.log(`   README.md       — documentação do sistema`);
  console.log('');
  console.log('Próximos passos:');
  console.log(`  1. Edite client.js com as regras do seu sistema.`);
  console.log(`  2. No Setup Hub → Criação/Alteração de Mundo, selecione "${rawName}".`);
} else {
  console.log('Arquivos gerados:');
  console.log(`   addon.json      — manifesto`);
  console.log(`   client.js       — entry point`);
  console.log(`   styles/         — CSS opcional`);
  console.log(`   templates/      — Handlebars opcional`);
  console.log(`   lang/           — traduções opcionais`);
  console.log(`   README.md       — documentação do addon`);
  console.log('');
  console.log('Próximos passos:');
  console.log(`  1. Edite client.js com a lógica do addon.`);
  console.log(`  2. Ative em Setup Hub → Módulos → "${rawName}".`);
}
console.log('  3. Reinicie o servidor ou dê refresh no client.');
