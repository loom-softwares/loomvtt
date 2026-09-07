# Meu Primeiro Addon

Tutorial completo criando um addon do zero.

Vamos criar um addon "Chat Enhancer" que:
- Adiciona um timestamp nas mensagens de chat
- Adiciona um comando `/roll` customizado
- Mostra uma notificação quando um dado crítico é rolado

## 1. Estrutura de diretórios

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

console.log('Chat Enhancer carregado!');

// ─── Timestamp nas mensagens ───
LoomHooks.on('chat.message', (message) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message.userName}: ${message.content}`);
});

// ─── Notificação de crítico ───
LoomHooks.on('chat.roll', (rollData) => {
  if (rollData.roll?.total === 20) {
    showToast('🎯 Crítico! ' + rollData.userName + ' rolou 20!', 'success');
  }
  if (rollData.roll?.total === 1) {
    showToast('💀 Falha crítica! ' + rollData.userName + ' rolou 1!', 'error');
  }
});

// ─── Comando /roll customizado ───
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

// ─── Exemplo: adicionar botão na sidebar ───
LoomHooks.on('window.render', (window, data) => {
  if (window.constructor.name === 'Sidebar') {
    console.log('Sidebar renderizada, posso modificar!');
  }
});

// Utilitário simples de dado
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

## 4. Instalação

Opção A — Copiar manualmente:
```
<DataRoot>/marketplace/addons/chat-enhancer/
```

Opção B — Instalar via API:
```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://raw.githubusercontent.com/seu-user/chat-enhancer/main/addon.json", "type": "addon"}'
```

## 5. Ativação

1. Acesse Setup Hub > Módulos
2. Ative "Chat Enhancer"
3. Ou em um mundo: Configurações > Módulos > ative por mundo

## 6. Próximos passos

- Adicione [configurações](../guide/addon-creation.md#manifest-addonjson) com `settings` no manifest
- Use `wrap()` para interceptar funções do core
- Crie uma janela personalizada com `windowManager`
- Importe `Signal` de `/_loom/sdk/index.js` para eventos client-side

> **Nota:** `Signal` (EventEmitter server-side) **não** é exportado pelo SDK.
> O SDK não expõe o sistema de Signals do servidor — addons client-side recebem
> eventos via `LoomHooks` (escuta de WebSocket).

Veja a [referência completa da SDK](../sdk/modules.md) para todas as APIs disponíveis.
