# API: Displays & Mesa Física (`/api/display`)

Gerenciamento de links de exibição somente leitura (*Read-Only*) revogáveis para OBS Browser Source, mesas físicas (TVs e projetores horizontais), telas secundárias e espectadores remotos.

---

## Endpoints

### `GET /api/display/links`

Lista todos os links de display gerados para o mundo ativo e retorna os endereços IP da rede local.

- **Permissão**: GM autenticado na sessão do mundo ativo (`requireAuth`, `requireWorldMatch`, `requireGM`).
- **Resposta `200`**:
  ```json
  {
    "links": [
      {
        "id": "uuid-v4",
        "worldId": "world-1",
        "token": "a1b2c3d4e5f6...",
        "name": "TV Mesa Física",
        "mode": "physical",
        "config": {
          "showGrid": false,
          "showTokens": "none",
          "rotation": 90,
          "transparentBg": false,
          "showChat": false
        },
        "expiresAt": null,
        "isRevoked": false,
        "isExpired": false,
        "createdAt": "2026-09-20T21:00:00.000Z",
        "updatedAt": "2026-09-20T21:00:00.000Z"
      }
    ],
    "localIps": ["192.168.1.15"]
  }
  ```

---

### `POST /api/display/links`

Cria um novo link de display com token criptográfico seguro de 24 bytes (`crypto.randomBytes(24)`).

- **Permissão**: GM autenticado na sessão do mundo ativo.
- **Corpo da requisição**:
  ```json
  {
    "name": "TV da Sala",
    "mode": "physical",
    "config": {
      "showGrid": false,
      "showTokens": "none",
      "rotation": 90,
      "transparentBg": false,
      "showChat": false
    },
    "expiresInSeconds": 28800
  }
  ```
- **Campos do `config`**:
  - `showGrid` (`boolean`): Exibe ou oculta a grade tática do mapa (útil desligar quando a mesa física possui grid físico desenhado ou acrílico).
  - `showTokens` (`'all' | 'npcs_only' | 'none'`): Define a visibilidade de tokens (útil usar `'none'` quando os jogadores utilizam miniaturas reais de plástico/metal sobre a TV).
  - `rotation` (`0 | 90 | 180 | 270`): Rotação do mapa para telas instaladas de lado ou na ponta da mesa.
  - `transparentBg` (`boolean`): Ativa fundo 100% transparente para overlays no OBS Studio.
  - `showChat` (`boolean`): Exibe painel translúcido compacto de chat e rolagens recentes.
- **Resposta `201`**:
  ```json
  {
    "success": true,
    "link": { ... },
    "localIps": ["192.168.1.15"]
  }
  ```

---

### `DELETE /api/display/links/:id`

Revoga o link de display imediatamente.

- **Permissão**: GM autenticado na sessão do mundo ativo.
- **Efeito**:
  - Marca `isRevoked = true` no banco do mundo.
  - Dispara sinal em tempo real no WebSocket (`display.revoked`).
  - Todas as telas ativas conectadas àquele token são desconectadas instantaneamente exibindo a tela de acesso revogado.
- **Resposta `200`**:
  ```json
  { "success": true, "message": "Link revogado com sucesso." }
  ```

---

### `GET /api/display/verify/:token`

Valida um token de display público, estabelece a sessão segura de visualização (*read-only*) e retorna as configurações de exibição.

- **Permissão**: Pública (não exige login prévio).
- **Efeito**:
  - Valida se o token existe, não foi revogado e não expirou.
  - Emite o cookie de sessão `WORLD_COOKIE` autenticado com uma sessão virtual de visualização (`userId: display-${link.id}`, `isDisplay: true`, role 1, apenas leitura), sem registrar usuário na tabela do banco nem na tela de login.
- **Resposta `200`**:
  ```json
  {
    "valid": true,
    "linkId": "uuid-v4",
    "token": "a1b2c3d4e5f6...",
    "name": "TV Mesa Física",
    "mode": "physical",
    "config": {
      "showGrid": false,
      "showTokens": "none",
      "rotation": 90,
      "transparentBg": false,
      "showChat": false
    },
    "worldId": "world-1",
    "worldName": "Campanha Principal",
    "activeStageId": "stage-1"
  }
  ```
- **Erros**:
  - `404` se o link não existir.
  - `403` com `code: 'REVOKED'` se o mestre tiver revogado o link.
  - `403` com `code: 'EXPIRED'` se o tempo limite tiver passado.
