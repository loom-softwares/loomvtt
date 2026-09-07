/*******************************************************************************
 * LoomVTT
 * client/core/tour-manager.ts
 * 
 * 
 * Manager for guided UI tours.
 ******************************************************************************/

import { Tour } from '../components/tour.js';

export class TourManager {
  private static instance: TourManager | null = null;
  private currentTour: Tour | null = null;

  static getInstance(): TourManager {
    if (!TourManager.instance) {
      TourManager.instance = new TourManager();
    }
    return TourManager.instance;
  }

  private async runGameHudTour(): Promise<void> {
    const steps = [
      {
        selector: '#hud-toolbox',
        title: 'Caixa de Ferramentas',
        text: 'Aqui você encontra todas as ferramentas para desenhar, criar notas e interagir com a cena.'
      },
      {
        selector: '#hud-sidebar',
        title: 'Barra Lateral',
        text: 'A barra lateral contém atores, itens, jornais e outras ferramentas organizadas por abas.'
      },
      {
        selector: '#hud-hotbar',
        title: 'Barra de Macros',
        text: 'Arraste macros aqui para acesso rápido durante a sessão de jogo.'
      },
      {
        selector: '#game-canvas',
        title: 'Canvas do Jogo',
        text: 'Esta é a área principal do jogo. Use o mouse para navegar, arrastar tokens e interagir com a cena.'
      }
    ];

    // Mark as seen immediately so it doesn't keep reappearing 
    // if the user ignores it without clicking Skip/Finish.
    localStorage.setItem('loom-tour-seen', 'true');

    this.currentTour = new Tour(steps);
    await this.currentTour.start();
  }

  async startGameHudTour(): Promise<void> {
    if (localStorage.getItem('loom-tour-seen') === 'true') {
      return;
    }
    await this.runGameHudTour();
  }

  async startGameHudTourAfterSeen(): Promise<void> {
    await this.runGameHudTour();
  }

  destroy(): void {
    if (this.currentTour) {
      this.currentTour.destroy();
      this.currentTour = null;
    }
  }
}