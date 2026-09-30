# Interface & HUD

**Loom VTT** features a modern, clean interface engineered to maximize visible map space while providing lightning-fast controls and tactical automations.

---

## 🖥️ Virtual Tabletop Overview

The main session viewport is organized into four intuitive control zones:

![LoomVTT Game HUD Overview](/assets/screenshots/game-hud.png)

1. **Tactical Canvas (Center):** High-performance WebGL/Canvas viewport rendering the scene background, dynamic lighting, real-time shadows, fog of war, and character tokens.
2. **Canvas Tools (Left Toolbar):** Tools for token manipulation, distance measurement, walls, light sources, positional audio, traps, and spell templates.
3. **Sidebar (Right):** The primary command center containing chat, dice logs, actors, items, scenes, combat tracker, journals, compendiums, and settings.
4. **Action & Macro Hotbar (Bottom):** One-touch macro slots bound to keys 1 through 0, along with player latency and framerate indicators.

---

## ⚡ Action & Macro Hotbar

Positioned at the bottom of the screen, the hotbar keeps your most critical abilities and automations within immediate reach:

![Macro Hotbar](/assets/screenshots/ActionBar/macro-hotbar.png)

* **Slots 1 to 0:** Trigger spells, attacks, or custom JavaScript macros by pressing the corresponding number keys on your keyboard.
* **Pagination:** Use the arrows to toggle between up to 5 hotbar pages, organizing abilities for combat, exploration, or roleplay.
* **Bar Lock:** Click the lock icon to prevent accidentally dragging or removing macro icons during fast-paced encounters.
* **Drag-and-Drop:** Drag weapons, spells, or macros directly from the right sidebar into any empty hotbar slot.

---

## 📊 User Performance & Status Widget

In the lower-left corner, each participant has real-time insight into their connection quality:

![User Status Widget](/assets/screenshots/UserTools/user-status-widget.png)

* **Name & Role:** Displays the active user name and assigned role (e.g., *Gamemaster* or *Player*).
* **Latency (Ping):** Measures network round-trip response time in milliseconds (e.g., `2ms`).
* **Frame Rate (FPS):** Continuous render performance monitor (e.g., `60 FPS`), ensuring smooth animations and lighting.

---

## 👤 User & Character Configuration

Clicking the gear icon in the player widget opens the **Configure User** modal:

![Configure User Modal](/assets/screenshots/UserTools/configure-user-modal.png)

Here you can customize:

* **Display Name:** Your public name in chat messages and GM player lists.
* **Player Color:** Hex color used to highlight your canvas cursor, ruler measurements, and token selection rings.
* **Pronouns:** Identity pronouns displayed in session rosters.
* **Main Character:** Links your user to your primary Actor, enabling one-click sheet access and speaking in character in chat.
* **Change Password:** Securely update your world login password.

---

## 🎮 Camera Navigation Controls

| Action | Mouse Control | Keyboard Shortcut |
| :--- | :--- | :--- |
| **Pan Camera** | Click & drag Middle or Right Mouse Button | `Ctrl + Arrow Keys` |
| **Zoom In / Zoom Out** | Mouse Wheel (Scroll) | `PageUp` / `PageDown` |
| **Reset View** | — | `Home` |
| **Pause Game (GM)** | — | `Spacebar` |

---

## 🗺️ Top Scene Navigation & Preload

Located across the top of the viewport, the scene navigation bar lets the GM preview and switch between scenes seamlessly:
* **Active Scene vs Preview:** The GM can preview any scene by clicking its tab without dragging players. To switch the world's active scene and pull all players, right-click the scene tab and select *Activate for Everyone*.
* **Memory Preloading (Preload):** The GM can right-click any inactive scene and select *Preload Scene*. The engine loads map textures and geometry in background with an LRU cache (up to 5 cached scenes), delivering instant transitions with zero stutter.
* **Collapse/Expand:** The caret toggle button at the start of the navigation bar collapses the row to display only the active scene, keeping screen real estate clear.

