# Interface & HUD

O **Loom VTT** conta com uma interface moderna, projetada para maximizar a área visível do mapa sem abrir mão de controle rápido e automações táticas.

---

## 🖥️ Visão Geral da Mesa de Jogo

A área principal da sessão é dividida em quatro zonas de controle intuitivas:

![Visão Geral do HUD do LoomVTT](/assets/screenshots/game-hud.png)

1. **Canvas Tático (Centro):** O tabuleiro virtual com renderização de alto desempenho via WebGL/Canvas. Suporta mapa de fundo, iluminação em tempo real com sombras dinâmicas, névoa de guerra e movimentação de tokens.
2. **Barra de Ferramentas do Canvas (Esquerda):** Ferramentas para manipulação de tokens, medição de distância, desenho de paredes, fontes de luz, som posicional, armadilhas e modelos de área.
3. **Barra Lateral Direta (Sidebar):** O centro operacional contendo chat de texto, rolagens de dados, atores, itens, cenas, combate, diários, compêndios e configurações.
4. **Hotbar de Ações & Barra Inferior:** Acesso instantâneo a macros via atalhos numéricos (1 a 0) e indicador de desempenho do jogador.

---

## ⚡ Hotbar de Ações e Macros

Localizada na parte inferior da tela, a hotbar permite que mestres e jogadores tenham seus recursos mais utilizados a um clique ou tecla de distância:

![Barra Inferior de Macros e Hotbar](/assets/screenshots/ActionBar/macro-hotbar.png)

* **Slots 1 a 0:** Execute magias, ataques com armas ou scripts customizados pressionando as teclas numéricas correspondentes no teclado.
* **Paginação de Hotbar:** Use as setas para alternar entre até 5 páginas diferentes de macros (permitindo organizar atalhos por combate, exploração ou magias).
* **Bloqueio de Barra:** Ícone de cadeado para evitar remover ou arrastar acidentalmente macros durante o calor do combate.
* **Organização Fácil:** Basta arrastar um item, arma ou macro da barra lateral diretamente para qualquer slot vazio da hotbar.

---

## 📊 Widget de Status e Desempenho do Jogador

No canto inferior esquerdo, cada participante encontra o widget com o seu status de conexão atual:

![Widget de Status do Jogador](/assets/screenshots/UserTools/user-status-widget.png)

* **Nome e Papel:** Exibe o nome do usuário e sua função na sessão (ex: *Gamemaster* ou *Jogador*).
* **Latência (Ping):** Mede o tempo de resposta em milissegundos com o servidor do LoomVTT (ex: `2ms`).
* **Taxa de Quadros (FPS):** Monitoramento contínuo da taxa de renderização (ex: `60 FPS`), garantindo que animações e luzes estejam fluidas.

---

## 👤 Configuração de Usuário e Personagem

Clicando no ícone de engrenagem no widget de jogador, abre-se a janela de **Configurar Usuário**:

![Configuração de Usuário e Personagem](/assets/screenshots/UserTools/configure-user-modal.png)

Nesta modal é possível definir:

* **Nome de Exibição:** Nome que aparecerá nas mensagens do chat e listas do mestre.
* **Cor do Jogador:** Cor hexadecimal usada para destacar seu ponteiro no mapa, medições de régua e bordas de seleção.
* **Pronomes:** Pronomes de identificação exibidos na sessão.
* **Personagem Principal (Main Character):** Vincula a sua conta ao seu Ator principal, permitindo abrir a ficha rapidamente com duplo clique e falar no chat diretamente em nome do personagem.
* **Alterar Senha:** Permite redefinir com segurança sua senha individual de acesso àquele mundo.

---

## 🎮 Controles de Navegação da Câmera

| Ação | Controle do Mouse | Atalho de Teclado |
| :--- | :--- | :--- |
| **Mover Câmera (Pan)** | Clique e arraste com o botão do meio ou direito | `Ctrl + Setas do Teclado` |
| **Zoom In / Zoom Out** | Girar roda do mouse (Scroll) | `PageUp` / `PageDown` |
| **Resetar Visão** | — | `Home` |
| **Pausar Jogo (GM)** | — | `Barra de Espaço` |

---

## 🗺️ Barra Superior de Cenas & Pré-carregamento

Na parte superior da tela, a barra de navegação de cenas permite que o Mestre alterne rapidamente entre cenários:
* **Cena Ativa vs Pré-visualização:** O Mestre pode inspecionar qualquer cena clicando em seu botão sem transportá-los imediatamente. Para ativar a cena e puxar todos os jogadores, basta clicar com o botão direito e selecionar *Ativar para Todos*.
* **Pré-carregamento em Memória (Preload):** O Mestre pode clicar com o botão direito em uma cena e escolher *Pré-carregar Cena*. O motor carrega as texturas e paredes em segundo plano com um cache LRU (até 5 cenas em memória), garantindo transições instantâneas sem congelamento de tela.
* **Recolher/Expandir:** O botão lateral na barra permite recolher as abas para focar apenas na cena ativa, economizando espaço na tela.

