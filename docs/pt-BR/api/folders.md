# Folders (Pastas)

## Endpoints

**Base:** `/api/folders`
**Auth:** `requireAuth, requireWorldMatch`

Tipos válidos: `actor`, `item`, `scene`, `journal`, `roll-table`, `macro`, `deck`, `playlist`, `compendium`, `compendium-entry`, `compendium-source-owner`

---

### GET `/`

Lista pastas, da mais antiga para a mais nova (`createdAt` asc). `?worldId=`, `?type=` para filtrar; `?packId=` filtra por pacote (aplicado a qualquer tipo, mas só é útil para `compendium-entry`).

**Response `200`:** `FoldersDocument[]`

---

### GET `/:id`

Busca pasta por ID. `404` `{ "error": "Folder not found" }` se não existir.

---

### POST `/`

Cria pasta. Responde `201` com a pasta criada.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** (não vazio após trim) | — |
| `type` | `string` | **sim** (um dos tipos válidos) | — |
| `worldId` | `string` | não | `'world-1'` |
| `packId` | `string` | **sim** para `compendium-entry`, senão não | `''` |
| `parent` | `string` | não | `''` |
| `sorting` | `string` | não | `'m'` |
| `color` | `string` | não | `''` |

Valida que o parent existe, que o type coincide e, para `compendium-entry`, que o `packId` é o mesmo. Erros de validação retornam `400`.

**Evento WS:** `folder.created`

---

### PUT `/:id`

Atualiza pasta. Aceita `name`, `parent`, `sorting`, `color`, `hubLogoUrl`, `hubBackground`; sem nenhum campo válido retorna `400`. Um `parent` igual ao próprio id da pasta ou ao parent atual é ignorado. Um novo parent precisa existir e ter o mesmo type. A rota **não** verifica ciclos de ancestralidade (A → B → A é aceito).

**Evento WS:** `folder.updated`

---

### DELETE `/:id`

Remove pasta. Opções por query ou body:

| Opção | Default | Efeito |
|-------|---------|--------|
| `deleteSubfolders` | `false` | Remove também todas as subpastas descendentes (recursivo); os documentos dentro delas são desvinculados. |
| `reparentTo` | `'root'` | Só `'root'` é respeitado: as pastas filhas vão para a raiz. Qualquer outro valor é ignorado e as filhas vão para o parent da pasta removida (ver CODE ISSUE). |
| `deleteContents` | `false` | Remove os itens do mundo dentro da(s) pasta(s). Somente GM (`403` caso contrário); somente pastas de `item` (`400` caso contrário). |

Os documentos da pasta são desvinculados (`folderId` vira `''`). Respostas: `{ "success": true, "id", "deletedItems" }` ou, com `deleteSubfolders`: `{ "success": true, "deletedIds", "deletedItems" }`.

**Eventos WS:** `folder.deleted` por pasta removida (`{ id }`), `item.deleted` por item removido quando `deleteContents` está ativo.

> CODE ISSUE: `reparentTo` diferente de `'root'` é ignorado (`server/applications/api/folders.ts`, linha do `newParent`). Documentado como comportamento real até a correção.
