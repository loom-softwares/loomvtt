# My First Addon

Complete tutorial on creating an addon from scratch.

Let's create a "Chat Enhancer" addon that:
- Adds an `/r adv` command that rolls a d20 with advantage
- Shows a notification when a d20 comes up 20 or 1

> **Limitation:** an addon cannot decorate the chat list yet (there is no hook for
> rendering chat messages), so this tutorial does not add timestamps to messages.

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
  "engine": "loom",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { LoomHooks, showToast } from '/_loom/sdk/index.js';

console.log('Chat Enhancer loaded!');

// ─── Critical notification ───
// `chat.roll` is called with the roll result only (`data.roll`): formula, terms, total, flavor, mode, meta.
// Rolls hidden from this player arrive redacted, without `total` and `terms`.
LoomHooks.on('chat.roll', (roll) => {
  if (roll?.total === undefined) return;
  const die = roll.terms?.find((t) => t.kind === 'dice' && t.faces === 20 && t.count === 1);
  if (!die) return;

  const face = die.rolls[0];
  if (face === 20) showToast('🎯 Critical! A d20 came up 20!', 'success');
  if (face === 1) showToast('💀 Critical failure! A d20 came up 1!', 'error');
});

// ─── `/r adv 1d20+3` rolls with advantage (2d20, keep the highest) ───
// `chatRollCommand` runs before a roll is sent. Changing `ctx.formula` changes what the server rolls.
LoomHooks.on('chatRollCommand', (ctx) => {
  const match = ctx.originalFormula?.match(/^adv\s+1d20(.*)$/i);
  if (match) ctx.formula = `2d20kh1${match[1]}`;
});

// ─── Example: reacting to a window render ───
// `window.render` is called with the window instance and an empty data object.
LoomHooks.on('window.render', (win) => {
  console.log('Window rendered:', win.options?.id);
});
```

## 4. Installation

Option A — Copy manually:
```
<DataRoot>/marketplace/addons/chat-enhancer/
```

Option B — Install via API (requires an admin session; the body field is `manifestUrl`, the URL of the hosted `addon.json`):
```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -H "Cookie: <your admin session cookie>" \
  -d '{"manifestUrl": "https://raw.githubusercontent.com/your-user/chat-enhancer/main/addon.json", "type": "addon"}'
```

The installer rejects any manifest without `"engine": "loom"`.

## 5. Activation

1. Go to Setup Hub > Addons (the Addons tab)
2. Click Activate on "Chat Enhancer" (this calls `POST /api/marketplace/addon/chat-enhancer/activate`, admin only)
3. For a single world: in the world's sidebar, open Settings > Modules, which opens Module Management, and enable the addon there
4. Reload the world page: client addons are loaded when the world starts

## 6. Next steps

- Add [settings](../guide/addon-creation.md#manifest-addonjson) with `settings` in the manifest
- Use `wrap()` to intercept core functions
- Create a custom window with `windowManager`
- Import `Signal` from `/_loom/sdk/index.js` for client-side events

> **Note:** `Signal` (server-side EventEmitter) is **not** exported by the SDK.
> The SDK does not expose the server's Signal system — client-side addons receive
> events via `LoomHooks` (WebSocket listener).

See the [full SDK reference](../sdk/modules.md) for all available APIs.
