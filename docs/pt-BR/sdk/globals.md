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
Sistemas convertidos costumam alterar o `Loom.config.Actor.documentClass` ou `Loom.config.Item.documentClass` para injetar lógica customizada de cálculo e roll. No LoomVTT, o registro funciona perfeitamente (Fase 1) para evitar que o código quebre, e os Documentos Base instanciarão e delegarão chamadas de hooks (`_preCreate`, `_onUpdate`, `_onDelete`, `prepareData`, etc) para a classe registrada (Fase 2).

> **Nota de Implementação (Fase 2):** Atualmente, `Actor` e `Item` operam 100% na Fase 2. A Fase 2 de `ChatMessage` ainda está **pendente** — você pode registrar a classe no `Loom.config`, mas as mensagens de chat ainda não instanciam seu `documentClass` customizado no client.

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
- `Loom.system`: Informações do ruleset ativo (incluindo `id`, `version`, `title`).
- `Loom.world`: Propriedade global plana contendo as informações do mundo atualmente ativo (como `id`, `title`, etc). Diferente das coleções, este é um snapshot dos dados obtido no momento do bootstrap e não possui métodos interativos, seguindo paridade com a VTT legada (`game.world`).
- `Loom.Roll`: Atalho global para a classe `LoomRoll`, espelhando a classe `Roll` original usada para rolagem de dados e avaliação matemática.
- `Loom.Die`: Atalho global para a classe `Die`, compondo os termos base de um `LoomRoll`.
