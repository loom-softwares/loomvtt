# LoomSidebarTab (`sidebar-tab.ts`)

Base para customizar painéis de sidebar (chat log, compendium directory, actor
directory, settings, etc.) a partir de um sistema ou addon. Não é export do
pacote SDK (`/_loom/sdk/index.js`) — existe só como global `window.Loom`:

```typescript
// Não é import do SDK — só existe como global window.Loom.
class MyChatLog extends Loom.LoomSidebarTab { /* ... */ }
```

## API

```typescript
class LoomSidebarTab {
  static DEFAULT_OPTIONS: { actions?: Record<string, (event: Event, target: HTMLElement) => void> };

  get element(): HTMLElement | null; // querySelector('#sidebar')

  async render(context?: any, options?: any): Promise<void>;
  async _onRender(context?: any, options?: any): Promise<void>; // sobrescreva
  _getEntryContextOptions(): SidebarEntryContextOption[]; // sobrescreva
}

interface SidebarEntryContextOption {
  name: string;
  icon?: string;
  condition?: (target: HTMLElement) => boolean;
  callback: (target: HTMLElement) => void;
  danger?: boolean;
}
```

`render()` chama `_onRender(context, options)`, depois conecta todo elemento
`[data-action]` dentro de `this.element` ao handler correspondente em
`static DEFAULT_OPTIONS.actions`, e por fim liga `contextmenu` em todo
`[data-entry-id]` ao que `_getEntryContextOptions()` retornar (usando o
componente `showContextMenu` já existente no core).

> **Nota:** cobre a superfície que sistemas convertidos realmente usam (render
> + dispatch de ações + menu de contexto), não tenta recriar o pipeline
> completo de `ChatLog`/`CombatTracker` de referência (virtualização de lista,
> mutation observers, etc.). Implementação própria, não é porta de código.

## Subclasses prontas

`Loom.applications.sidebar.tabs.{ActorDirectory, ChatLog, CompendiumDirectory,
Settings}` — cada uma já é uma subclasse vazia de `LoomSidebarTab`, prontas
pra sistema convertido estender (`class WoDChatLog extends
Loom.applications.sidebar.tabs.ChatLog`).

## Exemplo

```typescript
class MyChatLog extends Loom.applications.sidebar.tabs.ChatLog {
  static DEFAULT_OPTIONS = {
    actions: {
      rerollDice: (event, target) => { /* ... */ },
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    // injetar HTML extra, etc.
  }

  _getEntryContextOptions() {
    return [
      {
        name: 'Reroll',
        icon: '🎲',
        condition: (target) => target.dataset.canReroll === 'true',
        callback: (target) => { /* ... */ },
      },
    ];
  }
}
```
