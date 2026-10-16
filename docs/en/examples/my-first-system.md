# My First System

Complete tutorial on creating an RPG system from scratch.

Let's create a "Simplified Fantasy" system with:
- Attributes: Strength, Dexterity, Vitality
- HP and mana
- One item type: weapon (damage, type)

## 1. Directory Structure

```
<DataRoot>/marketplace/rulesets/simplified-fantasy/
├── ruleset.json
└── client.js
```

## 2. Manifest (`ruleset.json`)

```json
{
  "name": "simplified-fantasy",
  "title": "Simplified Fantasy",
  "version": "1.0.0",
  "engine": "loom",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { SystemRegistry, defineSystem, settings } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'simplified-fantasy',
  title: 'Simplified Fantasy',
  version: '1.0.0',

  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor', 'consumable'],

  // Called for actors (`systemData` on creation) AND items (`data` on creation), with the type of the new document.
  getDefaultData(type) {
    if (type === 'character') {
      return {
        attributes: { str: 10, dex: 10, vit: 10 },
        hp: { value: 20, max: 20 },
        mana: { value: 10, max: 10 },
        level: 1,
      };
    }
    if (type === 'npc') {
      return {
        attributes: { str: 10, dex: 10, vit: 10 },
        hp: { value: 10, max: 10 },
      };
    }
    if (type === 'weapon') return { damage: '1d6', damageType: 'physical' };
    if (type === 'armor') return { defense: 1 };
    return {};
  },

  // Declared in the type, but the engine does not call validateData yet.
  validateData(type, data) {
    const errors = [];
    if (data.hp?.value > data.hp?.max) {
      errors.push('Current HP cannot exceed maximum');
    }
    if (data.mana?.value > data.mana?.max) {
      errors.push('Current Mana cannot exceed maximum');
    }
    return { valid: errors.length === 0, errors };
  },

  // The engine ignores the return value: change the object it receives, in place.
  // The actor's values live in `actor.systemData` (the same object as `actor.system`).
  // Known limit: the generic actor window reloads the actor after preparing it, so these
  // modifiers are not shown there (see the note at the end of section 3).
  prepareData(actor) {
    const attrs = actor.systemData?.attributes ?? {};
    actor.systemData.modifiers = {
      str: Math.floor((attrs.str || 10) / 2) - 5,
      dex: Math.floor((attrs.dex || 10) / 2) - 5,
      vit: Math.floor((attrs.vit || 10) / 2) - 5,
    };
  },

  // rollInitiative is declared in the type, but the engine never calls it (see section 4, "Initiative").

  getSheetSchema(actorType) {
    if (actorType === 'npc') {
      return {
        tabs: [{
          id: 'main',
          label: 'General',
          fields: [
            { key: 'hp.value', label: 'HP', type: 'number' },
            { key: 'hp.max', label: 'Max HP', type: 'number' },
          ],
        }],
      };
    }

    return {
      tabs: [
        {
          id: 'attributes',
          label: 'Attributes',
          fields: [
            { key: 'attributes.str', label: 'Strength', type: 'number' },
            { key: 'attributes.dex', label: 'Dexterity', type: 'number' },
            { key: 'attributes.vit', label: 'Vitality', type: 'number' },
            { key: 'level', label: 'Level', type: 'number' },
          ],
        },
        {
          id: 'combat',
          label: 'Combat',
          fields: [
            { key: 'hp.value', label: 'HP', type: 'number' },
            { key: 'hp.max', label: 'Max HP', type: 'number' },
            { key: 'mana.value', label: 'Mana', type: 'number' },
            { key: 'mana.max', label: 'Max Mana', type: 'number' },
          ],
        },
      ],
    };
  },

  // Note: the client does not render this yet. The item sheet asks the server for the schema,
  // and the server never receives client-side rulesets, so items use the basic sheet.
  getItemSheetSchema(itemType) {
    if (itemType === 'weapon') {
      return {
        tabs: [{
          id: 'main',
          label: 'Weapon',
          fields: [
            { key: 'damage', label: 'Damage', type: 'text' },
            { key: 'damageType', label: 'Type', type: 'text' },
          ],
        }],
      };
    }
    return { tabs: [{ id: 'main', label: 'General', fields: [] }] };
  },
}));

// Setting used by the `combatInitiative` hook (see "Initiative" below).
settings.register('simplified-fantasy', 'initiativeFormula', {
  name: 'Initiative formula',
  scope: 'world',
  type: String,
  default: '1d20',
});

console.log('Simplified Fantasy System loaded!');
```

> **Note:** `prepareData` runs for sheets built on `LoomDocumentSheet`/`LoomActorSheet`. The generic actor
> window (`ActorSheetWindow`, used for sheets opened from the sidebar) loads the actor again after this step,
> so its derived values do not appear there.

## 4. Initiative

The engine does not call `rollInitiative`. When the GM starts a combat with Dex initiative, the sidebar
calls the `combatInitiative` hook with a context object, and the system sets the totals there:

- `ctx.castIds`: the tokens taking part
- `ctx.initiatives`: write `ctx.initiatives[castId] = total` for each token
- `ctx.pending`: push a Promise here if the roll is asynchronous

The hook runs only from the "Start Combat (DEX Initiative)" button, for the selected tokens. `POST /start`,
`POST /combatant` and the encounter sheet do not call it. Only the totals in `ctx.initiatives` are used, so
`ctx.rolls` and `ctx.health` are optional to write.

The formula is read with `Loom.settings.get('simplified-fantasy', 'initiativeFormula')` (the setting above;
it falls back to `1d20` when no value is set).

## 5. Activation

1. Copy the folder to `<DataRoot>/marketplace/rulesets/simplified-fantasy/`
2. On the server, go to Setup Hub > Systems
3. Activate "Simplified Fantasy"
4. Create or edit a world, set `system: simplified-fantasy`
5. Connect to the world — the `character`/`npc` types will be available

## 6. Testing

Actors created through the API take their starting values from the `systemData` you send
(the server has no client-side system to fill them in). In the browser console, while connected to the world:

```javascript
// In the browser console
const actor = await Loom.api.post('/actors', {
  worldId: 'your-world-id',
  name: 'Aragorn',
  type: 'character',
  systemData: Loom.systems.getActive().getDefaultData('character'),
});
console.log('Actor created:', actor);
```
