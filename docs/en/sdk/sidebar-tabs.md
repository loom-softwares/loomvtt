# LoomSidebarTab (`sidebar-tab.ts`)

Base for customizing sidebar panels (chat log, compendium directory, actor
directory, settings, etc.) from a system or addon. It is not an SDK package export
(`/_loom/sdk/index.js`) — exists only as global `window.Loom`:

```typescript
// Not an SDK import — only exists as the window.Loom global.
class MyChatLog extends Loom.LoomSidebarTab { /* ... */ }
```

## API

```typescript
class LoomSidebarTab {
  static DEFAULT_OPTIONS: { actions?: Record<string, (event: Event, target: HTMLElement) => void> };

  get element(): HTMLElement | null; // querySelector('#sidebar')

  async render(context?: any, options?: any): Promise<void>;
  async _onRender(context?: any, options?: any): Promise<void>; // override
  _getEntryContextOptions(): SidebarEntryContextOption[]; // override
}

interface SidebarEntryContextOption {
  name: string;
  icon?: string;
  condition?: (target: HTMLElement) => boolean;
  callback: (target: HTMLElement) => void;
  danger?: boolean;
}
```

`render()` calls `_onRender(context, options)`, then connects every `[data-action]`
element inside `this.element` to the corresponding handler in
`static DEFAULT_OPTIONS.actions`, and finally attaches a `contextmenu` on every
`[data-entry-id]` using what `_getEntryContextOptions()` returns (using the
core's existing `showContextMenu` component).

> **Note:** covers the surface that converted systems actually use (render
> + action dispatch + context menu), does not attempt to recreate the full
> reference `ChatLog`/`CombatTracker` pipeline (list virtualization,
> mutation observers, etc.). In-house implementation, not a code port.

## Ready Subclasses

`Loom.applications.sidebar.tabs.{ActorDirectory, ChatLog, CompendiumDirectory,
Settings}` — each is already an empty subclass of `LoomSidebarTab`, ready for a
converted system to extend (`class WoDChatLog extends
Loom.applications.sidebar.tabs.ChatLog`).

## Example

```typescript
class MyChatLog extends Loom.applications.sidebar.tabs.ChatLog {
  static DEFAULT_OPTIONS = {
    actions: {
      rerollDice: (event, target) => { /* ... */ },
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    // inject extra HTML, etc.
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
