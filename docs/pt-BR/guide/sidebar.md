# Barra Lateral (Sidebar)

A **Barra Lateral** (Sidebar) na lateral direita da tela é o painel de gerenciamento central do **Loom VTT**. Através de seus ícones superiores, mestres e jogadores acessam rapidamente todos os recursos, dados e ferramentas da campanha.

---

## 💬 1. Chat e Rolagens de Dados

O chat é onde a narrativa acontece e as rolagens de dados são calculadas com automação completa:

![Aba de Chat com Rolagens](/assets/screenshots/sidebar/sidebar-chat-rolls.png)

* **Cards de Rolagem:** Mostram a fórmula, o valor de cada dado, os modificadores, o total e um detalhamento ao passar o cursor. Uma rolagem que não é pública recebe uma etiqueta (somente Mestre, Mestre às cegas, somente eu). A comparação com a Classe de Dificuldade (DC) e o destaque de sucessos e falhas críticas ficam a cargo dos cards do próprio sistema.
* **Comando de Rolagem:**
  * `/r 1d20 + 5` — Rola a fórmula. Os botões de modo de rolagem no painel de chat (Pública, Somente Mestre, Mestre às Cegas, Somente Eu) definem quem vê a próxima rolagem.
  * `/roll`, `/gmroll`, `/blindroll` e `/whisper` não são interpretados pelo cliente: o texto é enviado como uma mensagem comum do chat.
* **Ferramentas de Formatação:** Barra de formatação inferior com suporte a negrito, links, códigos e imagens.

---

## 👥 2. Atores e Personagens

![Aba de Atores](/assets/screenshots/sidebar/sidebar-actors.png)

* **Organização em Pastas:** Agrupe heróis, PdMs, monstros e aliados em pastas personalizadas.
* **Criação Rápida:** Botão **Criar Ator** com suporte a importação ou criação manual.
* **Arrastar para o Mapa:** Arraste qualquer ator para o canvas para gerar um token pronto para o combate.
* **Busca Instantânea:** Filtre atores pelo nome ou tipo com a barra de busca em tempo real.
* **Importar e Exportar:** importe um personagem de um slot do Loom Connect ou de um arquivo `.json`, e salve um pelo menu da ficha ("Salvar personagem em arquivo (.json)" ou "Exportar para o Loom Connect" depois de conectar nas configurações da conta). Um personagem importado por jogador aguarda a aprovação do Mestre.

---

## 🎒 3. Itens e Equipamentos

![Aba de Itens](/assets/screenshots/sidebar/sidebar-items.png)

* Catálogo de todas as armas, armaduras, consumíveis, magias e talentos da campanha.
* Arraste itens diretamente da aba de Itens para a ficha de um Ator para adicionar ao inventário automaticamente!

---

## 🗺️ 4. Cenas e Mapas

![Aba de Cenas](/assets/screenshots/sidebar/sidebar-scenes.png)

* Lista todos os mapas disponíveis na campanha com preview em miniatura.
* **Ativação:** Clique na cena para abrir sua janela de configuração. Clique com o botão direito e escolha **Ativar (Todos os Jogadores)** para puxar todos os jogadores conectados para essa cena de uma vez. (Ao clicar em uma cena de mapa, ela expande para mostrar as cenas filhas.)

---

## ⚔️ 5. Rastreador de Combate (Combat Tracker)

![Rastreador de Combate](/assets/screenshots/sidebar/sidebar-combat.png)

* **Iniciativa Automática:** Rola a iniciativa de todos os participantes com um clique (ex: botão *Start Combat (DEX Initiative)*).
* **Gestão de Rodadas:** Exibe a ordem de turnos, rodada atual e o combatente ativo.

---

## 📖 6. Diários e Documentos (Journals)

![Aba de Diários](/assets/screenshots/sidebar/sidebar-journals.png)

* Editor de texto rico para crônicas, pistas da aventura e cartas para os jogadores.
* Suporte a páginas com imagens e possibilidade de arrastar o documento para o tabuleiro criando pins de anotação no mapa.

---

## 🃏 7. Baralhos e Cartas (Decks)

![Aba de Baralhos](/assets/screenshots/sidebar/sidebar-cards-decks.png)

* Suporte nativo a baralhos de cartas tradicionais (54 cartas) ou baralhos temáticos (como cartas de tarô, inspiração, ferimentos críticos ou magias).
* Permite embaralhar, comprar cartas ou distribuí-las para outras pilhas do mundo (mãos ou descartes), e passar cartas individuais de uma pilha para outra.

---

## 🎲 8. Tabelas de Rolagem (Roll Tables)

![Aba de Tabelas de Rolagem](/assets/screenshots/sidebar/sidebar-rolltables.png)

* Crie geradores aleatórios para encontros na masmorra, tesouros, clima ou eventos imprevistos.
* Rolagens com um clique enviando os resultados diretamente para o chat.

---

## ⚡ 9. Macros

![Aba de Macros](/assets/screenshots/sidebar/sidebar-macros.png)

* Diretório de scripts de automação customizados (em JavaScript ou comandos de chat).
* Arraste macros para a hotbar inferior para executá-las com atalhos numéricos.

---

## 🎵 10. Playlists e Sons de Fundo

![Aba de Playlists](/assets/screenshots/sidebar/sidebar-playlists.png)

* Três controles de volume: **Geral** é o volume de tudo no VTT, **Música** é toda playlist (as tocadas pela barra lateral e a playlist da própria cena) e **Ambiente** são só os sons colocados no mapa com a ferramenta de áudio. O Geral multiplica os outros dois.
* A música da cena fica em sincronia na mesa: quem recarrega a página ou entra depois (jogador ou Mestre) vai para a faixa em que a mesa está, no ponto em que ela chegou, e não para o início da playlist.

* Organize faixas em listas de reprodução para batalhas épicas, tavernas relaxantes ou momentos de tensão.
* Escolha várias faixas de uma vez para a playlist; a aba de música tem uma barra de progresso com avanço e, com a barra lateral recolhida, um cartão "tocando agora" fica no canto superior direito.

---

## 📦 11. Compêndios Compartilhados

![Aba de Compêndios](/assets/screenshots/sidebar/sidebar-compendiums.png)

* Pacotes com monstros, magias, itens e mapas que podem ser importados ou exportados para uso em múltiplos mundos e campanhas.

---

## 🔍 12. Camadas da Cena (Scene Directory)

![Camadas da Cena](/assets/screenshots/sidebar/sidebar-scene-directory.png)

* Permite buscar rapidamente qualquer elemento presente na cena ativa: tokens, luzes, paredes, tiles, desenhos ou notas.

---

## ⚙️ 13. Gestão e Configurações do Mundo

![Configurações do Mundo](/assets/screenshots/sidebar/sidebar-world-settings.png)

O painel administrativo para o Mestre:
* **Módulos:** Gerenciamento de pacotes e extensões ativas.
* **Atalhos de Teclado:** Visualização e personalização de keybinds.
* **Links de Convite:** Gera links diretos para convidar jogadores com segurança.
* **Configuração do Mundo:** Edição de título, sistema e parâmetros globais.
* **Voltar para Configuração:** Encerra a sessão ativa e retorna ao menu de seleção de mundos.
