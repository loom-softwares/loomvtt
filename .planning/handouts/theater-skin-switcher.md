# Handout — Seletor de skin do Modo Teatro (caixa suspensa)

Referência de comportamento: `E:\CODE\FoundryVTT\Modules\storyteller-cinema\src\scripts\core\skin-manager.ts`.
Lá o `apply(skinId)` faz três coisas: injeta as CSS vars da skin, marca a classe no body,
e persiste no setting — e o switcher só chama `getSkins()` → usuário escolhe → `apply(id)`.
No Loom é a mesma ideia, mas em vez de um setting de mundo, a escolha vai pra
`stages.flags.theaterSkin` e é retransmitida por WebSocket pra todos os clientes.

São 5 passos independentes. Faça na ordem. Não invente nada além do que está escrito.

---

## Passo 1 — server: `flags` chega como string crua no init (BUG REAL, corrigir primeiro)

**Arquivo:** `server/index.ts`

**Localize** (linha ~1225):

```ts
          const enrichedStages = currentStages.map((stage: any) => {
            const levels = currentLevels.filter((l: any) => l.stageId === stage.id).sort((a: any, b: any) => a.bottomElevation - b.bottomElevation);
            const thumbUrl = levels.length > 0 ? levels[0].backgroundUrl : '';
            return {
              ...stage,
              levels,
              thumbUrl,
              bgUrl: thumbUrl
            };
          });
```

**Troque por:**

```ts
          const enrichedStages = currentStages.map((stage: any) => {
            const levels = currentLevels.filter((l: any) => l.stageId === stage.id).sort((a: any, b: any) => a.bottomElevation - b.bottomElevation);
            const thumbUrl = levels.length > 0 ? levels[0].backgroundUrl : '';
            // `select('*')` cru não passa pelo LoomDocument, então `flags` vem como
            // string JSON. Sem isso, `flags.theaterSkin` no client é sempre undefined.
            let stageFlags: Record<string, any> = {};
            try {
              stageFlags = typeof stage.flags === 'string' ? JSON.parse(stage.flags || '{}') : (stage.flags ?? {});
            } catch { /* flags corrompido, segue com objeto vazio */ }
            return {
              ...stage,
              flags: stageFlags,
              levels,
              thumbUrl,
              bgUrl: thumbUrl
            };
          });
```

> Não use o helper `parseJsonField` — ele é declarado depois (linha ~1269), fora de escopo aqui.

---

## Passo 2 — client: tirar os console.log de debug

**Arquivo:** `client/screens/game-hud/game-hud.ts`

**Apague** estas duas linhas (dentro de `applyTheaterState`, ~818 e ~821), nada mais:

```ts
    console.log('[THEATER-DEBUG] flags read', flags, 'raw activeStage.flags=', this.initState.activeStage?.flags);
```

```ts
    console.log('[THEATER-DEBUG] resolved', { bgUrl, skinId: skin?.id, skinFilter: skin?.filter, allSkinIds: theaterSkins.list().map(s => s.id) });
```

---

## Passo 3 — duas skins sem textura (o padrão passa a ser "sem nada escrito")

As 4 skins atuais têm o nome gravado na imagem da barra de cima. Elas continuam como
opção temática, mas o padrão vira uma skin puramente CSS, sem asset nenhum —
igual ao `default` / `vignette` do módulo de referência.

**Arquivo:** `client/core/theater-skins.ts`

**Localize:**

```ts
const BASE = '/theater-skins';

theaterSkins.register({
  id: 'dark-world',
```

**Insira ANTES do `theaterSkins.register({ id: 'dark-world'`** (e depois do `const BASE`):

```ts
/* Skins puramente CSS — sem asset, sem nome gravado na barra. A primeira
   registrada é o padrão do sistema (ver DEFAULT_THEATER_SKIN abaixo). */
theaterSkins.register({
  id: 'classic-black',
  name: 'Clássico (sem moldura)',
  author: 'Loom',
  filter: '',
  styles: {
    '--cinematic-bar-bg': '#000000',
    '--cinematic-bar-border': 'none',
    '--cinematic-text-color': '#ffffff',
  },
  assets: {},
});

theaterSkins.register({
  id: 'vignette',
  name: 'Vinheta Suave',
  author: 'Loom',
  filter: '',
  styles: {
    '--cinematic-bar-bg': 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
    '--cinematic-bar-border': 'none',
    '--cinematic-text-color': '#e0e0e0',
  },
  assets: {},
});
```

**No fim do arquivo, acrescente:**

```ts
/** Skin usada quando a cena não define `flags.theaterSkin`. */
export const DEFAULT_THEATER_SKIN = 'classic-black';
```

> A barra de baixo da `vignette` fica com o gradiente invertido — isso é esperado,
> não tente consertar com CSS extra; se o usuário reclamar, é ajuste de estética,
> não deste handout.

---

## Passo 4 — server: persistir e retransmitir a troca de skin

**Arquivo:** `server/index.ts`

### 4a — a ponte do Signal (SEM ISSO NADA CHEGA NO CLIENTE)

**Localize** (linha ~804):

```ts
Signal.listen('stage.theaterToggled', (payload) => {
  broadcastToAll('stage.theaterToggled', payload);
});
```

**Acrescente logo abaixo:**

```ts
Signal.listen('stage.theaterSkinChanged', (payload) => {
  broadcastToAll('stage.theaterSkinChanged', payload);
});
```

### 4b — o handler WS

**Localize** o fim do bloco `if (type === 'stage.theater') { ... }` (linha ~1535), que termina assim:

```ts
        Signal.broadcast('stage.theaterToggled', { stageId, active: !!active });
      }
```

**Acrescente logo abaixo:**

```ts

      // ── Troca rápida de skin do modo teatro ─────────────────────────────────
      // O seletor ao lado do botão de teatro; persiste em flags.theaterSkin e
      // reenvia pra todos, pra a moldura mudar ao vivo em todas as telas.
      if (type === 'stage.theaterSkin') {
        if ((auth.userRole ?? 1) < 4) return;
        const { stageId, skinId } = data;
        if (!stageId || typeof skinId !== 'string') return;
        const stage = await db('stages').where({ id: stageId }).first();
        if (!stage) return;
        let stageFlags: Record<string, any> = {};
        try { stageFlags = stage.flags ? JSON.parse(stage.flags) : {}; } catch { /* flags corrompido, ignora */ }
        stageFlags.theaterSkin = skinId;
        await db('stages').where({ id: stageId }).update({ flags: JSON.stringify(stageFlags) });
        Signal.broadcast('stage.theaterSkinChanged', { stageId, skinId });
      }
```

---

## Passo 5 — client: a caixa suspensa

**Arquivo:** `client/screens/game-hud/game-hud.ts`

### 5a — import

**Localize:**

```ts
import { theaterSkins } from '../../core/theater-skins.js';
```

**Troque por:**

```ts
import { theaterSkins, DEFAULT_THEATER_SKIN } from '../../core/theater-skins.js';
```

### 5b — o `<select>` no template

**Localize** (dentro de `render()`, ~193):

```ts
      <button id="theater-toggle-btn" class="theater-toggle-btn" style="display:none" title="Modo Teatro">
        <i class="fa-solid fa-masks-theater"></i>
      </button>
```

**Troque por:**

```ts
      <button id="theater-toggle-btn" class="theater-toggle-btn" style="display:none" title="Modo Teatro">
        <i class="fa-solid fa-masks-theater"></i>
      </button>
      <select id="theater-skin-select" class="theater-skin-select" style="display:none" title="Moldura do Modo Teatro">
        ${theaterSkins.list().map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
```

### 5c — separar "pintar a skin" de "ligar/desligar"

**Localize** o método `applyTheaterState` inteiro (~805 a ~845, do `private applyTheaterState(active: boolean): void {` até o `}` que fecha o método) e **troque por:**

```ts
  private applyTheaterState(active: boolean): void {
    this.theaterActive = active;
    this.container.classList.toggle('theater-mode', active);
    this.canvasManager?.setTheaterActive(active);
    this.subcomponents.sidebar?.setCollapsed(active);

    const select = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    const isGM = (this.props.session.userRole ?? 1) >= 4;
    if (select) select.style.display = active && isGM ? '' : 'none';

    if (!active) return;
    this.paintTheaterSkin();
  }

  /** Repinta a moldura/fundo do teatro a partir das flags da cena ativa.
   * Separado de `applyTheaterState` porque a troca de skin ao vivo precisa
   * repintar sem religar o modo. */
  private paintTheaterSkin(): void {
    const flags = (this.initState.activeStage?.flags ?? {}) as {
      cinematicBg?: string;
      theaterSkin?: string;
      theaterEffect?: string;
    };
    const bgUrl = flags.cinematicBg || this.canvasManager?.getCurrentBackgroundUrl?.() || '';
    const skinId = flags.theaterSkin || DEFAULT_THEATER_SKIN;
    const skin = theaterSkins.get(skinId);

    const select = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    if (select && select.value !== skinId) select.value = skinId;

    const layer = this.container.querySelector<HTMLElement>('#theater-layer');
    const bgEl = this.container.querySelector<HTMLElement>('#theater-bg');
    const fogEl = this.container.querySelector<HTMLElement>('#theater-fog');
    const topBar = this.container.querySelector<HTMLElement>('.theater-bar-top');
    const bottomBar = this.container.querySelector<HTMLElement>('.theater-bar-bottom');

    if (bgEl) {
      bgEl.innerHTML = bgUrl ? mediaHtml(bgUrl, { className: 'theater-bg-media' }) : '';
      const effectFilter = TheaterEffectFilters[flags.theaterEffect || 'none'] || '';
      const skinFilter = skin?.filter || '';
      bgEl.style.filter = [skinFilter, effectFilter].filter(Boolean).join(' ');
    }

    if (fogEl) fogEl.hidden = flags.theaterEffect !== 'fog';

    if (layer) {
      // Limpa as vars da skin anterior antes de aplicar as novas — senão uma skin
      // sem `--cinematic-bar-border` herdaria a borda da skin anterior.
      for (const s of theaterSkins.list()) {
        for (const prop of Object.keys(s.styles)) layer.style.removeProperty(prop);
      }
      if (skin) {
        for (const [prop, value] of Object.entries(skin.styles)) {
          layer.style.setProperty(prop, value);
        }
      }
    }
    if (topBar) topBar.style.backgroundImage = skin?.assets.topBar ? `url('${skin.assets.topBar}')` : '';
    if (bottomBar) bottomBar.style.backgroundImage = skin?.assets.bottomBar ? `url('${skin.assets.bottomBar}')` : '';
  }
```

> Mantenha o bloco de comentário `/** Toggles the theater overlay ... */` que já existe
> logo acima de `applyTheaterState`.

### 5d — ligar o seletor

**Localize** (dentro de `setupTheaterMode`, ~766):

```ts
    wsClient.on('stage.theaterToggled', (data: { stageId: string; active: boolean }) => {
      if (data.stageId !== this.initState.activeStage?.id) return;
      this.applyTheaterState(data.active);
    });
```

**Troque por:**

```ts
    wsClient.on('stage.theaterToggled', (data: { stageId: string; active: boolean }) => {
      if (data.stageId !== this.initState.activeStage?.id) return;
      this.applyTheaterState(data.active);
    });

    const skinSelect = this.container.querySelector<HTMLSelectElement>('#theater-skin-select');
    if (skinSelect) {
      skinSelect.addEventListener('change', () => {
        const stageId = this.initState.activeStage?.id;
        if (!stageId) return;
        wsClient.send('stage.theaterSkin', { stageId, skinId: skinSelect.value, worldId: this.props.worldId });
      });
    }

    wsClient.on('stage.theaterSkinChanged', (data: { stageId: string; skinId: string }) => {
      const stage = this.initState.activeStage;
      if (!stage || data.stageId !== stage.id) return;
      // Grava na cópia em memória pra um toggle posterior já abrir com a skin nova.
      stage.flags = { ...((stage.flags ?? {}) as Record<string, any>), theaterSkin: data.skinId };
      if (this.theaterActive) this.paintTheaterSkin();
    });
```

### 5e — CSS mínimo do seletor (só posicionamento, sem estética)

**Arquivo:** `client/styles/screens.css`

**Localize:**

```css
.stream-link-btn {
  left: calc(50% + 44px);
}
```

**Acrescente logo abaixo:**

```css
.theater-skin-select {
  position: absolute;
  top: 12px;
  right: calc(50% + 28px);
  z-index: 10001;
  height: 36px;
  max-width: 180px;
  padding: 0 8px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(15, 12, 22, 0.75);
  color: #f0e6d3;
  cursor: pointer;
  font-size: 12px;
}
```

**E** na lista de seletores `display: none !important` das views de captura (~394),
**acrescente** `.game-hud.capture-chat .theater-skin-select,` e
`.game-hud.capture-canvas .theater-skin-select,` junto dos irmãos `.stream-link-btn`.

---

## Passo 6 — alinhar o padrão na janela de config da cena

**Arquivo:** `client/windows/stage-config-window.ts`

Em dois lugares o `'dark-world'` está escrito na mão. Troque os dois por `'classic-black'`:

1. No `<select name="flags.theaterSkin">`, o trecho `(this.stage.flags as any)?.theaterSkin || 'dark-world'`.
2. No payload de save, `theaterSkin: data['flags.theaterSkin'] || 'dark-world'`.

---

## Verificação

```bash
npm run verify
```

Depois, no navegador (dev em `localhost:5173`, mundo "A Cripta da Floresta", GM):

1. Ativar o Modo Teatro → as barras devem aparecer **pretas lisas, sem nome escrito**.
2. A caixa suspensa deve aparecer à esquerda do botão de máscaras, só pro GM, só com o teatro ligado.
3. Trocar pra "Dark World" → a moldura com textura aparece na hora, sem recarregar.
4. Desligar e religar o teatro → deve voltar na skin escolhida, não no padrão.

Não commite sem os 4 itens acima conferidos.
