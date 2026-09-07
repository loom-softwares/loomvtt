# Registro de Efeitos de Transição de Cena (`transition-effect-registry.ts`)

Registro de efeitos de transição de cena — tocados pelo `CanvasManager` quando uma
stage é ativada (ou atualizada de um jeito que muda fundo/grid/dimensões), controlado
por stage via `transitionType`/`transitionDuration` (Configurar Cena → "Animação de
Transição"). Implementado como **registro additivo por chave** (mesmo padrão de
`Loom.statusEffects`/`Loom.dice`) — não um objeto global substituível.

Os builtins são **dado, não código**: vivem em `client/canvas/transition-effects.json`
e são carregados no registro na inicialização. Um addon adiciona um efeito novo do
mesmo jeito — chama `register()` com um objeto no mesmo formato das entradas do JSON —
nunca precisa mexer em `canvas-manager.ts`, `screens.css` nem na janela de config da cena.

```typescript
import { transitionEffectRegistry } from '/_loom/canvas/transition-effect-registry.js';
// ou, de um addon:
Loom.transitions.register({ ... });
```

## API

```typescript
transitions.register(def: TransitionEffectDef): void
transitions.unregister(id: string): void
transitions.registerAnimator(name: string, fn: (durationMs: number) => Promise<void>): void
```

`register()` também injeta a regra CSS `mask-image`/`filter` do efeito na página
automaticamente — não precisa editar folha de estilo separada.

## TransitionEffectDef

```typescript
interface TransitionEffectDef {
  id: string;              // ex: 'circle', 'wipe'
  label: string;           // aparece no select de config da cena
  usesMask: boolean;       // false = fade só de opacity; true = forma via mask-image/clip-path
  reveal: Keyframe[];      // keyframes da Web Animations API, "coberto" -> "revelado"
  maskImage?: string;      // fórmula CSS mask-image (só quando usesMask)
  filter?: string;         // filter CSS extra (ex: url(#algum-svg-filter))
  extraAnimation?: string; // nome de um animador registrado via registerAnimator()
}
```

Os keyframes de `reveal` podem apontar pra propriedades CSS comuns (`opacity`,
`clipPath`) ou custom properties (`--minha-var`) — uma custom property usada dentro de
`maskImage` precisa de uma declaração `@property` correspondente em `screens.css` pro
navegador interpolar suave em vez de saltar no meio da animação (percentage/angle/etc —
ver as declarações `--iris-r`/`--blind-h`/`--clock-a` já existentes como referência).

## Como toca

Um instante antes da transição começar, `CanvasManager` tira uma foto da tela atual num
`<canvas>` de overlay, aplica a máscara/opacity do efeito nela, troca o conteúdo real da
cena por baixo (invisível, escondido pela foto ainda opaca), e só então roda a animação
de `reveal` — o frame antigo dissolve/abre através da forma, revelando a cena nova. É
por isso que efeitos com `usesMask` não precisam de um estado "cobrir" explícito: a
própria foto já é esse estado.

## Built-ins

`none`, `fade`, `circle` (íris), `swirl` (íris + distorção de pixel de verdade via
filtro SVG `feDisplacementMap`, animado separadamente via `registerAnimator`), `wipe`
(cortina), `blinds` (persiana), `clock` (varredura radial) — ver
`client/canvas/transition-effects.json` pros keyframes/fórmulas exatos.

## Exemplo

```js
Loom.transitions.register({
  id: 'meu-efeito',
  label: 'Meu Efeito',
  usesMask: true,
  reveal: [{ '--minha-var': '0%' }, { '--minha-var': '150%' }],
  maskImage: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent var(--minha-var), #000 var(--minha-var), #000 100%)',
});
```

Aparece automaticamente no select "Tipo de Transição" da config de cena — não precisa
de nenhum wiring adicional além do `register()`.
