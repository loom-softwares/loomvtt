# Wrappable (`wrappable.ts`)

Sistema de interceptação de funções que permite addons empilharem wrappers em funções do core, sem depender de bibliotecas de terceiros.

```typescript
import { wrap, getWraps } from '/_loom/sdk/index.js';
```

## API

```typescript
function wrap<Fn extends (...args: any[]) => any>(baseFn: Fn): Wrappable<Fn>

interface Wrappable<Fn> {
  (...args: Parameters<Fn>): ReturnType<Fn>;
  wrap(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
  /** Alias de `wrap()` — mesma implementação, nome da convenção libWrapper real do
   * plataforma original. Alguns sistemas convertidos chamam `.addWrapper()` em vez de `.wrap()`. */
  addWrapper(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
}
```

## Exemplo

```typescript
// Envolver função custom
const minhaFn = wrap((x: number) => x * 2);

// Addon A adiciona wrapper
const unsubA = minhaFn.wrap((original, x) => {
  console.log('Addon A interceptou');
  return original(x);
});

// Addon B empilha outro wrapper
const unsubB = minhaFn.wrap((original, x) => {
  console.log('Addon B primeiro');
  return original(x);
});

// Chamar
minhaFn(5); // Addon B → Addon A → base

// Remover wrapper específico
unsubA();
```

## Comportamento

- Múltiplos wrappers empilham: último registrado = mais externo
- Se um wrapper lançar erro, pula pra camada anterior
- `wrap()` retorna função unsubscribe

## Wrap points já expostos pelo core (`Loom.wraps`)

Pontos de extensão nominais que o core já criou — addon não precisa (e não deveria)
tentar criar os seus próprios equivalentes concorrentes:

| Wrap point | Assinatura | Uso |
|---|---|---|
| `renderRollCard` | `(roll: RollResult, esc) => string` | Customiza o card HTML de um roll no chat |
| `renderMessage` | `(msg, ctx: { esc, canSeeRoll }) => string` | Customiza o HTML de qualquer mensagem de chat |
| `renderMacroIcon` | `(macro) => string` | Customiza o ícone de um slot da hotbar de macros |
| `resolveFOVOrigins` | `function` | Customiza os pontos de origem do cálculo de FOV do Canvas |
| `chatCardContextOptions` | `(msg) => ChatCardContextOption[]` | Itens do menu de clique-direito num card do chat — core já devolve um "Reroll" genérico pra toda mensagem de roll (reenvia a mesma formula/mode/meta/actorId), funciona mesmo sem sistema nenhum registrado |

```js
Loom.wraps.renderRollCard.addWrapper((original, roll, esc) => {
  return `<div class="meu-card-custom">${original(roll, esc)}</div>`;
});

// O "Reroll" simples já vem de graça (core). Só adicione opção extra aqui se
// o sistema tiver mecânica própria condicionando o reroll (ex: gastar 1 ponto
// de Vontade, só disponível se a rolagem falhou, etc) — não duplique o reroll
// genérico que o core já dá.
Loom.wraps.chatCardContextOptions.addWrapper((original, msg) => {
  const base = original(msg);
  if (!msg.isRoll || !msg.roll?.meta?.wod6ePool) return base;
  const willpower = getCurrentWillpower(msg.speaker?.actorId); // exemplo
  if (willpower <= 0) return base;
  return [...base, {
    label: 'Reroll com Vontade (-1)',
    icon: '<i class="fa-solid fa-star"></i>',
    action: () => { /* gasta 1 Vontade, refaz a rolagem com a regra do sistema */ },
  }];
});
```

> **Sobre o `icon`**: é HTML cru, e a marcação do Font Awesome continua sendo a
> forma correta de escrever. O que muda é o desenho — nomes mapeados pelo core
> aparecem com o traço do Lucide, e nomes fora do mapa seguem desenhando o Font
> Awesome, sem virar quadrado vazio. Ver [`icons.md`](icons.md).

### Card de roll custom — NUNCA dê fundo/borda própria pro container raiz

A mensagem inteira (avatar + nome + timestamp + o que `renderRollCard`/`renderMessage`
devolver) já fica dentro de UM envelope do core (`.sidebar-message`) que sozinho já tem
fundo/borda/raio — é a única caixa visual da mensagem. Se o HTML devolvido pelo wrap
point também tiver fundo opaco/borda no elemento raiz, vira "caixa dentro de caixa"
(dois contornos visíveis, um dentro do outro — bug real, já aconteceu).

```css
/* ERRADO — cria um segundo contorno dentro do .sidebar-message */
.meu-card-custom { background: #141414; border: 1px solid #333; border-radius: 8px; }

/* CERTO — transparente, só divisórias sutis entre seções se precisar */
.meu-card-custom { background: transparent; border: none; }
.meu-card-custom .resultado { border-top: 1px solid rgba(255,255,255,0.08); }
```
