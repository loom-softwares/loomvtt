# Effects (`Loom.effects`)

`Loom.effects` is the addon side of the effects system. It applies item and tile templates, clears and lists the applied effects of a cast or an actor, turns manual conditions on and off, and answers the player requests that wait for GM approval. Each call sends a request to the routes in [Effects API](../api/effects.md), and the server checks the permissions there.

```js
const result = await Loom.effects.apply({ templateId, targetCastId });
if (result.status === 'applied') console.log(result.effect.name);
```

## Members

| Member | Kind | Who may call it | Documented in |
|--------|------|-----------------|---------------|
| `apply(input)` | template action | Assistant GM, or a player for their own items and tiles | [Templates](#templates) |
| `clear(input)` | template action | Assistant GM, or a player for their own tile effects | [Templates](#templates) |
| `list(input)` | read | Any signed-in user of the world | [Templates](#templates) |
| `condition(input)` | manual condition | Assistant GM | [Manual conditions](#manual-conditions) |
| `pendingRequests()` | approval | Assistant GM | [Approval requests](#approval-requests) |
| `approve(requestId)` | approval | Assistant GM | [Approval requests](#approval-requests) |
| `deny(requestId)` | approval | Assistant GM | [Approval requests](#approval-requests) |
| `forActor(actorId)` | raw CRUD | Any signed-in user of the world | [Raw CRUD](#raw-crud) |
| `forItem(itemId)` | raw CRUD | Any signed-in user of the world | [Raw CRUD](#raw-crud) |
| `create(data)` | raw CRUD | Assistant GM | [Raw CRUD](#raw-crud) |
| `update(id, updates)` | raw CRUD | Assistant GM | [Raw CRUD](#raw-crud) |
| `delete(id)` | raw CRUD | Assistant GM | [Raw CRUD](#raw-crud) |
| `openConfig(buffId)` | advanced window | Assistant GM | [Advanced window](#advanced-window) |

The first seven members never throw. A failed request resolves to a result object whose `ok` field is `false`, or whose `status` field is `'error'`. The raw CRUD members behave differently and are described in [Raw CRUD](#raw-crud).

## Targets

Most calls take the target as `targetCastId` or `targetActorId`. A linked cast (a player character) receives its effects on its actor, so the effect follows the character across stages. An unlinked cast (an NPC) keeps its own effects. When both fields are sent, `targetCastId` is used. The one exception is `list`, which takes `castId` or `actorId`.

## Templates

### `apply(input)`

Copies a template onto a target.

- **Input:** `{ templateId, targetCastId? , targetActorId? }`.
- **Returns:** an `EffectApplyResult`, `{ status, effect?, requestId?, blockedBy?, error? }`.

| `status` | When it happens | Fields set |
|----------|-----------------|------------|
| `'applied'` | The effect was applied. | `effect`, the applied copy |
| `'pending'` | A player's item effect is waiting for GM approval. A toast tells the player so. | `requestId` |
| `'blocked'` | The same effect (or condition) is already active on the target. | `blockedBy`, the id of the blocking effect, and `error` |
| `'error'` | Anything else: the server refused the request (for example `403`, `404`, `400`, `429` or `500`), no GM is connected to approve a player's effect, or the network failed. | `error`, the server message, `HTTP <status>`, or `'network'` |

### `clear(input)`

Removes the applied effects of a target that match a filter. Templates are never removed.

- **Input:** `{ targetCastId? , targetActorId? , filter }`. The `filter` takes the keys `all`, `origin`, `sourceType`, `sourceId`, `conditionId`, `tag` and `templateId`. Every key given must match. `all: true` matches every applied effect on its own. See [Clear filter](../api/effects.md#clear-filter).
- **Returns:** `{ ok, removed, error? }`. `removed` is the array of removed effect ids, and it is empty when nothing matched or the request failed.

A player may clear only the tile effects of a target they own. The filter must then set `sourceType: 'tile'` and name either `sourceId` (the tile id) or `templateId`. Any other request from a player returns `{ ok: false, removed: [], error: 'Assistant GM permission required' }`. See [Player tile clear](../api/effects.md#player-tile-clear).

```js
const cleared = await Loom.effects.clear({
  targetActorId: actor.id,
  filter: { sourceType: 'tile', sourceId: tile.id },
});
console.log(cleared.removed);
```

### `list(input)`

Lists the applied effects of a cast or an actor. Templates are never listed.

- **Input:** `{ castId? }` or `{ actorId? }`. The key names here are `castId` and `actorId`, not the `target…` names used by the other calls.
- **Returns:** `{ ok, effects, error? }`. `effects` is an array of applied effects. A linked cast returns the effects of its actor.

When neither key is given, the call does not send a request. It returns `{ ok: false, effects: [], error: 'castId or actorId is required' }`.

## Manual conditions

### `condition(input)`

Turns a condition on or off on a cast or an actor, without a template. The condition also shows as a status marker on the target's casts (see [Status markers](../api/effects.md#status-markers)).

- **Input:** `{ conditionId, on, targetCastId? , targetActorId? , name? , icon? }`. `on` is `true` or `false`. `name` and `icon` apply only when `on` is `true`, and `name` defaults to `conditionId`.
- **Returns:** `{ ok, effect?, removed, blockedBy?, error? }`.

| Case | Result |
|------|--------|
| `on: true`, created | `{ ok: true, effect, removed: [] }` |
| `on: false` | `{ ok: true, removed }`. `removed` may be empty. The marker is removed in either case, including a marker set by hand. |
| The condition is already active on the target | `{ ok: false, removed: [], blockedBy, error }` |
| Any other failure | `{ ok: false, removed: [], error }` |

```js
await Loom.effects.condition({ targetCastId: cast.id, conditionId: 'prone', on: true });
await Loom.effects.condition({ targetCastId: cast.id, conditionId: 'prone', on: false });
```

## Approval requests

When the world has GM approval turned on, a player's item effect is parked until an Assistant GM answers it (see [GM approval](../api/effects.md#gm-approval)). These members let a system show and answer those requests.

### `pendingRequests()`

Lists the requests waiting in the caller's world, oldest first.

- **Returns:** `{ ok, requests, error? }`. Each request is `{ id, worldId, userId, templateId, target, createdAt }`. `target` is `{ castId? , actorId? }` with the target the player sent, and `createdAt` is a server time in milliseconds.

### `approve(requestId)`

Applies a waiting player effect. The server checks it again as the player would now. The request is removed whatever the result, so it can be answered only once.

- **Returns:** `{ ok, effect?, error? }`. `error` is the server message, for example `'Effect request not found'` when the request has expired or was already answered.

### `deny(requestId)`

Drops a waiting player effect and tells the player.

- **Returns:** `{ ok, error? }`.

```js
const { ok, requests } = await Loom.effects.pendingRequests();
for (const request of ok ? requests : []) {
  await Loom.effects.approve(request.id);
}
```

## Advanced window

### `openConfig(buffId)`

Opens the advanced window of one effect. The window edits every field of the record: the name, icon, description, condition, duration and its unit, the expiry point (turns only), the tags, the removal and transfer flags, the list of changes and the visual a token draws, with a live preview of that visual. The **Advanced** button on each effect row of the actor and item sheets opens the same window.

A visual is the look a token draws for one effect. Its kind is `aura`, `tint`, `glow`, `icon` or `particles`. A `particles` visual draws small shapes that rise, fall or twinkle around the token. Its style is one of `smoke`, `embers`, `bubbles`, `sparkles`, `hearts`, `drops` or `zzz`, and the default is `smoke`. `color` is `#rrggbb`, `intensity` is 0 to 1 and sets the peak alpha of the particles, `speed` is 0 to 3 (0 is the slowest, not still), and `size` is 0.5 to 3 and scales the particles and the area they spread over. The whole visual is at most 200 characters of JSON. Under reduced effects a token keeps only its `icon` visuals, so particles are not drawn.

```js
await Loom.effects.openConfig(effect.id);
```

- **Input:** `buffId`, the id of an effect template or of an applied copy.
- **Returns:** a promise that resolves once the window is open, or once the refusal is shown. It does not throw.

Only an Assistant GM (role 3) and above can open the window. Any other role gets the standard error toast and no window. The server enforces the same rule on [PUT /api/buffs/:id](../api/buffs.md#put-id).

Save sends only the fields that changed. The window checks the values first, with the same limits as the server, and names the field that is wrong. A server error is shown as it comes, and the window stays open so nothing typed is lost.

Each change row has a stat key (a dotted path such as `system.attributes.hp`), a mode (`add`, `multiply`, `override`, `upgrade` or `downgrade`), a value and a priority. Changes apply by priority, lowest first. The `add`, `multiply`, `upgrade` and `downgrade` modes need a number.

## Example: a spell that applies an effect

This walks through one spell, from its template to the moment the effect ends. The same steps work for any item (a potion, a trinket) or tile.

### Step 1: create the template once

The template is the master copy of the effect. Create it once, for example when a GM sets up the spell or when the system imports it. A template belongs to the spell item, so it has an `itemId` and no `actorId` or `castId`.

```js
const template = await Loom.effects.create({
  itemId: spell.id,
  name: 'Poison Cloud',
  icon: 'fa-solid fa-skull-crossbones',
  description: 'Poisoned for 3 turns.',
  durationUnit: 'turns',
  duration: 3,
  expireOn: 'turn-end',
  conditionId: 'poisoned',
  tags: ['magic', 'poison'],
  removeOnCombatEnd: true,
  changes: [{ key: 'attack', mode: 'add', value: -2 }],
  visual: { kind: 'particles', style: 'smoke', color: '#3fae3f', intensity: 0.8, speed: 1, size: 1 },
});
```

The world comes from the session, because the call sends an `itemId`. The server checks the other fields as follows:

- `durationUnit` is one of `permanent`, `rounds`, `turns`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` or `years`. A `permanent` effect stores `duration` as `-1`.
- `visual` is validated: `kind` is `aura`, `tint`, `glow`, `icon` or `particles`; `style` is one of the particle styles; `color` is `#rrggbb`; `intensity` is 0 to 1; `speed` is 0 to 3; `size` is 0.5 to 3.
- Every applied copy copies the template's visual. When the template has no visual, the token draws the preset of its `conditionId`.
- Under reduced effects, particles are not drawn.

The same template can be built by hand, with the effect list on the item sheet. The **Advanced** button on that row opens the advanced window (`openConfig`), which edits every field, including the visual, with a live preview.

### Step 2: apply it to a target

```js
const result = await Loom.effects.apply({ templateId: template.id, targetCastId: target.id });

switch (result.status) {
  case 'applied':
    console.log('Effect active:', result.effect.name);
    break;
  case 'pending':
    // GM approval is on: the GM sees a dialog, and the player gets a toast.
    console.log('Waiting for GM approval:', result.requestId);
    break;
  case 'blocked':
    console.warn('Already active on this target:', result.blockedBy);
    break;
  case 'error':
    console.error(result.error);
    break;
}
```

The target is the cast the player picked. The server resolves a linked cast (a player character) to its actor, so the effect is shared by every token of that character. An unlinked NPC cast carries the effect itself.

The caller must be an Assistant GM, or have edit rights on the actor that owns the spell item.

### Step 3: how the effect ends

The effect expires by itself:

- Turns count on the target's turn boundary named by `expireOn`.
- Rounds count when the round changes.
- Time units (`seconds` to `years`) count with the world time. A paused world pauses them.
- `removeOnCombatEnd: true` clears the effect when the combat ends.

A GM can remove it early by template or by condition. The filter needs at least one criterion:

```js
await Loom.effects.clear({ targetCastId: target.id, filter: { templateId: template.id } });
await Loom.effects.clear({ targetCastId: target.id, filter: { conditionId: 'poisoned' } });
```

### Step 4: read it and follow changes

`Loom.effects.list({ castId })` returns the applied effects of a target. A linked cast returns the effects of its actor.

Live updates arrive as the Signals `buff.created`, `buff.updated` and `buff.deleted`. See [Signals](../api/effects.md#signals).

There is no built-in target picker and no cast button. The system code decides the target and calls `apply`.

## Raw CRUD

These members call the `/api/buffs` routes. They work on the stored effect records and skip the template rules: a raw `create` does not check No stacking, and it does not copy a template. The server only validates the field values. Prefer `apply`, `clear` and `condition` for gameplay.

| Member | Request | Returns |
|--------|---------|---------|
| `forActor(actorId)` | `GET /api/buffs/actor/:actorId` | `Promise<EffectData[]>` |
| `forItem(itemId)` | `GET /api/buffs/item/:itemId` | `Promise<EffectData[]>` |
| `create(data)` | `POST /api/buffs` | `Promise<EffectData>`. `data` needs a `name` and one of `actorId`, `itemId` or `tileId`. It also needs a `worldId`, unless it has an `itemId`; the world of the session is used when `worldId` is omitted. |
| `update(id, updates)` | `PUT /api/buffs/:id` | `Promise<EffectData>`. Only the fields given are changed. |
| `delete(id)` | `DELETE /api/buffs/:id` | `Promise<{ success: boolean }>` |

`EffectData` is the shape declared in `client/core/effects-api.ts`: `id`, `worldId`, `actorId`, `itemId`, `name`, `icon`, `origin`, `duration`, `disabled` and `changes`. The server returns more fields, such as `castId`, `durationUnit` and `sourceType`.

Unlike the other members, these calls **throw** when the request fails. The error is an `ApiError` with a `status` number and a `message`. Wrap them in `try`/`catch`:

```js
try {
  await Loom.effects.update(effect.id, { disabled: true });
} catch (err) {
  console.warn(err.status, err.message);
}
```

`delete` on an applied effect also removes its condition from the status markers of the cast, as `clear` does. See [Status markers](../api/effects.md#status-markers).
