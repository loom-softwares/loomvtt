# API Client (`api.ts`)

Cliente HTTP com autenticação via cookie (credentials: include). Todas as chamadas são prefixadas com `/api`.

```typescript
import { api, API_PATHS } from '/_loom/sdk/index.js';
```

> **No SDK:** `import { api, API_PATHS, keybinds, LoomHooks, SystemRegistry, diceRegistry, sheets, wrap, showToast } from '/_loom/sdk/index.js'`

> **Observação:** `ApiError` **não** é exportado pelo SDK. Ele existe em `client/core/api.ts`
> (interior do cliente) e não faz parte da API pública do `@loomvtt/sdk`. Para checar
> erros HTTP, inspecione `e.status` ou `e.message` diretamente no `catch`.

## Métodos

```typescript
api.get<T>(path: string): Promise<T>
api.post<T>(path: string, body?: unknown): Promise<T>
api.put<T>(path: string, body?: unknown): Promise<T>
api.delete<T>(path: string): Promise<T>
```

## SDK Exports

Além do cliente HTTP, o SDK exporta:

| Export                  | Tipo                                                    | Descrição                                                      |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `api`                 | `API`                                                 | Cliente REST                                                     |
| `API_PATHS`           | `object`                                              | Constantes de caminhos                                           |
| `LoomHooks`           | `HooksAPI`                                            | Sistema de eventos                                               |
| `SystemRegistry`      | `SystemRegistryAPI`                                   | Registro de sistemas                                             |
| `defineSystem`        | `(config) => LoomSystem`                              | Helper typed para definir sistemas                               |
| `diceRegistry`        | `DiceRegistryAPI`                                     | Registro de dados                                                |
| `keybinds`            | `KeybindRegistryAPI`                                  | Registro de atalhos                                              |
| `sheets`              | `SheetCatalogAPI`                                     | Catálogo de fichas                                              |
| `windowManager`       | `WindowManagerAPI`                                    | Gerenciador de janelas                                           |
| `wrap`                | `(fn) => Wrappable`                                   | Criar ponto de wrapping                                          |
| `getWraps`            | `() => wraps`                                         | Pontos de wrap existentes                                        |
| `statusEffects`       | `StatusEffectRegistryAPI`                             | Registro de condições/status effects                           |
| `loadThree`           | `() => Promise<typeof import('three')>`               | Carrega Three.js sob demanda                                     |
| `loadCannon`          | `() => Promise<typeof import('cannon-es')>`           | Carrega cannon-es sob demanda                                    |
| `showToast`           | `(msg, type?) => void`                                | Toast                                                            |
| `showConfirm`         | `(title, msg) => Promise<boolean>`                    | Confirmação                                                    |
| `showPrompt`          | `(message, default?) => Promise<string\|null>`         | Input                                                            |
| `showAlert`           | `(message) => Promise<void>`                          | Alerta                                                           |
| `showSelectDialog`    | `(title, message, options[]) => Promise<string\|null>` | Diálogo de seleção                                            |
| `BaseWindow`          | `class`                                               | Classe base pra qualquer janela                                  |
| `LoomDocumentSheet`   | `class`                                               | Base de ficha com data-binding automático                       |
| `LoomHandlebarsMixin` | `function`                                            | Mixin`(Base) => class` — render por `static PARTS`/`TABS` |
| `LoomDialog`          | `class`                                               | Diálogo modular                                                 |
| `fields`              | `object`                                              | Data fields API (StringField, NumberField, etc)                  |
| `VERSION`             | `string`                                              | Versão do SDK                                                   |

## Constantes (API_PATHS)

```typescript
API_PATHS = {
  SETUP_STATUS: '/setup/status',
  SETUP_INIT: '/setup/init',
  SETUP_LOGIN: '/setup/login',
  SETUP_LOGOUT: '/setup/logout',
  SETUP_VERIFY: '/setup/verify',
  SETUP_CONFIG: '/setup/config',
  SETUP_LOCAL_ADDRESS: '/setup/local-address',
  WORLDS: '/worlds',
  WORLDS_INVITE_LINKS: '/worlds/:id/invite-links',
  WORLDS_REGENERATE_PASSWORD: '/worlds/:id/invite-links/regenerate-password',
  SYSTEMS: '/systems',
  MARKETPLACE: '/marketplace',
};
```

## Exemplo

```typescript
try {
  const actors = await api.get('/actors');
} catch (e) {
  // Não há ApiError exportado no SDK — inspecione diretamente:
  console.error(e.status, e.message);
}
```

> **Nota:** `ApiError` não é exportado pelo SDK. Em `catch`, inspecione `e.status` ou `e.message` diretamente.
