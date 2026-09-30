# Combat (Combate)

## Endpoints

**Base:** `/api/combat`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em toda rota, exceto `GET /:worldId`)

---

### GET `/:worldId`

Retorna o combat ativo do mundo.

**Response `200`:** Combat object ou `null`

---

### POST `/:worldId/start`

Inicia novo combate. Encerra combate ativo anterior.

**Request body:** `{ "combatants": [{ "id", "name", "initiative?" }] }`

Se `initiative` não for informado, rola 1d20 (resultado 1-20) aleatório.

**Response `201`:** Combat criado (ordenado por iniciativa DESC)
**Evento WS:** `combat.started`

---

### POST `/:worldId/dex-initiative`

Inicia combate com iniciativa resolvida pela fórmula do sistema ativo.

**Request body:** `{ "castIds"?: [ids], "initiativeFormula"?: "1d20+@attributes.dex.mod" }`

- Se `initiativeFormula` não for enviada, usa a `initiativeFormula` do sistema ativo (ou padrão `1d20`).
- A fórmula é resolvida com `@variables` do `systemData` inteiro achatado (ex: `@attributes.dex.mod`, `@skills.perception.value`).
- Se `castIds` não for fornecido, usa todos os `CastsDocument` do mundo.
- Resultado final: cada combatente recebe o valor total do roll calculado, mantendo DEX apenas para exibição (não afeta o roll real).

**Response `201`:** Combat criado

---

### POST `/:worldId/next`

Avança para o próximo turno.

**Response `200`:** Combat atualizado (round/turn)
**Evento WS:** `combat.next`

---

### POST `/:worldId/end`

Encerra combate ativo.

**Response `200`:** `{ "success": true }`
**Evento WS:** `combat.ended`

---

### POST `/:worldId/combatant`

Adiciona combatente pelo `castId` ao combate ativo. Cria combate se não existir.

**Request body:** `{ "castId": "..." }`

⚠️ **Nota:** Iniciativa é sempre `1d20` (1-20) aleatório quando adicionado via este endpoint — não passa pelo sistema. Para iniciativa customizada, use `/dex-initiative`.

**Response `200`:** Combat atualizado
**Evento WS:** `combat.updated`

---

### DELETE `/:worldId/combatant/:castId`

Remove combatente.

**Response `200`:** Combat atualizado

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
// No script de setup do sistema, registre a setting:
Loom.settings.register(systemId, 'initiativeFormula', '1d20 + @attributes.dex.mod');
```

**Variáveis disponíveis:** qualquer campo numérico no `systemData` achatado, referenciado como `@caminho.aninhado` (ex: `@attributes.dex.mod`, `@skills.perception.value`).

**Endpoints que usam:**
- `POST /dex-initiative` — rola a fórmula do sistema, ordena por resultado, inicia combate.
- `POST /start` — ignora o sistema, usa d20 aleatório fixo.
- `POST /combatant` — ignora o sistema, usa d20 aleatório fixo.
