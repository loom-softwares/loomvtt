# System Registry (`system-registry.ts`)

Registro de sistemas/rulesets. Exposto globalmente como `globalThis.__loomSystemRegistry`.

```typescript
import { SystemRegistry, LoomSystem } from '../applications/systems/system-registry.js';
```

## API

```typescript
SystemRegistry.register(system: LoomSystem): void
SystemRegistry.get(id: string): LoomSystem | undefined
SystemRegistry.getAll(): LoomSystem[]
SystemRegistry.getActive(): LoomSystem | undefined
SystemRegistry.setActive(id: string): void
```

## LoomSystem

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];       // ex: ['character', 'npc']
  itemTypes: string[];        // ex: ['weapon', 'armor', 'spell']
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  /**
   * ⚠️ **Declarado na interface, mas NÃO é invocado pelo motor** (verificado no client e no
   * server — nenhum call site existe). Para customizar iniciativa, use `Loom.settings.get(systemId, 'initiativeFormula')`
   * que é resolvida com @variables do systemData achatado. Assinatura (referência, caso um dia seja ligado):
   */
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  /** CSS bruto do sistema — injetado 1x numa `<style id="loom-system-styles">` quando o sistema fica ativo. */
  styles?: string;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
}
```

## SheetSchema

```typescript
interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean' | 'dots' | 'actions'
      | 'select' | 'color' | 'image' | 'square-counter';
  /** Usado por 'dots' (nº de pips) e 'square-counter' (total de quadrados). */
  max?: number;
  /** Só pra type 'select' — lista de opções. */
  options?: { value: string; label: string }[];
}
interface SheetTab {
  id: string;
  label: string;
  /** Emoji ou classe de ícone (ex: 'fa-sword'), exibido ao lado do label. */
  icon?: string;
  fields: SheetField[];
}
interface SheetSchema {
  tabs: SheetTab[];
}
```

> **`square-counter`**: o valor armazenado é `{ max: number, superficial: number, aggravated: number }`
> (não um `number` solto como os outros tipos) — cada quadrado cicla
> `vazio → superficial → agravado → vazio` individualmente ao clicar.

## Exemplo

```js
const SystemRegistry = globalThis.__loomSystemRegistry;

SystemRegistry.register({
  id: 'my-system',
  title: 'My System',
  version: '1.0.0',
  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor'],
  getDefaultData(type) {
    if (type === 'character') return { hp: { value: 10, max: 10 } };
    return {};
  },
  getSheetSchema(actorType) {
    return {
      tabs: [{
        id: 'main',
        label: 'Principal',
        fields: [{ key: 'hp.value', label: 'HP', type: 'number' }],
      }],
    };
  },
});
```
