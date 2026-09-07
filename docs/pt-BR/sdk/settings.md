# Settings (`settings-registry.ts`)

Registro real e persistente de configurações de addon/sistema — `register`, `registerMenu`,
`get`, `set`. Exposto em `window.Loom.settings`.

```typescript
// Não é export do SDK — só existe como global window.Loom.
Loom.settings.register(/* ... */);
```

## API

```typescript
type SettingScope = 'world' | 'client';

interface SettingConfig {
  name?: string;
  hint?: string;
  scope: SettingScope;
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
Loom.settings.getMenus(): RegisteredMenu[];
Loom.settings.getDefinitionsForModule(module: string): RegisteredSetting[];
Loom.settings.settingsMap: Map<string, RegisteredSetting>; // chave `module.key` -> config
```

## Persistência e paridade

- **scope `world`**: persiste via REST (`/api/module-settings/:worldId/:module/:key`), per-world.
- **scope `client`**: persiste em `localStorage` (por usuário/navegador).
- `get()` é **síncrono** (paridade com o que sistemas convertidos esperam). Para `world`,
  o registro dispara pré-carregamento assíncrono de todas as settings do módulo — funciona
  porque sistemas chamam `register()` no hook `init`, muito antes de `get()` em `ready`/render.

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