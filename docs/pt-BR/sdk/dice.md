# Dados — Parser de Rolagem + Dice Registry

> **Importante pra quem está portando um sistema:** existem DUAS coisas distintas aqui.
>
> - **Parser real** (`server/applications/dice/roller.ts`, função `roll()`) — interpreta a
>   string de fórmula (`"2d6+3"`, `"5d10cs>5c"`) e calcula o `total`. É isso que roda de
>   verdade quando o cliente manda `chat.roll` via WebSocket. Servidor é sempre a
>   autoridade final pros termos padrão (`d`, `kh/kl/dh/dl`, `r`, `x`, `cs>`).
> - **Dice Registry** (`dice-registry.ts`, abaixo) — registro de **expressões de dado
>   customizadas**. Desde a ponte `{kind:config}` (ver seção abaixo), isso **AFETA sim
>   o resultado do roll** quando usado na fórmula — não é mais puramente cosmético.
>
> Um sistema de dice-pool comum (WoD5e, Shadowrun, L5R etc) só precisa mexer na
> **fórmula que manda pro roller** (`cs>`/`cs<`/`cs=`) — não precisa do Dice Registry pra
> isso. O Dice Registry entra em jogo quando um addon quer um TIPO de dado totalmente
> novo (ex: dado 3D físico, ou uma face/expressão que o parser padrão não cobre).

## Sintaxe do parser real (`roll()`)

```
NdF              → N dados de F faces, soma tudo (ex: "2d6")
NdFkh / NdFkl    → mantém só o(s) N mais alto(s)/baixo(s)
NdFdh / NdFdl    → descarta o(s) N mais alto(s)/baixo(s)
NdFr[T]          → reroll uma vez se o resultado for <= T
NdFx[T]          → dado explode (rola de novo) se resultado >= T
NdFcs>N / cs<N / cs=N   → CONTA SUCESSOS (não soma!) — dado-pool genérico
NdFcs>Nc                → igual acima, mas o resultado MÁXIMO da face conta como 2 sucessos
+N / -N          → modificador fixo somado ao total
@caminho.do.dado → substituído por valor numérico antes de avaliar (ver `resolve-formula.ts`)
```

`cs>`/`cs<`/`cs=` transformam o termo num contador de sucessos: em vez de somar os valores
dos dados, `total` vira a contagem de dados que bateram a condição (+2 por dado no natural
máximo, se usar o sufixo `c`). Genérico — qualquer sistema de dice-pool pode usar, não é
específico de nenhum jogo.

**Exemplo (estilo WoD5e — pool de 5 dados básicos + 2 avançados, sucesso >5, crítico dobra em 10):**
```
roll("5d10cs>5c + 2d10cs>5c")
// total = soma de sucessos dos dois grupos de dados
```

## Montando o pool automaticamente (`resolve-formula.ts` / `item-modifiers.ts`)

Antes de rolar, o client pode montar a fórmula automaticamente a partir do actor, em vez
de escrever a soma na mão. Exposto em `window.Loom.rolls`:

```typescript
import { sumPaths } from '../core/resolve-formula.js';
import { getActiveModifiers, collectItemModifiers, type ItemModifier } from '../core/item-modifiers.js';

// Soma vários campos do actor (ex: atributo + perícia)
const baseDice = sumPaths(['attributes.strength.value', 'skills.brawl.value'], actor.systemData);

// Bônus contextuais de item, consultados NO MOMENTO DO ROLL (não aplicados
// permanentemente no data do actor — diferente de BuffChange/effects.ts)
const modifiers = collectItemModifiers(actor.items); // lê `item.systemData.bonuses: ItemModifier[]`
const bonus = getActiveModifiers(modifiers, ['skills.brawl'], actor.systemData);

const formula = `${baseDice + bonus}d10cs>5c`;
```

`ItemModifier` = `{ selectors: string[], value: number, activeWhen?: {...}, source?: string }`.
Um item guarda esses bônus em `systemData.bonuses`; `activeWhen` aceita `always`, `isEqual`
(compara um path do actor a um valor) ou `isPath` (path existe/não é null). Isso é o
equivalente genérico ao "bonuses[] com selectors" que sistemas de dice-pool geralmente têm —
implementado como infraestrutura de motor, não amarrado a nenhum sistema específico.

## `@variable` resolvido automaticamente pelo servidor

Quando o `chat.roll` chega com um `actorId`, o servidor busca o actor, achata o
`systemData` (paths tipo `abilities.dex` viram chave `"abilities.dex"`) e passa isso
como `data` pro `roll()` — então `"1d20+@abilities.dex"` já resolve o valor real do
atributo sem o client precisar montar a fórmula com o número já embutido. Isso é
diferente do `resolveFormula()` do client (que existe pra montagem client-side antes
de mandar) — os dois convivem, use o que fizer mais sentido pro seu caso.

## Termos customizados na fórmula — ponte com o Dice Registry (`{kind:config}`)

`resolveCustomDiceTerms()` (`client/screens/game-hud/roll-dispatch.ts`) resolve termos
no formato `{kind:config}` **no client, antes de mandar a fórmula pro servidor** — o
termo vira o `subtotal` calculado, e o servidor nunca precisa saber que aquele tipo
customizado existe (ruleset/addon nunca roda server-side no LoomVTT).

```
{myDie:6}                        → config escalar (número)
{exploding:{"count":1,"faces":6}} → config objeto
{pool:[3,10]}                     → config array
```

```js
Loom.dice.register('myDie', MyDieExpression);

dispatchRoll({
  ...,
  formula: '1d20+{myDie:6}', // resolvido no client antes de enviar
});
```

Limitação: strings de config contendo `}` quebram o parsing — evite `}` dentro de
valores string do config. `kind` desconhecido ou JSON inválido é deixado como está (não
quebra o roll).

---

# Dice Registry (`dice-registry.ts`)

Registro de expressões de dados customizáveis (visual/face de dado). Exposto globalmente como `globalThis.__loomDice`.

```typescript
import { diceRegistry } from '/_loom/sdk/index.js';
import { DiceExpression, DieExpression, FateExpression, ModifierExpression } from '../applications/dice/dice-expression.js';
```

## API

```typescript
diceRegistry.register(kind: string, exprClass: ExpressionConstructor): void
diceRegistry.create(kind: string, config?: any): DiceExpression | undefined
diceRegistry.has(kind: string): boolean
```

## DiceExpression

```typescript
abstract class DiceExpression {
  abstract readonly kind: string;
  abstract evaluate(): DiceEvaluation;
  abstract toJSON(): object;
}

interface DiceEvaluation {
  rolls: number[];
  subtotal: number;
  label: string;
  dropped?: number[];
}
```

## Expressões nativas

| Classe | kind | Descrição |
|--------|------|-----------|
| `DieExpression` | `'d'` | Dado numérico (d4, d6, d20 etc) |
| `FateExpression` | `'f'` | Dado Fate (-/0/+) |
| `ModifierExpression` | `'m'` | Modificador fixo (+2, -1) |

## Exemplo

```js
const DiceRegistry = globalThis.__loomDice;

// Registrar dado customizado
DiceRegistry.register('d%', MyPercentileDie);

// Usar
const die = DiceRegistry.create('d20', { count: 1 });
const result = die.evaluate();
console.log(result.subtotal, result.rolls);
```

## Compatibilidade VTT (`LoomRoll` e `Die`)

Sistemas convertidos (como WoD5e) estendem largamente as classes base `Roll` e `Die` para injetar comportamento de dados customizados (ex: _VampireHungerDie_). Para manter total compatibilidade com esses construtos nativos do sistema:

- **`Loom.Roll` (`LoomRoll`)**: Uma ponte que implementa a API orientada a objetos (ex: `await roll.evaluate()`, `roll.terms`, `roll.toMessage()`). Ao chamar `toMessage()`, essa classe converte sua própria rolagem num payload para a nossa API Serverless (`dispatchRoll`), não re-rolando dados mas despachando corretamente pro Chat Log e HUD do LoomVTT. Além disso, contém implementações de métodos como `Roll.validate()` e `roll.product()`.
- **`Loom.Die` (`Die`)**: A superclasse polifill que permite subsistemas criarem classes como `class VampireDie extends Die`. Implementa funções centrais como avaliação isolada, extração de targets de sucesso (`cs>X`) e extração de bônus marginais. Os resultados da função `evaluate()` do dado são automaticamente "cacheados" (no array local do dado, `this.results`) e respeitados pelo `LoomRoll`, preservando o design orientado a subclasses do sistema original.

