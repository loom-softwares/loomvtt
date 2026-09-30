# Keybinds (`keybinds`)

Keyboard shortcut registration system. Exposed in the SDK as `keybinds` and at `window.Loom.keybinds`.

```typescript
import { keybinds } from '/_loom/sdk/index.js';
```

## API

```typescript
keybinds.register(action: KeybindAction): void
keybinds.unregister(id: string): void
keybinds.getKey(actionId: string): string
keybinds.setBinding(actionId: string, key: string): void
keybinds.resetBinding(actionId: string): void
keybinds.resetAll(): void
```

### KeybindAction

```typescript
interface KeybindAction {
  id: string;          // unique identifier
  label: string;       // display name (e.g. 'Activate dark mode')
  description: string; // tooltip text
  defaultKey: string;  // e.g. 'T', 'Escape', 'Ctrl+Shift+X', 'F5'
  category?: string;   // group in config UI (e.g. 'Core', 'My Addon')
  onPress?: () => void; // callback when key is pressed
}
```

## Methods

### `register(action)`

Registers a new shortcut. If the `id` already exists, replaces it.

### `unregister(id)`

Removes a registered shortcut.

### `getKey(actionId)`

Returns the current key (takes user overrides into account).

### `setBinding(actionId, key)`

Overrides a shortcut's key (persists in localStorage).

### `resetBinding(actionId)`

Removes the override and reverts to the default key.

### `resetAll()`

Removes all overrides and reverts to default keys.

## Example

```typescript
import { keybinds } from '/_loom/sdk/index.js';

// Register addon shortcut
keybinds.register({
  id: 'my-addon-action',
  label: 'Special Action',
  description: 'Triggers a special action from my addon',
  defaultKey: 'Ctrl+Shift+Z',
  category: 'My Addon',
  onPress: () => {
    console.log('Action triggered!');
  },
});

// Override a core shortcut key
keybinds.setBinding('target-token', 'G');

// Remove shortcut when addon is disabled
keybinds.unregister('my-addon-action');
```

## Supported Keys

- Letters: `A-Z` (case-insensitive)
- Numbers: `0-9`
- Function: `F1`-`F24`
- Special: `Escape`, `Enter`, `Space`, `Tab`, `Delete`, `Backspace`
- Navigation: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Home`, `End`
- Modifiers: `Ctrl+`, `Shift+`, `Ctrl+Shift+`

## Notes

- Shortcuts only work when focus is not in an input/textarea/contenteditable
- Multiple shortcuts can be registered to the same key (last registered wins)
- Users can reconfigure shortcuts in the keybind configuration window
