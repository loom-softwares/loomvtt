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

Um túnel `quick` aguarda até 15 segundos o cloudflared imprimir a URL `trycloudflare.com`. Um túnel `named` executa `cloudflared tunnel run <name>` e retorna `url: null`, pois a URL é o domínio próprio do usuário. Iniciar com um túnel já em execução para o anterior antes.

**Response `200`:** Status do túnel (veja `GET /status`)
**Response `400`:** `{ "error": "Invalid mode. Must be \"quick\" or \"named\"." }`
**Response `500`:** `{ "error": "..." }` quando o cloudflared não está instalado, quando `named` é usado sem `name`, ou quando a URL quick não aparece em 15 segundos

---

### POST `/stop`

Para o túnel (SIGTERM no cloudflared) e salva `tunnelMode: "off"`.

**Response `200`:** Status do túnel (veja `GET /status`)
**Response `500`:** `{ "error": "..." }`

---

### GET `/status`

Retorna o status atual do túnel.

**Response `200`:**
```json
{
  "running": true,
  "mode": "quick",
  "url": "https://meu-tunel.trycloudflare.com"
}
```

`mode` é `"off"` e `url` é `null` quando nenhum túnel está em execução. `running` é `false` quando o processo do cloudflared terminou.

---

### Erros em todas as rotas

`401` `{ "error": "Admin session required" }` (sem cookie de admin) ou `{ "error": "Invalid or expired token" }`; `403` `{ "error": "Admin access required" }` (sessão válida sem ser admin).

### WebSocket

Nenhum. As rotas do túnel não emitem eventos.

---

## Painel

Acessível via `AppConfigWindow` (Setup Hub → engrenagem → Configuração do Aplicativo → "Acesso Externo"). A janela `cloudflared-tunnel-window.ts` gerencia o túnel.

## Persistência

`tunnelMode` e `tunnelName` são salvos em `loom.config.json`.

## URL nos pontos de compartilhamento

- Janela "Links de Convite" — seção "Túnel (Internet)"
- Tela de World Login — campo "Link Externo" (só para sessão de admin, e só enquanto um túnel roda com URL, ou seja, no modo quick)

O endpoint de Links de Convite (`GET /api/worlds/:worldId/invite-links`) também retorna o estado do túnel, então a janela do GM não chama estas rotas.
