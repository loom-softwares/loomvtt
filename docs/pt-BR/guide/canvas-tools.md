# Ferramentas do Canvas (Grid Tools)

A barra de ferramentas na lateral esquerda da tela concentra todos os controles necessários para interagir com o tabuleiro, posicionar elementos e orquestrar combates e explorações no **Loom VTT**.

---

## 🧭 Visão da Barra de Ferramentas

Ao clicar em qualquer ícone da barra lateral esquerda, ela se expande exibindo suas subferramentas especializadas:

| Barra Recolhida | Menu de Tokens Expandido |
| :---: | :---: |
| ![Barra de Ferramentas](/assets/screenshots/gridtool/gridtool-toolbar.png) | ![Submenu de Ferramentas](/assets/screenshots/gridtool/gridtool-token-tools-subbar.png) |

---

## ♟️ Ferramentas de Tokens e Personagens

A ferramenta de tokens permite controlar aventureiros, monstros e NPCs na cena ativa com alta precisão e atalhos rápidos:

![Seleção e Atalhos de Tokens](/assets/screenshots/gridtool/gridtool-select-tokens.png)

### Atalhos e Controles de Tokens

* **Clique:** Seleciona o token sob o cursor.
* **Arrastar:** Move o token pelo grid. Uma régua dinâmica mostra o trajeto e a distância total percorrida em pés ou metros.
* **Shift + Clique:** Adiciona ou remove tokens de uma seleção múltipla.
* **Ctrl + Scroll do Mouse:** Gira o token em incrementos precisos (ótimo para indicar a direção da linha de visão).
* **Duplo Clique:** Abre imediatamente a ficha completa do Ator correspondente.
* **Botão Direito:** Abre o HUD rápido de token sobre o tabuleiro (para alterar vida, condições ou visibilidade).
* **Ctrl + Clique (durante movimento):** Adiciona waypoints (pontos intermediários de caminho) para calcular rotas ao redor de cantos ou armadilhas.
* **Delete / Backspace:** Remove o token da cena ativa (o Ator original na barra lateral permanece intacto).

As ferramentas de seleção de luzes, sons, notas, desenhos e tiles também desenham uma **caixa de arrastar** (segure Shift para somar ao grupo): arraste qualquer elemento do grupo para movê-los todos juntos e use **Delete** para removê-los. O Delete também remove uma luz, som, desenho ou tile selecionado sozinho.

---

## 🎨 Tiles & Imagens sobre o Mapa

![Ferramentas de Tiles](/assets/screenshots/gridtool/gridtool-tiles-select.png)

Os **Tiles** são imagens independentes que você pode sobrepor ao mapa da cena:
* Úteis para veículos (navios, carroças), mobílias, telhados removíveis ou armadilhas reveladas.
* Permite arrastar, rotacionar com `Ctrl + Scroll` e redimensionar diretamente sobre o grid.
* Possuem suporte a sobreposição com controle de camadas (z-index).

---

## ✏️ Ferramentas de Desenho e Formas

![Ferramentas de Desenho](/assets/screenshots/gridtool/gridtool-drawings-select.png)

Permite que o Mestre e os jogadores façam anotações e ilustrações visuais na cena em tempo real:
* **Desenho Livre:** Linhas e esboços rápidos com espessura e cor ajustáveis.
* **Formas Geométricas:** Retângulos, círculos, elipses e polígonos fechados.
* **Texto no Tabuleiro:** Adiciona legendas ou nomes de locais visíveis aos jogadores. A aba Texto da ficha do desenho define fonte, tamanho, alinhamento, negrito, itálico e sombra.

---

## 🎯 Modelos de Área (Templates)

![Modelos de Área](/assets/screenshots/gridtool/gridtool-templates-select.png)

Ideal para magias de área de efeito (AoE), explosões e baforadas de dragão:
* **Tipos Disponíveis:** Cones, Esferas/Círculos, Linhas/Raios e Cubos/Retângulos.
* **Destaque de Alvos:** Todos os tokens tocados pelo modelo de área são destacados visualmente para agilizar testes de resistência.
* Clique no modelo para selecioná-lo e pressione `Delete` para removê-lo quando o efeito terminar.

---

## ⚡ Gatilhos e Armadilhas (Traps)

![Armadilhas no Mapa](/assets/screenshots/gridtool/gridtool-traps-place.png)

O Loom VTT possui um sistema nativo de armadilhas interativas:
* **Criação Rápida:** Clique e arraste para desenhar a área da armadilha no piso.
* **Disparo Automático:** Quando um token pisa sobre a célula do gatilho, a armadilha é disparada instantaneamente e se desativa.
* Perfeito para alçapões, dardos envenenados, runas arcanas e armadilhas táticas de masmorras.

---

## 📌 Diários e Notas no Mapa

![Notas de Diário na Cena](/assets/screenshots/gridtool/gridtool-notes-select.png)

* Permite arrastar páginas de Diário da barra lateral diretamente para a cena, criando pins interativos no mapa.
* Com duplo clique sobre o pin, a página de anotações ou imagem correspondente se abre na tela.
* É possível configurar visibilidade pública ou secreta (apenas para o Mestre).

---

## 🎭 Arte do Teatro (tela de teatro)

A tela de teatro (a sobreposição cinematográfica que o Mestre liga no botão das máscaras) tem uma ferramenta própria. Com o teatro ligado, a barra mostra só a **Arte do teatro**; as ferramentas do mapa voltam quando ele é desligado.

* **Adicionar imagem** escolhe um arquivo de imagem e coloca no meio da tela, nas proporções dele. **Adicionar texto** coloca um texto ali e abre a ficha dele.
* **Selecionar e mover**: clique num item, arraste para mover, arraste um canto para redimensionar (a imagem mantém a proporção; o texto cresce junto com a fonte). Duplo clique abre a ficha (texto, fonte, tamanho, cor, alinhamento, negrito, itálico, sombra, opacidade, rotação, para frente/trás, excluir). **Delete** remove o item selecionado.
* **Limpar a tela** remove tudo da tela de teatro desta cena.
* A arte pertence à **cena**, não ao mapa: outra cena tem a sua própria tela de teatro, então cada cena de mapa pode abrir com uma tela de entrada diferente. Combine com a opção "abrir em modo teatro" da cena para montar uma tela de entrada para a mesa.
* Todos veem ao vivo; só o Mestre edita. Os tamanhos são relativos à largura da tela, então ela fica igual em qualquer monitor.
