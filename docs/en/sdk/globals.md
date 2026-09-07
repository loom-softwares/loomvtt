# Global Variables (Loom API)

To maximize compatibility with native scripts and imported systems, LoomVTT provides a series of global variables under `window.Loom`.

## `Loom.config`

`Loom.config` exposes the primary class registries and global system configurations.

```typescript
console.log(Loom.config.Actor.documentClass);
console.log(Loom.config.Item.documentClass);
console.log(Loom.config.ChatMessage.documentClass);
console.log(Loom.config.ui.chat);
```

### `documentClass` Integration (Phase 1 and Phase 2)
Converted systems often alter `Loom.config.Actor.documentClass` or `Loom.config.Item.documentClass` to inject custom calculation and roll logic. In LoomVTT, the registry works perfectly (Phase 1) to prevent the code from breaking, and the Base Documents will instantiate and delegate hook calls (`_preCreate`, `_onUpdate`, `_onDelete`, `prepareData`, etc) to the registered class (Phase 2).

> **Implementation Note (Phase 2):** Currently, `Actor` and `Item` operate 100% in Phase 2. Phase 2 for `ChatMessage` is still **pending** — you can register the class in `Loom.config`, but chat messages do not yet instantiate your custom `documentClass` on the client.

### `prepareData` in sheets — when it runs and what NOT to do

When opening a sheet (`LoomDocumentSheet.loadDocument()`), the engine takes the raw JSON coming
from the API and runs the `prepareData()` cycle of the registered `documentClass` BEFORE passing the
document to `getTemplateData()` — same idea as the `prepareData` from the previous version
(`reset()` → `prepareBaseData()` → `prepareEmbeddedDocuments()` → `prepareDerivedData()`).
This means that any system that registers `Loom.config.Actor.documentClass`
with an overridden `prepareDerivedData()` has this method actually called every time
the sheet renders, without needing any additional code in the sheet.

**Critical difference regarding the origin platform — read before writing `prepareDerivedData`:**
LoomVTT **does not separate** source data (`_source`) from derived data, as older systems did.
If `prepareDerivedData()` writes a calculated value directly to a field in
`systemData` (e.g.: `sd.resources.vitae.max = 10 + stamina`), and the sheet later saves the
entire `systemData` back to the server (`api.put(.../actors/:id, { systemData })`),
**the calculated value becomes persisted data** and stops recalculating the next time the
origin Attribute changes — the field "sticks" to the old value.

**Mandatory convention:** every calculated value in `prepareDerivedData()` goes inside
`systemData.derived` (a dedicated sub-object, never directly in the real fields), and **every**
save that sends the entire `systemData` must remove this key before sending:

```js
class MyActor extends Loom.config.Actor.documentClass {
  prepareDerivedData() {
    const sd = this.systemData;
    sd.derived = { ...(sd.derived || {}), vitaeMax: 10 + (sd.attributes?.stamina ?? 1) };
    // NEVER: sd.resources.vitae.max = 10 + stamina  (this persists and gets stuck)
  }
}

// In the sheet, before any api.put(...) that sends the entire systemData:
function stripDerived(sd) {
  const { derived, ...rest } = sd || {};
  return rest;
}
await api.put(`/actors/${id}`, { systemData: stripDerived(sd) });
```

This is not enforced by the engine (no error happens if you don't follow it) — it is a
convention that prevents a silent and hard-to-notice bug (the value "looks right" until
the origin Attribute changes and the derived one doesn't follow).

## `ui.notifications`

The `ui.notifications` object is exposed on `Loom.ui` and maps visual notifications to the internal UI gear (usually dispatching to `showToast`).

- `ui.notifications.info(message)`
- `ui.notifications.warn(message)`
- `ui.notifications.error(message)`
- `ui.notifications.notify(message)`

*(All of them work globally, ensuring high cross-system compatibility).*

## Root Collections (`Loom.actors`, `Loom.items`, `Loom.system`)

- `Loom.actors`: Live collection of Actors (`WorldCollection`).
- `Loom.items`: Live collection of global Items.
- `Loom.system`: Active ruleset information (including `id`, `version`, `title`).
- `Loom.world`: Flat global property containing the currently active world's information (like `id`, `title`, etc). Unlike collections, this is a snapshot of the data obtained at bootstrap time and has no interactive methods, following parity with the legacy VTT (`game.world`).
- `Loom.Roll`: Global shortcut for the `LoomRoll` class, mirroring the original `Roll` class used for dice rolling and mathematical evaluation.
- `Loom.Die`: Global shortcut for the `Die` class, composing the base terms of a `LoomRoll`.
