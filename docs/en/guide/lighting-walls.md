# Lighting, Walls & Sound

**Loom VTT** features a high-performance 2D raycasting and physics engine that calculates dynamic line of sight, real-time shadows, and spatial audio directly within the browser.

---

## 🧱 Walls & Vision Obstacles

Wall tools dictate how lighting, character perception, and token movement interact with the environment.

![Wall Tools](/assets/screenshots/gridtool/gridtool-walls-select.png)

### Wall Types

* **Standard Walls:** Completely block physical token movement, character sight, and light propagation.
* **Interactive Doors:** A click opens or closes the door, revealing hidden rooms. A locked door can only be opened by the GM. Only the GM can lock or unlock a door, with a right-click.
  Each door can set an **opening distance** (a token owned by the player must be that close; the GM can always open it) and its own **open and close sounds**.
* **Windows:** Restrict token movement and block light, while letting vision through.
* **Secret Doors:** Rendered invisibly to players until revealed or unlocked by the GM.
* **Terrain Walls:** Block token movement only. Sight, light and sound pass through them.
* **Ethereal Walls:** Block sight and light, but not movement.
* **Invisible Walls:** Block movement, and are not drawn on the map.

### Wall Shortcuts
* **Click:** Select a wall segment or endpoint node.
* **Drag:** Reposition selected segments.
* **Delete:** Remove selected wall.
* **Shift + release:** When you finish a segment, release the mouse while holding Shift to continue the chain from its end. **Double Click** ends the chain.

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
