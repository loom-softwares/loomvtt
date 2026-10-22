# Running the Standalone Node Server

Covers the production release built by `npm run package:server` — a plain
Node server package, not the Electron desktop app. Use this when you want to
run LoomVTT on a headless machine (a VPS, a home server, a Linux box) without
a desktop UI.

## 1. Build the release

From the project root, on your dev machine:

```bash
npm run build
npm run package:server
```

This produces `release/node/` — a self-contained folder with the compiled
server (`app/`), the compiled client (`client/`), the SDK build
(`packages/sdk/dist/`, served at `/_loom/sdk/`), `shared/`, the `supervisor.mjs`
launcher, the `start.sh`/`start.command` scripts, and a trimmed `package.json`. It does **not** bundle `node_modules`: that's installed on
whichever machine actually runs it, in the next step, so the native
dependency (`better-sqlite3`) always matches that machine's OS/architecture.
The same `release/node/` folder works on Windows, Linux, and macOS.

## 2. Copy it to the target machine

Copy the whole `release/node/` folder to wherever you want to run it —
another drive, another computer, a server. No installer needed.

## 3. Install and start

On Windows, inside that folder:

```bash
npm install --omit=dev
npm start
```

On macOS/Linux, a double-click launcher is included — it installs
dependencies only if `node_modules` is missing, then starts the server:

- **macOS**: double-click `start.command` (Finder runs it in Terminal.app)
- **Linux**: double-click/run `start.sh` (execute permission is already set;
  depending on your file manager's settings it may ask "Run" vs "Display")

Or from a terminal:

```bash
./start.sh
```

The server starts on port 3000 by default (`http://localhost:3000`).

## Choosing where data lives

By default, LoomVTT stores its `Config/`, `Data/` (worlds, assets, database)
and `Logs/` folders in the OS-standard per-user app-data location
(`%LOCALAPPDATA%\LoomVTT` on Windows, `~/.config/LoomVTT` on Linux/macOS).

To point all three at a folder of your choosing instead — a different drive,
a dedicated data directory for a server instance — pass `--dataPath`:

```bash
./start.sh --dataPath="/path/to/folder"          # Linux/macOS, from a terminal
node app/index.js --dataPath="/path/to/folder"   # Windows, from a terminal
```

(through `npm start` directly, npm needs an extra `--` to forward the flag:
`npm start -- --dataPath="/path/to/folder"`)

By default, `loom.config.json` is at `Config/loom.config.json` inside the user data folder. To use a configuration file somewhere else, give its full path when starting:

```powershell
$env:LOOM_CONFIG = 'D:\LoomVTT\Config\loom.config.json'
npm run dev # development (source checkout)
# or npm start for the compiled build
```

When running the server directly, use `--configPath="D:\LoomVTT\Config\loom.config.json"` instead. The file must exist; if it is missing or invalid, the server stops with an error instead of silently creating another configuration. When the `dataPath` inside that file is set, it points to the LoomVTT root folder (the one that contains `Config/`, `Data/` and `Logs/`), the same as `--dataPath`.

The `start.command` double-click launcher doesn't take arguments that way —
for a custom data path, run from a terminal instead.

The same override also works as an environment variable, useful for
services/containers where passing a CLI flag is awkward:

```bash
LOOM_ROOT=/path/to/folder node app/index.js
```

Behavior:

- If the folder doesn't exist yet, it's created (`Config/`, `Data/`,
  `Data/worlds/`, `Data/assets/`, `Logs/`).
- If the folder already has a previous LoomVTT install's data in it, that
  data is reused as-is — nothing is overwritten.
- Without `--dataPath`/`LOOM_ROOT`, nothing changes: LoomVTT falls back to
  the OS-default location exactly as before.

## Keeping it running

`npm start` runs in the foreground (it runs `node supervisor.mjs app/index.js`). For a real server deployment, run it
under a process manager so it survives crashes and reboots — e.g.
[pm2](https://pm2.keymetrics.io/) (`pm2 start supervisor.mjs --name loomvtt -- app/index.js`)
or a systemd service unit calling `node supervisor.mjs app/index.js`.

Run it through `supervisor.mjs`, not `app/index.js` directly: the supervisor is what restarts
the server when Setup Hub asks for a restart and what swaps the files during an in-app update of
the Node edition. Started directly, the server runs, but those two buttons may do nothing (only a
systemd unit gets the restart, as an exit code 75 that the unit must restart).
