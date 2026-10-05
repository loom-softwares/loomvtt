# Lighting, Walls & Sound

**Loom VTT** features a high-performance 2D raycasting and physics engine that calculates dynamic line of sight, real-time shadows, and spatial audio directly within the browser.

---

## 🧱 Walls & Vision Obstacles

Wall tools dictate how lighting, character perception, and token movement interact with the environment.

![Wall Tools](/assets/screenshots/gridtool/gridtool-walls-select.png)

### Wall Types

* **Standard Walls:** Completely block physical token movement, character sight, and light propagation.
* **Interactive Doors:** Can be toggled open or locked with a click by the GM (or authorized players), dynamically revealing hidden rooms.
  Each door can set an **opening distance** (a token owned by the player must be that close; the GM can always open it) and its own **open and close sounds**.
* **Windows & Grates:** Restrict token movement while allowing light and vision to pass through.
* **Secret Doors:** Rendered invisibly to players until revealed or unlocked by the GM.
* **Terrain Walls:** Let tokens see past the first barrier (such as a low parapet or cliff edge) while blocking what lies behind.

### Wall Shortcuts
* **Click:** Select a wall segment or endpoint node.
* **Drag:** Reposition selected segments.
* **Delete:** Remove selected wall.
* **Ctrl + Click:** Chain connected wall nodes to rapidly outline rooms and corridors.

---

## 💡 Dynamic Lighting & Real-time Shadows

Enrich your scenes with vibrant, animated light sources:

![Dynamic Lighting Tools](/assets/screenshots/gridtool/gridtool-lights-select.png)

### Lighting Features

* **Localized Sources:** Torches with flickering flame effects, directional bullseye lanterns, or campfires.
* **Custom Color & Hue:** Set precise lighting tones (warm fire orange, eerie eldritch purple, bioluminescent green).
* **Bright & Dim Radii:** Configure exact distances for full illumination and shadowy dim light falloff.
* **Double Click:** Open the light configuration dialog to tweak intensity, color, and pulse animations.
* **Per Floor:** a light shines only on its own floor. Turn on "Shared by every floor" in its sheet to light every floor of the scene. The fog works the same way: only the tokens and lights of the floor on screen reveal it, and what was explored is remembered per floor.
* **Dynamic Shadows:** As tokens navigate corridors, their line-of-sight casts realistic shadows against walls, updating fog of war dynamically.

---

## 🔊 Positional Ambient Audio

Elevate scene atmosphere by placing spatial sound emitters directly onto the canvas:

| Place Sound Emitter | Select & Adjust Audio |
| :---: | :---: |
| ![Place Sound](/assets/screenshots/gridtool/gridtool-sounds-place.png) | ![Select Sound](/assets/screenshots/gridtool/gridtool-sounds-select.png) |

### How Spatial Audio Works

* **Proximity Attenuation:** Place a crackling fireplace, rushing river, or murmuring tavern crowd on the map. The volume each player hears scales smoothly according to their token's distance from the audio source!
* **Audible Radius:** Define the maximum distance at which the sound can be detected.
* **Looping Audio:** Native support for seamless audio loops and environmental soundscapes.
