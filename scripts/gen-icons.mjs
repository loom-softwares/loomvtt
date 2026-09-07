/**
 * Gera `client/styles/generated/hud-icons.css`.
 *
 * Só entram os ícones realmente usados pelo app — não as bibliotecas inteiras.
 * `lucide-static` e `simple-icons` são devDependencies: servem só a este
 * script. O CSS gerado é commitado e não exige nada em tempo de build nem de
 * execução, então o bundle do cliente não carrega nenhuma das duas bibliotecas.
 *
 * Para regerar depois de mexer no mapa:
 *   npm run gen:icons
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'node_modules/lucide-static/icons';

/** Font Awesome -> Lucide. Chave = nome usado hoje nos templates, sem o `fa-`. */
const MAP = {
  'arrow-right-from-bracket':'log-out','arrows-alt':'move','arrows-alt-h':'move-horizontal',
  'bars':'menu','bold':'bold','bolt':'zap','book':'book','book-atlas':'book-marked',
  'book-open':'book-open','briefcase':'briefcase','bug':'bug','bullseye':'target',
  'caret-down':'chevron-down','caret-up':'chevron-up','chevron-up':'chevron-up',
  'circle':'circle','circle-play':'circle-play','clapperboard':'clapperboard','clone':'copy',
  'code':'code','cog':'settings','comment':'message-circle','copy':'copy','crow':'bird',
  'cube':'box','cubes':'boxes','dice':'dice-5','door-closed':'door-closed','door-open':'door-open',
  'door-secret':'door-closed','draw-polygon':'pentagon','earth-americas':'earth','eye':'eye',
  'eye-slash':'eye-off','file-circle-plus':'file-plus','floppy-disk':'save','folder':'folder',
  'folder-open':'folder-open','folder-plus':'folder-plus','font':'type','gear':'settings',
  'ghost':'ghost','globe':'globe','grip-lines':'grip-horizontal','hand-pointer':'pointer',
  'hiking':'footprints','image':'image','key':'key','keyboard':'keyboard','layer-group':'layers',
  'leaf':'leaf','lightbulb':'lightbulb','link':'link','lock':'lock','lock-open':'lock-open',
  'magnet':'magnet','map':'map','map-pin':'map-pin','masks-theater':'drama','microphone':'mic',
  'moon':'moon','mountain':'mountain','mouse-pointer':'mouse-pointer-2','music':'music',
  'paint-brush':'paintbrush','pencil-alt':'pencil','play':'play','plus':'plus',
  'right-from-bracket':'log-out','rotate':'rotate-cw','rotate-right':'rotate-cw','ruler':'ruler',
  'ruler-horizontal':'ruler','running':'footprints','sack-xmark':'package-x','scroll':'scroll',
  'shield-halved':'shield','slash':'slash','spider':'bug','square':'square','stop':'square',
  'sun':'sun','terminal':'terminal','th':'grid-3x3','trash':'trash-2','trash-alt':'trash-2',
  'trash-can':'trash-2','undo-alt':'undo-2','user':'user','user-friends':'users',
  'user-group':'users','user-injured':'user-x','users':'users','user-secret':'venetian-mask',
  'arrow-down-to-bracket':'download','arrow-left':'arrow-left',
  'arrow-up-from-bracket':'upload','arrows-rotate':'refresh-cw',
  'arrows-turn-to-dots':'git-fork','bell':'bell','bell-slash':'bell-off',
  'book-medical':'book-heart','border-all':'grid-2x2','box-open':'package-open',
  'calendar':'calendar','clipboard':'clipboard','clipboard-list':'clipboard-list',
  'cogs':'settings-2','coins':'coins','compass':'compass','crop-simple':'crop',
  'crown':'crown','dice-d20':'dices','download':'download',
  'edit':'pencil','ellipsis-vertical':'ellipsis-vertical','external-link-alt':'external-link',
  'file':'file','file-image':'file-image','fire':'flame','gift':'gift',
  'hammer':'hammer','heart':'heart','id-card':'id-card','images':'images','khanda':'swords',
  'language':'languages','list':'list','magnifying-glass':'search','minus':'minus',
  'note-sticky':'sticky-note','palette':'palette','pen-to-square':'square-pen',
  'person-running':'footprints','puzzle-piece':'puzzle','rocket':'rocket','save':'save',
  'share':'share-2','skull':'skull','sliders':'sliders-horizontal','spinner':'loader-circle',
  'square-plus':'square-plus','stamp':'stamp','star':'star','table-cells-large':'layout-grid',
  'triangle-exclamation':'triangle-alert','undo':'undo-2','up-right-from-square':'external-link',
  'wrench':'wrench',
  'volume-high':'volume-2','volume-mute':'volume-x','volume-up':'volume-2','volume-xmark':'volume-x',
  'walking':'footprints','water':'waves','window-maximize':'maximize','xmark':'x',
};

/**
 * Marcas (GitHub, Discord) vêm do Simple Icons, não do Lucide: o Lucide
 * removeu ícones de marca por questão de licenciamento, e trocar um logo
 * conhecido por um ícone genérico descaracteriza a marca. Simple Icons é CC0,
 * então continua sem exigir atribuição — que era o motivo de sair do FA.
 *
 * Logo é forma preenchida, não traço: entram por um molde próprio, com fill
 * e sem stroke.
 */
const MARCAS = { 'github': 'github', 'discord': 'discord' };
const DIR_MARCAS = 'node_modules/simple-icons/icons';

const faltando = [];
const corpos = {};
for (const [fa, lucide] of Object.entries(MAP)) {
  const f = path.join(DIR, lucide + '.svg');
  if (!fs.existsSync(f)) { faltando.push(fa + ' -> ' + lucide); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  corpos[fa] = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('');
}

if (faltando.length) {
  console.error('Nomes inexistentes no Lucide (' + faltando.length + '):');
  faltando.forEach((x) => console.error('  ' + x));
  process.exit(1);
}

/** Marcas: mesmo dicionário de corpos, mas marcadas para usar o molde de fill. */
const marcas = {};
for (const [fa, si] of Object.entries(MARCAS)) {
  const f = path.join(DIR_MARCAS, si + '.svg');
  if (!fs.existsSync(f)) {
    console.error('Marca ausente no simple-icons: ' + fa + ' -> ' + si);
    process.exit(1);
  }
  marcas[fa] = fs
    .readFileSync(f, 'utf8')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .trim();
}

/**
 * Gera CSS, não TypeScript.
 *
 * A marcação `<i class="fa-solid fa-trash">` continua igual; a regra abaixo
 * troca o glifo do Font Awesome por uma máscara com o traço do Lucide.
 *
 * Por que CSS e não um helper `icon()` no TS: os ícones aparecem tanto em
 * template literals quanto em strings simples (`toolbox.ts`), e há classes
 * montadas em tempo de execução (`fa-caret-${aberto ? 'up' : 'down'}`, ícone
 * de macro escolhido pelo usuário). Nenhum substituidor automático acertaria
 * os três casos, e o ícone de macro nem tem lista conhecida.
 *
 * Cada ícone ganha sua própria regra COMPLETA — não existe regra base que
 * zere o glifo de todo mundo. Consequência deliberada: ícone fora do mapa
 * continua desenhando o Font Awesome normal, em vez de virar quadrado vazio.
 * Isso vale inclusive para ícone que um sistema de terceiros injete.
 */
const todos = [
  ...Object.entries(corpos).map(([n, c]) => [n, c, false]),
  ...Object.entries(marcas).map(([n, c]) => [n, c, true]),
];

const regras = todos
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([nome, corpo, ehMarca]) => {
    const svg = ehMarca
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black">' + corpo + '</svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
        'stroke="black" stroke-width="1.75" stroke-linecap="round" ' +
        'stroke-linejoin="round">' + corpo + '</svg>';
    const url = encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    return (
      '.fa-' + nome + '::before {\n' +
      "  content: '';\n" +
      '  display: inline-block;\n' +
      '  width: 1em;\n' +
      '  height: 1em;\n' +
      '  vertical-align: -0.135em;\n' +
      '  background-color: currentColor;\n' +
      "  -webkit-mask: url(\"data:image/svg+xml," + url + "\") no-repeat center / contain;\n" +
      "  mask: url(\"data:image/svg+xml," + url + "\") no-repeat center / contain;\n" +
      '}'
    );
  });

const css = `/* ==========================================================================
   Ícones do HUD — traços do Lucide (ISC) sobre a marcação do Font Awesome.
   ==========================================================================

   NÃO EDITE À MÃO. Gerado por \`scripts/gen-icons.mjs\`.
   Para regerar:  npm run gen:icons

   Por que trocar: o traço sólido do Font Awesome é um dos elementos mais
   reconhecíveis da interface que estamos deixando para trás. Além disso, os
   ícones do FA Free são CC BY 4.0 e exigem atribuição visível — inconveniente
   num produto pago. Lucide é ISC e não exige crédito na tela.

   Escopo: o app inteiro, sem seletor de raiz. Começou escopado em
   \`.game-hud\`, mas o menu de contexto monta em \`document.body\` — fora do HUD —
   e ficava com ícone de outra família dentro da mesma tela. Qualquer
   componente compartilhado usado dentro do HUD teria o mesmo problema, então
   a fronteira foi removida em vez de remendada caso a caso.

   Ícone fora do mapa continua desenhando o Font Awesome — de propósito. Há
   classes montadas em tempo de execução (ícone de macro é escolhido pelo
   usuário) e sistemas de terceiros podem injetar ícone próprio; nenhum dos
   dois pode virar quadrado vazio.
   ========================================================================== */

${regras.join('\n\n')}
`;

fs.mkdirSync('client/styles/generated', { recursive: true });
fs.writeFileSync('client/styles/generated/hud-icons.css', css, 'utf8');
console.log('gerado client/styles/generated/hud-icons.css com ' + regras.length + ' ícones');
