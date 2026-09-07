# Handlebars Helpers — `{{localize}}`, `{{formGroup}}`, etc. (`handlebars-helpers.ts`)

Registers a subset of standard Handlebars helpers that converted systems assume are already
available globally in templates. It is a **side-effect module**: just importing it
(`import './core/handlebars-helpers.js'`) already registers the helpers in the Handlebars used
by `renderTemplate()` — it doesn't export anything to import directly.

Source: `client/core/handlebars-helpers.ts`.

> **Why it exists:** any converted template that uses `{{localize}}`, `{{concat}}` etc.
> (practically all of them) would break with "Missing helper" without these registrations.
>
> **Missing helpers for more complex widgets** (`formGroup`/`formInput`/`numberInput`/
> `radioBoxes`/`editor`/`object`) to produce entire forms — but the form ones below
> **are already** included. Add on demand if a real template needs more.

## Registered Helpers

| Helper | Template Usage | Description |
|--------|-----------------|-----------|
| `localize` | `{{localize "str.key"}}` / `{{localize "str" a=1}}` | Translates the key via i18n (accepts parameter hash for `format`) |
| `concat` | `{{concat a b c}}` | Concatenates the arguments |
| `ifThen` | `{{ifThen cond "A" "B"}}` | `cond ? A : B` |
| `numberFormat` | `{{numberFormat value decimals=2 sign=true}}` | Formats number (`toFixed(decimals)`; `sign` prefixes `+` for ≥0) |
| `checked` | `checked="{{checked bool}}"` | Returns `checked` if true |
| `disabled` | `{{disabled bool}}` | Returns `disabled` if true |
| `selectOptions` | `{{selectOptions choices selected=selected localize=true}}` | Generates `<option>` for a map/array; marks the selected; optionally localizes |
| `formGroup` | `{{#formGroup label="..." hint="..."}}{{/formGroup}}` | Wrapper `<div class="form-group">` + `<label>` + block + `<p class="hint">` |
| `formInput` | `{{formInput type="text" name="x" value=val}}` | Generates `<input>` (supports `checkbox`, `select` with `options`) |
| `numberInput` | `{{numberInput val name="hp" step=1 min=0 max=10}}` | `<input type="number">` with attributes |
| `radioBoxes` | `{{radioBoxes name choices checked=checked}}` | Generates radio group (`<div class="radio-boxes">`) |

## Example

```handlebars
<!-- Localization + concat -->
<button>{{localize "sheet.save"}} {{concat name " (" level ")"}}</button>

<!-- Format a number with sign -->
<hp>{{numberFormat hp decimals=0 sign=true}}</hp>

<!-- Localized options select, with one selected -->
<select>
  {{selectOptions choices selected=current localize=true}}
</select>

<!-- Block form group -->
{{#formGroup label="Name" hint="Name displayed on the sheet"}}
  {{formInput type="text" name="name" value=name}}
{{/formGroup}}

<!-- Radios -->
{{radioBoxes "die" dieChoices checked=activeDie}}
```
