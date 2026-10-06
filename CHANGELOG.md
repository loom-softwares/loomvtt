# Changelog

All notable changes to LoomVTT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> For historical release notes prior to Alpha 05 in Portuguese, see [`CHANGELOG.pt-BR.md`](./CHANGELOG.pt-BR.md).

## [1.0.5-alpha] - 2026-10-06

> Build: `0007`

### Added

- **Update Indicator**: the update button of the Setup Hub turns yellow and gets a red dot when a newer version of the program exists on the channel you follow; with no update it stays as it was. A pre-release build (alpha, beta) follows **Preview** by default (Stable only has final releases), and the channel chosen in the updates screen is remembered.
- **Node Edition Updates Itself**: the update button now works on the Node edition (the folder with `start.sh`): the server downloads the release's Node zip, checks it against the release's `SHA256SUMS`, unpacks it, and the supervisor swaps `app`, `client`, `packages`, `shared` and the scripts while the server is stopped, then restarts it; the page shows the download progress and reloads by itself. Your data folder and `node_modules` are not touched, `npm install` runs only when the dependencies changed, and the previous files are put back if anything fails. (An install that is neither the installed app, the Node edition nor a source checkout now says to download the new version instead of showing a raw `git` error.)
- **Connection Notice**: when the connection to the server is lost for more than 5 seconds a toast says so ("Reconnecting…"), and another one says when it is back. A drop that mends itself in a few seconds shows nothing.
- **Disconnect Log**: the server records why each socket disconnected (tunnel closed, ping timeout...) and warns when its event loop was blocked, to find the cause of connection drops.

### Security

- **World Session Timeout**: a world session ends 30 minutes after its last tab closes. Closing the browser without signing out used to leave the session valid for the 24 hours of its token; now the next visit goes back to the login screen (the Setup Hub admin session is unchanged).
- **Media push needs a session**: the route that sends an image or video to the players now requires a login like the rest of the API.

### Fixed

- **Node Edition Runs As Production**: the Node edition and `npm start` start the server with `NODE_ENV=production` (the log said `development` because nothing set it).
- **Doors Are Instant**: a door changes on screen at once and only that wall is updated, instead of waiting for the server and reloading every wall of the stage on every client (three round trips through a tunnel). If the server refuses, the door goes back. The door event also stays inside its own world.
- **Owner Of A Sheet Moves The Token**: the owner of an actor can move the token a GM placed from it; the canvas only looked at the ownership of the token itself, which is empty for a token placed by the GM, so the drag was blocked even though the server accepts it.
- **Tokens After A Dropped Connection**: after a reconnection the server sends the tokens again (moves, additions and removals made during the drop were never delivered and needed a reload), and a connection a tunnel killed silently is noticed in at most about 10 seconds instead of 45.
- **Stage Updates Apply Only What Changed**: a change to a stage re-applies darkness, fog, music and levels only when that part changed, instead of rebuilding everything on every update (less lag when a GM edits a scene during a session).
- **Media Viewer Through A Tunnel**: images and videos given as full addresses of this same server (what a tunnel produces) are opened and pushed as same-origin paths.

## [1.0.4-alpha] - 2026-10-04

> Build: `0006`

### Added

- **Macros In Compendiums**: opening a macro of a compendium (of the world or of an addon or ruleset) opens the macro editor on that entry instead of saying there is no specific editor; saving writes the name, picture and command back to the entry (a locked compendium still refuses the save).
- **Path In The File Browser**: the file browser shows the path of the selected file (or of the folder being browsed) above the upload bar, selectable, with a button that copies it.
- **Item Folder Into A Compendium**: dragging a folder of the items tab into the window of an Item compendium copies the folder, its sub-folders and every item in them into the pack, keeping the structure (the world's items are not changed).
- **Select Tools Pick Several**: the select tools of lights, sounds, notes, drawings and tiles draw a drag box (Shift adds to the group). Dragging any element of the group moves them all together (several selected walls too), and **Delete** removes them. Delete also works on a single selected light, sound, drawing or tile (it used to exist only for walls and notes).
- **Light On Every Floor Option**: each light has a "Shared by every floor" option in its sheet (off by default, migration 066, `allLevels` in the lights API).
- **Theater Art Tool**: a new tool for the scene's theater screen. With theater mode on, the GM's toolbar shows only "Theater art" (select and move, add a picture, add a text, clear the screen) and the map tools return when it is turned off. Pictures and texts belong to the scene (`flags.theaterItems`), so each map scene has its own entry screen. Click to select, drag to move, drag a corner to resize (a picture keeps its proportions, a text grows with its font), double click opens the item sheet (text, font, size, colour, alignment, bold, italic, shadow, opacity, rotation, forward/back, delete) and Delete removes the selected item. Everyone sees the changes live; only the GM edits. Sizes are relative to the screen width, so the screen looks the same on any monitor.
- **Scene Music Stays In Step**: a reload or a late join goes to the track the table is on, at the point it has reached, instead of the start of the playlist (`GET/POST /api/stages/:id/music-sync`; the first report wins and the timeline is kept in memory on the server).
- **Text Style On Drawings**: the text of a drawing (the text tool and the labels of shapes) has alignment, bold, italic and shadow in the Text tab of its sheet (migration 064).

### Security

- **Theater art is validated on the server**: the list is rebuilt field by field before it is stored (80 items at most, pictures only from this server's files or https pages, no markup or other schemes, text shown as text), and only the GM can send it (`stage.theaterItems`).

### Fixed

- **Compendium List After An Edit**: the window of an addon or ruleset compendium refreshes its list when an entry is edited in its sheet (the old name or picture stayed there until the window was reopened).
- **Compendiums In Folders**: a world compendium put in a folder stays there after a reload (the list of compendiums did not return the folder, so the sidebar showed every pack at the top level). Renaming a compendium shows in the sidebar at once (the sidebar did not listen to compendium changes), and renaming no longer rewrites every entry of the pack, which made it slow.
- **Compendium Window Folders**: after dropping a folder of items into a compendium the folders show up at once, with the dropped one open (they used to appear only after closing and reopening the window, with the items loose meanwhile); folders, sub-folders and entries are listed in alphabetical order where numbers count as numbers ("2" before "10").
- **File Browser Inside A World**: the browser opened on the shared `uploads` folder because most windows did not say which world they were in. Inside a world the world tab now starts in the world's own assets and can browse every folder of that world (its root is the world's folder and it cannot climb above it); outside a world (the setup hub) it still browses from the data root. A world session now reaches only its own folder (the id has to match whole: `world-1` no longer reaches `world-10`), and the loose files at the root of a world (database, manifest, backups) are never listed to it.
- **Fog Per Floor**: only the tokens and lights of the floor on screen reveal the fog (the vision of a token on an upper floor used to reveal the others), and what a player explored is saved and loaded per floor (migration 065, `levelId` in the fog-reveals API). Records saved before it belong to no floor, so each floor starts unexplored.
- **Lights Stay On Their Floor**: a light only shines on the floor it belongs to, in the picture and in the fog.
- **Remembered Area Darker**: the part of the map that was explored but is not in sight is kept darker, so lights are what bring it back.
- **Tiles**: they can be moved, resized (from the edges and corners) and opened with a double click again, also after the first use; a picture tile starts at the picture's own size and in the centre of the view; a new tile no longer shows "New tile" as its text and starts enabled; the colour swatch and the hex field stay in step (the last one used to win, so a new colour was saved as none); the drawings sheet header no longer overlaps the tabs. Tiles saved with double-encoded triggers or actions no longer raise errors on every click or mouse move.
- **Fog Exploration**: saving sends only the new polygons, in pieces under the body limit (the full list outgrew 1 MB on a big map and the server answered 500 forever); a body over the limit is answered 413 instead of a blind 500.
- **Volume Sliders**: Master is everything, **Music** is every playlist (the sidebar's and the scene's own) and **Ambient** is only the sounds placed on the map with the audio tool; each slider says what it controls.

## [1.0.3-alpha] - 2026-10-03

> Build: `0005`

### Added

- **Scene Music Track**: the scene's music can now be one specific track of its playlist (new "Track" select under the playlist in the scene config; empty keeps the whole playlist). A chosen track plays alone and repeats. The change a GM makes reaches every player through the scene update, and shuffle uses a fixed seed so every player hears the same order instead of their own random one. Starting the scene music also stops what the sidebar was playing.
- **"Scene music" Bar With Stop**: the music tab shows what the scene is playing (playlist and track) and a stop button: "Stop for everyone" for the GM (clears the scene's music), "Stop on my side" for players (local, stays off until the scene's music changes).
- **Playlist Order And Transport**: tracks have a real order (move up/down for the GM, saved with `PUT /api/playlists/:id/sounds-order`) and the list has previous / play / next / repeat-playlist / sequential-or-shuffle controls. Play on a track now continues through the playlist in order.
- **Note Link Picker**: the journal and waypoint (scene) fields in the note config are now one type-to-search picker each (the list opens on focus and narrows as you type; arrows, Enter and Esc work). Scenes are listed as a tree, parent scenes first with their children indented below. The reusable component is `components/search-select.ts`.
- **Windows Stay On Screen**: windows open no taller than 85% of the screen, are never larger than the screen, and are moved back inside it whenever their size changes (content that loads late no longer pushes the title bar or the buttons out of view).
- **System Dice In The Chat**: `/r 1dv`, `/r 2dg+1dv` and the other dice a system names by letter (wod5e) roll as the d10 success pool they are (`1dv` is `1d10cs>5`, typed modifiers kept). A formula the roller cannot read now shows a message instead of doing nothing.
- **Playlist Control Permission**: players only listen to the music unless their role is granted "Control playlists" in the user permissions window. With it (or as GM) they play, skip, stop and change loop/order for the whole table, and playing a track from the list plays it for everyone. The scene music has its own endpoint (`PUT /api/stages/:id/music`) and loop/order/volume changes are checked on the server.
- **Now-Playing Bar With MP3 Tags**: the scene music bar shows the MP3 title, artist, album and cover when the file has them (read from the first bytes of the file only), has a round stop button instead of a text button, and everyone gets a "Now playing" notice when the track changes, on whichever tab they are.
- **Export A Character From Its Sheet**: the sheet's menu has "Export to Loom Connect", so it is always clear which character is saved (it used to be tied to the main character). The default site address is now `loomvtt.com`, and the connect popup shows an in-page accept screen instead of the browser's confirm box.
- **Starting Camera For Map Scenes**: map scenes (the waypoint destinations) have no Levels tab, where the starting camera (x, y, zoom) and its "capture current view" button lived; they now have them in Basics.
- **Template Keeps Your Text**: applying a journal template to a page that already has text asks whether to keep it. Kept text goes into the template's body area (the first heading becomes the headline) and loses the old theme's look.
- **Insert > Image Replaces A Template Placeholder**: with the cursor in a template's placeholder block (e.g. the gazette photo), the picture replaces the whole block at full width instead of landing inside its dark frame.
- **Safe Iframes In Journal Pages**: pages can embed an external page with `<iframe>`: https only, never a page from this server or a local/private address, with a sandbox imposed by LoomVTT (no top-level navigation, no downloads, no camera or microphone, no access to our cookies), no referrer and no browser features. Sites that refuse to be embedded stay blank.
- **Addon Window Details**: each addon row shows its author as a badge, a repository link (GitHub icon for GitHub) and its version.
- **Public IP Invite Link**: without a tunnel, the invite links window offers the public IP and port when the address is reachable from outside (private and carrier-grade NAT ranges are skipped), with a note that the port must be open on the router.

- **Loom Connect From The Settings**: connect once from the account tab (the link lasts about an hour and only the short-lived access token stays in the browser; disconnect with `DELETE /api/worlds/:worldId/connect-account`). The sheet menu shows "Export to Loom Connect" only while connected, and a rejected link shows the site's reason instead of reloading the page.
- **Import A Character**: the Actors tab can import from a Loom Connect slot or from a `.json` file saved from a sheet ("Save to file" in the sheet menu). Pictures and tokens come inside the file and are restored into the world's assets. The slot picker shows the portrait, the system and whether it fits the current world, and empty slots are shown as empty.
- **GM Approval Of Imports**: a character imported by a player waits for the GM (hidden from everyone else, with a badge and an "Approve" entry in the context menu). The GM decides who may import in the user permissions window ("Import characters", on for players by default).
- **Door Distance And Sounds**: a door has an opening distance (players must stand near it; the GM is exempt) and its own open and close sounds, with a few royalty-free ones bundled in `public/sounds/doors`. All three are saved with the wall (migration 063).
- **Several Files At Once**: the file picker uploads and selects many files, audio, video and PDF files have their own icons, and a playlist takes many tracks in one go.
- **Progress Bar In The Music Tab**: shows elapsed time and seeks; while the sidebar is collapsed a now-playing card stays at the top right.
- **Token Select Box**: the select tool of the token grid draws a drag box that selects several tokens.
- **Portrait And Token Editor**: redesigned as flat columns. Each layer is one line with a thumbnail, eye, order and delete; an adjust box per layer controls opacity, brightness, contrast and saturation plus flip, center and clone. A new token starts as colour, figure, circle mask and ring, and the previews stay fixed while the layer list scrolls.

### Security

- **Assets Need A Session**: world pictures, sounds and PDFs (`/worlds/:id/assets`, `/uploads`, `/thumb`) are served only to a signed-in session of that world (player, GM, display, stream or admin). The login screen's pictures (world cover, background, user avatars) stay public. `LOOM_OPEN_ASSETS=1` turns the gate off.
- **Uploads By Extension**: the server decides from the extension before writing anything (images, audio, video and PDF only; no scripts, executables or markup), on top of the magic-byte check.
- **Imported Pictures Cannot Carry Markup**: picture addresses inside an imported character package are sanitized before they reach the database.
- **Journal Frames Stay Off Internal Hosts**: iframes in journal pages cannot point at local or private addresses.
- **One Session Per Account**: a second login is refused while the account is connected somewhere else.
- **Loom Connect Popup**: shows the address it will send the token to, and no longer signs the visitor out of the site.

### Fixed

- **Playlist Did Not Play In Sequence**: the sidebar sorted tracks by name while play order used `sortOrder`, which was always 0; play on a track played only that track; and a track's own loop repeated the whole playlist. New tracks now go to the end, creation time breaks ties, and a track's loop repeats that track while the playlist's loop repeats the sequence (also in the scene player).
- **Limited Sheet For The Owner After Editing**: four places read a document's ownership by user id without handling the stored JSON text form, so after an edit came back from the server the owner read as "no access" and the wod5e sheet dropped to the limited view. Ownership is now read through one parser (`parseOwnership`) that accepts both forms.
- **Share Art With Spaces Or Accents In The Name**: the share check rejected file names with spaces or accents and anything after `?` other than a version; paths are now sent encoded, other cache parameters are accepted, and the toast says why a share failed.
- **Ownership Window Lost Owners**: opening it from a list that held the stored JSON text spread the text into characters, every row read "None" and saving wrote zeros over the real owners. It now reads the document's real levels and saves only the rows that were changed.
- **Macro Hotbar Menu Off Screen**: the right-click menu on a hotbar slot opened below the bottom of the screen; it is now moved back inside the viewport.
- **Journal Page Shown By The GM Stayed On "Loading"**: the page now travels with the push (only to the chosen players), so it opens even for a player with no access to the journal; if it still cannot load, the window says so.
- **Letter Theme Collapsed Into A Strip**: pages with the letter/parchment themes shrank to one letter per line in the viewer; they now fill the width.
- **New Roll Table Posted The Formula**: a table created from the sidebar had no "show formula" default and posted "rolled 1d20" with the result; it now posts only the result.
- **Editor Insert > Image Did Nothing**: the stock prompt was appended outside the editor and never worked; the menu now opens the file picker and puts the picture at the cursor.
- **GM Could Not Change Their Own Password**: the routes treated any role/character field in the request as a change to a Gamemaster account. Only values that actually differ count now; promoting, demoting and changing another GM's password still need the Setup Hub administrator.
- **Player Could Not Change Their Own Avatar**: the profile form sent role and main character along with the rest, and a main character the player does not own read as "assign a character". Players now send only name, color, avatar and pronouns.
- **Item Dropped On A Sheet Needed Two Tries**: an item created from the sidebar was not registered in the items collection (its echo returned early), so the system could not resolve it on drop and did nothing until the item was edited. It is registered first now, and `Loom.fromUuid` (async) fetches an item the collection does not have yet.
- **Banner Image Over The Tabs**: in windows with tabs (scene config and similar) the header picture faded on behind the tab bar and the form; it now stops at the tabs.
- **3D Dice Never Started When The Environment Map Failed**: the HDR loader neither reported nor raised an error on a bad file, so the dice never initialised. The addon now reads the file itself and falls back to its cubemap, logging what the server delivered.
- **Changing Your Own Password Logged You Out**: the account's sessions were revoked with "revoked" even for the person who made the change. That browser now gets a token for the new session version and stays connected; other devices still lose theirs.
- **"undefined" Row In The Shortcuts Window**: a converted system registered its shortcut in the original `register(namespace, name, data)` form and the manager stored a nameless entry. That form is now adapted (name, hint, key and modifiers).
- **Update Screen**: a channel with nothing published is no longer an error (it is shown in green as "nothing newer"), and the "force update" option has its own row instead of a squeezed column.
- **Journal Page Viewer**: the page name appears only in the window header and the page fills the window; the toolbar row shows only when there are page arrows or "show to players".
- **PDF Pages**: PDFs can be uploaded and picked (the server only accepted images, audio and video and the file picker's upload field had no PDF); the page type label showed the raw key "journal.pageTypePdf" and the hint talked about audio and video.
- **Right Click On The Player Bar**: the avatars on the bar opened no menu (only the rows of the open list did); they now open "Configure user" and "Change password" (the GM for anyone, a player for themselves).
- **Invite Links Reloaded The Page For The GM**: the window asked an admin-only route for the tunnel and the 401 made the client reload; the tunnel address now comes with the invite links, and the tunnel block shows only when a tunnel is running.
- **Music Volume Jumping At Low Levels**: map sounds and scene music fought over the volume (a fade-in running at the same time as the position update, fade-outs piling up, a fade-in aimed at a stale volume), and a "volume above 0.01" check behaved differently with the master volume low. Each sound now has one fade at a time and the fade-in follows the sliders.
- **Portrait Editor Previews Were Oval**: the preview frame lost its square shape when the window was wide and stretched the canvas, so the circle mask looked like an oval. The frames are always square, smaller, and the window is laid out in cards.
- **Roll Table Title**: the editable title no longer gets a boxed outline over the banner; a thin underline marks it.
- **Delete Removes Map Sounds**: the Delete key removes a selected map sound, with undo.
- **Door Settings Were Lost**: saving the wall settings dropped the wall's level, and the door's distance and sounds disappeared after a reload.
- **Long Track Title**: no longer pushes the stop button out of the music card.
- **File Picker Footer**: the footer buttons use the small size and no longer clip or stretch.
- **Loom Connect Link**: the sign-in popup no longer revokes the token before the server checks it, the site address is `loomvtt.com`, and SVG pictures are encoded in exports instead of failing.
- **Export Of Another Owner's Sheet**: a character the account owns or is assigned to exports even when it is not the main character.
- **Session Error After Login**: signing in again no longer ends the session already open (replaced by the refusal above).

## [1.0.2-alpha] - 2026-10-01

> Build: `0004`

### Added

- **Portrait & Token Editor**: layered editor for an actor's sheet art and token art (images, rings, masks, color layers, WebP export to the world's `tokens` folder). Clicking the sheet portrait opens it; the token side starts fully transparent with no automatic circle. Exposed as `Loom.openPortraitEditor(actor)`.
- **Media Viewer & Share**: view the character art or token art from the actor sheet menu, the sidebar and the token HUD; the GM can share it with everyone or chosen players (`Loom.openMediaViewer`).
- **Actor Sheet Menu Registry**: every sheet's dots menu now has the basics (view art, editor, ownership, token prototype) and rulesets/addons add their own entries with `Loom.actorSheetMenu.register(id, provider)`.
- **Free-form Token Shape**: new "None" token shape (no backing disc, clip or default border) for transparent art; tokens made with the editor use it, and "apply token image to all stages" sets it.
- **Map Import (.dd2vtt / .df2vtt / .uvtt)**: import Universal VTT maps (e.g. Dungeon Alchemist) from the Stages tab as a new stage or a new level: image, walls, doors and lights, with a preview, warning above 200 wall segments and a hard limit of 1000. A stage without lights in the file starts with global illumination on.
- **Token Vision Cone**: a vision angle below 360 now shows a real slice in front of the token (front is up at rotation 0), and the light the token carries follows it. Darkvision and Monochrome now tint what the token sees. New "Reset exploration" button in the stage's fog settings.
- **Token Canvas**: tokens fill their whole grid square, thin selection square, larger resource bars and numbers (per-token "show numbers" option), and status/movement badges drawn with Font Awesome or the app's own icons.
- **Rotate With Ctrl + Mouse Wheel**: turns the selected (or hovered) tokens smoothly, saved when the wheel stops; Q/E keep the 45 degree steps.
- **Zoom Out To Fit**: the canvas can always zoom out until the whole scene fits in the view, however large the map.
- **Token Turns Toward A Mouse Pull**: pulling a token with the mouse now turns it toward where it was dropped (its front is up at rotation 0), and the vision cone follows. Keyboard steps and Ctrl + wheel are untouched, pulls under half a cell do nothing, and a token flagged `lockRotation` never turns. The angle is saved with the same debounced call as the wheel.
- **Day/Night Button Highlight**: the sun/moon transition buttons in the light toolbox show the scene's current mode (below 0.5 darkness is day).
- **Exploration Along The Path**: fog exploration records what the vision touches while the token moves (every half cell) and when it turns (15 degrees), not only where it stops. Only the new polygons are sent to the server and to other clients.
- **Shared Fog Exploration**: the scene's "Shared" exploration mode now works (one explored area for the whole table, merged on the server, live to everyone); "Individual" stays private per player and "None" records nothing. The server reads the mode from the scene instead of trusting the client. New `DELETE /api/fog-reveals/stage/:stageId/mine` resets only the caller's exploration.
- **WebSocket Reconnection**: after a dropped connection (tunnel hiccup, sleeping laptop) the client re-identifies and rejoins the world and stage rooms, catches up on missed chat and rolls (`GET /api/chat-messages`), and flushes the moves and rolls queued while offline (up to 50, newest move per token). Chat, move, relay and drag now have separate rate-limit buckets and a refused roll tells the roller (`chat.roll.rejected`).
- **Localization Pass**: about 1,850 hardcoded UI strings across the HUD, windows, components and core moved to `t()` (3,030 keys, EN and PT-BR in parity). `npm run verify` now fails on key mismatches, duplicate keys and new hardcoded toast/fallback text (`scripts/i18n-inventory.mjs`, `scripts/i18n-classify.mjs`, `scripts/check-i18n-gate.mjs`).

### Fixed

- **Readable Server Console In Production**: the standalone server is installed with `npm install --omit=dev`, which skipped `pino-pretty`, so `npm start` printed raw JSON log lines. `pino-pretty` is now a runtime dependency (colored, one block per line). Debug lines stay dev-only (`npm run dev*` or `LOOM_LOG_LEVEL=debug`), so `npm start` logs info and above.
- **Exploration Never Saved Or Restored**: the canvas never received the user id the fog layer needs, so exploration silently skipped both saving and loading since the first commit; `setUserId` is now called with the session user.
- **Day/Night Tools Turned Token Vision Off**: the sun/moon transition tools switched vision on and off by themselves, which killed global illumination and left only darkness; they now follow the scene's `tokenVision`.
- **Global Illumination Never Turned Off At Night**: it stayed on while darkness was at or below the threshold (default 1), so full night still counted as lit. It is now on in daylight and below the threshold, and off at or above it; the threshold help text says so.
- **Doors Visible Across The Whole Map**: with global illumination on, every door showed everywhere. Doors now only show inside the token's vision (the room it is in, bounded by walls) or in explored areas; the GM still sees all unless previewing a token.
- **Reset Fog In Individual Mode**: the reset button only cleared the screen. It now deletes the caller's stored exploration and tells only that player's clients.
- **Fog Leaked Between Players**: individual-mode exploration updates are now sent only to that player and the GM.
- **Players Without A Selected Token**: they now see through all the tokens they own (including ownership inherited from the linked actor); selecting one focuses the vision on it.
- **Door Icons Cut By Walls And Shadows**: door icons are drawn above the fog and lighting so the wall they sit on no longer hides half of them. In dark scenes (night, or global illumination off) they only show inside what the token sees and the areas already explored.
- **Vision Cone Shape**: cones under 180 degrees were circular segments and scene-corner rays widened every cone almost to a full circle; the polygon is now a proper slice with its apex at the token.
- **Explored Area Under Global Illumination**: the fog remembers what global illumination let the token see, not just its dark sight range.
- **Pixi Back Buffer Warning**: the canvas enables the back buffer that the Darkvision and Monochrome tint needs.

## [1.0.1-alpha] - 2026-09-30

> Build: `0003`

### Added

- **Package Marketplace & Addon Installer Expansion**:
  - Enhanced package marketplace integration and addon installer supporting dynamic package discovery, progress tracking, and robust error handling.
  - Setup Hub UI enhancements for modules and systems management tabs with updated grid cards and status indicators.
  - Comprehensive localization support updates across English (`en.json`) and Brazilian Portuguese (`pt-BR.json`).
- **Canvas & Wall API Enhancements**:
  - Expanded canvas management and fog of war layer handling in PixiJS v8.
  - Integrated dedicated wall management endpoints (`/api/walls`) and improved stage rendering pipelines.
- **Journal Rich Media Embeds**:
  - Support for external video and PDF embeds in journal pages, including YouTube and Vimeo links.
- **In-App Updates for the Installed Windows App**: Settings > Updates now downloads and installs new releases automatically (signed-hash verified, silent install, app reopens). Source installs keep the `git pull` flow.
- **Ruleset Macros**: new `ruleset-macro` hotbar type that runs a macro shipped by the active ruleset in the page with the full Loom API, plus `Loom.canvas.getControlledActors()` for macros that act on the selected tokens.

### Fixed

- **CSP & Canvas Rendering Under Strict Security Policies**:
  - Imported `pixi.js/unsafe-eval` polyfill to prevent WebGLRenderer shaders and particle codegen crashes under strict Content Security Policies.
  - Adjusted CSP directives (`script-src`, `frame-src`, `media-src`) to permit Handlebars template compilation, script macros, and external journal media embeds without compromising security.
- **Database Migrations Auto-Healing**:
  - Added runtime migration record auto-healing (`fixupMigrationRecordExtensions`) to prevent boot crashes caused by `.ts` vs `.js` filename extension discrepancies between development and production builds.
- **Central User Table Backfill**:
  - Added migration `060_backfill_central_users_from_worlds` to automatically migrate user accounts stranded in legacy per-world SQLite databases into the central server database.
- **UI & Mobile Responsiveness**:
  - Improved responsive layout gates in `responsive.css` behind `pointer: coarse`, keeping desktop views untouched while refining mobile touch interaction.
  - Enhanced context menu positioning and responsive styles for world login and setup screens.
- **Catalog Banners Under Strict CSP**: package catalog banners are now proxied through the local server, so they render again in the packaged app.
- **Neutral Naming in the Update Helper**: internal `system.*` update expansion helper renamed (`expandSystemUpdate`); behavior unchanged.

## [1.0.0-alpha] - 2026-09-28

> Build: `0001`
>
> First public alpha release. Earlier `1.0.1`–`1.0.4-alpha` internal builds
> were consolidated into this single release before any real distribution
> happened — see [`CHANGELOG.pt-BR.md`](./CHANGELOG.pt-BR.md) for the day-by-day
> history.

### Security

- **Removed an internal-only license activation shortcut**: a fixed developer key that should never have shipped in distributable builds has been removed entirely. Local/test activation now goes through the same site-issued license flow as a real key.

### Added

- **Sidebar Tree Hierarchy & Visual Insertion Lines**:
  - Distinct glowing insertion line indicators (`.drag-indicator-top` and `.drag-indicator-bottom`) with anchor dots across all sidebar tabs (Actors, Items, Journals, Stages, Compendiums, Tables, Decks, Macros, and Playlists).
  - Effortless moving of entities and folders to root by dropping on root items or empty space in the list, removing artificial "Move to Root" drop zone buttons.
  - Boundary-aware folder dropping: hovering folder top/bottom boundaries places items at the parent level, while hovering the folder body moves into the folder.
- **Full Compendium & Sheet Drag-and-Drop Pipeline**:
  - Direct drag-and-drop import of items and entities from compendiums into world items, actor sheets, or nested folders.
  - Detached import of actor-owned items into world items by dragging from actor sheets into the sidebar.
  - Full support for custom system item types defined in active ruleset manifests (e.g. WoD5e, D&D5e).
- **Reactive Roll Tables (RollTables) Collection**:
  - New reactive client-side collection `rollTablesCollection` synchronized over WebSocket (`roll-table.created`, `roll-table.updated`, `roll-table.deleted`).
  - Full sidebar context menus for tables (create, open, rename, delete).
- **Ambient Audio & Spatial Soundscapes**:
  - Positional ambient audio sources on the PixiJS canvas (`AmbientAudio`) with configurable radius, volume, distance attenuation, and proximity-based triggers on token movement.
  - Full real-time synchronization of audio playlists, tracks, playback states, volume, and looping over WebSocket (`playlists.sync`).
- **File Picker Folder Management**:
  - Hierarchical folder navigation, folder creation, renaming, and organization directly within `FilePickerWindow`.
  - Nested folder support across world assets and upload directories with REST endpoints (`GET/POST/DELETE /assets/folders`).
- **Stage Preload & Texture LRU Cache**:
  - Smart scene preloading system (`stage-preload.ts`) with a 5-scene LRU cap that automatically evicts older cached scenes using PixiJS `Assets.unload()` to protect memory.
  - Interactive stage navigation and sidebar context menus allowing GMs to preload high-resolution battlemaps before pulling players.
- **Actor Groups as Virtual Folders**:
  - Actor groups in the sidebar can now act as virtual folders supporting drag-and-drop hierarchy and automatic `systemData` member synchronization.
  - Redesigned and modernized `NoteConfigWindow` and `OwnershipConfigWindow` with standardized form controls and improved visual ergonomics.
  - Overhauled map pin rendering and interaction handling on PixiJS canvas.
- **Setup Hub System Configuration & Package Management**:
  - Dedicated `SystemConfigWindow` in Setup Hub allowing GMs to configure rulesets, manage embedded compendium packs, inspect declared licenses, and cleanly uninstall unused systems.
  - Conditional display of License and Compendiums tabs across addon and system manifest windows, showing only tabs actually declared in package manifests.
- **Commercial Package Entitlements & Marketplace Verification**:
  - Installer package integrity validation, cryptographic entitlement verification (`GET /marketplace/entitlements`), and secure license registration via the global `activation_codes` table with SHA-256 hash storage.
- **System Registry & Marketplace Package Browser**:
  - Added the system registry, marketplace package browsing, entitlement-aware package installation, and Setup Hub integration for discovering and managing systems and commercial packages.
- **Standalone Server Deployment Guide**:
  - Comprehensive Portuguese documentation for deploying standalone LoomVTT headless servers via Docker, systemd, reverse proxies (Nginx/Caddy), SSL, and persistent data paths (`docs/pt-BR/guide/running-standalone-server.md`).

### Security

- **Strict Server-Side WebSocket Payload Filtering**:
  - Initial connection payloads (`cast`, `actors`, `items`, `journals`) are now sanitized and permission-checked by the server prior to broadcast, preventing clients from inspecting unpublished or private entities.
- **Enforced Roll Privacy for Secret Rolls**:
  - Private dice rolls (`gmroll`, `blindroll`, `selfroll`) now have their visibility enforced deterministically by the server before broadcasting to connected sockets.
- **Display & Streaming Session Lockdown**:
  - Read-only display/streamer sessions are enforced at the server level, discarding any attempted mutations, token movements, or administrative requests.
- **SSRF Protection & Payload Capping for Remote Compendiums**:
  - Blocked SSRF vectors on remote compendium APIs and capped incoming response sizes.
- **Asset Upload Magic Byte Validation**:
  - Rejects files with spoofed or unrecognized magic signatures, preventing malicious file masquerading.
- **Prototype Pollution Prevention**:
  - Blocked `__proto__`, `constructor`, and `prototype` manipulation in `expandObject` and `mergeObject`.
- **Live User Moderation & Instant Bans**:
  - Real-time user role updates, ban state enforcement (`users_banned` migration `054`), and immediate WebSocket disconnection on ban.
- **Secrets Masking & Global Activation Codes**:
  - Stopped leaking and logging licensing secrets, hashed activation codes with SHA-256, and migrated codes to a global server table (`055_folder_hub_fields`).

### Fixed

- **Chromium Drag-and-Drop Event Alignment**: Harmonized `effectAllowed` and `dropEffect` throughout the drag-and-drop lifecycle, resolving dropped compendium items being cancelled by Chromium browsers.
- **SQLite Compendium UUID Parsing**: Fixed parsing bugs when local compendium pack paths contain `.sqlite` extensions.
- **API Item Type Manifest Validation**: `POST /items` now resolves valid item types dynamically against all loaded ruleset manifests.
- **HUD Drop Leaks & Canvas Event Propagation**: Prevented drag-and-drop operations from the sidebar or windows from unintentionally leaking drop events into the underlying PixiJS canvas.
- **Scene Reloading & Transition Artifacts**: Fixed edge cases where changing active stages or levels caused residual sound effects or desynced lighting states.
- **Module Settings Secrets Protection**: Required GM authorization for all addon settings mutations and masked sensitive secret keys.
- **Compendium World Scoping**: Strictly scoped compendium file resolution to the requesting world's directory to eliminate cross-world directory traversal.
- **GitHub Bug Report Sync Gating**: Gated the GitHub issue sync behind GM permissions with strict rate limits and request payload caps.

### Added

- **Dedicated Displays, Digital Game Tables & OBS Studio (Alpha 05)**:
  - Read-only display link system (`/display?token=...`) for projecting maps onto horizontal smart TVs (physical gaming tables with real miniatures), projectors, secondary monitors, or live streams via OBS Studio Browser Source.
  - Database schema and migration `053_display_links` featuring unique cryptographic tokens, preset configurations (virtual grid suppression, player token hiding, 90°/180°/270° canvas rotation, transparent background for live overlays), and instant single-click revocation with real-time WebSocket disconnects (`Signal: display.revoked`).
  - GM HUD management interface (`DisplayLinksWindow`) with segmented control tabs, creation wizard, and automatic LAN IP resolution buttons for connecting Smart TVs (Samsung, LG, etc.) and wireless devices.
  - Privacy and UI isolation: display connections consume internal read-only accounts (`Display Viewer` / `Streamer`) and are excluded from the GM's player list to keep the party roster clean.
  - Full i18n localization (`pt-BR.json` and `en.json`), automatic network reconnection banner during Wi-Fi drops, and complete documentation in `docs/en/guide/table-and-obs-displays.md` and `docs/en/api/display.md`.
- **Journals are now full campaign pages**: each journal can organize pages into categories and use rich text/HTML, Markdown with a live preview, image, PDF, audio, video, or a navigable index. It includes ready-made themes (newspaper, parchment, gazette, letter, and dossier), color customization, enriched entity links, a standalone page viewer, and the option to show a page to players.
- **Compendium journals use the same page workflow**: Journal entries in materialized packs or addon/ruleset sources can open in the journal interface, preserving pages, categories, themes, and content when the source permits editing.
- **Addons can require a per-installation license for remote compendium content**: an addon with a paid remote pack (`compendiums: [{type:'remote', apiUrl}]`) now declares `"requiresApiKey": true` in its manifest; the purchased key is pasted once per server (Setup Hub → edit addon → Compatibility → License), not per world — reuses the same `/marketplace/redeem` table/flow already used for paid local addons, branching on `packageName` in the body instead of duplicating the logic. The remote-source contract switched from PostgREST to a small, database-agnostic format of our own: `GET {apiUrl}/meta` and `GET {apiUrl}/entries[/:id]` — any backend works (Supabase, Postgres+PostgREST, or a thin API of your own over MySQL/whatever) as long as it speaks those three routes.
- **Addons can declare `systems: string[]`** in their manifest — restricts the addon to worlds running a specific ruleset (e.g. content only meant for `wod5e`), even if it's enabled in `world_packages`. Without the field, it stays universal.
- **`ModuleManifestWindow` (Setup Hub) redesigned**: now two tabs (General/Compatibility); Dependencies and Conflicts, previously a free-text comma-separated field, are now two pickers each (Addons/Systems) with a closed dropdown + removable chips (replaced two earlier attempts — a checkbox grid, then a native `<select multiple>` — based on direct usage feedback).

### Security

- **Rotated Ed25519 license verification key**: Replaced the public key in `license-manager.ts` following a credential leak on the remote licensing server. The new private signing key is stored exclusively in Vercel production environment variables, with repository ignore rules preventing local private key leakage.

### Fixed

- **Theater Mode character portrait cards did not appear for non-GM players and displays**: `GET /api/actors` previously filtered out actors unowned by the requesting user, causing `paintCastPortraits()` on player and display clients to silently drop portrait cards with empty strings (`actorsCollection.get(id)` was undefined). Fixed by enriching `stage.cast` and `stage.castRoster` events with actor metadata (`activeCastMembers`), allowing limited public view for actors placed on stage, safely parsing JSON `stage.flags`, and providing a graceful token fallback.
- **Display links created phantom database users that appeared in the world login screen**: Display links previously inserted a permanent `Display Viewer` user row into the database. Converted display authentication to clean, isolated virtual JWT sessions (`userId: display-${id}`, `isDisplay: true`) without writing to the database, auto-clearing legacy rows, and filtering system accounts from the login dropdown.
- **Display screen token manipulation and camera lag**: Enforced strict read-only token locking on display links (preventing accidental touches or unauthorized moves from spectator screens) and optimized movement interpolation animations from 800ms down to responsive 160ms–300ms steps.
- **Compendium journals did not update without a reload**: the API already emitted source-entry changes, but the event never reached WebSocket clients. The journal window and standalone viewer now reload the current entry after a compendium change; the rich-text editor toolbar also stays anchored while its content scrolls.
- **Admin and world sessions could kill each other**: `GET /setup/verify` cleared `WORLD_COOKIE` as a side effect whenever it validated an admin token — harmless at the original call site (Setup Hub bootstrap, no active world) but catastrophic at its second, real-world caller: the game-hud sidebar's cosmetic "does this browser also have admin access" check, run every time the Settings tab opens DURING an active game. Any GM also logged into Setup Hub in the same browser silently lost their world session just by opening that tab. Fixed (`GET /setup/verify` is now fully read-only) and generalized via a full audit: `POST /setup/login`, `POST /setup/logout`, and `POST /worlds` (creation) also cleared the OTHER domain's cookie without needing to — neither should ever kill the other (`DELETE /worlds/:id` already did this correctly, checking the cookie belongs to the deleted world before clearing it).
- **Dev server restarts killed every live session on every file save**: `tsx watch` restarts the whole process on every server-file save, and `bootId` (used to invalidate tokens on a genuine restart, by design) was regenerated from scratch on each of those dev restarts too — correct in production, but in dev any file edit during a live test session logged everyone out. `bootId` now persists in `settings` (`dev_*` keys) only when `npm_lifecycle_event === 'dev:server'`; production still generates a fresh one every boot, unchanged.
- **wod5e: dragging a compendium item onto a sheet did nothing**: `ActorUX._onDropItem` resolved the dropped item via `Loom.fromUuidSync(uuid)` — which only looks up documents already loaded in memory (documented on `fromUuidSync` itself: a `Compendium.*` UUID always returns `undefined`). The drag payload already carries the full entry (`data.data`); it just wasn't being used. Now it is, whenever the uuid is a compendium one.
- **wod5e: a dropped compendium item turned into 2-3 duplicate items**: the converted sheet (`wod-actor-base.js`) manually reimplemented the same drag-and-drop binding the core (`Application.wireDragDrop()`) already does automatically on every render from `options.dragDrop` — a single physical drop fired `_onDrop` more than once (2x from that duplication alone, 3x counting `LoomDocumentSheet`'s generic `globalDragDrop`), creating the same item repeatedly. Removed the manual reimplementation (also present, separately, in `group-actor-sheet.js`); kept a per-event lock as a safety net for the remaining `globalDragDrop` overlap.
- **wod5e: an item created via drag-and-drop vanished from the sheet until some unrelated re-render happened**: nothing in the drop flow reloaded the sheet afterward — the item existed in the database but the open sheet didn't know it, so the drop looked like it had failed and the next attempt created a genuine duplicate (the real source of the duplication above, not just the listener race). Added a deterministic reload after the drop.
- **wod5e: the Condition item sheet crashed on open**: `condition-item-sheet.js` still overrode `_onRender()`/`super._onRender()`, a convention already abandoned in `wod-item-base.js` (which only defines `onRender()`, no underscore — the name the core actually calls). `super._onRender is not a function` on every open.
- **wod5e: selecting a discipline/edge/gift could leave two marked as selected at once, and clicking fast locked up the sheet**: `_onSelectDisciplinePower`/`_onSelectEdgePerk`/`_onSelectGiftPower` (vtm/htr/wta, identical code in all three) had no guard against double-clicks and never forced a reload after updating — the local item array stayed stale until the next unrelated render, leaving the old and new selection both marked. Added a per-actor lock plus a deterministic reload to all three.
- **The server's loop breaker blocked legitimate use, not just real loops**: `mutation-loop-guard` cut off at 3 PUTs/second on the same resource — converted systems make several sequential calls for a single user action (switching a selection, for instance), so clicking through 2-3 different options quickly to test already exceeded the limit with no loop actually running. Raised to 8; a genuine loop (render → WS → submit → render...) fires dozens of times a second, well above that.
- **Scroll position reset to the top on any window re-render**: `rerenderBody()` rebuilds the whole HTML (`innerHTML = ...`), which always zeroes `scrollTop` — with no exception for the element that actually scrolls (often a child, not the body root). Now saves/restores scroll on any scrolled descendant, not just the root container.
- **wod5e: an item sheet's delete/sync button never showed up**: `item?.isOwned` was checked in 9 files (8 "pick-one" item sheets plus the shared base) but that property is never defined anywhere in the codebase — always `undefined`, always false. Replaced with the real signal (`item.actorId || item.parent?.id`).
- **wod5e: hiding a field from player view (biography/appearance/tenets/touchstones) crashed the sheet**: `_onToggleLimited` read `data-name`, but the template always used `data-path` — `null.split('.')` on every click. Fixed, and the field's real address was fixed too (`actor.systemData.settings...`, not `actor.settings...`, which never existed).
- **wod5e: a group member with no portrait showed a broken-image icon**: `<img src="{{member.avatarUrl}}">` had no fallback for a member without one. Now falls back to the project's standard default portrait, same as everywhere else.
- **The rich-text editor (ProseMirror) toolbar wrapped onto two rows in a narrow field**: toolbar items are inline-block with no `white-space` rule, so they wrapped the moment the editor was narrower than all of them combined (common in a character-sheet field). Single row with horizontal scroll now.
- **A world's compendium leaked another system's content**: a GM carrying an admin cookie (Setup Hub) got an empty `req.auth.worldId` even while inside one specific world (`requireAuth` prefers the admin cookie whenever both exist) — the compendium filter treated that as "admin session with no world" and skipped filtering entirely, showing the compendium of ANY ruleset/addon the process had ever loaded (e.g. srd5e showing up inside a wod5e world). Now falls back to `activeWorldId` (the process's active world) in that case — the engine only ever hosts one world at a time, so that combination can only mean this admin is inside the active world.
- **That same filter checked a column nothing ever writes**: `world.packageIds` looked like the right source for "which addons this world has enabled", but no live code path writes it — real enablement lives in the `world_packages` table (written by `PackageManager.addWorldPackage`, the same path `/redeem` uses). In practice this zeroed the list for every world, always — no addon (only rulesets, self-scoped by their own name) ever showed up in any world's compendium. Fixed to read from `world_packages` instead.
- **Switching worlds without closing the previous one**: `/worlds/:id/activate` and `/launch-gm` swapped the globally active world without ever tearing down the previous one — its sqlite connection stayed cached, old WS sessions kept a now-stale `bootId`, and any read depending on "the currently active world" (the compendium filter above, for one) could resolve to the WRONG world for anyone still logged into the old one. This is likely the root cause of an earlier incident ("session drops when activating an addon") that had only received a client-side patch. Now properly closes the previous world (connection, `bootId`, `world.deactivated` broadcast) before opening the new one.
- **Saving an addon/ruleset manifest triggered a full page reload**: Vite's dev-mode addon watcher treated any changed file outside `.css`/`.sqlite*` as "reload everything" — including `addon.json`/`ruleset.json`, which the addon-edit screen rewrites on every "Save". The Modules tab already refreshes itself after saving; no F5 needed.
- **wod5e: the plain reroll did nothing / duplicated the card**: the actual context-menu wrapper (`Loom.wraps.chatCardContextOptions`) never called wod5e's own implementation (`_onAnyReroll`) — the "Reroll" option shown was the core's generic one, which re-posts the roll as a BRAND NEW message (genuinely re-rolling server-side), but wod5e's card always renders the old message's pre-baked `meta.bodyHtml` whenever `meta.wod5e` is set — the new roll happened, it just stayed invisible behind the old copied HTML. Registered wod5e's own reroll on the correct wrapper, alongside the Willpower reroll (which also had a smaller bug: the roll callback never re-copied `basicDice`/`advancedDice`, prototype getters dropped by the `{...roll}` spread, so every reroll merged in zero new dice).
