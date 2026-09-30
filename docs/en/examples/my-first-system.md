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
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'simplified-fantasy',
  title: 'Simplified Fantasy',
  version: '1.0.0',

  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor', 'consumable'],

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
    return {};
  },

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

  prepareData(actor) {
    const data = { ...actor };
    data.modifiers = {
      str: Math.floor((data.attributes?.str || 10) / 2) - 5,
      dex: Math.floor((data.attributes?.dex || 10) / 2) - 5,
      vit: Math.floor((data.attributes?.vit || 10) / 2) - 5,
    };
    return data;
  },

  // ⚠️ rollInitiative is declared in the interface but is NOT invoked by the engine.
  // To customize initiative, use Loom.settings.get(systemId, 'initiativeFormula')
  rollInitiative(actor) {
    const mod = Math.floor(((actor.attributes?.dex || 10) / 2) - 5);
    return { formula: `1d20${mod >= 0 ? '+' : ''}${mod}`, total: 0 };
  },

  getItemDefaultData(type) {
    if (type === 'weapon') return { damage: '1d6', damageType: 'physical' };
    if (type === 'armor') return { defense: 1 };
    return {};
  },

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

// Optional: customize the actor sheet via sheetCatalog
console.log('Simplified Fantasy System loaded!');
```

## 4. Activation

1. Copy the folder to `<DataRoot>/marketplace/rulesets/simplified-fantasy/`
2. On the server, go to Setup Hub > Systems
3. Activate "Simplified Fantasy"
4. Create or edit a world, set `system: simplified-fantasy`
5. Connect to the world — the `character`/`npc` types will be available

## 5. Testing

```javascript
// In the browser console
const actor = await Loom.api.post('/actors', {
  worldId: 'your-world-id',
  name: 'Aragorn',
  type: 'character'
});
console.log('Actor created:', actor);
```
