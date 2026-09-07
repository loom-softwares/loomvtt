# Collections

O LoomVTT expõe coleções de documentos mantendo forte paridade com a API legada de `Collection` e `WorldCollection` de sistemas de RPG convertidos.

As seguintes coleções estão disponíveis em `window.Loom`:
- `Loom.actors`
- `Loom.items`
- `Loom.scenes`
- `Loom.modules`
- `Loom.macros`
- `Loom.packs`
- `Loom.users`
- `Loom.messages`
- `Loom.combats` (contém `Loom.combat` para atalho do combate ativo)
- `Loom.journal`
- `Loom.folders`
- `Loom.tables` (RollTables)
- `Loom.playlists`

## Métodos Iterativos

Para garantir compatibilidade com loops e scripts de migração que operam iterando sobre coleções inteiras, as coleções do LoomVTT fornecem a mesma assinatura de métodos de Array padrão que sistemas de RPG convertidos esperam:

- `map(fn)`: Retorna um array com o resultado da execução da função callback em cada documento.
- `filter(fn)`: Retorna um array contendo apenas os documentos que passaram no teste da função callback.
- `find(fn)`: Retorna o primeiro documento que passar no teste da função callback.
- `forEach(fn)`: Executa uma função em cada elemento iterando de forma síncrona pela coleção.

```typescript
// Exemplo de iteração de atores
const activeActors = Loom.actors.filter(actor => actor.system.active);
Loom.actors.forEach(actor => console.log(actor.name));
```

## Compatibilidade de Documentos Inválidos

A `WorldCollection` rastreia documentos cujos dados falharam na validação estrita do banco de dados/schema. Para não quebrar módulos ou macros que inspecionam esses casos, implementamos propriedades equivalentes:

- `invalidDocumentIds` (Set): Retorna um `Set` vazio, simulando o comportamento comum de quando não há dados corrompidos.
- `getInvalid(id)`: Retorna sempre `undefined`.
