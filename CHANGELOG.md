# Changelog

All notable changes to LoomVTT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **Note**: This is the public-facing changelog. It covers user-visible changes. Internal refactors and developer-only changes may be omitted.

---

## [Unreleased]

*Changes in development — not yet released.*

### Added
- **Paid remote compendium content**: addons can now ship compendium content hosted on a third-party backend (Supabase, Postgres, or any server speaking a small REST contract of ours) instead of a bundled `.sqlite` file. If the content is paid, the addon declares `requiresApiKey: true` and the license you purchase is entered once per server install (Setup Hub → edit addon → Compatibility tab) — not re-entered per world.
- **System-specific addons**: an addon's manifest can now declare `systems: [...]` to restrict it to worlds running a specific ruleset, so a piece of content built for one game system never shows up for an unrelated one.
- **Addon manifest editor redesign**: dependencies, conflicts, and compatible systems are now picked from what's actually installed (dropdown + removable tags) instead of typed as a comma-separated list.

### Fixed
- **A world could see another system's compendium content** in some admin-session setups — fixed at the source.
- **wod5e: "Reroll" (without spending Willpower) did nothing** — it now actually updates the roll in place, matching the Willpower reroll.

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
