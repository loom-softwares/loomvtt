# Changelog

All notable changes to LoomVTT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **Note**: This is the public-facing changelog. It covers user-visible changes. Internal refactors and developer-only changes may be omitted.

---

## [Unreleased]

*Changes in development — not yet released.*

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
