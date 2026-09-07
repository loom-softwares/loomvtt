# Meu Primeiro Sistema

Tutorial completo criando um sistema de RPG do zero.

Vamos criar um sistema "Fantasia Simplificada" com:
- Atributos: Força, Destreza, Vigor
- HP e mana
- Um tipo de item: arma (dano, tipo)

## 1. Estrutura de diretórios

```
<DataRoot>/marketplace/rulesets/fantasia-simplificada/
├── ruleset.json
└── client.js
```

## 2. Manifest (`ruleset.json`)

```json
{
  "name": "fantasia-simplificada",
  "title": "Fantasia Simplificada",
  "version": "1.0.0",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { SystemRegistry, defineSystem } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'fantasia-simplificada',
  title: 'Fantasia Simplificada',
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
      errors.push('HP atual não pode exceder o máximo');
    }
    if (data.mana?.value > data.mana?.max) {
      errors.push('Mana atual não pode exceder o máximo');
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

  // ⚠️ rollInitiative é declarado na interface mas NÃO é invocado pelo motor.
  // Para customizar iniciativa, use Loom.settings.get(systemId, 'initiativeFormula')
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
          label: 'Geral',
          fields: [
            { key: 'hp.value', label: 'HP', type: 'number' },
            { key: 'hp.max', label: 'HP Máx', type: 'number' },
          ],
        }],
      };
    }

    return {
      tabs: [
        {
          id: 'attributes',
          label: 'Atributos',
          fields: [
            { key: 'attributes.str', label: 'Força', type: 'number' },
            { key: 'attributes.dex', label: 'Destreza', type: 'number' },
            { key: 'attributes.vit', label: 'Vigor', type: 'number' },
            { key: 'level', label: 'Nível', type: 'number' },
          ],
        },
        {
          id: 'combat',
          label: 'Combate',
          fields: [
            { key: 'hp.value', label: 'HP', type: 'number' },
            { key: 'hp.max', label: 'HP Máx', type: 'number' },
            { key: 'mana.value', label: 'Mana', type: 'number' },
            { key: 'mana.max', label: 'Mana Máx', type: 'number' },
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
          label: 'Arma',
          fields: [
            { key: 'damage', label: 'Dano', type: 'text' },
            { key: 'damageType', label: 'Tipo', type: 'text' },
          ],
        }],
      };
    }
    return { tabs: [{ id: 'main', label: 'Geral', fields: [] }] };
  },
}));

// Opcional: personalizar a ficha de actor via sheetCatalog
console.log('Sistema Fantasia Simplificada carregado!');
```

## 4. Ativação

1. Copie a pasta para `<DataRoot>/marketplace/rulesets/fantasia-simplificada/`
2. No servidor, acesse Setup Hub > Sistemas
3. Ative "Fantasia Simplificada"
4. Crie ou edite um mundo, defina `sistema: fantasia-simplificada`
5. Conecte ao mundo — os tipos `character`/`npc` estarão disponíveis

## 5. Testando

```javascript
// No console do navegador
const actor = await Loom.api.post('/actors', {
  worldId: 'seu-world-id',
  name: 'Aragorn',
  type: 'character'
});
console.log('Actor criado:', actor);
```
