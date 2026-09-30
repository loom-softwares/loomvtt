# Referência: sheet com abas + elemento flutuante fora da janela

Copie esta estrutura pra qualquer sheet nova que precise de abas e/ou de um elemento
que vaza pra fora do retângulo da janela (rail lateral, popup suspenso). Não invente
CSS de aba nem cálculo de margem do zero — os três pontos abaixo (opções da janela,
HTML, CSS) já existem prontos no core; só troque os nomes.

Não pule nenhum dos três blocos — cada um resolve um bug real, documentado, que já
aconteceu em produção quando faltou:

1. `allowOverflow` + `overflowMargin` sem isso: o elemento flutuante some da tela
   dependendo de onde a janela é arrastada, sem erro nenhum no console.
2. `.loom-window-tabs` / `.tab[data-group]` sem isso: todas as abas ficam visíveis
   ao mesmo tempo, empilhadas.
3. `overflow: visible` escopado na classe do sistema sem isso: mesmo com 1 e 2
   certos, `.loom-window-body` corta o elemento flutuante (scroll do corpo corta o
   eixo X também, não só o Y).

## 1. Opções da janela (`extends BaseWindow`)

```typescript
export class MinhaSheetWindow extends BaseWindow {
  constructor(props: { actorId: string }) {
    super({
      id: `minha-sheet-${props.actorId}`,
      title: 'Minha Sheet',
      width: 900,
      height: 820,
      allowOverflow: true,      // só se tiver elemento vazando pra fora da janela
      overflowMargin: 70,       // largura real do que vaza + folga — trava o arrasto
      classes: ['minha-sheet'], // vira classe do .loom-window raiz, usada no CSS abaixo
    });
  }
}
```

Se a sheet NÃO tem nada vazando pra fora (só abas normais, tudo dentro do corpo),
pule `allowOverflow`/`overflowMargin`/`classes` — só a seção 2 se aplica.

## 2. HTML (dentro de `bodyTemplate()`)

```html
<form class="minha-sheet-root">
  <!-- Opcional: rail flutuante fora da janela (seção 1 precisa estar configurada) -->
  <nav class="minha-sheet-rail">
    <button data-tab="atributos" data-group="primary" class="active">Atributos</button>
    <button data-tab="inventario" data-group="primary">Inventário</button>
  </nav>

  <div class="minha-sheet-body">
    <div class="tab" data-tab="atributos" data-group="primary">
      ... conteúdo da aba ...
    </div>
    <div class="tab" data-tab="inventario" data-group="primary">
      ... conteúdo da aba ...
    </div>
  </div>
</form>
```

Regras fixas, não mude:
- Nav: `[data-tab][data-group]` em qualquer elemento clicável — clique já funciona
  sozinho (delegação do core), não precisa `data-action` nem listener novo.
- Conteúdo: classe `.tab` exata (não `.tab-content`) + `data-tab`/`data-group`
  batendo com o botão correspondente.

## 3. CSS (no stylesheet do sistema)

```css
/* Só necessário se usar rail flutuante fora da janela (senão pule este bloco) */
.minha-sheet .loom-window-body {
  overflow: visible;
}

.minha-sheet-rail {
  position: absolute;
  left: -58px; /* precisa bater com overflowMargin (>=) lá na seção 1 */
  top: 40px;
  width: 52px;
  display: flex;
  flex-direction: column;
}
```

A classe de escopo (`.minha-sheet` aqui) é a mesma passada em `classes: [...]` na
seção 1 — sem essa amarração o `overflow: visible` não teria como saber qual janela
mirar, e aplicar isso genericamente em toda `.loom-window-body` quebraria o scroll
de todas as outras janelas do Loom.

## Onde estão as classes genéricas de aba (nav dentro dos limites da janela)

Se a sua sheet NÃO precisa de rail flutuante fora da janela — só abas normais dentro
do corpo — use as classes genéricas já prontas em vez de reinventar `.minha-sheet-rail`:

```html
<nav class="loom-window-tabs">
  <a data-tab="geral" data-group="primary" class="active">Geral</a>
</nav>
```

`.loom-window-tabs` já estiliza a barra (`client/styles/windows.css`). Isso cobre a
maioria dos casos — o rail flutuante (seção 1/3) é só pra quando o design pede
especificamente algo pendurado pra fora da janela.

Ver também: `docs/sdk/windows.md` (`allowOverflow`, abas), `docs/sdk/wrappable.md`
(`addWrapper`).
