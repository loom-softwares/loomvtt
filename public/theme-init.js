// Aplica tema/paleta ANTES do CSS carregar, senão dá um flash do tema
// errado. Espelha client/core/theme-manager.ts — mudou uma chave de
// localStorage lá, muda aqui também.
(function () {
  try {
    var theme = localStorage.getItem('loom.theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var palette = localStorage.getItem('loom.palette') || 'default';
    if (['default', 'ember', 'frost', 'violet'].indexOf(palette) !== -1) {
      if (palette !== 'default') document.documentElement.setAttribute('data-palette', palette);
    } else {
      var raw = localStorage.getItem('loom.customPalettes');
      var list = raw ? JSON.parse(raw) : [];
      var custom = list.find(function (p) { return p.name === palette; });
      if (custom) {
        var css = Object.entries(custom.vars).map(function (kv) { return '  ' + kv[0] + ': ' + kv[1] + ';'; }).join('\n');
        var style = document.createElement('style');
        style.id = 'loom-custom-theme';
        style.textContent = ':root {\n' + css + '\n}';
        document.head.appendChild(style);
      }
    }
  } catch (e) {}
})();
