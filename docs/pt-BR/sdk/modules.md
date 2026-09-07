# SDK

O SDK é servido pelo próprio LoomVTT em `/_loom/sdk/index.js`. Addons fazem import direto:

```js
import { LoomHooks, api, SystemRegistry } from '/_loom/sdk/index.js';
```

## API completa

| Export | Tipo | Origem |
|--------|------|--------|
 | `LoomHooks` | `{ on, off, once, callAll }` | Sistema de eventos (client-side) |
| `api` | `{ get, post, put, delete }` | Cliente REST |
| `API_PATHS` | `object` | Constantes de rotas |
| `windowManager` | `{ open, focus, close, closeAll }` | Gerenciador de janelas |
| `sheets` | `{ catalog, get }` | Catálogo de fichas |
| `wrap` | `(fn) => Wrappable` | Interceptação de funções |
| `getWraps` | `() => wraps` | Pontos de wrap existentes |
| `showToast` | `(msg, type?) => void` | Notificação |
| `showConfirm` | `(title, msg) => Promise<boolean>` | Confirmação |
| `showPrompt` | `(message, default?) => Promise<string\|null>` | Input |
| `showAlert` | `(message) => Promise<void>` | Alerta |
| `showSelectDialog` | `(title, message, options[]) => Promise<string\|null>` | Diálogo de seleção |
| `SystemRegistry` | `{ register, get, getAll, getActive, setActive }` | Registro de sistemas |
| `defineSystem` | `(config) => LoomSystem` | Helper para definir sistemas |
| `diceRegistry` | `{ register, create, has }` | Registro de dados |
| `keybinds` | `{ register, unregister, getKey, setBinding, resetBinding, resetAll }` | Registro de atalhos |
| `statusEffects` | `{ register, get, getAll }` | Registro de condições/status effects |
| `loadThree` | `() => Promise<typeof import('three')>` | Carrega Three.js sob demanda |
| `loadCannon` | `() => Promise<typeof import('cannon-es')>` | Carrega cannon-es sob demanda |
| `VERSION` | `string` | Versão do SDK |
| `BaseWindow` | `class` | Classe base de janela |
| `LoomDocumentSheet` | `class` | Base de ficha com data-binding |
| `LoomHandlebarsMixin` | `function` | Mixin `(Base) => class` — render por `static PARTS`/`TABS` |
| `LoomDialog` | `class` | Diálogo modular |
| `fields` | `object` | Data fields API (StringField, NumberField, etc.) |

## Tipos exportados

| Tipo | Descrição |
|------|-----------|
| `LoomSystem` | Contrato de ruleset |
| `SheetSchema`, `SheetTab`, `SheetField` | Schema de ficha |
| `DiceEvaluation` | Resultado de rolagem |
| `CastMemberData`, `StageData`, `TileData` | Dados de cena |
| `AmbientLightData`, `DrawingData`, `WallData` | Dados de canvas |
| `NoteData`, `NoiseData` | Dados auxiliares |
| `InitData` | Payload do sync inicial |
| `Wrappable<Fn>` | Tipo do wrapping |
| `WindowLike` | Contrato de janela |
| `ToastType` | `'info' \| 'success' \| 'warning' \| 'error'` |
| `KeybindRegistryAPI` | `{ register, unregister, getKey, setBinding, resetBinding, resetAll }` |

## Alternativa via window.Loom

Addons também podem acessar via `window.Loom.*` sem imports (legado):

```js
Loom.api.get('/actors');
Loom.LoomHooks.on('actor.created', handler);
Loom.windowManager.open('id', MyWindow);
```
