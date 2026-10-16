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
  "engine": "loom",
  "client": "client.js"
}
```

## 3. Client-side (`client.js`)

```javascript
import { SystemRegistry, defineSystem, settings } from '/_loom/sdk/index.js';

SystemRegistry.register(defineSystem({
  id: 'fantasia-simplificada',
  title: 'Fantasia Simplificada',
  version: '1.0.0',

  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor', 'consumable'],

  // Chamado para actors (`systemData` na criação) E para itens (`data` na criação), com o tipo do novo documento.
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

  // Declarado no tipo, mas o motor ainda não chama validateData.
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

  // O motor ignora o valor de retorno: altere o objeto recebido, no lugar.
  // Os valores do actor ficam em `actor.systemData` (o mesmo objeto que `actor.system`).
  // Limite conhecido: a janela genérica de actor recarrega o actor depois de preparar,
  // então estes modificadores não aparecem nela (veja a nota no fim da seção 3).
  prepareData(actor) {
    const attrs = actor.systemData?.attributes ?? {};
    actor.systemData.modifiers = {
      str: Math.floor((attrs.str || 10) / 2) - 5,
      dex: Math.floor((attrs.dex || 10) / 2) - 5,
      vit: Math.floor((attrs.vit || 10) / 2) - 5,
    };
  },

  // rollInitiative é declarado no tipo, mas o motor nunca o chama (veja a seção 4, "Iniciativa").

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

  // Nota: o cliente ainda não renderiza isto. A ficha de item pede o schema ao servidor,
  // e o servidor nunca recebe sistemas client-side, então itens usam a ficha básica.
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

// Configuração usada pelo hook `combatInitiative` (veja "Iniciativa" abaixo).
settings.register('fantasia-simplificada', 'initiativeFormula', {
  name: 'Fórmula de iniciativa',
  scope: 'world',
  type: String,
  default: '1d20',
});

console.log('Sistema Fantasia Simplificada carregado!');
```

> **Nota:** `prepareData` roda para fichas construídas sobre `LoomDocumentSheet`/`LoomActorSheet`. A janela genérica
> de actor (`ActorSheetWindow`, usada nas fichas abertas pela sidebar) carrega o actor de novo depois desse passo,
> então os valores derivados não aparecem nela.

## 4. Iniciativa

O motor não chama `rollInitiative`. Quando o GM inicia um combate com iniciativa por Destreza, a sidebar
chama o hook `combatInitiative` com um objeto de contexto, e o sistema define os totais ali:

- `ctx.castIds`: os tokens que participam
- `ctx.initiatives`: escreva `ctx.initiatives[castId] = total` para cada token
- `ctx.pending`: adicione uma Promise aqui se a rolagem for assíncrona

O hook só roda pelo botão "Iniciar combate (iniciativa DES)", para os tokens selecionados. `POST /start`,
`POST /combatant` e a ficha de encontro não o chamam. Só os totais em `ctx.initiatives` são usados, então
escrever `ctx.rolls` e `ctx.health` é opcional.

A fórmula é lida com `Loom.settings.get('fantasia-simplificada', 'initiativeFormula')` (a configuração acima;
usa `1d20` quando nenhum valor está definido).

## 5. Ativação

1. Copie a pasta para `<DataRoot>/marketplace/rulesets/fantasia-simplificada/`
2. No servidor, acesse Setup Hub > Sistemas
3. Ative "Fantasia Simplificada"
4. Crie ou edite um mundo, defina `sistema: fantasia-simplificada`
5. Conecte ao mundo — os tipos `character`/`npc` estarão disponíveis

## 6. Testando

Actors criados pela API recebem os valores iniciais do `systemData` que você envia
(o servidor não tem um sistema client-side para preenchê-los). No console do navegador, conectado ao mundo:

```javascript
// No console do navegador
const actor = await Loom.api.post('/actors', {
  worldId: 'seu-world-id',
  name: 'Aragorn',
  type: 'character',
  systemData: Loom.systems.getActive().getDefaultData('character'),
});
console.log('Actor criado:', actor);
```
