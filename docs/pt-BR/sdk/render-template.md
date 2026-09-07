# Render Template — `.hbs` (`render-template.ts`)

Motor de templates Handlebars pro lado do cliente — usado por addons/rulesets pra renderizar
sheets de Actor/Item. Exposto **só** em `window.Loom.renderTemplate`/`window.Loom.loadTemplates` —
**não** é export do pacote SDK (`/_loom/sdk/index.js`), apesar de estar documentado nesta
pasta por afinidade de assunto.

```typescript
// Não é import — Loom já é global no client, addon usa direto.
const html = await Loom.renderTemplate('path/to/template.hbs', data);
```

## API

```typescript
Loom.renderTemplate(path: string, data?: unknown): Promise<string>;
Loom.loadTemplates(paths: string[]): Promise<void>;   // registra partials por path e nome curto
```

`clearTemplateCache` e o `Handlebars` interno **não são acessíveis** a addons — só
existem dentro do módulo `client/core/render-template.ts`, sem alias público.

## Resolução de path (importante)

Path de convenção legada é traduzido automaticamente pro caminho real servido:

| Convenção legada | Caminho real |
|------------------|--------------|
| `systems/<id>/...` | `/marketplace/rulesets/<id>/...` |
| `modules/<id>/...` | `/marketplace/addons/<id>/...` |

Templates são arquivos `.hbs` puros, servidos nativamente — sem reescrita de extensão. Se o
path resolvido estiver errado, o fetch bate no `index.html` do dev server (200 OK) —
Handlebars compila HTML qualquer e o template sai lixo.

## Cache

Templates compilados e fontes são cacheados por path resolvido. Após editar um addon em
dev, chame `clearTemplateCache(path)` (ou sem argumento pra limpar tudo) pra ver as mudanças.

## Handlebars helpers

Os helpers compatíveis (ver `handlebars-helpers.md`) já vêm registrados globalmente no
motor interno — nenhuma ação extra necessária do lado do addon.

## Exemplo

```js
// Pré-carregar partials
await Loom.loadTemplates(['/marketplace/rulesets/wod5e/templates/parts/health.hbs']);

// Renderizar a sheet
const html = await Loom.renderTemplate('/marketplace/rulesets/wod5e/templates/actor-sheet.hbs', actorData);
container.innerHTML = html;
```