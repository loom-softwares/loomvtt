# Handlebars Helpers — `{{localize}}`, `{{formGroup}}`, etc. (`handlebars-helpers.ts`)

Registra um subconjunto de helpers Handlebars padrão que sistemas convertidos assumem já
estarem disponíveis globalmente nos templates. É um **side-effect module**: só importar ele
(`import './core/handlebars-helpers.js'`) já registra os helpers no Handlebars usado
pelo `renderTemplate()` — não exporta nada pra importar direto.

Fonte: `client/core/handlebars-helpers.ts`.

> **Por que existe:** qualquer template convertido que usa `{{localize}}`, `{{concat}}` etc.
> (praticamente todos) quebraria com "Missing helper" sem esses registros.
>
> **Faltam helpers de widgets mais complexos** (`formGroup`/`formInput`/`numberInput`/
> `radioBoxes`/`editor`/`object`) produzir formulários inteiros — mas os de formulário abaixo
> **já estão** incluídos. Adicione sob demanda se um template real precisar de mais.

## Helpers registrados

| Helper | Uso no template | Descrição |
|--------|-----------------|-----------|
| `localize` | `{{localize "str.key"}}` / `{{localize "str" a=1}}` | Traduz a chave via i18n (aceita hash de parâmetros pra `format`) |
| `concat` | `{{concat a b c}}` | Concatena os argumentos |
| `ifThen` | `{{ifThen cond "A" "B"}}` | `cond ? A : B` |
| `numberFormat` | `{{numberFormat value decimals=2 sign=true}}` | Formata número (`toFixed(decimals)`; `sign` prefixa `+` p/ ≥0) |
| `checked` | `checked="{{checked bool}}"` | Retorna `checked` se verdadeiro |
| `disabled` | `{{disabled bool}}` | Retorna `disabled` se verdadeiro |
| `selectOptions` | `{{selectOptions choices selected=selected localize=true}}` | Gera `<option>` pra um mapa/array; marca o selecionado; opcionalmente localiza |
| `formGroup` | `{{#formGroup label="..." hint="..."}}{{/formGroup}}` | Wrapper `<div class="form-group">` + `<label>` + bloco + `<p class="hint">` |
| `formInput` | `{{formInput type="text" name="x" value=val}}` | Gera `<input>` (suporta `checkbox`, `select` com `options`) |
| `numberInput` | `{{numberInput val name="hp" step=1 min=0 max=10}}` | `<input type="number">` com os atributos |
| `radioBoxes` | `{{radioBoxes name choices checked=checked}}` | Gera grupo de radios (`<div class="radio-boxes">`) |

## Exemplo

```handlebars
<!-- Localização + concat -->
<button>{{localize "sheet.save"}} {{concat name " (" level ")"}}</button>

<!-- Formate um número com sinal -->
<hp>{{numberFormat hp decimals=0 sign=true}}</hp>

<!-- Select de opções localizadas, com uma selecionada -->
<select>
  {{selectOptions choices selected=current localize=true}}
</select>

<!-- Grupo de formulário em bloco -->
{{#formGroup label="Nome" hint="Nome exibido na ficha"}}
  {{formInput type="text" name="name" value=name}}
{{/formGroup}}

<!-- Radios -->
{{radioBoxes "die" dieChoices checked=activeDie}}
```