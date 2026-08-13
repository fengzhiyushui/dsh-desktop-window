# dsh-desktop-window

[中文](README.zh.md) | English

DSH desktop-window plugin: opens the DeepSeek Harness Web UI in a **standalone app window** (Edge/Chrome `--app` mode) — double-click to launch, auto-popup, no address bar, fully isolated from your everyday browser.

## Features

- **Auto-open**: once `dsh web` boots and the server is ready, a standalone app window pops up automatically (enabled by default);
- **Manual toggle**: an "独立窗口" (Standalone Window) button in the session header action row opens/closes the window;
- **Settings toggle**: Settings → General → "启动时自动打开独立窗口" (auto-open at startup), persisted to `$DSH_HOME/desktop-window.json` (BOM-tolerant, so Notepad edits are safe);
- **Whale icon**: injects the official DeepSeek whale favicon (16/32/64/128/256) plus a web manifest (192/512) — the window title bar shows the whale; the taskbar icon is best-effort via an icon helper (see Known limitations);
- **Security**: mutation routes are same-origin guarded (cross-site POST → 403); the window uses a dedicated profile directory under TEMP, fully isolated from your normal Edge/Chrome profile;
- **Lifecycle**: window-close state syncs automatically; on plugin unload the window process tree, icon helper and all routes are cleaned up.

## Installation

Prerequisites: DSH installed (`dsh` on PATH) and pnpm (`dsh plugin` shells out to pnpm; `npm install -g pnpm` if missing).

**From GitHub (recommended):**

```sh
dsh plugin --profile web add github:<your-name>/dsh-desktop-window
# or
dsh plugin --profile web add "git+https://github.com/<your-name>/dsh-desktop-window.git"
```

**From a local directory:**

```sh
dsh plugin --profile web add "file:D:/path/to/dsh-desktop-window"
```

> **Windows path-with-spaces gotcha**: `dsh plugin` forwards arguments to pnpm through a shell, and paths
> containing spaces get re-split, producing `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`.
> Workaround: create a space-free junction and install from there:
>
> ```powershell
> New-Item -ItemType Junction -Path D:\dsh-desktop-window -Target 'D:\path with spaces\dsh-desktop-window'
> dsh plugin --profile web add "file:D:/dsh-desktop-window"
> ```

`dsh plugin add` installs the package into the profile's node_modules and automatically merges the
`dsh.bundle`-declaring package into `dsh.profile.bundles` — no manual config edits. **Restart `dsh web`** after installing.

## Updating

```sh
# update to the latest release (git deps re-fetch the default branch HEAD)
dsh plugin --profile web update dsh-desktop-window

# then restart dsh web
```

Release process: see [CHANGELOG.md](CHANGELOG.md). Users never need to re-`add`; a plain `update` is enough.

## Usage

```sh
dsh web
# a standalone app window pops up once the server is ready
```

- "独立窗口" button in the session header: open/close the window;
- Settings → General: turn auto-open on/off;
- Browser choice: Edge first, Chrome as fallback (both use the `--app` window mode with identical flags).
  To change the preference order, edit `BROWSER_CANDIDATES` in `lib/index.js`.

## Desktop shortcut (Windows)

One-liner (targets `DSH-Desktop.cmd`, whale icon):

```powershell
powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\create-shortcut.ps1"
# with a default workspace:
powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\create-shortcut.ps1" -WorkspaceDir "D:\my project"
```

You can also just double-click `DSH-Desktop.cmd` (uses the global `dsh` when present, falls back to npx).

## Platforms

Windows first (window-close relies on `taskkill`; the taskbar icon helper relies on PowerShell). On
macOS/Linux auto-open and the button work, but closing degrades to killing the main process only.

## Development & build

`lib/client.js` is the browser-side bundle (the built artifact is committed, so installers never build). Two rules matter:

- **react must stay external**: official client bundles `require("react")` against the module-table seed word
  (the shared React registered by the shell kernel); bundling it in creates a second React and breaks Hooks;
- **the `__ModuleLoader__.load` registration shell is mandatory**: bare CJS output is not recognized by the module table.

Rebuild:

```sh
npm install          # esbuild + react (dev deps)
npm run build        # node scripts/build-client.js
```

## Layout

```
package.json             dual-face declaration (dsh.bundle + dsh.client)
cordis.patch.yml         composition layer (one row: desktop-window)
lib/index.js             Host half: window process + HTTP routes + icon/manifest injection + state persistence
lib/client.js            browser bundle (built artifact, committed)
src/client.js            client source (React)
scripts/build-client.js  build script (esbuild + registration shell)
scripts/set-window-icon.ps1  taskbar icon helper (WM_SETICON + custom AppUserModelID)
scripts/install.ps1      one-shot installer
scripts/create-shortcut.ps1   one-shot desktop shortcut
DSH-Desktop.cmd          double-click launcher
assets/                  official DeepSeek whale icon (SVG / multi-size PNG / ICO)
```

## Known limitations

- **Windows taskbar button icon**: the title bar shows the whale (favicon/manifest take effect), but the taskbar
  button still shows the default icon on some Edge versions — the helper tries WM_SETICON + a custom
  AppUserModelID with varying success. For a guaranteed whale taskbar icon, use "Edge menu → Apps → Install
  this site as an app" once (it consumes the manifest this plugin injects).
- Closing the app window does not quit the `dsh` process (by design: only the standalone window closes).
- The auto-open toggle lives in `$DSH_HOME/desktop-window.json`; a future version may migrate it to the settings service.

## License

MIT
