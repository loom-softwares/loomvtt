# Utils — utilitários de objeto (`utils.ts`)

Funções utilitárias críticas para sistemas convertidos: debounce/throttle, merge recursivo,
clonagem profunda e acesso a propriedades aninhadas.

Fonte: `client/core/utils.ts`. Exposto em runtime como `Loom.utils` (todas as
funções), como `Loom.debounce`/`Loom.throttle` (atalhos top-level) e pelo alias global
`vtt.utils` (ver `globals.md`).

## Exports

| Export | Assinatura | Descrição |
|--------|-----------|-----------|
| `debounce` | `<T>(callback: T, delay: number): (...args) => void` | Envolve a função com debounce (executa só após o delay sem novas chamadas) |
| `throttle` | `<T>(callback: T, delay: number): (...args) => void` | Limita a frequência de execução (no máximo uma vez por intervalo, com execução no fim se chamada no meio) |
| `mergeObject` | `(original, other, options?): merged` | Merge recursivo — objetos aninhados combinam, o resto é sobrescrito |
| `duplicate` | `(obj): cloned` | Clone profundo via JSON (perde funções/Map/Set) |
| `deepClone` | `(obj): cloned` | Alias de `duplicate` |
| `getProperty` | `(obj, path): value?` | Lê propriedade aninhada por notação de ponto (`'a.b.c'`) |
| `setProperty` | `(obj, path, value): void` | Define propriedade aninhada, criando objetos intermediários |
| `isEmpty` | `(value): boolean` | `true` se `value` for `null`/`undefined`/array vazio/objeto vazio/Map ou Set vazios |
| `randomID` | `(length = 16): string` | Gera ID alfanumérico aleatório |
| `flattenObject` | `(obj): flat` | Achata objeto aninhado em chaves de ponto (`{a:{b:1}}` → `{"a.b":1}`) — arrays não são achatados |
| `expandObject` | `(obj): nested` | Inverso de `flattenObject` — expande chaves de ponto de volta pra objeto aninhado |
| `parseHTML` | `(html, inline?): HTMLElement` | Parseia string HTML pra elemento DOM (`<div>` por padrão, ou `DocumentFragment` se `inline=true`) |
| `escapeHTML` | `(text): string` | Escapa `& < > " '` pra inserção segura em texto |
| `isVideoUrl` | `(url): boolean` | `true` se a url termina em `.webm`/`.mp4`/`.m4v`/`.ogv`/`.mov` |
| `mediaHtml` | `(url, opts?: {className?, alt?, extraAttrs?}): string` | Retorna `<img>` ou `<video muted loop autoplay>` conforme a extensão — use SEMPRE que renderizar `avatarUrl`/`imgUrl` de campo de usuário no template, nunca escreva `<img>` na mão pra isso (arquivo `.webm` num `<img>` fica em branco, sem erro nenhum) |

## Exemplo

```js
// Loom não é import do SDK — é global no client. Usa Loom.utils (ou vtt.utils).
const { getProperty, mergeObject, duplicate, debounce } = Loom.utils;

// Acesso a propriedade aninhada
const str = getProperty(actor.systemData, 'attributes.strength.value'); // 10

// Merge recursivo — subobjetos combinam, não substituem inteiros
const merged = mergeObject({ a: { x: 1 } }, { a: { y: 2 } });
// merged = { a: { x: 1, y: 2 } }

// Clone profundo
const copy = duplicate(actor.systemData);

// Debounce pra salvar com atraso
const save = debounce(() => submitForm(), 300);
```

> **Limitação do `duplicate`/`deepClone`:** usa `JSON.parse(JSON.stringify())` — funções,
> `Map`, `Set` e valores não serializáveis não são clonados (fica `undefined`/perdido).

> **Nota:** `expandObject` também roda automaticamente como middleware server-side
> (`server/index.ts`) em toda request — qualquer payload de update mandado em
> notação de ponto (`{"system.attributes.hp": 5}`, formato comum em scripts
> convertidos) é expandido antes de chegar no handler da rota, e a chave
> `system` (se presente) é renomeada pra `systemData` automaticamente.
