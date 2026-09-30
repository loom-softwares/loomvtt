# Collections

LoomVTT exposes document collections maintaining strong parity with the legacy API of `Collection` and `WorldCollection` from converted RPG systems.

The following collections are available under `window.Loom`:
- `Loom.actors`
- `Loom.items`
- `Loom.scenes`
- `Loom.modules`
- `Loom.macros`
- `Loom.packs`
- `Loom.users`
- `Loom.messages`
- `Loom.combats` (contains `Loom.combat` for a shortcut to the active combat)
- `Loom.journal`
- `Loom.folders`
- `Loom.tables` (RollTables)
- `Loom.playlists`

## Iterative Methods

To ensure compatibility with loops and migration scripts that operate by iterating over entire collections, LoomVTT collections provide the same standard Array method signatures that converted RPG systems expect:

- `map(fn)`: Returns an array with the result of executing the callback function on each document.
- `filter(fn)`: Returns an array containing only the documents that passed the callback function test.
- `find(fn)`: Returns the first document that passes the callback function test.
- `forEach(fn)`: Executes a function on each element iterating synchronously through the collection.

```typescript
// Example of iterating over actors
const activeActors = Loom.actors.filter(actor => actor.system.active);
Loom.actors.forEach(actor => console.log(actor.name));
```

## Invalid Documents Compatibility

`WorldCollection` tracks documents whose data failed strict database/schema validation. To avoid breaking modules or macros that inspect these cases, we implemented equivalent properties:

- `invalidDocumentIds` (Set): Returns an empty `Set`, simulating the common behavior of when there is no corrupted data.
- `getInvalid(id)`: Always returns `undefined`.
