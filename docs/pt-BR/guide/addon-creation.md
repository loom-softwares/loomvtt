# Criação de Addons

Addons são pacotes que estendem o LoomVTT com funcionalidades adicionais.

## Estrutura

```
<DataRoot>/marketplace/addons/meu-addon/
├── addon.json     ← manifesto (obrigatório)
└── client.js      ← entry point client-side (opcional)
```

## Manifest (`addon.json`)

```json
{
  "name": "meu-addon",
  "title": "Meu Addon",
  "version": "1.0.0",
  "engine": "loom",
  "type": "addon",
  "engineVersion": ">=0.1.0",
  "author": "Seu Nome",
  "repository": "https://github.com/usuario/meu-addon",
  "description": "Um addon incrível para LoomVTT.",
  "manifest": "https://github.com/usuario/meu-addon/releases/latest/download/addon.json",
  "download": "https://github.com/usuario/meu-addon/releases/latest/download/meu-addon.zip",
  "backgroundUrl": "https://meusite.com/fundo.jpg",
  "coverUrl": "https://meusite.com/capa.jpg",
  "active": true,
  "core": "core.js",
  "client": "client.js",
  "mount": "meu-addon-root",
  "styles": ["styles/meu-addon.css"],
  "signals": ["meu-sinal-addon"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "dependencies": ["outro-addon"],
  "conflicts": [],
  "settings": [
    {
      "key": "modoEscuro",
      "type": "boolean",
      "default": false,
      "label": "Modo escuro",
      "scope": "world"
    }
  ]
}
```

| Campo            | Tipo             | Descrição                                 |
| ---------------- | ---------------- | ------------------------------------------- |
| `name`         | `string`       | Identificador único (apenas letras, num, `_`, `-`) |
| `title`        | `string`       | Nome de exibição                          |
| `version`      | `string`       | Semver                                      |
| `engine`       | `"loom"`       | **Obrigatório**. Define que o pacote é para LoomVTT |
| `type`         | `"addon"`      | **Obrigatório**. Define que é um addon      |
| `engineVersion`| `string`       | Faixa de versão exigida — min e/ou max, ex: `>=0.1.0`, `<2.0.0`, ou `>=1.0.0 <2.0.0` |
| `author`       | `string`       | Nome do autor                              |
| `repository`   | `string`       | URL do repositório/código-fonte            |
| `description`  | `string`       | Descrição do pacote                       |
| `manifest`     | `string`       | URL remota deste `addon.json` para auto-update |
| `download`     | `string`       | URL do `.zip` para download na instalação |
| `backgroundUrl`| `string`       | URL para imagem de fundo no Setup Hub      |
| `coverUrl`     | `string`       | URL para imagem de capa (se aplicável)      |
| `active`       | `boolean`      | Se desativado globalmente (default: true)   |
| `core`         | `string`       | Entry point server-side (`.js/.ts`)       |
| `client`       | `string`       | Entry point client-side (`.js`)           |
| `mount`        | `string`       | ID do elemento DOM para montar UI           |
| `styles`       | `string[]`     | Array de paths para arquivos CSS          |
| `languages`    | `Array`        | Array de definições de idioma (`lang`, `name`, `path`) |
| `signals`      | `string[]`     | Nomes de Signals que este addon escuta      |
| `dependencies` | `string[]`     | Addons/sistemas que devem estar ativos      |
| `conflicts`    | `string[]`     | Addons/sistemas que NÃO podem estar ativos |
| `settings`     | `SettingDef[]` | Configurações do addon                    |

- `engineVersion` é informativo, não é portão rígido. Número inteiro sozinho funciona
  (`"1"`, `">=2"`), e uma clausula mal formatada/typo é logada e ignorada em vez de
  bloquear a instalação. Se a versão realmente cair fora da faixa declarada, a
  instalação segue mesmo assim — o instalador só devolve uma string `warning` (mostrada
  como toast) pra quem está instalando julgar se é seguro.

## Client-side

O `client.js` é carregado via `import()` dinâmico no navegador. Use o SDK do LoomVTT:

```javascript
// client.js
import { LoomHooks, api, sheets, showToast, showConfirm, windowManager, wrap } from '/_loom/sdk/index.js';

console.log('Meu addon carregado!');

// Registrar hook
LoomHooks.on('actor.created', (actor) => {
  console.log('Novo actor:', actor.name);
});

// Registrar ficha personalizada
class MeuSheet extends sheets.get('actor', '*') {
  // ...
}
sheets.catalog('actor', 'meu-tipo', MeuSheet);

// Wrap de função
const unsub = wrap(resolveFOVOrigins).wrap((original, cast) => {
  console.log('Calculando FOV para', cast.id);
  return original(cast);
});

// API
api.get('/actors').then(actors => {
  console.log(actors);
});

// Janelas
await windowManager.open('minha-janela', MinhaJanela);

// Notificações
showToast('Addon ativado!', 'success');
showConfirm('Tem certeza?').then(ok => {});
```

## Server-side

O `core.js` (se especificado) é importado no servidor durante o boot, uma
vez, no mesmo processo Node do resto do app — acesso total ao banco e a
todo módulo interno, sem sandbox. Dois pontos de extensão:

**Sua própria tabela no banco.** LoomVTT é relacional de ponta a ponta
(knex, sobre SQLite ou Postgres) — não tem cliente NoSQL nenhum plugado no
app pra usar. `db` é uma instância knex apontada pro mundo atualmente ativo:

```javascript
// core.js — caminho relativo a partir de marketplace/addons/<seu-addon>/core.js
import { db } from '../../../server/applications/database/db.js';

async function ensureTable() {
  if (!(await db.schema.hasTable('my_addon_notes'))) {
    await db.schema.createTable('my_addon_notes', (t) => {
      t.string('worldId').primary();
      t.text('text').defaultTo('');
    });
  }
}
```

Não existe hook pra "o banco do mundo acabou de ficar pronto" — cheque/crie
sua tabela de forma lazy, na primeira vez que uma rota precisar dela.

**Sua própria API REST.** O `app` Express principal nunca é exportado pro
código de addon (dar acesso ao app cru deixaria um addon sobrescrever rota
do core ou meter middleware antes da auth). `registerAddonRoutes()` monta
seu router num namespace próprio, `/api/addons/<seu-addon>/*`, já com
`requireAuth` aplicado:

```javascript
import { Router } from 'express';
import { registerAddonRoutes } from '../../../server/applications/addons/addon-api.js';

const router = Router();
router.get('/notes', async (req, res) => {
  const worldId = req.auth?.worldId;
  res.json({ text: '...' });
});
registerAddonRoutes('meu-addon', router);
```

O client chama igual a qualquer endpoint do core: `api.get('/addons/meu-addon/notes')`.

**Reagir ao que o core já dispara** — o outro ponto de extensão, sem rota
nenhuma:

```javascript
import { Signal } from '../../../server/applications/signals/index.js';

Signal.listen('cast.created', (data) => {
  console.log('Cast member criado:', data);
});
```

`Signal` é um `EventEmitter` puro do lado do servidor — nunca chega no
navegador por conta própria; é pra reagir a outra coisa do servidor, não
pra falar com o client (ver o [addon de exemplo completo](https://github.com/sammore2/loom-exemple-addon) com os três juntos).

## Ciclo de vida

1. Server boot → `loadAllAddons()` escaneia `marketplace/addons/**/addon.json`
2. Valida dependências e conflitos
3. Importa `core.js` via `import()` dinâmico
4. Client connect → `GET /marketplace/packages` → importa `client.js`
5. Addon ativo recebe Signals/LoomHooks em tempo real

## Instalação

Via Setup Hub > Addons ou API:

```bash
curl -X POST http://localhost:3000/api/marketplace/install \
  -H "Content-Type: application/json" \
  -d '{"url": "https://raw.githubusercontent.com/user/repo/main/addon.json", "type": "addon"}'
```

## APIs disponíveis

Veja [sdk/](../sdk/window-loom.md) para a lista completa de APIs expostas.
