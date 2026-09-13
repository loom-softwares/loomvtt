/*******************************************************************************
 * LoomVTT
 * client/core/theater-skins.ts
 *
 *
 * Registry of theater-mode (cinematic) letterbox skins — CSS variables +
 * texture assets, no PIXI involved (the letterbox bars are plain DOM elements,
 * see game-hud.ts). Ships with a few free skins built in; a future addon can
 * call `theaterSkins.register(...)` to add more (e.g. a premium marketplace)
 * without touching this file.
 ******************************************************************************/

export interface TheaterSkinAssets {
  topBar?: string;
  bottomBar?: string;
  portraitBorder?: string;
  background?: string;
  border?: string;
  footer?: string;
}

export interface TheaterSkin {
  id: string;
  /** Fallback name (used if `nameKey` has no translation — ex.: addon futuro). */
  name: string;
  /** Chave i18n (namespace `theaterSkins.*`) exibida no seletor rápido. */
  nameKey?: string;
  author?: string;
  /** CSS filter applied to the cinematic background image (not the whole screen). */
  filter?: string;
  styles: Record<string, string>;
  assets: TheaterSkinAssets;
}

class TheaterSkinRegistry {
  private skins = new Map<string, TheaterSkin>();

  register(skin: TheaterSkin): void {
    this.skins.set(skin.id, skin);
  }

  get(id: string): TheaterSkin | undefined {
    return this.skins.get(id);
  }

  list(): TheaterSkin[] {
    return Array.from(this.skins.values());
  }
}

export const theaterSkins = new TheaterSkinRegistry();

const BASE = '/theater-skins';

/* Skins puramente CSS — sem asset, sem nome gravado na barra. A primeira
   registrada é o padrão do sistema (ver DEFAULT_THEATER_SKIN abaixo). */
theaterSkins.register({
  id: 'classic-black',
  name: 'Clássico (sem moldura)',
  nameKey: 'theaterSkins.classicBlack',
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
  nameKey: 'theaterSkins.vignette',
  author: 'Loom',
  filter: '',
  styles: {
    '--cinematic-bar-bg': 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
    '--cinematic-bar-border': 'none',
    '--cinematic-text-color': '#e0e0e0',
  },
  assets: {},
});

theaterSkins.register({
  id: 'noir',
  name: 'Noir Detective',
  nameKey: 'theaterSkins.noir',
  author: 'Loom',
  // Quem escolhe essa skin no seletor rápido espera P&B na hora — mesmo
  // valor do efeito "noir" separado (flags.theaterEffect, só na config da
  // cena); os dois convivem bem porque TheaterEffectFilters os concatena.
  filter: 'grayscale(100%) contrast(1.2)',
  styles: {
    '--cinematic-bar-bg': '#1a1a1a',
    '--cinematic-bar-border': '1px solid #333333',
    '--cinematic-text-color': '#cccccc',
  },
  assets: {},
});

theaterSkins.register({
  id: 'sepia',
  name: 'Fotografia Antiga',
  nameKey: 'theaterSkins.sepia',
  author: 'Loom',
  filter: 'sepia(0.8) contrast(0.9)',
  styles: {
    '--cinematic-bar-bg': '#3b2f2f',
    '--cinematic-bar-border': '2px solid #8b7355',
    '--cinematic-text-color': '#f4ebd0',
  },
  assets: {},
});

theaterSkins.register({
  id: 'dark-world',
  name: 'Dark World',
  nameKey: 'theaterSkins.darkWorld',
  author: 'The Blacksmith',
  filter: 'grayscale(20%) sepia(10%) contrast(1.15)',
  styles: {
    '--cinematic-bar-bg': '#120202',
    '--cinematic-footer-bg': 'transparent',
    '--cinematic-portrait-name-bg': 'rgba(30, 0, 0, 0.6)',
    '--cinematic-portrait-aspect-ratio': '3 / 4',
    '--cinematic-text-color': '#dfc1c1',
    '--cinematic-portrait-name-border-top': '1px solid #5a0000',
  },
  assets: {
    topBar: `${BASE}/dark-world/assets/top-bar.webp`,
    bottomBar: `${BASE}/dark-world/assets/bottom-bar.webp`,
    portraitBorder: `${BASE}/dark-world/assets/portrait-border.webp`,
    background: `${BASE}/dark-world/assets/portrait-bg.webp`,
    border: `${BASE}/dark-world/assets/bar-border.webp`,
    footer: `${BASE}/dark-world/assets/footer.webp`,
  },
});

theaterSkins.register({
  id: 'medieval-parchment',
  name: 'Medieval Parchment',
  nameKey: 'theaterSkins.medievalParchment',
  author: 'The Blacksmith',
  filter: '',
  styles: {
    '--cinematic-bar-bg': '#23170f',
    '--cinematic-footer-bg': 'transparent',
    '--cinematic-portrait-name-bg': 'rgba(35, 23, 15, 0.85)',
    '--cinematic-portrait-aspect-ratio': '3 / 4',
    '--cinematic-text-color': '#e5d3b3',
    '--cinematic-portrait-name-border-top': 'none',
  },
  assets: {
    topBar: `${BASE}/medieval-parchment/assets/top-bar.webp`,
    bottomBar: `${BASE}/medieval-parchment/assets/bottom-bar.webp`,
    portraitBorder: `${BASE}/medieval-parchment/assets/portrait-border.webp`,
    background: `${BASE}/medieval-parchment/assets/portrait-bg.webp`,
    border: `${BASE}/medieval-parchment/assets/bar-border.webp`,
    footer: `${BASE}/medieval-parchment/assets/footer.webp`,
  },
});

theaterSkins.register({
  id: 'metal-max',
  name: 'Metal Max',
  nameKey: 'theaterSkins.metalMax',
  author: 'The Blacksmith',
  filter: '',
  styles: {
    '--cinematic-bar-bg': '#000000',
    '--cinematic-bar-border': '2px solid #333333',
    '--cinematic-footer-bg': 'transparent',
    '--cinematic-portrait-name-bg': 'rgba(0, 0, 0, 0.5)',
    '--cinematic-portrait-aspect-ratio': '3 / 4',
    '--cinematic-text-color': '#ffffff',
    '--cinematic-portrait-name-border-top': 'none',
  },
  assets: {
    topBar: `${BASE}/metal-max/assets/top-bar.webp`,
    bottomBar: `${BASE}/metal-max/assets/bottom-bar.webp`,
    portraitBorder: `${BASE}/metal-max/assets/portrait-border.webp`,
    background: `${BASE}/metal-max/assets/portrait-bg.webp`,
    border: `${BASE}/metal-max/assets/bar-border.webp`,
    footer: `${BASE}/metal-max/assets/footer.webp`,
  },
});

theaterSkins.register({
  id: 'cyber-punk',
  name: 'Cyberpunk Neon',
  nameKey: 'theaterSkins.cyberPunk',
  author: 'The Blacksmith',
  filter: 'hue-rotate(320deg) contrast(1.1)',
  styles: {
    '--cinematic-bar-bg': '#05050a',
    '--cinematic-bar-border': '2px solid #00ffff',
    '--cinematic-footer-bg': 'rgba(5, 5, 10, 0.8)',
    '--cinematic-portrait-name-bg': 'rgba(255, 0, 127, 0.45)',
    '--cinematic-portrait-aspect-ratio': '3 / 4',
    '--cinematic-text-color': '#00ffff',
    '--cinematic-portrait-name-border-top': '2px solid #00ffff',
  },
  assets: {
    topBar: `${BASE}/cyber-punk/assets/top-bar.webp`,
    bottomBar: `${BASE}/cyber-punk/assets/bottom-bar.webp`,
    portraitBorder: `${BASE}/cyber-punk/assets/portrait-border.webp`,
    background: `${BASE}/cyber-punk/assets/portrait-bg.webp`,
    border: `${BASE}/cyber-punk/assets/bar-border.webp`,
    footer: `${BASE}/cyber-punk/assets/footer.webp`,
  },
});

/** Skin usada quando a cena não define `flags.theaterSkin`. */
export const DEFAULT_THEATER_SKIN = 'classic-black';
