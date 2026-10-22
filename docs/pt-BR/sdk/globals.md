# Variáveis Globais (Loom API)

Para maximizar a compatibilidade com scripts nativos e systems importados, o LoomVTT provê uma série de variáveis globais sob `window.Loom`.

## `Loom.config`

`Loom.config` expõe os registros de classes primárias e configurações globais do sistema.

```typescript
console.log(Loom.config.Actor.documentClass);
console.log(Loom.config.Item.documentClass);
console.log(Loom.config.ChatMessage.documentClass);
console.log(Loom.config.ui.chat);
```

### Integração de `documentClass` (Fase 1 e Fase 2)
Sistemas convertidos costumam alterar o `Loom.config.Actor.documentClass` ou `Loom.config.Item.documentClass` para injetar lógica customizada de cálculo e roll. No LoomVTT, o registro funciona perfeitamente (Fase 1) para evitar que o código quebre, e os Documentos Base instanciarão a classe registrada e chamarão seus `prepareData()`/`prepareDerivedData()` (Fase 2). O client não tem delegação de `_preCreate`, `_onUpdate` ou `_onDelete`: nenhum caminho de código chama esses métodos.

> **Nota de Implementação (Fase 2):** `Actor`, `Item` e `User` instanciam o `documentClass` registrado. `ChatMessage` também o instancia (`LiveMessage` em `client/core/messages-collection.ts`) e chama seu `prepareDerivedData()`, mas os demais métodos de ciclo de vida não são chamados.

### `prepareData` em fichas (sheets) — quando roda e o que NÃO fazer

Ao abrir uma ficha (`LoomDocumentSheet.loadDocument()`), o motor pega o JSON cru vindo
da API e roda o ciclo `prepareData()` do `documentClass` registrado ANTES de passar o
documento pra `getTemplateData()` — mesma ideia do `prepareData` da versão anterior
(`reset()` → `prepareBaseData()` → `prepareEmbeddedDocuments()` → `prepareDerivedData()`).
Isso significa que qualquer sistema que registre `Loom.config.Actor.documentClass`
com um `prepareDerivedData()` sobrescrito tem esse método chamado de verdade toda vez
que a ficha renderiza, sem precisar de nenhum código adicional na sheet.

**Diferença crítica em relação à plataforma de origem — leia antes de escrever `prepareDerivedData`:**
o LoomVTT **não separa** dado de origem (`_source`) de dado derivado, como sistemas antigos faziam.
Se `prepareDerivedData()` escrever um valor calculado direto num campo de
`systemData` (ex: `sd.resources.vitae.max = 10 + stamina`), e a sheet depois salvar o
`systemData` inteiro de volta pro servidor (`api.put(.../actors/:id, { systemData })`),
**o valor calculado vira dado persistido** e para de recalcular na próxima vez que o
Atributo de origem mudar — o campo "gruda" no valor antigo.

**Convenção obrigatória:** todo valor calculado em `prepareDerivedData()` vai dentro de
`systemData.derived` (um sub-objeto dedicado, nunca direto nos campos reais), e **todo**
save que manda o `systemData` inteiro precisa remover essa chave antes de enviar:

```js
class MyActor extends Loom.config.Actor.documentClass {
  prepareDerivedData() {
    const sd = this.systemData;
    sd.derived = { ...(sd.derived || {}), vitaeMax: 10 + (sd.attributes?.stamina ?? 1) };
    // NUNCA: sd.resources.vitae.max = 10 + stamina  (isso persiste e trava)
  }
}

// Na sheet, antes de qualquer api.put(...) que manda o systemData inteiro:
function stripDerived(sd) {
  const { derived, ...rest } = sd || {};
  return rest;
}
await api.put(`/actors/${id}`, { systemData: stripDerived(sd) });
```

Isso não é imposto pelo motor (nenhum erro acontece se você não seguir) — é uma
convenção que evita um bug silencioso e difícil de notar (o valor "parece certo" até
o Atributo de origem mudar e o derivado não acompanhar).

## `ui.notifications`

O objeto `ui.notifications` é exposto em `Loom.ui` e mapeia notificações visuais para a engrenagem interna de UI (geralmente despachando para `showToast`).

- `ui.notifications.info(message)`
- `ui.notifications.warn(message)`
- `ui.notifications.error(message)`
- `ui.notifications.notify(message)`

*(Todos eles funcionam de forma global, garantindo alta compatibilidade cross-system).*

## Coleções Root (`Loom.actors`, `Loom.items`, `Loom.system`)

- `Loom.actors`: Coleção viva de Atores (`WorldCollection`).
- `Loom.items`: Coleção viva de Itens globais.
- `actor.items` em um ator vivo (não é `Loom.items`) é um getter que devolve uma visão tipo coleção dos itens
  embutidos daquele ator: tem `size` e `get()`, mas não tem `length`. Uma linha de ator crua com `populate=true`
  traz `items` como array simples. Confira qual dos dois você tem antes de usar.
- `Loom.system`: Informações do ruleset ativo (incluindo `id`, `version`, `title`).
- `Loom.world`: Propriedade global plana contendo as informações do mundo atualmente ativo (como `id`, `title`, etc). Diferente das coleções, este é um snapshot dos dados obtido no momento do bootstrap e não possui métodos interativos, seguindo paridade com a VTT legada (`game.world`). A HUD de jogo busca esse dado quando abre o mundo, antes de o hook `init` disparar. Antes desse ponto ele é `undefined`, e continua `undefined` se essa busca falhar.
- `Loom.Roll`: Atalho global para a classe `LoomRoll`, espelhando a classe `Roll` original usada para rolagem de dados e avaliação matemática.
- `Loom.Die`: Atalho global para a classe `Die`, compondo os termos base de um `LoomRoll`.

## Outros auxiliares em `window.Loom`

Todos estes existem em `window.Loom` em tempo de execução (`client/main.ts`).

| Membro | O que faz |
|---|---|
| `Loom.fromUuidSync(uuid)` | Busca síncrona de `<Tipo>.<id>` nas coleções vivas (`Actor`, `Item`, `Scene`, `JournalEntry`/`Journal`, `Macro`, `Folder`, `RollTable`, `Playlist`, `Combat`, `User`). Devolve `undefined` quando o documento ainda não foi carregado, quando o UUID tem mais de dois segmentos e para todo UUID `Compendium.*` (UUIDs de compêndio não são resolvidos aqui). |
| `Loom.fromUuid(uuid)` | Versão assíncrona. Mesma busca; se nada for achado e o UUID for `Item.<id>`, busca o item em `GET /api/items/:id` e o registra. Outros tipos nunca são buscados: resolvem para `undefined`. |
| `Loom.openCompendiumEntrySheet(pack, entry)` | Abre a ficha real de uma entrada de compêndio (pack do mundo ou source pack de addon/ruleset). Mostra um toast informativo e devolve `null` quando o tipo do pack não tem ficha. |
| `Loom.mountRichTextEditor(el, initialHTML, rootNode?, options?)` | Monta em `el` o editor ProseMirror usado pelos journals. `options` é `{ floatingMenu?, insertMenu? }`. Devolve `{ view, getHTML(), destroy() }`. |
| `Loom.clipboard.copyPlainText(text)` | Copia texto com um `<textarea>` oculto; devolve `true` quando a cópia funcionou. |
| `Loom.dice3d` | Aparência dos dados próprios de um sistema nos dados 3D: `registerDie(denomination, appearance, source?)`, `registerPreset(preset, source?)`, `unregisterDie(source)`, `show(items)`, `showForRoll(roll)`. O SDK também exporta como `dice3d`. |
| `Loom.keybindings` | Alias de `Loom.keybinds` (mesmo objeto). Ver [keybinds.md](keybinds.md). |
