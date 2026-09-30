# Guia: Displays, TV de Mesa & OBS Studio (Alpha 05)

O LoomVTT permite gerar links de visualização dedicados somente leitura (*Read-Only*) para projetar o mapa em televisores deitados sobre a mesa física, projetores, monitores secundários ou transmissões ao vivo no OBS Studio.

---

## Como Abrir a Janela de Displays

No Game HUD do Mestre, clique no ícone de antena de transmissão (<i class="fa-solid fa-satellite-dish"></i>) na barra superior ou na toolbox. A janela **Displays & Mesa Física** será aberta.

---

## Modos e Presets de Exibição

1. **Mesa Física (TV Deitada / Projetor)**
   - Desativa automaticamente o grid virtual (ideal caso a mesa tenha grid desenhado ou acrílico).
   - Oculta tokens virtuais dos jogadores para permitir o uso de **miniaturas físicas reais de plástico/metal** sobre a tela.
   - Suporta **Rotação de 90°, 180° ou 270°** para TVs instaladas em qualquer orientação sem precisar reconfigurar o sistema operacional.
   - Oculta ferramentas e dados do Mestre.

2. **Table Display (TV na Parede / Monitor Secundário)**
   - Visualização limpa do mapa completo com grid e tokens visíveis.
   - Ideal para arrastar para um segundo monitor ou transmitir via Miracast/Chromecast.

3. **OBS Browser Source (Live / Streaming)**
   - Ativa **Fundo Transparente** (`alpha = 0`) para sobreposição limpa no layout da sua live.
   - Exibe rolagens de dados e mensagens do chat em tempo real sem barras de ferramentas.

4. **Espectador / Jogador Remoto**
   - Visualização idêntica à de um jogador, sem permissão de movimentação ou edição de fichas.

---

## Como Conectar à sua TV

### Opção 1: Transmitir Tela do Windows (`Win + K`)
1. No teclado, pressione **`Windows + K`**.
2. Selecione a sua Smart TV (Samsung, LG, etc.) e escolha o modo **"Estender"**.
3. Na janela de Displays do Loom, clique em **"Testar"** (<i class="fa-solid fa-up-right-from-square"></i>) no link desejado.
4. Arraste a nova aba para o monitor da TV e pressione **`F11`** para tela cheia.

### Opção 2: Pelo Navegador da Smart TV (Sem Fio)
1. Na janela de Displays, clique no botão **"Copiar LAN"**.
2. Abra o navegador da Smart TV (ex: Samsung Internet) conectado ao mesmo Wi-Fi do computador.
3. Digite o endereço copiado (ex: `http://192.168.1.15:3000/?display=...`).
4. A tela sincroniza automaticamente via WebSocket com o jogo.

---

## Recursos Integrados & Compatibilidade

- **Modo Teatro Cinematográfico**: Suporte completo ao Modo Teatro em tempo real. Quando o Mestre adiciona personagens ao elenco em cena, os portrait cards aparecem perfeitamente sincronizados na TV ou OBS, com as molduras da skin ativa e filtros visuais (ex: P&B no Noir, Sépia, Vinheta).
- **Visão Compartilhada do Grupo (Party Vision)**: Em telas com tokens habilitados, a TV herda a visão agregada dos personagens dos jogadores, revelando dinamicamente a névoa de guerra e luzes conforme o grupo explora o mapa.
- **Movimentação Somente Leitura (Read-Only Locking)**: Na TV ou display de espectador, o mapa aceita zoom e navegação de visualização, mas a movimentação de tokens é travada contra toques acidentais (apenas o dono legítimo ou o GM podem mover seus tokens).

---

## Segurança e Resiliência

- **Sessões Virtuais Limpas**: Os links geram uma sessão JWT isolada (`isDisplay: true`). Nenhuma conta fantasma é criada no banco de dados, mantendo a tela de login ("Quem é você?") e o gerenciamento de jogadores completamente limpos.
- **Tokens Revogáveis com 1 Clique**: O Mestre pode revogar qualquer link ativo instantaneamente na lista de displays. Telas conectadas são desconectadas de imediato com aviso visual.
- **Isolamento de Segredos**: Não vazam monstros ocultos, camadas de GM, notas secretas ou controles administrativos.
- **Reconexão Automática**: Em caso de oscilações de Wi-Fi, um aviso discreto aparece e o mapa se reconecta sozinho assim que a rede estabilizar.
