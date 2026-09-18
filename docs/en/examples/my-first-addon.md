# My First Addon

Complete tutorial on creating an addon from scratch.

Let's create a "Chat Enhancer" addon that:
- Adds a timestamp to chat messages
- Adds a custom `/roll` command
- Shows a notification when a critical dice is rolled

## 1. Directory Structure

```
<DataRoot>/marketplace/addons/chat-enhancer/
├── addon.json
└── client.js
```

## 2. Manifest (`addon.json`)

```json
{
  "name": "chat-enhancer",
  "title": "Chat Enhancer",
  "version": "1.0.0",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { LoomHooks, showToast, api } from '/_loom/sdk/index.js';

console.log('Chat Enhancer loaded!');

// ─── Timestamp on messages ───
LoomHooks.on('chat.message', (message) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message.userName}: ${message.content}`);
});

// ─── Critical notification ───
LoomHooks.on('chat.roll', (rollData) => {
  if (rollData.roll?.total === 20) {
    showToast('🎯 Critical! ' + rollData.userName + ' rolled a 20!', 'success');
  }
  if (rollData.roll?.total === 1) {
    showToast('💀 Critical failure! ' + rollData.userName + ' rolled a 1!', 'error');
  }
});

// ─── Custom /roll command ───
LoomHooks.on('chat.message', (message) => {
  if (message.content.startsWith('/roll ')) {
    const formula = message.content.replace('/roll ', '');
    const result = evaluateDiceFormula(formula);
    api.post('/chat/roll', {
      worldId: getCurrentWorldId(),
      formula,
      roll: result,
    });
  }
});

// ─── Example: adding a button to the sidebar ───
LoomHooks.on('window.render', (window, data) => {
  if (window.constructor.name === 'Sidebar') {
    console.log('Sidebar rendered, I can modify it!');
  }
});

// Simple dice utility
function evaluateDiceFormula(formula) {
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return { total: 0, rolls: [] };

  const count = parseInt(match[1] || '1');
  const sides = parseInt(match[2]);
  const mod = parseInt(match[3] || '0');
  const rolls = [];

  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { total, rolls };
}

function getCurrentWorldId() {
  return document.querySelector('[data-world-id]')?.dataset.worldId;
}
```

## 4. Installation

Option A — Copy manually:
```
<DataRoot>/marketplace/addons/chat-enhancer/
```

Option B — Install via API:
```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://raw.githubusercontent.com/your-user/chat-enhancer/main/addon.json", "type": "addon"}'
```

## 5. Activation

1. Go to Setup Hub > Addons
2. Activate "Chat Enhancer"
3. Or in a world: Settings > Addons > activate per world

## 6. Next steps

- Add [settings](../guide/addon-creation.md#manifest-addonjson) with `settings` in the manifest
- Use `wrap()` to intercept core functions
- Create a custom window with `windowManager`
- Import `Signal` from `/_loom/sdk/index.js` for client-side events

> **Note:** `Signal` (server-side EventEmitter) is **not** exported by the SDK.
> The SDK does not expose the server's Signal system — client-side addons receive
> events via `LoomHooks` (WebSocket listener).

See the [full SDK reference](../sdk/modules.md) for all available APIs.
