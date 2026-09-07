# Status Effect Registry (`status-effect-registry.ts`)

Registro de condições/status effects exibidas como ícone sob o token no Canvas.
Implementado como **registro additivo por chave** (mesmo padrão de `Loom.dice`/`Loom.sheets`) — não um objeto
global substituível, que reabriria o problema de conflito de ordem entre
addons.

```typescript
import { statusEffects } from '/_loom/sdk/index.js';
```

## API

```typescript
statusEffects.register(def: StatusEffectDef): void
statusEffects.get(id: string): StatusEffectDef | undefined
statusEffects.getAll(): StatusEffectDef[]
```

## StatusEffectDef

```typescript
interface StatusEffectDef {
  id: string;      // ex: 'frenzy', 'blinded'
  label: string;
  color: number;    // cor de fundo do ícone (hex, ex: 0xaa0000)
  icon?: string;
}
```

## Built-ins

5 condições genéricas já registradas por padrão: `blinded`, `poisoned`, `stunned`,
`prone`, `invisible`. Um sistema pode sobrescrever qualquer uma delas registrando
de novo com o mesmo `id`, ou adicionar condições próprias.

## Exemplo

```js
Loom.statusEffects.register({ id: 'frenzy', label: 'Frenzy', color: 0xaa0000 });
Loom.statusEffects.register({ id: 'torpor', label: 'Torpor', color: 0x2b2b2b });
```

O `cast.statusMarkers` (array de ids) já usa esse registro pra desenhar o ícone
certo no token — não precisa de nenhum wiring adicional além do `register()`.
