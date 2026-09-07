/*******************************************************************************
 * LoomVTT
 * client/windows/deck-sheet-window.ts
 * 
 * 
 * Window for managing a card deck.
 ******************************************************************************/

import { BaseWindow } from './base-window.js';
import { LoomDialog } from './loom-dialog.js';
import { windowManager } from '../core/window-manager.js';
import { api } from '../core/api.js';
import { showToast } from '../components/toast.js';
import { wsClient } from '../core/ws-client.js';
import { t } from '../lib/i18n.js';
import { FilePicker } from '../core/file-picker.js';
import { gameContext } from '../core/game-context.js';
import { fetchDeckPresets, loadDeckPresetFile, instantiateDeckCards } from '../core/deck-presets.js';

interface Card {
  id: string;
  name: string;
  type?: string;
  suit?: string;
  value?: string | number;
  img?: string;
  face?: string;
  back?: string;
  description?: string;
  /** ID of the stack (deck) this card came from — used by `recall`. */
  origin?: string;
}

interface Deck {
  id: string;
  name: string;
  type: string;
  stackType?: 'deck' | 'hand' | 'pile';
  ownerId?: string;
  cards: Card[];
  state: Record<string, any>;
}

interface DeckSummary {
  id: string;
  name: string;
  stackType?: 'deck' | 'hand' | 'pile';
}

export class DeckSheetWindow extends BaseWindow {
  private deck: Deck | null = null;
  private loading = true;
  private showCardBack = false;
  private unsubscribeCreated: (() => void) | null = null;
  private unsubscribeUpdated: (() => void) | null = null;
  private unsubscribeDeleted: (() => void) | null = null;

  private get isGM(): boolean {
    return (wsClient.session?.userRole ?? 1) >= 4;
  }

  constructor(private props: { deckId: string }) {
    super({
      id: `deck-sheet-${props.deckId}`,
      title: t('sidebar.deckTitle'),
      icon: '<i class="fa-solid fa-clone"></i>',
      width: 520,
      height: 'auto',
      documentId: props.deckId,
      bannerImage: '/images/general-banners/cards-banner.png'
    });
  }

  protected _postRender(): void {
    super._postRender();
    if (this.element) {
      this.element.classList.add('window-fixed-header');
    }
  }

  async mount(): Promise<void> {
    super.mount();
    this.unsubscribeUpdated = wsClient.on('deck.updated', (deck: Deck | null) => {
      if (!deck || deck.id !== this.props.deckId) return;
      this.deck = deck;
      this.rerenderBody();
    });
    this.unsubscribeDeleted = wsClient.on('deck.deleted', (data: any) => {
      if (data.id !== this.props.deckId) return;
      windowManager.close(`deck-sheet-${this.props.deckId}`);
    });
    await this.load();

    this.element.addEventListener('dragstart', (e: DragEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.deck-card-item');
      if (!item) return;
      const cardId = item.getAttribute('data-id');
      const card = this.deck?.cards.find(c => c.id === cardId);
      if (!card || !e.dataTransfer) return;

      const payload = {
        type: 'Card',
        id: card.id,
        name: card.name,
        img: card.img || ''
      };

      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    });
  }

  protected onClose(): void {
    this.unsubscribeCreated?.();
    this.unsubscribeUpdated?.();
    this.unsubscribeDeleted?.();
  }

  private async load(): Promise<void> {
    try {
      this.deck = await api.get<Deck>(`/decks/${this.props.deckId}`);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar deck', 'error');
    } finally {
      this.loading = false;
      this.rerenderBody();
    }
  }

  bodyTemplate(): string {
    if (this.loading) {
      return `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
    }
    if (!this.deck) {
      return `<div class="empty-state"><p>${t('common.error')}</p></div>`;
    }
    const d = this.deck;
    const stackType = d.stackType || 'deck';
    return `
      <div class="banner-spacer"></div>
      <div class="scroll-content">
        <div class="deck-sheet">
          <div class="deck-header">
            <input type="text" name="name" value="${this.esc(d.name)}" class="deck-name-input" placeholder="Nome do Baralho" />
            <div class="deck-meta">
              <span class="deck-type-badge"><i class="fa-solid fa-layer-group"></i> ${t(`sidebar.deckStack${stackType.charAt(0).toUpperCase()}${stackType.slice(1)}`)}</span>
              <span class="deck-count"><i class="fa-solid fa-clone"></i> ${t('sidebar.deckCardCount', { count: d.cards.length })}</span>
            </div>
          </div>
          
          <div class="deck-toolbar">
            ${this.isGM ? `
              <div class="btn-group">
                <button class="btn" data-action="deck-shuffle" title="${t('sidebar.deckShuffle')}"><i class="fa-solid fa-shuffle"></i></button>
                ${stackType === 'deck' ? `
                  <button class="btn" data-action="deck-draw-to" title="${t('sidebar.deckDrawTo')}"><i class="fa-solid fa-hand-holding-hand"></i></button>
                  <button class="btn" data-action="deck-deal-to" title="${t('sidebar.deckDealTo')}"><i class="fa-solid fa-users"></i></button>
                  <button class="btn btn-secondary" data-action="deck-recall" title="${t('sidebar.deckRecall')}"><i class="fa-solid fa-rotate-left"></i></button>
                ` : ''}
                <button class="btn btn-secondary" data-action="deck-reset" title="${t('sidebar.deckReset')}"><i class="fa-solid fa-trash-arrow-up"></i></button>
              </div>
              <button class="btn btn-primary" data-action="deck-add-card"><i class="fa-solid fa-plus"></i> ${t('sidebar.cardAdd')}</button>
              <button class="btn btn-secondary" data-action="deck-import-preset" title="Carregar Baralho Pré-configurado"><i class="fa-solid fa-folder-open"></i> Presets</button>
            ` : ''}
            ${!this.isGM ? `
              <span class="deck-player-hint" style="font-size: 0.75rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 0.25rem;">
                <i class="fa-solid fa-circle-info"></i> ${stackType === 'hand' ? 'Cartas distribuídas pelo Mestre' : 'Baralho gerenciado pelo Mestre'}
              </span>
            ` : ''}
            <div style="flex:1"></div>
            <button class="btn btn-secondary" data-action="deck-toggle-view" title="${this.showCardBack ? t('sidebar.cardFront') : t('sidebar.cardBack')}">
              <i class="fa-solid ${this.showCardBack ? 'fa-eye' : 'fa-eye-slash'}"></i>
            </button>
          </div>

          <div class="deck-workspace">
            <div class="deck-card-list">
              ${d.cards.length === 0
                ? `<div class="deck-empty-state">
                    <i class="fa-regular fa-clone"></i>
                    <p>${!this.isGM && stackType === 'hand'
                      ? 'Sua mão está vazia. O Mestre da mesa pode distribuir cartas para você.'
                      : t('sidebar.deckCards')}</p>
                   </div>`
                : d.cards.map(c => this.cardTemplate(c, stackType)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private cardTemplate(c: Card, stackType: 'deck' | 'hand' | 'pile'): string {
    const backImage = c.back || this.deck?.state?.backImg || '/cards/backs/fantasy-01.png';
    const faceImage = c.img || c.face;
    const currentImg = this.showCardBack ? backImage : faceImage;

    return `
      <div class="deck-card-item" data-id="${this.esc(c.id)}" ${this.isGM ? 'data-action="deck-edit-card"' : ''} draggable="${this.isGM}" title="${t('sidebar.cardEdit')}">
        <div class="deck-card-item-controls">
          ${this.isGM && stackType !== 'deck' ? `<button class="deck-card-pass" data-action="card-pass" title="${t('sidebar.cardPass')}"><i class="fa-solid fa-share"></i></button>` : ''}
          ${this.isGM ? `<button class="deck-card-remove" data-action="deck-remove-card" title="${t('sidebar.cardRemove')}">✕</button>` : ''}
        </div>
        <div class="deck-card-visual">
          ${currentImg
        ? `<img src="${this.esc(currentImg)}" alt="${this.esc(c.name)}" class="deck-card-img" />`
        : `<div class="deck-card-placeholder">${this.showCardBack ? '🃏' : c.suit === 'hearts' || c.suit === 'copas' ? '♥' : c.suit === 'spades' ? '♠' : c.suit === 'diamonds' ? '♦' : c.suit === 'clubs' ? '♣' : '🃏'}</div>`}
        </div>
        <div class="deck-card-info">
          <div class="deck-card-name">${this.esc(c.name)}</div>
          ${c.type ? `<div class="deck-card-meta">${this.esc(c.type)}</div>` : ''}
          ${c.value !== undefined && c.value !== '' ? `<div class="deck-card-meta">${t('sidebar.cardValue')}: ${this.esc(c.value)}</div>` : ''}
        </div>
      </div>
    `;
  }

  onAction(action: string, id: string | null, target: HTMLElement): void {
    if (action === 'deck-shuffle') {
      this.shuffle();
    } else if (action === 'deck-draw-to') {
      this.drawTo();
    } else if (action === 'deck-deal-to') {
      this.dealTo();
    } else if (action === 'deck-recall') {
      this.recall();
    } else if (action === 'deck-reset') {
      this.resetDeck();
    } else if (action === 'deck-toggle-view') {
      this.showCardBack = !this.showCardBack;
      this.rerenderBody();
    } else if (action === 'deck-add-card') {
      this.addCard();
    } else if (action === 'deck-import-preset') {
      this.importPreset();
    } else if (action === 'deck-remove-card' && id) {
      this.removeCard(id);
    } else if (action === 'deck-edit-card' && id) {
      this.editCard(id);
    } else if (action === 'card-pass' && id) {
      this.passCard(id);
    } else if (action === 'save') {
      this.save();
    }
  }

  /**
   * Target stack choice dialog — used by draw/deal/pass. Lists
   * every other stack in the world (except this one), filtered by `stackTypeFilter`
   * when provided. Returns the chosen ID or null if canceled/empty.
   */
  private async pickStack(stackTypeFilter?: 'deck' | 'hand' | 'pile', multi = false): Promise<{ targets: string[]; number: number } | null> {
    if (!this.deck) return null;
    const worldId = gameContext.worldId;
    if (!worldId) return null;
    let stacks: DeckSummary[] = [];
    try {
      stacks = await api.get<DeckSummary[]>(`/decks/world/${worldId}`);
    } catch {
      stacks = [];
    }
    const options = stacks.filter(s => s.id !== this.deck!.id && (!stackTypeFilter || (s.stackType || 'deck') === stackTypeFilter));
    if (options.length === 0) {
      showToast(t('sidebar.deckPickStackEmpty'), 'info');
      return null;
    }
    const content = `
      <div class="form-group">
        <label>${t('sidebar.deckPickStack')}</label>
        <select name="target" ${multi ? 'multiple size="6"' : ''}>
          ${options.map(o => `<option value="${this.esc(o.id)}">${this.esc(o.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${t('sidebar.deckNumberOfCards')}</label>
        <input type="number" name="number" value="1" min="1" />
      </div>
    `;
    const result = await LoomDialog.wait({
      window: { title: t('sidebar.deckPickStack') },
      content,
      width: 340,
      buttons: [
        { action: 'cancel', label: t('common.cancel') },
        {
          action: 'confirm',
          label: t('sidebar.deckPickStack'),
          variant: 'primary',
          default: true,
          callback: (_e: Event, button: HTMLButtonElement) => {
            const container = button.closest('.loom-dialog') as HTMLElement;
            const select = container.querySelector<HTMLSelectElement>('[name="target"]');
            const targets = select ? Array.from(select.selectedOptions).map(o => o.value) : [];
            const number = parseInt((container.querySelector('[name="number"]') as HTMLInputElement)?.value || '1', 10) || 1;
            return { targets, number };
          }
        }
      ]
    });
    if (!result || !result.targets?.length) return null;
    return result;
  }

  private async drawTo(): Promise<void> {
    if (!this.deck) return;
    const picked = await this.pickStack();
    if (!picked) return;
    try {
      await api.post(`/decks/${this.deck.id}/draw`, { toId: picked.targets[0], number: picked.number });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao puxar carta', 'error');
    }
  }

  private async dealTo(): Promise<void> {
    if (!this.deck) return;
    const picked = await this.pickStack('hand', true);
    if (!picked) return;
    try {
      await api.post(`/decks/${this.deck.id}/deal`, { toIds: picked.targets, number: picked.number });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao distribuir', 'error');
    }
  }

  private async recall(): Promise<void> {
    if (!this.deck) return;
    try {
      await api.post(`/decks/${this.deck.id}/recall`, {});
      showToast(t('sidebar.deckRecall'), 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao recolher', 'error');
    }
  }

  private async passCard(cardId: string): Promise<void> {
    if (!this.deck) return;
    const picked = await this.pickStack();
    if (!picked) return;
    try {
      await api.post(`/decks/${this.deck.id}/pass`, { toId: picked.targets[0], cardIds: [cardId] });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao passar carta', 'error');
    }
  }

  private async shuffle(): Promise<void> {
    if (!this.deck) return;
    const cards = [...this.deck.cards];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    try {
      await api.put(`/decks/${this.deck.id}`, { cards, state: { ...this.deck.state, shuffled: true } });
      showToast('Deck embaralhado', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao embaralhar', 'error');
    }
  }

  private async resetDeck(): Promise<void> {
    if (!this.deck) return;
    try {
      await api.put(`/decks/${this.deck.id}`, { state: {} });
      showToast('Deck resetado', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao resetar', 'error');
    }
  }

  private async addCard(): Promise<void> {
    if (!this.deck) return;
    const newCard: Card = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: t('cardName'),
      face: 'back',
    };
    const cards = [...this.deck.cards, newCard];
    try {
      await api.put(`/decks/${this.deck.id}`, { cards });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao adicionar carta', 'error');
    }
  }

  private async editCard(cardId: string): Promise<void> {
    if (!this.deck) return;
    const card = this.deck.cards.find(c => c.id === cardId);
    if (!card) return;

    const content = `
      <div class="form-group">
        <label>${t('sidebar.cardName')}</label>
        <input type="text" name="name" value="${this.esc(card.name)}" />
      </div>
      <div class="form-group">
        <label>${t('sidebar.cardImage')}</label>
        <div class="deck-card-img-field">
          <input type="text" name="img" value="${this.esc(card.img || '')}" placeholder="caminho/da/imagem.webp" />
          <button type="button" class="btn-icon" data-action="browse-img" title="${t('sidebar.cardImage')}"><i class="fa-solid fa-folder-open"></i></button>
        </div>
      </div>
      <div class="form-group">
        <label>${t('sidebar.cardType')}</label>
        <input type="text" name="type" value="${this.esc(card.type || '')}" />
      </div>
      <div class="form-group">
        <label>${t('sidebar.cardSuit')}</label>
        <input type="text" name="suit" value="${this.esc(card.suit || '')}" />
      </div>
      <div class="form-group">
        <label>${t('sidebar.cardValue')}</label>
        <input type="text" name="value" value="${this.esc(card.value ?? '')}" />
      </div>
    `;

    const dialog = new LoomDialog({
      window: { title: t('sidebar.cardEdit') },
      content,
      width: 380,
      actions: {
        'browse-img': async (_event, target) => {
          const container = target.closest('.dialog-content') as HTMLElement;
          const input = container?.querySelector<HTMLInputElement>('[name="img"]');
          if (!input) return;
          const path = await new FilePicker({
            type: 'image',
            current: input.value,
            worldId: gameContext.worldId || '',
          }).browse();
          if (path) input.value = path;
        }
      },
      buttons: [
        { action: 'cancel', label: t('common.cancel') },
        {
          action: 'save',
          label: t('common.save'),
          variant: 'primary',
          default: true,
          callback: (_event: Event, button: HTMLButtonElement) => {
            const container = button.closest('.loom-dialog') as HTMLElement;
            const val = (name: string) => (container.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value.trim();
            return {
              name: val('name') || card.name,
              img: val('img') || undefined,
              type: val('type') || undefined,
              suit: val('suit') || undefined,
              value: val('value') || undefined,
            };
          }
        }
      ]
    });

    const result = await dialog.wait();
    if (!result || !this.deck) return;

    const cards = this.deck.cards.map(c => c.id === cardId ? { ...c, ...result } : c);
    try {
      await api.put(`/decks/${this.deck.id}`, { cards });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao editar carta', 'error');
    }
  }

  private async removeCard(cardId: string): Promise<void> {
    if (!this.deck) return;
    const cards = this.deck.cards.filter(c => c.id !== cardId);
    try {
      await api.put(`/decks/${this.deck.id}`, { cards });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover carta', 'error');
    }
  }

  private async importPreset(): Promise<void> {
    if (!this.deck || !this.isGM) return;
    const presets = await fetchDeckPresets();
    if (presets.length === 0) {
      showToast('Nenhum preset de baralho encontrado.', 'info');
      return;
    }
    const content = `
      <div class="form-group">
        <label>Modelo / Preset de Baralho</label>
        <select name="presetId">
          ${presets.map(p => `<option value="${this.esc(p.id)}">${this.esc(p.name)} (${p.count} cartas)</option>`).join('')}
        </select>
        <p class="form-help" style="margin-top:6px; font-size:12px; color:var(--text-muted, #aaa);">
          Isso preencherá este baralho com cartas pré-configuradas (com imagens, naipes e valores).
        </p>
      </div>
      <div class="form-group">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="replaceExisting" ${this.deck.cards.length > 0 ? 'checked' : ''} />
          <span>Substituir cartas existentes (limpar anteriores)</span>
        </label>
      </div>
    `;
    const result = (await LoomDialog.wait({
      window: { title: 'Carregar Baralho Pré-configurado' },
      content,
      width: 400,
      buttons: [
        { action: 'cancel', label: t('common.cancel') },
        {
          action: 'import',
          label: 'Carregar',
          variant: 'primary',
          default: true,
          callback: (_e: Event, _btn: HTMLButtonElement, dialog: LoomDialog) => {
            const body = dialog.getBody();
            const presetId = (body?.querySelector('[name="presetId"]') as HTMLSelectElement)?.value || '';
            const replaceExisting = (body?.querySelector('[name="replaceExisting"]') as HTMLInputElement)?.checked ?? false;
            return { presetId, replaceExisting };
          }
        }
      ]
    })) as { presetId: string; replaceExisting: boolean } | null;
    if (!result?.presetId) return;

    const preset = presets.find(p => p.id === result.presetId);
    if (!preset) return;

    const presetData = await loadDeckPresetFile(preset.file);
    if (!presetData) {
      showToast('Falha ao ler arquivo do preset.', 'error');
      return;
    }

    const newCards = instantiateDeckCards(presetData.cards);
    const finalCards = result.replaceExisting ? newCards : [...this.deck.cards, ...newCards];
    const newState = {
      ...this.deck.state,
      ...(presetData.back ? { backImg: presetData.back } : {})
    };

    try {
      await api.put(`/decks/${this.deck.id}`, {
        cards: finalCards,
        type: presetData.type || this.deck.type,
        state: newState
      });
      this.deck.cards = finalCards;
      this.deck.type = presetData.type || this.deck.type;
      this.deck.state = newState;
      this.rerenderBody();
      showToast(`Baralho carregado com sucesso (${newCards.length} cartas)!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar preset', 'error');
    }
  }

  private async save(): Promise<void> {
    if (!this.deck) return;
    const name = this.element.querySelector<HTMLInputElement>('[name="name"]')?.value || this.deck.name;
    try {
      await api.put(`/decks/${this.deck.id}`, { name });
      showToast('Deck salvo', 'success');
      windowManager.close(`deck-sheet-${this.deck.id}`);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar deck', 'error');
    }
  }

  private esc(text: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}
