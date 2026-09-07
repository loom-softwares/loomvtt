# Ícones

O LoomVTT desenha ícones a partir da marcação do Font Awesome, mas os traços que
aparecem na tela vêm do [Lucide](https://lucide.dev). Você escreve o mesmo HTML de
sempre e recebe o traço novo.

```html
<i class="fa-solid fa-star"></i>
```

Não há função a importar, nem componente a instanciar. A substituição acontece em
CSS.

## Como funciona

`client/styles/generated/hud-icons.css` traz uma regra por ícone que troca o glifo
do Font Awesome por uma máscara SVG do Lucide:

```css
.fa-star::before {
  content: '';
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  mask: url("data:image/svg+xml,…") no-repeat center / contain;
}
```

Consequências práticas para quem escreve sistema ou addon:

- O ícone **herda a cor do texto** (`currentColor`). Para recolorir, mude `color`
  no elemento ou no pai — não `background`.
- O ícone **mede 1em**, então acompanha o `font-size` do contexto, igual ao
  Font Awesome fazia.
- Modificadores de tamanho do Font Awesome (`fa-lg`, `fa-2x`) continuam
  funcionando, porque atuam sobre `font-size`.

## Nome fora do mapa continua no Font Awesome

Só os ícones de fato usados pelo app entram no arquivo gerado. **Um nome que não
está no mapa desenha o Font Awesome normal** — não vira quadrado vazio.

Isso é deliberado e protege dois casos que o core não controla: ícone de macro,
escolhido pelo usuário em tempo de execução, e ícone que um sistema de terceiros
injeta como HTML cru. O Font Awesome segue carregado no app exatamente por isso.

Ou seja: qualquer nome válido do Font Awesome funciona. Os que o LoomVTT mapeia
aparecem com o traço do Lucide; o resto aparece como antes.

## Marcas

`fa-github` e `fa-discord` vêm do [Simple Icons](https://simpleicons.org), não do
Lucide — que removeu ícones de marca por questão de licenciamento. Trocar um logo
conhecido por um ícone genérico descaracterizaria a marca.

Marcas usam molde de preenchimento em vez de traço, mas o uso é idêntico:

```html
<i class="fa-brands fa-github"></i>
```

## Pedir um ícone novo

Se o seu sistema usa um nome do Font Awesome que ainda não está mapeado, ele já
funciona — mas com o traço antigo, e vai destoar do resto da interface.

Para mapear, edite `MAP` em `scripts/gen-icons.mjs` e regenere:

```bash
npm run gen:icons
```

A chave é o nome do Font Awesome sem o prefixo `fa-`; o valor é o nome no Lucide.

```js
const MAP = {
  'shield-halved': 'shield',
  'masks-theater': 'drama',
};
```

O script falha e lista os nomes se algum não existir no Lucide, então erro de
digitação aparece na hora em vez de virar ícone faltando na tela.

## Licenças

| Origem | Licença | Exige atribuição |
|---|---|---|
| Lucide | ISC | Não |
| Simple Icons | CC0 | Não |
| Font Awesome Free | CC BY 4.0 | **Sim** |

`lucide-static` e `simple-icons` são `devDependencies`: servem apenas ao gerador.
O CSS gerado é versionado, então **o bundle do cliente não carrega nenhuma das
duas bibliotecas** — o custo em produção é só o arquivo de máscaras.

## Emoji

Alguns pontos da interface usam emoji de propósito, e não são candidatos a
conversão: as condições de status do token (envenenado, queimando, atordoado)
aparecem miúdas e sobrepostas ao token, várias ao mesmo tempo, e a cor própria do
emoji é o que permite distingui-las sobre um mapa colorido. Ícone monocromático
de 16px seria pior de ler exatamente onde mais importa.

O mesmo vale para os naipes de carta (`♥ ♠ ♦ ♣`) e para marcadores em que a cor
carrega o significado.

## Ver também

- [`wrappable.md`](wrappable.md) — opções de menu de card aceitam ícone como HTML
  cru, e valem as mesmas regras desta página.
