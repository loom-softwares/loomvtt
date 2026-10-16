# Combat (Combate)

## Endpoints

**Base:** `/api/combat`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em toda rota, exceto `GET /:worldId` e `POST /:worldId/combatant/:castId/initiative`)

---

### GET `/:worldId`

Retorna o combat ativo do mundo.

**Response `200`:** Combat object ou `null`

---

### POST `/:worldId/start`

Inicia novo combate. Encerra combate ativo anterior e inicia a música de combate do mundo.

**Request body:** `{ "combatants": [{ "id", "name", "initiative?" }] }`

Se `initiative` não for informado, rola 1d20 (resultado 1-20) aleatório. Um valor informado é guardado como enviado: diferente de `dex-initiative`, esta rota não o limita a -20..100.

**Response `201`:** Combat criado (ordenado por iniciativa DESC)
**Response `400`:** a inserção falhou
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `combat.ended` (sempre enviado primeiro, para o combate que é substituído), depois `combat.started`

---

### POST `/:worldId/dex-initiative`

Inicia combate com iniciativa por DES. Um total que um handler de `combatInitiative` fornece é usado como dado. A fórmula é usada só para combatentes sem total informado, e só quando `deferred` não é `true`.

**Request body:** `{ "castIds"?: [ids], "initiativeFormula"?: "1d20+@attributes.dex.mod" }`

- Se `initiativeFormula` não for enviada, o servidor usa `1d20`. O client envia a fórmula do sistema ativo, mas o servidor só a lê quando `deferred` está ausente. O botão "Iniciar combate (iniciativa DES)" sempre envia `deferred: true`, então nesse caminho a fórmula nunca é usada: todo combatente sem total informado começa com `initiative: null` e rola o próprio d20 na aba de combate.
- A fórmula é resolvida com `@variables` do `systemData` inteiro achatado (ex: `@attributes.dex.mod`, `@skills.perception.value`).
- Se `castIds` faltar ou vier vazio, usa todos os casts do mundo. Caso contrário, só os listados participam.
- Resultado final: cada combatente recebe o valor total do roll calculado, mantendo DEX apenas para exibição (não afeta o roll real).
- Campos opcionais do body: `initiatives` (`{ [castId]: total }`, total fornecido pelo ruleset, limitado a -20..100, usado no lugar da fórmula), `health` (`{ [castId]: { hp, maxHp } }`), `deferred` (quando `true`, combatentes sem total informado começam com `initiative: null` e rolam depois por `POST /:worldId/combatant/:castId/initiative`) e `rolls` (`{ [castId]: { bonus, mode } }`, guardado para a rolagem adiada).
- Combatentes com iniciativa `null` ficam por último na ordem.

**Response `201`:** Combat criado
**Response `400`:** `{ "error": "No cast members in this world." }`
**Evento WS:** `combat.started` (o combate anterior é encerrado sem `combat.ended`)

---

### POST `/:worldId/next`

Avança para o próximo turno. Quando o turno volta ao início e começa uma nova rodada, a `duration` de todos os buffs ativos do mundo diminui 1, e os que chegam a 0 são removidos (`-1` é permanente).

**Response `200`:** Combat atualizado (round/turn)
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.next`

---

### POST `/:worldId/previous`

Volta um turno (para quando o Mestre avançou por engano). As durações de buffs já decrementadas não são restauradas.

**Response `200`:** Combat atualizado. Na rodada 1, turno 0, devolve o combate sem mudança.
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.updated` (não `combat.next`, para que efeitos de início de turno não rodem de novo)

---

### POST `/:worldId/reset`

Volta à rodada 1, turno 0, com todas as iniciativas em `null` de novo (cada combatente rola de novo). O combate continua ativo.

**Response `200`:** Combat atualizado
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.updated` (sem `combat.ended`)

---

### POST `/:worldId/end`

Encerra combate ativo.

**Response `200`:** `{ "success": true }`
**Evento WS:** `combat.ended`

---

### POST `/:worldId/combatant`

Adiciona combatente pelo `castId` ao combate ativo. Cria combate se não existir. Se o cast já estiver no combate, devolve o combate sem mudança.

**Request body:** `{ "castId": "...", "hp"?: number, "maxHp"?: number }` (`hp` e `maxHp` default para o `systemData.hp` do próprio cast)

⚠️ **Nota:** Iniciativa é sempre `1d20` (1-20) aleatório quando adicionado via este endpoint — não passa pelo sistema. Para iniciativa customizada, use `/dex-initiative`.

**Response `200`:** Combat atualizado
**Response `400`:** `{ "error": "castId is required" }`
**Response `404`:** `{ "error": "Cast member not found" }`
**Evento WS:** `combat.updated`

---

### DELETE `/:worldId/combatant/:castId`

Remove combatente.

**Response `200`:** Combat atualizado
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.updated`

---

### POST `/:worldId/combatant/:castId/initiative`

Permite que o dono do token defina a própria iniciativa, somente enquanto ela ainda for `null`. O GM sempre pode. Não é exclusivo do GM: qualquer usuário logado do mundo pode chamar, mas quem não é GM precisa ser dono do token (mesma regra de propriedade de `POST /api/cast/:id/position`).

**Request body:** `{ "initiative": number }` (limitado a -20..100)

**Response `200`:** Combat atualizado
**Response `400`:** `{ "error": "initiative must be a number" }`
**Response `403`:** `{ "error": "Only the owner of this token can set its initiative" }`
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Combatant not found" }`
**Response `409`:** `{ "error": "Initiative is already set" }`
**Evento WS:** `combat.updated`

---

---

### PUT `/:worldId/combatant/:castId`

Atualiza combatente. Campos permitidos: `hp`, `maxHp`, `initiative`, `isActive`, `name`, `groupId`.
Também aceita `flags: { [namespace]: {...} }` — merge raso por namespace (mesmo padrão de
flags de `ChatMessage`/`User`), então as flags de um addon não sobrescrevem as de outro.

**Response `200`:** Combat atualizado
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Combatant not found" }`
**Evento WS:** `combat.updated`

---

### POST `/:worldId/group`

Adiciona um grupo de combatentes — uma linha de iniciativa compartilhada que vários combatentes podem entrar.

**Request body:** `{ "name": "..." }`

**Response `201`:** Grupo criado (`{ id, name, initiative: null }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }`
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.updated`

---

### PUT `/:worldId/group/:groupId`

Renomeia um grupo e/ou define sua iniciativa compartilhada.

**Request body:** `{ "name"?: "...", "initiative"?: number | null }`

**Response `200`:** Grupo atualizado
**Response `404`:** `{ "error": "No active combat" }` / `{ "error": "Group not found" }`
**Evento WS:** `combat.updated`

---

### DELETE `/:worldId/group/:groupId`

Remove um grupo. Os membros continuam como combatentes, mas perdem o `groupId` (voltam a
usar a própria iniciativa).

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "No active combat" }`
**Evento WS:** `combat.updated`

---

## Iniciativa: como customizar por sistema

Sistemas customizam iniciativa via a setting `initiativeFormula` (registrada no `Loom.settings`).

**Para o author do sistema:**
```javascript
// No script de setup do sistema, registre a setting. O terceiro argumento precisa ser um objeto de config:
// uma string solta é espalhada na definição, então nenhum default é guardado.
Loom.settings.register(systemId, 'initiativeFormula', {
  scope: 'world',
  type: String,
  default: '1d20 + @attributes.dex.mod',
});
```

**Variáveis disponíveis:** qualquer campo numérico no `systemData` achatado, referenciado como `@caminho.aninhado` (ex: `@attributes.dex.mod`, `@skills.perception.value`).

**Endpoints que usam:**
- `POST /dex-initiative` — ordena por resultado e inicia combate. A fórmula rola só para combatentes sem total informado e só quando `deferred` está ausente; o botão de iniciar combate envia `deferred: true`, então normalmente deixa cada d20 para ser rolado na aba de combate.
- `POST /start` — ignora o sistema, usa d20 aleatório fixo.
- `POST /combatant` — ignora o sistema, usa d20 aleatório fixo.
