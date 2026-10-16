# Settings (`settings-registry.ts`)

Registro real e persistente de configurações de addon/sistema — `register`, `registerMenu`,
`get`, `set`. Exposto em `window.Loom.settings` e como export `settings` do SDK.
O export do SDK tem só `register`, `registerMenu`, `get`, `set` e `settings`. `whenReady` existe apenas em
`window.Loom.settings`, então um módulo que importa do SDK não consegue aguardar os valores salvos.

```typescript
import { settings } from '/_loom/sdk/index.js';
// ou, sem import:
Loom.settings.register(/* ... */);
```

## API

```typescript
type SettingScope = 'world' | 'client';

interface SettingConfig {
  name?: string;
  hint?: string;
  scope?: SettingScope; // opcional nos tipos do SDK; sempre passe (ver "Persistência e paridade")
  config?: boolean;
  type?: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor | 'string' | 'number' | 'boolean' | 'object' | 'array';
  default: any;
  choices?: Record<string, string>;
  onChange?: (value: any) => void;
}

interface SettingMenuConfig {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  restricted?: boolean;
  type?: new (...args: any[]) => any; // classe a instanciar ao abrir o menu
}

Loom.settings.register(module: string, key: string, config: SettingConfig): void;
Loom.settings.registerMenu(module: string, key: string, config: SettingMenuConfig): void;
Loom.settings.get(module: string, key: string): any;
Loom.settings.set(module: string, key: string, value: any): Promise<void>;
Loom.settings.whenReady(module: string): Promise<void>; // só em window.Loom.settings: resolve quando as settings salvas do mundo do módulo são carregadas
Loom.settings.settings: Map<string, RegisteredSetting>; // chave `module.key` -> config
```

> **Rótulos de menu são chaves de tradução.** A janela de settings passa `label` (ou `name`, depois a chave)
> pelo tradutor da engine, então uma chave desconhecida aparece como a própria chave. Use uma chave dos seus
> arquivos de idioma para ter um rótulo traduzido; texto puro em inglês só aparece como está porque não é uma chave conhecida.
>
> **CODE ISSUE:** `getMenus()` e `getDefinitionsForModule(module)` existem no registro interno
> (`client/core/settings-registry.ts`), mas `window.Loom.settings` não os expõe. Para ler as definições use
> `Loom.settings.settings`. No `window.Loom` o mapa se chama `settings`, não `settingsMap`.

## Persistência e paridade

- **scope `world`**: persiste via REST (`/api/module-settings/:worldId/:module/:key`), per-world. `set()` rejeita a promise se nenhum mundo estiver ativo.
- **scope `client`**: persiste em `localStorage` (por usuário/navegador).
- `set()` chama o `onChange` da definição depois de salvar.
- `get()` é **síncrono** (paridade com o que sistemas convertidos esperam). Para `world`,
  o registro dispara pré-carregamento assíncrono de todas as settings do módulo — funciona
  porque sistemas chamam `register()` no hook `init`, muito antes de `get()` em `ready`/render.
  Enquanto os valores salvos não chegam, `get()` devolve o default. Use `await Loom.settings.whenReady(module)`
  quando um valor salvo precisar ser lido na inicialização.
- O pré-carregamento tem duas pré-condições. Um mundo precisa estar ativo quando `register()` roda, e
  `scope: 'world'` precisa estar escrito explicitamente. Sem mundo ativo, `whenReady()` resolve na hora, nada é
  carregado e `get()` continua devolvendo os defaults.
- Uma definição sem `scope` é lida e gravada como `world`, mas `register()` não a pré-carrega. Sempre passe `scope`.

## Settings pre-registradas

Settings que a engine já registra com default, assumidas por sistemas convertidos sem
chamada explícita de `register()`:

| Módulo | Chave | Tipo | Default |
|--------|-------|------|---------|
| `core` | `chatBubblesPan` | Boolean | `true` |
| `core` | `notesDisplayToggle` | Boolean | `false` |
| `core` | `language` | String | `'en'` |

## Exemplo

```js
Loom.settings.register('meu-addon', 'modoDifícil', {
  scope: 'client',
  type: Boolean,
  default: false,
  onChange: (v) => console.log('novo valor:', v),
});

const hard = Loom.settings.get('meu-addon', 'modoDifícil');
await Loom.settings.set('meu-addon', 'modoDifícil', true);
```