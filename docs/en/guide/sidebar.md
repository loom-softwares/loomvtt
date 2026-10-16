# Sidebar

The **Sidebar** on the right side of the screen is the primary command center of **Loom VTT**. Through its top tab bar, Game Masters and players quickly navigate all campaign entities, rolls, and settings.

---

## 💬 1. Chat & Dice Rolls

The chat panel is where narrative storytelling meets automated rules execution:

![Chat with Dice Rolls](/assets/screenshots/sidebar/sidebar-chat-rolls.png)

* **Roll Cards:** Show the formula, each die value, modifiers, the total, and a breakdown tooltip. A roll that is not public carries a tag (GM only, GM blind, Self only). Comparison with a difficulty (DC) and critical/fumble highlighting are left to the system's own cards.
* **Roll Command:**
  * `/r 1d20 + 5` — Rolls the formula. The roll-mode buttons in the chat panel (Public, GM only, GM blind, Self only) set who sees the next roll.
  * `/roll`, `/gmroll`, `/blindroll` and `/whisper` are not interpreted by the client: the text is sent as a normal chat message.
* **Rich Text Formatting:** Built-in formatting bar for bold, links, code blocks, and embedded media.

---

## 👥 2. Actors & Characters

![Actors Tab](/assets/screenshots/sidebar/sidebar-actors.png)

* **Folder Organization:** Group heroes, NPCs, monsters, and allies in custom nested folders.
* **Instant Creation:** Quick **Create Actor** button with support for imported or custom templates.
* **Drag-to-Canvas:** Drag any actor directly onto the map to spawn an encounter-ready token.
* **Live Search:** Instant filter by name or actor type.
* **Import & Export:** import a character from a Loom Connect slot or from a `.json` file, and save one from its sheet menu ("Save character to a file (.json)" or "Export to Loom Connect" once connected in the account settings). A character imported by a player waits for the GM's approval.

---

## 🎒 3. Items & Gear

![Items Tab](/assets/screenshots/sidebar/sidebar-items.png)

* Full directory of weapons, armor, consumables, spells, and passive feats.
* Drag items directly from the Items directory onto an Actor sheet to update their inventory immediately.

---

## 🗺️ 4. Scenes & Maps

![Scenes Tab](/assets/screenshots/sidebar/sidebar-scenes.png)

* Lists all campaign maps with thumbnail visual previews.
* **Activation:** Click a scene to open its configuration window. Right-click it and choose **Activate (All Players)** to pull all connected players to that scene at once. (A map scene expands to show its child scenes when clicked.)

---

## ⚔️ 5. Combat Tracker

![Combat Tracker](/assets/screenshots/sidebar/sidebar-combat.png)

* **Automated Initiative:** Roll initiative for all combatants in a single click (e.g., *Start Combat (DEX Initiative)*).
* **Round & Turn Tracking:** Clear visual order of turns, current round counter, and highlighted active combatant.

---

## 📖 6. Journals & Campaign Lore

![Journals Tab](/assets/screenshots/sidebar/sidebar-journals.png)

* Rich text editor for adventure notes, player handouts, and secret GM lore.
* Supports image pages and dragging onto the canvas to place interactive map pins.

---

## 🃏 7. Card Decks

![Card Decks Tab](/assets/screenshots/sidebar/sidebar-cards-decks.png)

* Native support for standard playing decks (54 cards) or custom thematic decks (Tarot, critical injuries, inspiration, spell cards).
* Shuffle, draw cards, or deal them to other stacks in the world (hands or piles), and pass individual cards from one stack to another.

---

## 🎲 8. Roll Tables

![Roll Tables Tab](/assets/screenshots/sidebar/sidebar-rolltables.png)

* Create random generators for random encounters, loot drops, weather, or critical tables.
* Single-click rolling outputs formatted results directly into chat.

---

## ⚡ 9. Macros

![Macros Tab](/assets/screenshots/sidebar/sidebar-macros.png)

* Library of automation scripts (in JavaScript or chat commands).
* Drag macros into the bottom hotbar for instant keyboard activation.

---

## 🎵 10. Audio Playlists

![Playlists Tab](/assets/screenshots/sidebar/sidebar-playlists.png)

* Three volume sliders: **Master** is the volume of everything in the VTT, **Music** is every playlist (the ones played from the sidebar and the scene's own playlist), and **Ambient** is only the sounds placed on the map with the audio tool. Master multiplies the other two.
* The scene's music stays in step across the table: a player or the GM who reloads or joins late goes to the track the table is on, at the point it has reached, instead of the start of the playlist.

* Curate soundscapes for combat, atmospheric exploration, or dialogue.
* Pick several tracks at once for a playlist; the music tab has a progress bar you can seek, and a now-playing card stays at the top right while the sidebar is collapsed.

---

## 📦 11. Shared Compendiums

![Compendiums Tab](/assets/screenshots/sidebar/sidebar-compendiums.png)

* Pre-packaged libraries of monsters, spells, items, and maps ready to import across multiple worlds and adventures.

---

## 🔍 12. Scene Directory & Layers

![Scene Directory](/assets/screenshots/sidebar/sidebar-scene-directory.png)

* Quickly filter and select any placed entity on the active scene: tokens, lights, walls, tiles, drawings, or notes.

---

## ⚙️ 13. World Settings & Management

![World Settings](/assets/screenshots/sidebar/sidebar-world-settings.png)

The Game Master administrative command console:
* **Modules:** Manage and toggle installed extensions.
* **Keybindings:** View and customize keyboard shortcuts.
* **Invite Links:** Generate secure links to invite players to the table.
* **World Configuration:** Edit world metadata, systems, and global rules.
* **Return to Setup:** Exit the active session and return to the main world selector.
