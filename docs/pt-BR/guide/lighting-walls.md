# Luzes, Paredes & Som

O **Loom VTT** conta com um motor de física e raycasting de alta performance que calcula linha de visão, sombras realistas e áudio posicional em tempo real diretamente no navegador.

---

## 🧱 Paredes e Bloqueio de Visão

As ferramentas de parede definem como a luz, a visão dos personagens e a movimentação física interagem com o mapa.

![Ferramentas de Paredes](/assets/screenshots/gridtool/gridtool-walls-select.png)

### Tipos de Paredes Disponíveis

* **Paredes Padrão:** Bloqueiam completamente a passagem física de tokens, a visão dos personagens e a propagação da luz.
* **Portas Interativas:** Um clique abre ou fecha a porta, revelando a área oculta além dela. Uma porta trancada só pode ser aberta pelo Mestre. Só o Mestre tranca ou destranca uma porta, com um clique com o botão direito.
  Cada porta pode definir uma **distância de abertura** (um token do próprio jogador precisa estar perto; o Mestre sempre abre) e **sons próprios de abrir e fechar**.
* **Janelas:** Restringem o movimento de tokens e bloqueiam a luz, mas deixam a visão passar.
* **Portas Secretas:** Ficam completamente invisíveis aos jogadores até que o Mestre decida revelá-las ou abri-las.
* **Paredes de Terreno:** Bloqueiam apenas o movimento de tokens. Visão, luz e som atravessam essas paredes.
* **Paredes Etéreas:** Bloqueiam a visão e a luz, mas não o movimento.
* **Paredes Invisíveis:** Bloqueiam o movimento e não são desenhadas no mapa.

### Atalhos de Parede
* **Clique:** Seleciona um segmento de parede ou nó.
* **Arrastar:** Move o segmento selecionado.
* **Delete:** Remove o segmento.
* **Shift + soltar:** Ao terminar um segmento, solte o mouse segurando Shift para continuar a cadeia a partir da ponta. **Duplo clique** encerra a cadeia.

---

## 💡 Iluminação Dinâmica e Sombras

Crie atmosferas deslumbrantes posicionando fontes de iluminação coloridas e animadas na cena:

![Ferramentas de Luz Dinâmica](/assets/screenshots/gridtool/gridtool-lights-select.png)

### Recursos de Iluminação

* **Luzes Locais:** Tochas com chamas pulsantes, lanternas direcionais ou fogueiras de acampamento.
* **Cores Customizadas:** Defina o matiz exato da luz (luz suave amarelada de fogo, brilho azulado místico, verde venenoso, etc.).
* **Raio Claro e Escuro:** Configure a distância de iluminação plena (Bright Light) e o raio de penumbra (Dim Light).
* **Duplo Clique:** Abre a janela de propriedades da fonte luminosa para ajustar cor, intensidade e animação.
* **Por Andar:** a luz brilha só no próprio andar. Ligue "Compartilhada entre andares" na ficha dela para iluminar todos os andares da cena. A névoa funciona igual: só os tokens e as luzes do andar na tela a revelam, e o que foi explorado é lembrado por andar.
* **Sombras em Tempo Real:** Conforme os tokens se movem, suas linhas de visão interagem com as fontes de luz e as paredes calculando a névoa de guerra progressiva.

---

## 🔊 Áudio Ambiente e Som Posicional

Traga imersão auditiva para suas masmorras e cidades posicionando fontes de áudio dinâmicas diretamente no tabuleiro:

| Posicionar Fonte de Som | Seleção e Ajuste de Áudio |
| :---: | :---: |
| ![Posicionar Som](/assets/screenshots/gridtool/gridtool-sounds-place.png) | ![Ajustar Som](/assets/screenshots/gridtool/gridtool-sounds-select.png) |

### Como Funciona o Áudio Posicional

* **Atenuação por Distância:** Um som de cachoeira, fogueira crepitante ou multidão de taverna é posicionado em um ponto do mapa. O volume que cada jogador escuta varia suavemente de acordo com a proximidade de seu token daquela fonte!
* **Raio de Audição:** Configure o raio máximo no qual o áudio pode ser ouvido pelos personagens.
* **Áudio Contínuo:** Suporte a arquivos em loop para música de ambiente ou efeitos contínuos.
