# Canvas Tools

The left-side toolbar hosts all essential controls for interacting with the map, manipulating tokens, and orchestrating tactical encounters in **Loom VTT**.

---

## 🧭 Toolbar Overview

Clicking any primary tool icon in the left toolbar expands a specialized flyout menu of subtools:

| Collapsed Toolbar | Token Submenu Expanded |
| :---: | :---: |
| ![Toolbar](/assets/screenshots/gridtool/gridtool-toolbar.png) | ![Submenu](/assets/screenshots/gridtool/gridtool-token-tools-subbar.png) |

---

## ♟️ Token & Character Tools

The Token Tool lets you select, position, and command player characters, monsters, and NPCs with responsive keyboard and mouse controls:

![Token Selection and Shortcuts](/assets/screenshots/gridtool/gridtool-select-tokens.png)

### Token Controls & Shortcuts

* **Click:** Select token under the cursor.
* **Drag:** Move token across the grid. A dynamic ruler shows distance traveled in feet or meters.
* **Shift + Click:** Add or remove tokens from a multi-selection.
* **Ctrl + Mouse Scroll:** Rotate token smoothly (useful for indicating facing and vision direction).
* **Double Click:** Instantly opens the character sheet of the linked Actor.
* **Right Click:** Opens the floating token HUD directly on canvas to tweak HP, conditions, or visibility.
* **Ctrl + Click (during drag):** Add waypoints to chart complex movement paths around obstacles or hazards.
* **Delete / Backspace:** Remove token from active scene (the source Actor in the sidebar remains untouched).

The select tools of lights, sounds, notes, drawings and tiles also draw a **drag box** (hold Shift to add to the group): drag any element of the group to move them all together (the wall select tool does the same with several walls), and press **Delete** to remove them. Delete also removes a single selected light, sound, drawing or tile.

---

## 🎨 Tiles & Map Overlays

![Tiles Tool](/assets/screenshots/gridtool/gridtool-tiles-select.png)

**Tiles** are independent images that you can place and arrange over the scene background:
* Great for vehicles (ships, wagons), furniture, modular rooms, or hidden traps.
* Drag, rotate with `Ctrl + Scroll`, and resize directly on the tactical grid.
* Supports layering order with z-index controls.

---

## ✏️ Drawing & Shape Tools

![Drawings Tool](/assets/screenshots/gridtool/gridtool-drawings-select.png)

Allows GMs and authorized players to sketch visual annotations on the fly:
* **Freehand:** Rapid sketching with adjustable stroke width and color.
* **Geometric Shapes:** Rectangles, circles, ellipses, and closed polygons.
* **Text on Canvas:** Add readable labels and tactical markers. The Text tab of the drawing sheet sets the font, size, alignment, bold, italic and shadow.

---

## 🎯 Area Templates

![Area Templates](/assets/screenshots/gridtool/gridtool-templates-select.png)

Essential for calculating spell areas of effect (AoE), breath weapons, and explosions:
* **Available Shapes:** Cones, Circles/Spheres, Rays/Lines, and Cubes/Rectangles.
* **Target Highlighting:** Tokens encompassed by the template are highlighted visually to simplify saving throw calculations.
* Click to select and press `Delete` to remove the template once the spell resolves.

---

## ⚡ Traps & Triggers

![Traps Tool](/assets/screenshots/gridtool/gridtool-traps-place.png)

Loom VTT includes a native trap and trigger zone engine:
* **Quick Placement:** Click and drag to create trigger zones across any floor tiles.
* **Automatic Activation:** When any token moves onto the trigger zone, the trap fires immediately and deactivates.
* Perfect for pit traps, poison darts, pressure plates, and arcane glyphs.

---

## 📌 Map Pins & Journal Notes

![Journal Notes on Canvas](/assets/screenshots/gridtool/gridtool-notes-select.png)

* Drag Journal pages from the right sidebar directly onto the canvas to place interactive map pins.
* Double-clicking a pin opens the linked journal entry, secret notes, or player handout.
* Supports GM-only visibility or public player discovery.

---

## 🎭 Theater Art (theater screen)

The theater screen (the cinematic overlay the GM turns on with the masks button) has its own tool. While the theater is on, the toolbar shows only **Theater art**; the map tools come back when it is turned off.

* **Add a picture** picks an image file and puts it in the middle of the screen at its own proportions. **Add a text** puts a text there and opens its sheet.
* **Select and move**: click an item, drag it to move it, drag a corner to resize it (the picture keeps its proportions; a text grows with its font). Double click opens the sheet (text, font, size, colour, alignment, bold, italic, shadow, opacity, rotation, forward/back, delete). **Delete** removes the selected item.
* **Clear the screen** removes everything from this scene's theater screen.
* The art belongs to the **scene**, not to the map: another scene has its own theater screen, so each map scene can open on a different entry screen. Combine it with the scene's "open in theater mode" option to make an entry screen for the table.
* Everyone sees it live; only the GM edits it. Sizes are relative to the screen width, so it looks the same on any monitor.
