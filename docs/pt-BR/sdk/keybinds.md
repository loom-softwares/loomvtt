# Keybinds (`keybinds`)

Sistema de registro de atalhos de teclado. Exposto no SDK como `keybinds` e em `window.Loom.keybinds`.

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
  label: string;       // display name (e.g. 'Ativar modo escuro')
  description: string; // tooltip text
  defaultKey: string;  // e.g. 'T', 'Escape', 'Ctrl+Shift+X', 'F5'
  category?: string;   // group in config UI (e.g. 'Núcleo', 'Meu Addon')
  onPress?: () => void; // callback when key is pressed
}
```

## Métodos

### `register(action)`

Registra um novo atalho. Se o `id` já existir, substitui.

### `unregister(id)`

Remove um atalho registrado.

### `getKey(actionId)`

Retorna a tecla atual (leva em conta overrides do usuário).

### `setBinding(actionId, key)`

Sobrescreve a tecla de um atalho (persiste em localStorage).

### `resetBinding(actionId)`

Remove o override e volta à tecla padrão.

### `resetAll()`

Remove todos os overrides e volta às teclas padrão.

## Exemplo

```typescript
import { keybinds } from '/_loom/sdk/index.js';

// Registrar atalho do addon
keybinds.register({
  id: 'meu-addon-acao',
  label: 'Ação Especial',
  description: 'Dispara uma ação especial do meu addon',
  defaultKey: 'Ctrl+Shift+Z',
  category: 'Meu Addon',
  onPress: () => {
    console.log('Ação disparada!');
  },
});

// Sobrescrever tecla de um atalho core
keybinds.setBinding('target-token', 'G');

// Remover atalho quando addon for desativado
keybinds.unregister('meu-addon-acao');
```

## Teclas Suportadas

- Letras: `A-Z` (case-insensitive)
- Números: `0-9`
- Função: `F1`-`F24`
- Especiais: `Escape`, `Enter`, `Space`, `Tab`, `Delete`, `Backspace`
- Navegação: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Home`, `End`
- Modificadores: `Ctrl+`, `Shift+`, `Ctrl+Shift+`

## Notas

- Atalhos só funcionam quando o foco não está em input/textarea/contenteditable
- Os nomes de tecla são valores de `KeyboardEvent.key` (`t`, `Escape`, `ArrowUp`). Se o usuário ativar a opção de teclas universais (localStorage `loom_universal_keys`), usa-se `KeyboardEvent.code`, com `KeyT` e `Digit1` lidos como `t` e `1`.
- Múltiplos atalhos podem ser registrados para a mesma tecla. Um override do usuário vence os padrões; entre os padrões, vence o registrado primeiro (`getAction` devolve a primeira correspondência). Ver a nota CODE ISSUE abaixo.

> **CODE ISSUE:** `getAction` em `client/core/keybinds.ts` devolve o primeiro padrão que bate, na ordem de registro; assim, uma ação registrada depois na mesma tecla nunca dispara, e nenhum conflito é reportado. Em aberto: se "o primeiro vence" é o comportamento pretendido.
- Usuários podem reconfigurar atalhos na janela de configuração de teclas
