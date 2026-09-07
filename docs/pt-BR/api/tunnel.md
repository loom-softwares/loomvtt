# Cloudflare Tunnel

## Endpoints

**Base:** `/api/tunnel`
**Auth:** `requireAdminSession` (escopo de servidor, não de mundo)

---

### POST `/start`

Inicia o túnel Cloudflare.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `mode` | `string` | **sim** | `'quick'` (temporário) ou `'named'` (nome fixo) |
| `name` | `string` | não | Nome do túnel (obrigatório se mode=`named`) |

**Response `200`:** Status do túnel

---

### POST `/stop`

Para o túnel.

**Response `200`:** Status do túnel

---

### GET `/status`

Retorna o status atual do túnel.

**Response `200`:**
```json
{
  "active": true,
  "url": "https://meu-tunel.trycloudflare.com",
  "mode": "quick",
  "pid": 12345
}
```

---

## Painel

Acessível via `AppConfigWindow` (Setup Hub → engrenagem → Configuração do Aplicativo → "Acesso Externo"). A janela `cloudflared-tunnel-window.ts` gerencia o túnel.

## Persistência

`tunnelMode` e `tunnelName` são salvos em `loom.config.json`.

## URL nos pontos de compartilhamento

- Janela "Links de Convite" — seção "Túnel (Internet)"
- Tela de World Login — campo "Link Externo" (só visível para admin)
