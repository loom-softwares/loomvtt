# Changelog

All notable changes to LoomVTT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> For historical release notes prior to Alpha 05 in Portuguese, see [`CHANGELOG.pt-BR.md`](./CHANGELOG.pt-BR.md).

## [1.0.0-alpha] - 2026-09-28

> Build: `0001`
>
> First public alpha release. Earlier `1.0.1`–`1.0.4-alpha` internal builds
> were consolidated into this single release before any real distribution
> happened — see [`CHANGELOG.pt-BR.md`](./CHANGELOG.pt-BR.md) for the day-by-day
> history.

### Security

- **Removed an internal-only license activation shortcut**: a fixed developer key that should never have shipped in distributable builds has been removed entirely. Local/test activation now goes through the same site-issued license flow as a real key.
- **Custom data location**: `--dataPath=<folder>` (or the `LOOM_ROOT` environment variable) now points the entire Config/Data/Logs location at a folder of your choosing, created automatically if missing and reused as-is if it already has data — with a prompt to restart Loom automatically when that path changes.
- **Local account linking with Loom Connect**: link a local install to your Loom Connect account to export and send character backups, with OAuth flows for players and GMs kept isolated from each other, ownership/compatibility validation on backups, image compression before upload, and the originating system version recorded alongside each backup.

### Added

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

---

## [1.0.0-alpha.0] — Alpha

### Added
- **Folders inside compendiums**: Both addon/ruleset-shipped compendium packs and per-world compendium packs now support organizing entries into folders (create, rename, recolor, nest), instead of one long flat list.
- **Compendium permission management**: GMs can now right-click a compendium source to unlock it for editing or manage which roles can view it, directly from the sidebar context menu.
- **Unified folder editor**: Every folder-edit dialog across the app (world folders, compendium folders, sidebar owner groups) now uses a single combined name + color dialog, instead of two separate steps.

### Changed
- **Standalone Node release**: No longer bundles `node_modules` or targets a specific platform/architecture at build time — the same release folder works on Windows, Linux, and macOS, installing its native dependency correctly for whichever machine runs it.
- **Custom data location**: `--dataPath=<folder>` (or the `LOOM_ROOT` environment variable) now points the entire Config/Data/Logs location at a folder of your choosing, created automatically if missing and reused as-is if it already has data.

### Fixed
- **Compendium edits triggering a full page reload**: A dev-server watcher was treating compendium `.sqlite` writes the same as a source file change, reloading the whole client instead of just refreshing the compendium window.
- **Folder assignment lost on every compendium save**: Editing and saving a world compendium pack was silently clearing every entry's folder assignment.
- **Duplicate "Stream Links (OBS)" windows**: Clicking the stream-link button multiple times could stack several dialogs and mint a fresh one-time code each time.
- **GM session replaced by opening an OBS stream link in a normal browser tab**: This is expected behavior for OBS's isolated Browser Source (a fresh session tied to a dedicated Streamer account), but the dialog now explicitly warns about it before it catches anyone off guard.

---

## [0.5.x] — Alpha

### Added
- **Rich Text Editor in SDK** (`Loom.mountRichTextEditor`): The ProseMirror-based rich text editor used in core journals is now exposed via the `Loom` global, allowing addon and ruleset developers to embed real rich text editors in description/bio fields.
- **Multi-floor / Level System**: Scenes can now have multiple floors (levels) with independent elevation ranges. Tokens, walls, lights, sounds, drawings, and notes are filtered per floor. Existing content is automatically migrated to the correct floor via database migrations.
- **Spatial Audio**: `SoundManager` rewritten with `AudioContext` + `PannerNode` (HRTF). Distance attenuation, stereo panning relative to the controlled token, and listener sync via `CanvasManager.updateControlledTokens()`.
- **Token Configuration Window — Form-based editing**: Replaced raw JSON textareas for `systemData`, `ownership`, and `detectionModes` with proper form controls. Ownership now shows a list of world players with a permission-level selector per row.
- **Active Tiles — Visual action editor**: The "Active Tiles" tab now shows structured form fields per action type (teleport destination, sound file picker, dialog title/text/image) instead of a raw JSON textarea.
- **Ambient Sound Window — Tab layout**: The noise configuration window now uses the unified `Tabs` architecture, matching the visual style of Token and Tile windows.
- **Cloudflare Tunnel hardening**: `trust proxy` configured so rate limiting works correctly per real client IP when exposed via tunnel. Session cookies now derive `secure` flag from actual request protocol. `POST /worlds/:id/join` now has its own rate limit. Admin password minimum length raised from 4 to 8 characters.

### Changed
- **File upload sanitization**: Upload sanitization now only removes genuinely dangerous characters (path separators, Windows-forbidden chars, control characters). Accented characters, spaces, and parentheses are preserved. Disambiguation suffix is only added on actual filename conflicts, using `name (1).ext` format.
- **Global compatibility alias renamed**: The `window.vtt` global (used by converted systems) is now generic. Installer error messages no longer reference specific VTT product names.

### Fixed
- **Tokens appearing on all floors**: Three independent bugs combined to show tokens/elements on every floor. Fixed by extracting `isOnCurrentLevel()` as a single shared rule applied at creation time, backfilling orphaned elements via migration `036`, and restacking overlapping floor elevation ranges via migration `037`.
- **"Unexpected end of JSON input" when clicking a world**: `getWorldDb()` was returning from cache before checking the `checkOnly` option, causing circular reference errors when `res.json()` tried to serialize a Knex instance. Only failed on the second click (first click was a cache miss).
- **World loading progress bar skipping**: Migration and backup steps — the slowest phases — ran with a frozen progress screen because `CardProgressTracker` was only triggered from "Activating World". Earlier phases now report progress; preload rescaled to 50–95% range.
- **NoiseConfigWindow layout (`<details>`/`<summary>`)**: Replaced with the unified Tabs architecture.

---

*Older entries will be added as the public changelog is backfilled.*
