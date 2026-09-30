# Window Manager (`window-manager.ts`)

Sistema de janelas (arrastáveis, focusáveis).

```typescript
import { windowManager, WindowLike } from '../core/window-manager.js';
```

## API

```typescript
windowManager.open<P>(id: string, WindowClass, props?: P): Promise<void>
windowManager.focus(id: string): void
windowManager.close(id: string): void
windowManager.closeAll(): void
windowManager.get(id: string): WindowLike | undefined
windowManager.rerenderIfOpen(id: string): void
windowManager.mountExisting(id: string, instance: WindowLike): Promise<void>
windowManager.closeTopmost(): boolean
```

- `get(id)`: retorna a instância da janela aberta, ou `undefined` se não estiver aberta.
- `rerenderIfOpen(id)`: re-renderiza o body da janela se estiver aberta; no-op caso contrário.
- `mountExisting(id, instance)`: registra uma instância de janela já criada externamente (idempotente — no-op se `id` já estiver aberto).
- `closeTopmost()`: fecha a janela de maior z-index; retorna `false` se não houver nenhuma aberta.

## WindowLike

```typescript
interface WindowLike {
  setZ(z: number): void;
  mount(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

## BaseWindowOptions

Ao estender \`BaseWindow\`, você pode fornecer opções no `super()` para controlar o comportamento da janela:

```typescript
interface BaseWindowOptions {
  id: string;
  title: string;
  icon?: string;
  width?: number;
  height?: number | 'auto'; // 'auto' calcula baseado no scrollHeight (max-height 90vh)
  documentId?: string;
  submitOnChange?: boolean; // Regra 5: auto-save debounce
  showFooter?: boolean; // Se false, oculta o rodapé padrão com botões save/cancel
  anchorTop?: boolean; // Se true, ancora a janela no topo da tela em vez de centralizar
  allowOverflow?: boolean; // Se true, não corta conteúdo que vaze pra fora do retângulo da janela (overflow:hidden vira visible)
  overflowMargin?: number; // Só com allowOverflow:true — px de conteúdo pendurado pra fora (ex: aba lateral flutuante). Some da tela sem isso.
}
```

### `allowOverflow` / `overflowMargin` — conteúdo que vaza pra fora da janela

Por padrão toda janela corta (`overflow: hidden`) qualquer coisa que passe do próprio
retângulo. Se o seu sheet tem um elemento flutuante fora da borda (aba lateral estilo
marcador de livro, popup suspenso de modificador — padrão comum em sheets da versão anterior.
real), ative os dois juntos:

```typescript
super({
  ...
  allowOverflow: true,
  overflowMargin: 70, // largura real do que vaza (ex: 58px de rail + folga)
});
```

`allowOverflow` sozinho só desliga o corte visual — a janela ainda pode ser arrastada
pra qualquer posição, e se o vazamento cair fora da VIEWPORT do navegador (não da
janela), some sem erro nenhum. `overflowMargin` resolve isso: soma na margem que
`constrainToViewport()` usa pra travar o arrasto, então a janela nunca pode chegar
perto o bastante da borda da tela pra esse conteúdo sair da área visível.

Isso sozinho não corta CSS de ancestral com `overflow-y: auto` — `.loom-window-body`
tem isso por padrão (scroll do corpo), e `overflow-y` implica `overflow-x` não-visible
mesmo sem declarar. Se o elemento flutuante for filho de `.loom-window-body`, seu CSS
de sistema precisa liberar isso também, escopado pela sua própria classe (passada em
`classes: [...]` nas opções da janela — vira classe do `.loom-window` raiz):

```css
.meu-sistema-sheet .loom-window-body {
  overflow: visible;
}
```

## BaseWindow

Todas as janelas estendem `BaseWindow` (`src/windows/base-window.ts`) ou `LoomDocumentSheet` (`src/windows/document-sheet.ts`).

Janelas com formulário usam `LoomFormData` (`src/core/form-data.ts`) pra serializar os campos do body em objeto tipado, com validação de obrigatórios:

```typescript
import { LoomFormData } from '../core/form-data.js';

const fd = new LoomFormData(bodyElement);
if (fd.missing.length > 0) { /* mostrar toast de campo obrigatório */ }
const data = fd.toObject();
```

### ApplicationV2 Parity

A `BaseWindow` implementa paridade com a API ApplicationV2:
- `renderChild(instance)` / `renderChild(id, class, options)`: Renderiza uma sub-janela e a anexa automaticamente no array `this.childIds`. O ciclo de vida da janela-pai fecha as janelas-filhas.
- `activateListeners(html)`: stub de compatibilidade com o `Application` V1 da plataforma original — chamado a cada `mount()`/`rerenderBody()` com o elemento raiz da janela. Sistemas convertidos de V1 que sobrescrevem esse método continuam funcionando sem adaptação.

### Classes de compatibilidade no chrome da janela

O elemento raiz e o header gerados por `mount()` recebem classes extras, além das nativas do Loom, pra bater com seletores CSS escritos para a plataforma de origem:

| Elemento | Classes Loom nativas | Alias adicionado |
|---|---|---|
| Raiz da janela | `loom-window app window-app` | `application` |
| Header | `loom-window-header` | `window-header` |
| Título | `loom-window-title` | `window-title` |
| Botão de controle | `loom-window-control-btn` | `header-control` |
| Botão de fechar | `loom-window-close` | `header-control` |
| Alça de resize | (interna) | `window-resize-handle` |

Título e header usam tags reais `<h1>`/`<header>` (antes eram `<div>`) — CSS de sistema convertido que dependa de seletor de tag (`h1 { ... }`) agora casa.
- Em `LoomDocumentSheet`, está disponível o método `_toggleDisabled(state: boolean)` para ativar ou desativar interações em todo o formulário (ex: durante salvamento assíncrono).
- Em `LoomCategoryBrowser`, o método `_prepareCategoryData()` (abstrato) pode ser herdado e, por padrão, atira um erro de implementação (comportamento de interface nativa).

## Abas (Tabs)

`LoomHandlebarsMixin` (`application.ts`) implementa `changeTab(tab, group)`, paridade
com `ApplicationV2.changeTab()` original — alterna a classe `active` em nav e
conteúdo por atributo, não por template separado. Markup mínimo:

```html
<nav class="loom-window-tabs">
  <a data-tab="geral" data-group="primary" class="active">Geral</a>
  <a data-tab="detalhes" data-group="primary">Detalhes</a>
</nav>

<div class="tab" data-tab="geral" data-group="primary">...</div>
<div class="tab" data-tab="detalhes" data-group="primary">...</div>
```

- Nav: qualquer elemento com `[data-tab][data-group]` — o clique já é capturado por
  delegação (não precisa `data-action`, nem listener próprio).
- Conteúdo: `<div class="tab" data-tab="..." data-group="...">` — a classe `.tab`
  (não `.tab-content`, que é outra coisa não relacionada em `components.css`) é o que
  o mixin alterna.
- `tabGroups: Record<string, string>` guarda a aba ativa por grupo — sete a aba
  inicial setando `this.tabGroups['primary'] = 'geral'` antes do primeiro render (ou
  deixa vazio: a primeira aba marcada `active` no HTML vale como estado inicial).
- CSS pronto em `client/styles/windows.css` (`.loom-window-tabs` / `.loom-window
  .tab[data-group]`) — não escreva `display:none`/`.active` na mão, já existe.

## LoomDialog (DialogV2 Parity)

A classe `LoomDialog` (exportada no SDK) substitui antigos dialogs customizados, provendo paridade estrita com o `DialogV2`.

```typescript
import { LoomDialog } from '/_loom/sdk/index.js';

// Métodos Estáticos (criam e aguardam a resposta do Modal)
const result1 = await LoomDialog.prompt({ window: { title: "Prompt" }, content: "..." });
const result2 = await LoomDialog.confirm({ window: { title: "Confirm" }, content: "..." });
const result3 = await LoomDialog.input({ window: { title: "Input" }, content: "..." });
const result4 = await LoomDialog.wait({ window: { title: "Wait" }, content: "..." });

// Instância
const dialog = new LoomDialog({ window: { title: "Meu Dialog" }, content: "..." });
dialog.render();
dialog.resolve("Valor final"); // Resolve a promise do diálogo remotamente e fecha
```

### `LoomDialog.query(user, type, config)`

Permite despachar um modal de diálogo para um usuário específico da sessão.

> **Nota de Fase 1/Fase 2:** Atualmente, o método verifica se o `user` requisitado é o cliente atual (comparando o `session.userId`). Se for local (Fase 1), ele exibe a interface na tela. Se o alvo for um cliente remoto (Fase 2), no momento a ação é **pendente** e retorna `null` com um log de aviso (aguarda round-trip via WebSocket a ser implementado).

## Exemplo

```typescript
import { MyWindow } from '../windows/my-window.js';

await windowManager.open('my-window', MyWindow, { data: {} });
windowManager.focus('my-window');
windowManager.close('my-window');
```

Se uma janela com o mesmo ID já estiver aberta, `open` foca ela em vez de criar outra.

## Janelas Disponíveis (37)

ActorSheetWindow, AppConfigWindow, BugReportWindow, CompendiumPackWindow, CompendiumSourceWindow, CreateWorldWindow, DeckSheetWindow, DiscordConfigWindow, DrawingConfigWindow, EditWorldWindow, FilePickerWindow, GameConfigWindow, GameSettingsWindow, InviteLinksWindow, ItemCreateWindow, ItemSheetWindow, JournalEditWindow, JournalWindow, KeybindConfigWindow, LightConfigWindow, MacroEditorWindow, ModuleManagementWindow, ModuleManifestWindow, ModuleSettingsWindow, NoiseConfigWindow, NoteConfigWindow, OwnershipConfigWindow, PlaylistConfigWindow, SheetConfigWindow, SoundConfigWindow, StageConfigWindow, TileConfigWindow, TokenConfigWindow, UserManagementWindow, UserPermissionsWindow, WallConfigWindow, WorldConfigLiteWindow

> `showSelectDialog()`/`showColorDialog()`/`showRangeDialog()` (em `client/components/
> dialog.ts`) não têm classe própria de janela registrada — são funções de conveniência
> que montam o `content` na hora e delegam pro `LoomDialog` (`client/windows/loom-dialog.ts`),
> a implementação real de `DialogV2`. Não entram na lista acima porque não são janelas
> independentes, só chamadas de `LoomDialog.wait()` por baixo.
