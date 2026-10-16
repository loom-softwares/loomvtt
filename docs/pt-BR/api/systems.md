# Systems (Sistemas/Rulesets)

## Endpoints

**Base:** `/api/systems`
**Auth:** Nenhum

---

### GET `/`

Lista os rulesets instalados (dos manifestos de addon em disco, carregados e do tipo `ruleset`).

**Response `200`:** `[{ id, title, version, backgroundUrl, author, repository, description }]`
**Response `500`:** `{ "error": "Failed to retrieve systems." }`

---

### GET `/active`

Sistema ativo com default data. Lê o mundo ativo (`isActive`) e torna o sistema dele o sistema ativo.

**Response `200`:** `{ id, title, version, actorTypes, itemTypes, defaultData: { character, npc } }`
**Response `404`:** `{ "error": "No active system registered." }`

---

### GET `/active/sheet`

Schema de ficha do sistema ativo. `?type=character` (padrão `character`)

**Response `200`:** `{ tabs: [{ id, label, icon?, fields }] }`, ou `null` quando o sistema não tem ficha para esse tipo.

---

### GET `/active/item-sheet`

Schema de ficha de item do sistema ativo. `?type=equipment` (padrão `equipment`). Mesma resposta de `GET /active/sheet`, com `null` quando o sistema não define nenhuma.

---

## Self-update do servidor (`/api/system`)

> Base diferente das rotas acima — mesmo nome parecido, router à parte
> (`server/applications/api/system.ts`), montado em `/api/system` (singular), não
> `/api/systems`.

**Auth:** `requireAdminSession` nas duas rotas.

### GET `/api/system/update-check`

Compara a versão local (`package.json`) contra a última release no GitHub.

**Query:** `?channel=stable|preview` (default `stable`)

**Response `200`:** `{ currentVersion, latestVersion, hasUpdate, changelog, publishedAt, channel }`.
Quando o GitHub responde com status de erro (por exemplo 404 quando não há release), ainda responde `200` com `hasUpdate: false`, `error` (mensagem em português) e `noRelease` (`true` no 404).
Quando a própria requisição lança exceção (por exemplo sem rede), responde `500` com `{ "error": "..." }` (veja o problema de código no relatório).

---

### GET `/api/system/update-status`

Progresso de uma atualização da edição Node rodando em segundo plano. Consultado pela tela de atualizações. `requireAdminSession`. Responde com `no-store`.

---

### POST `/api/system/update`

`requireAdminSession`. Body: `{ "channel": "stable" | "preview", "force"?: boolean }`. O que faz depende de como o app está instalado:

- **Build Electron** (`LOOM_ELECTRON_UPDATER=1`): entrega a atualização ao atualizador do Electron e retorna o resultado dele.
- **Edição Node** (`isNodeEdition(root)` é verdadeiro): baixa a release mais nova e inicia uma atualização em segundo plano. Retorna `{ "success": true, "started": true, "log": "Atualização iniciada." }`. Retorna `{ "success": false, "log": "Uma atualização já está em andamento." }` quando uma já está rodando.
- **Outras instalações sem `.git`**: não faz nada e retorna `{ "success": false, "log": "..." }` apontando para a página de releases.
- **Checkout do código-fonte** (tem `.git`): verifica se o `git` está disponível e então roda `git pull && npm install && npm run build` no diretório da aplicação.

**Response `200`:** `{ "success": boolean, "log": "..." }` (stdout/stderr combinados, mesmo em falha). Falhas na consulta ao GitHub também voltam como `200` com `success: false`.
