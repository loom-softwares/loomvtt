# Guide: Displays, Digital Game Tables & OBS Studio (Alpha 05)

LoomVTT allows you to generate dedicated read-only display links to project maps onto horizontal digital gaming tables (TV laid flat), projectors, secondary monitors, or live streams via OBS Studio Browser Sources.

---

## Opening the Displays Manager

In the GM's Game HUD, click on the broadcast antenna icon (<i class="fa-solid fa-satellite-dish"></i>) located on the top header or toolbox. The **Displays & Physical Table** window will open.

---

## Display Modes & Presets

1. **Physical Table (Horizontal TV / Projector)**
   - Automatically disables the virtual grid (ideal when using acrylic overlays or pre-printed battle mats).
   - Hides player virtual tokens to enable using **real physical plastic/metal miniatures** directly on top of the screen.
   - Supports **Canvas Rotation (90°, 180°, or 270°)** to adapt to any physical table orientation without altering your operating system display settings.
   - Completely hides GM tools, hidden layers, and secret notes.

2. **Table Display (Wall-Mounted TV / Second Monitor)**
   - Clean, full-screen map projection with grid and tokens visible.
   - Perfect for secondary monitors, projectors, or wireless casting via Miracast / Chromecast.

3. **OBS Browser Source (Live Streaming)**
   - Enables **Transparent Background** (`alpha = 0`) for seamless overlay integration onto stream layouts.
   - Shows live dice rolls and chat cards in real-time without bulky UI chrome.

4. **Spectator / Remote Viewer**
   - Clean player-perspective view without token manipulation or sheet editing capabilities.

---

## Connecting to your TV

### Option 1: Windows Screen Cast (`Win + K`)
1. On your keyboard, press **`Windows + K`**.
2. Select your Smart TV (Samsung, LG, etc.) and choose **"Extend"** display mode.
3. In Loom's Displays window, click **"Test"** (<i class="fa-solid fa-up-right-from-square"></i>) on your generated link.
4. Drag the newly opened browser tab onto the TV screen and press **`F11`** for full screen.

### Option 2: Smart TV Built-in Web Browser (Wi-Fi)
1. In the Displays window, click the **"Copy LAN"** button.
2. Open the Smart TV's built-in web browser (e.g. Samsung Internet) while connected to the same local Wi-Fi.
3. Enter the copied LAN address (e.g., `http://192.168.1.15:3000/?display=...`).
4. The display syncs automatically in real-time with the game world via WebSockets.

---

## Integrated Features & Compatibility

- **Cinematic Theater Mode**: Full real-time support for Theater Mode. When the GM highlights characters on stage, portrait cards appear seamlessly on TV and OBS displays, complete with active skin frames and visual filters (e.g. Noir grayscale, Sepia, Vignette).
- **Party Vision Sharing**: On displays with tokens enabled, the screen inherits the aggregated vision of all party tokens, dynamically revealing fog of war and dynamic lighting as characters advance.
- **Read-Only Movement Locking**: Canvas panning and viewing are supported, but token dragging is strictly locked against accidental touch or unauthorized manipulation (only token owners or the GM can move tokens).

---

## Security & Resilience

- **Clean Virtual Sessions**: Display links generate an isolated JWT session (`isDisplay: true`). No phantom user accounts are created in the database, ensuring the world login screen and player management stay completely clean.
- **One-Click Instant Revocation**: The GM can instantly revoke any active display link. Connected screens terminate immediately with a visual revocation notification.
- **Total Privacy & Secret Concealment**: Hidden enemies, GM layers, secret map notes, and administrative controls are never leaked to display clients.
- **Automatic Reconnection**: In case of temporary Wi-Fi drops, a discreet banner notifies viewers and the map re-establishes synchronization automatically once network connectivity resumes.
