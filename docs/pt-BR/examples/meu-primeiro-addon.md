# Meu Primeiro Addon

Tutorial completo criando um addon do zero.

Vamos criar um addon "Chat Enhancer" que:
- Adiciona um comando `/r adv` que rola um d20 com vantagem
- Mostra uma notificação quando um d20 sai 20 ou 1

> **Limitação:** um addon ainda não consegue decorar a lista do chat (não há hook para
> renderizar mensagens de chat), então este tutorial não adiciona timestamps às mensagens.

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
  "engine": "loom",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { LoomHooks, showToast } from '/_loom/sdk/index.js';

console.log('Chat Enhancer carregado!');

// ─── Notificação de crítico ───
// `chat.roll` é chamado só com o resultado da rolagem (`data.roll`): formula, terms, total, flavor, mode, meta.
// Rolagens ocultas para este jogador chegam censuradas, sem `total` e `terms`.
LoomHooks.on('chat.roll', (roll) => {
  if (roll?.total === undefined) return;
  const die = roll.terms?.find((t) => t.kind === 'dice' && t.faces === 20 && t.count === 1);
  if (!die) return;

  const face = die.rolls[0];
  if (face === 20) showToast('🎯 Crítico! Um d20 saiu 20!', 'success');
  if (face === 1) showToast('💀 Falha crítica! Um d20 saiu 1!', 'error');
});

// ─── `/r adv 1d20+3` rola com vantagem (2d20, mantém o maior) ───
// `chatRollCommand` roda antes de a rolagem ser enviada. Alterar `ctx.formula` muda o que o servidor rola.
LoomHooks.on('chatRollCommand', (ctx) => {
  const match = ctx.originalFormula?.match(/^adv\s+1d20(.*)$/i);
  if (match) ctx.formula = `2d20kh1${match[1]}`;
});

// ─── Exemplo: reagir à renderização de uma janela ───
// `window.render` é chamado com a instância da janela e um objeto de dados vazio.
LoomHooks.on('window.render', (win) => {
  console.log('Janela renderizada:', win.options?.id);
});
```

## 4. Instalação

Opção A — Copiar manualmente:
```
<DataRoot>/marketplace/addons/chat-enhancer/
```

Opção B — Instalar via API (exige sessão de administrador; o campo do corpo é `manifestUrl`, a URL do `addon.json` hospedado):
```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -H "Cookie: <seu cookie de sessão de administrador>" \
  -d '{"manifestUrl": "https://raw.githubusercontent.com/seu-user/chat-enhancer/main/addon.json", "type": "addon"}'
```

O instalador rejeita qualquer manifest sem `"engine": "loom"`.

## 5. Ativação

1. Acesse Setup Hub > Addons (a aba Addons)
2. Clique em Ativar em "Chat Enhancer" (chama `POST /api/marketplace/addon/chat-enhancer/activate`, só administrador)
3. Para um mundo só: na sidebar do mundo, abra Configurações > Módulos, que abre o Gerenciamento de Módulos, e habilite o addon ali
4. Recarregue a página do mundo: os addons client-side são carregados quando o mundo inicia

## 6. Próximos passos

- Adicione [configurações](../guide/addon-creation.md#manifest-addonjson) com `settings` no manifest
- Use `wrap()` para interceptar funções do core
- Crie uma janela personalizada com `windowManager`
- Importe `Signal` de `/_loom/sdk/index.js` para eventos client-side

> **Nota:** `Signal` (EventEmitter server-side) **não** é exportado pelo SDK.
> O SDK não expõe o sistema de Signals do servidor — addons client-side recebem
> eventos via `LoomHooks` (escuta de WebSocket).

Veja a [referência completa da SDK](../sdk/modules.md) para todas as APIs disponíveis.
