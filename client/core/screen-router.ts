/*******************************************************************************
 * LoomVTT
 * client/core/screen-router.ts
 * 
 * 
 * Router for managing main client screens.
 ******************************************************************************/

import { windowManager } from './window-manager.js';

export type Screen = 'admin-login' | 'setup-hub' | 'world-login' | 'game-hud' | 'world-users-setup' | 'activation';

class ScreenRouter {
  private app = document.getElementById('app')!;
  private current: { destroy?: () => void } | null = null;

  async navigate(screen: Screen, props: Record<string, unknown> = {}): Promise<void> {
    windowManager.closeAll();
    this.app.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 200));
    this.current?.destroy?.();
    this.app.innerHTML = '';
    await this.mountScreen(screen, props);
    this.app.style.opacity = '1';
  }

  private async mountScreen(
    screen: Screen,
    props: Record<string, unknown>,
  ): Promise<void> {
    switch (screen) {
      case 'activation': {
        const { ActivationScreen } = await import(
          '../screens/activation/activation-screen.js'
        );
        this.current = new ActivationScreen(this.app, props as any);
        break;
      }
      case 'admin-login': {
        const { AdminLoginScreen } = await import(
          '../screens/admin-login/admin-login.js'
        );
        this.current = new AdminLoginScreen(this.app, props as any);
        break;
      }
      case 'setup-hub': {
        const { SetupHubScreen } = await import(
          '../screens/setup-hub/setup-hub.js'
        );
        this.current = new SetupHubScreen(this.app);
        break;
      }
      case 'world-login': {
        const { WorldLoginScreen } = await import(
          '../screens/world-login/world-login.js'
        );
        this.current = new WorldLoginScreen(this.app, props as any);
        break;
      }
      case 'game-hud': {
        const { GameHudScreen } = await import(
          '../screens/game-hud/game-hud.js'
        );
        this.current = new GameHudScreen(this.app, props as any);
        break;
      }
      case 'world-users-setup': {
        const { WorldUsersSetupScreen } = await import(
          '../screens/world-users-setup/world-users-setup-screen.js'
        );
        this.current = new WorldUsersSetupScreen(this.app, props as any);
        break;
      }
    }
  }
}

export const router = new ScreenRouter();
