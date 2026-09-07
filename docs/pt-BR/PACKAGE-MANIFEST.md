# Contrato de manifest — addons e rulesets do LoomVTT

Um pacote é publicado como **uma release no GitHub com dois assets**:
`addon.json` (ou `ruleset.json`) e o `.zip` do pacote.

O usuário cola **um unico link** no Loom, e nada mais.

## Exemplo

```json
{
  "engine": "loom",
  "engineVersion": ">=0.0.2",
  "type": "addon",
  "name": "meu-addon",
  "title": "Meu Addon",
  "version": "1.0.0",
  "author": "Fulano",
  "description": "O que ele faz.",
  "manifest": "https://github.com/user/repo/releases/latest/download/addon.json",
  "download": "https://github.com/user/repo/releases/download/v1.0.0/meu-addon.zip"
}
```

## Campos

| Campo | Obrigatório | Observacao |
|---|---|---|
| `engine` | **sim** | Tem que ser exatamente `"loom"`. Sem isso a instalacao e recusada antes do download. |
| `type` | recomendado | `"addon"` ou `"ruleset"`. Se presente, tem que bater com o que o usuario escolheu. |
| `name` | **sim** | Apenas letras, numeros, `-` e `_`. Vira o nome da pasta instalada. |
| `version` | **sim** | Numerico separado por ponto (`1.2.3`). |
| `download` | **sim** | URL do `.zip`. Aponte para a **tag**, nao para `latest`. |
| `manifest` | **sim** | URL deste proprio arquivo. Aponte para `releases/latest/download/`. |
| `engineVersion` | nao | `">=X.Y.Z"` ou `"X.Y.Z"`. Recusa limpo se o Loom for mais antigo. |
| `title`, `author`, `description` | nao | Exibicao. |

## Por que `manifest` deve ser `latest` e `download` deve ser a tag

O `download` aponta a **tag** para que o `.zip` baixado seja sempre o que corresponde
exatamente aquele manifest — sem janela de dessincronia.

O `manifest` aponta `releases/latest/download/` para que checar atualizacao encontre a
release mais nova. Fixar o `manifest` na propria versao (padrao comum em outros VTTs, que
compensa com um registro central) deixaria o pacote congelado.

O Loom tolera manifest fixado — ele consulta a API de releases do GitHub como fonte
primaria de versao — mas usar `latest` e o correto e nao depende de cota de API.

## Publicando uma nova versao

1. Atualize `version` e o `download` (nova tag) no seu `addon.json`.
2. Crie a release com a tag nova.
3. Anexe os dois assets: `addon.json` e o `.zip`.

Nao ha passo 4. Quem ja instalou ve a atualizacao no proximo check.

## Hosts aceitos

Por seguranca, o Loom so busca pacote no GitHub (`github.com`,
`raw.githubusercontent.com`, `objects.githubusercontent.com`,
`release-assets.githubusercontent.com`, `api.github.com`, `codeload.github.com`).