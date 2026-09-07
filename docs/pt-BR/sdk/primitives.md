# Primitivas Globais — protótipos estendidos (`primitives.ts`)

Polyfill que estende protótipos nativos do JavaScript (`Array`, `String`, `Math`, `Number`,
`Set`, `Date`) com métodos utilitários que sistemas convertidos assumem já existirem. É um
**side-effect module** (`export {}`): só importar ele (`import './core/primitives.js'`)
já aplica as extensões em runtime — **não há nada pra importar**.

Fonte: `client/core/primitives.ts`.

> **Cuidado:** por mexer em protótipos globais, esses métodos ficam disponíveis em **todo**
> o app cliente, não só em addons convertidos. Evite definir métodos com o mesmo nome pra
> não sobrepor os polyfills.

## `Array.prototype`

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `equals` | `(other: any[]): boolean` | Igualdade elemento a elemento (mesmo tamanho e valores) |
| `partition` | `(fn: (item, index) => boolean): [fail, pass]` | Divide em dois arrays: os que falharam e os que passaram |
| `findSplice` | `(fn: (item, index) => boolean, replacement?): item?` | Remove o primeiro item que bate, opcionalmente inserindo `replacement` no lugar; retorna o item removido |
| `filterJoin` | `(sep: string, fn?): string` | Filtra (ou usa todos) e junta com separador |
| `deepFlatten` | `(): any[]` | Achata recursivamente arrays aninhados |

## `Array` (estático)

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `fromRange` | `(n: number, start?: number): number[]` | Gera `[start, start+1, ..., start+n-1]` |

## `String.prototype`

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `capitalize` | `(): string` | Primeira letra maiúscula |
| `titleCase` | `(): string` | Primeira letra de cada palavra maiúscula |
| `slugify` | `(options?: { replacement?: string; lower?: boolean }): string` | Normaliza (sem acentos) e vira slug |
| `stripScripts` | `(): string` | Remove tags `<script>...` |
| `stripDiacritics` | `(): string` | Remove diacríticos (acentos) |
| `compare` | `(other: string): number` | `localeCompare` case-insensitive (`sensitivity: 'base'`) |

## `Math` (estático)

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `clamp` | `(value, min, max): number` | Limita valor ao intervalo |
| `mix` | `(a, b, t): number` | Interpolação linear `a*(1-t) + b*t` |
| `toDegrees` | `(radians): number` | rad → graus |
| `toRadians` | `(degrees): number` | graus → rad |
| `normalizeDegrees` | `(degrees): number` | Normaliza para `[0, 360)` |
| `normalizeRadians` | `(radians): number` | Normaliza para `[0, 2π)` |
| `SQRT1_3` | `number` (readonly) | `1/sqrt(3)` |
| `SQRT3` | `number` (readonly) | `sqrt(3)` |

## `Number` (estático)

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `isNumeric` | `(value): boolean` | Se é número finito (rejeita null/boolean/string vazia) |
| `between` | `(num, min, max, inclusive?): boolean` | Testa intervalo (inclusivo por padrão) |
| `fromString` | `(str): number \| null` | Converte string, `null` se inválida |
| `paddedString` | `(value, digits): string` | Zero-padding à esquerda |
| `signedString` | `(value): string` | Prefixa `+` para não-negativos |
| `ordinalString` | `(value): string` | Sufixo ordinal (`1st`, `2nd`, `3rd`) |

## `Set.prototype`

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `every` / `some` | `(fn): boolean` | Predicado sobre os elementos |
| `filter` | `(fn): Set` | Retorna novo Set com os que passam |
| `map` | `(fn): Set` | Mapeia para novo Set |
| `find` | `(fn): item?` | Primeiro item que passa |
| `reduce` | `(fn, initial): acc` | Reduz |
| `equals` | `(other: Set): boolean` | Igualdade de conjuntos |
| `isSubset` | `(other: Set): boolean` | Se todos os elementos estão em `other` |
| `intersects` | `(other: Set): boolean` | Se compartilha algum elemento |
| `first` | `(): item?` | Primeiro elemento |
| `toObject` | `(): any[]` | Spread para array |

## `Date.prototype`

| Método | Assinatura | Descrição |
|--------|-----------|-----------|
| `isValid` | `(): boolean` | Se a data é válida |
| `toDateInputString` | `(): string` | `YYYY-MM-DD` (pra `<input type="date">`) |
| `toTimeInputString` | `(): string` | `HH:MM` (pra `<input type="time">`) |

## Exemplo

```js
import './core/primitives.js'; // aplica os polyfills

const arr = [1, [2, [3]]].deepFlatten();        // [1, 2, 3]
const [fail, pass] = [1, 2, 3].partition(n => n > 1); // fail=[1], pass=[2,3]
const slug = 'Olá Mundo!'.slugify();            // 'ola-mundo'
const clamped = Math.clamp(42, 0, 10);          // 10
const nums = Array.fromRange(3, 5);             // [5, 6, 7]
const subset = new Set([1, 2]).isSubset(new Set([1, 2, 3])); // true
```