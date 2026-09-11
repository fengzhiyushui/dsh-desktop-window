# dsh-desktop-window

[中文](README.zh.md) | English

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that opens the DSH Web UI in a **standalone app window** — double-click to launch, no tab strip, no address bar, and a browser profile fully isolated from your everyday browsing.

```text
dsh web  ──▶  server ready  ──▶  ┌──────────────────────────┐
                                 │  DSH · standalone window │
                                 │  (Edge/Chrome --app)     │
                                 └──────────────────────────┘
```

## Features

- **Auto-open** — the window appears by itself once the server is up (on by default).
- **Manual toggle** — a window button in the session header opens and closes it.
- **Settings switch** — *Settings → General → auto-open at startup*, persisted across restarts.
- **Whale branding** — the official whale favicon and a web manifest are injected, so the window title bar and an installed app carry the DeepSeek icon.
- **Isolated** — a dedicated profile directory under `%TEMP%`; your normal Edge/Chrome windows, tabs, and logins are untouched.

| | |
|---|---|
| Standalone window | Chromium `--app` mode: no tabs, no address bar, 1440×900 launch size |
| Auto-open | A settled first paint instead of a blank frame |
| Header button | Shows live window state and toggles it |
| Settings row | A compact switch in the General section of Settings |
| Whale icon | 7 favicon sizes plus a web manifest, injected as `<head>` rows |
| Safety | Mutating routes are same-origin guarded (cross-site `POST` → `403`); every route, timer, and child process is released on plugin unload |
| Lifecycle | Window-close state stays in sync; closing tears down the whole process tree |

## Requirements

| | |
|---|---|
| OS | Windows 10/11 (primary), macOS 11+ | Linux shares the same code path and is untested |
| DSH | `>= 0.1.0-rc.6` — developed and verified against **0.1.5-rc.1** |
| Node.js | `>= 22` (inherited from DSH) |
| Browser | Edge, Chrome, Chromium, Brave, or Vivaldi at a standard install location |
| pnpm | only for `dsh plugin add` / `update` (`npm install -g pnpm`) |

The window logic itself is cross-platform; only Windows is a supported target today.

## Installation

> Installing a bundle changes the profile's bundle list, which DSH reads **at startup** — so `dsh web` must be restarted afterwards.

**From GitHub:**

```sh
dsh plugin --profile web add github:fengzhiyushui/dsh-desktop-window
# equivalent:
dsh plugin --profile web add "git+https://github.com/fengzhiyushui/dsh-desktop-window.git"
```

**From a local checkout:**

```sh
dsh plugin --profile web add "file:D:/path/to/dsh-desktop-window"
```

`dsh plugin add` installs the package into the profile's `node_modules` and merges the bundle that declares `dsh.bundle` into `dsh.profile.bundles` automatically — no manual config edits. Then **restart `dsh web`**.

Or let the script do all of it (pnpm check, space-safe install, composition check):

```powershell
powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\install.ps1"
```

<details>
<summary><b>Windows: installing from a path that contains spaces</b></summary>

`dsh plugin` forwards arguments to pnpm through a shell, and a path with spaces
gets re-split into separate arguments. Install through a space-free junction
instead — `scripts/install.ps1` does this for you, or by hand:

```powershell
New-Item -ItemType Junction -Path D:\dsh-desktop-window -Target 'D:\path with spaces\dsh-desktop-window'
dsh plugin --profile web add "file:D:/dsh-desktop-window"
```
</details>

### Keeping it up to date

```sh
# a git dependency re-fetches the default branch HEAD
dsh plugin --profile web update dsh-desktop-window
# then restart dsh web
```

Users never need to re-`add`; `update` is enough.

## Usage

```sh
dsh web
# the standalone app window opens by itself once the server is ready
```

| What | Where |
|---|---|
| Open / close the window | the window button in the session header |
| Turn auto-open on or off | Settings → General → auto-open at startup |
| Change the browser preference | edit `browserCandidates()` in `lib/window-spec.js` |

Closing the app window does **not** stop `dsh` — by design, only the standalone window closes.

### Desktop shortcut (Windows)

```powershell
# whale icon, opens with this plugin folder as the workspace
powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\create-shortcut.ps1"

# with a specific default workspace
powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\create-shortcut.ps1" -WorkspaceDir "D:\my project"
```

`DSH-Desktop.cmd` is the launcher the shortcut points at; you can also double-click it. It uses `dsh` when it is on `PATH` and otherwise falls back to `npx @deepseek-ai/dsh@latest` (pin it with the `DSH_DESKTOP_DSH_VERSION` environment variable).

## Configuration

The auto-open preference lives in `$DSH_HOME/desktop-window.json` (default `%USERPROFILE%\.dsh\desktop-window.json`). It is written by the settings switch; a hand-edit is also fine, including one saved by Notepad (a UTF-8 BOM is tolerated).

```json
{
  "autoOpen": true,
  "cleanProfileOnUnload": false
}
```

| Key | Default | Meaning |
|---|---|---|
| `autoOpen` | `true` | Open the standalone window when the server starts |
| `cleanProfileOnUnload` | `false` | Delete the dedicated browser profile directory when the plugin unloads. Left `false`, the profile is kept so the window starts warm |

### HTTP endpoints

The plugin's browser half talks to these routes; they are also usable from scripts. Mutating routes reject a cross-site `Origin` with `403` and bodies larger than 4 KB.

| Route | Method | Purpose |
|---|---|---|
| `/desktop-window/status` | `GET`/`POST` | `{ open, auto }` |
| `/desktop-window/toggle` | `POST` | Open the window, or close it when open |
| `/desktop-window/set-auto` | `POST` | `{ auto: boolean }` → persists the preference |
| `/desktop-window/manifest.webmanifest` | `GET` | The injected web manifest |
| `/desktop-window/<icon>.png` | `GET` | Served icon bytes |

## Platform support

| Platform | Auto-open & button | Closing the window | Notes |
|---|---|---|---|
| Windows 10/11 | yes | full process-tree teardown (`taskkill /T /F`) | primary target |
| macOS | yes | SIGTERM, escalating to SIGKILL after 2 s | Chrome, Edge, Chromium, Brave, Vivaldi, in `/Applications` and `~/Applications` |
| Linux | yes | SIGTERM, escalating to SIGKILL after 2 s | Chrome, Edge, Chromium, Brave from the usual `/usr/bin` and `/bin` locations |

Every platform launches the same Chromium `--app` window; only browser discovery and
process teardown differ. Windows and macOS have dedicated code paths covered by tests;
Linux shares the POSIX path but has not been exercised on a real machine.

## Known limitations

- **The taskbar or Dock icon shows the browser, not the whale.** The window is Chromium in `--app` mode, so Windows groups its taskbar button under Edge/Chrome and shows the browser icon there, and macOS likewise shows the browser in the Dock. The title bar, the tab icon, and Alt+Tab / ⌘-Tab use the injected favicon. For the whale everywhere, install the page as an app: **Edge menu → Apps → Install this site as an app**, or in Chrome **⋮ → Cast, save, and share → Install page as app** (macOS: **⋮ → Save and share → Install page as app**). Both consume the manifest this plugin injects.
- **Closing the window does not quit `dsh`** — by design.
- **This is a browser window**, not an embedded webview.
- **The dedicated profile persists** under the platform temporary directory (`%TEMP%\dsh-desktop-window` on Windows, `$TMPDIR/dsh-desktop-window` on macOS), which is why the window starts warm. Set `cleanProfileOnUnload` to `true` to remove it on unload.
- **Opening the window does not authenticate it.** Mutating routes reject cross-site browser requests, but a local non-browser process is not challenged.

## Development

Development rules, build details, and the version-adaptation checklist are separate documents:

- [DEVELOPMENT.md](DEVELOPMENT.md) — architecture, build, test strategy, release process;
- [ADAPTATION.md](ADAPTATION.md) — the DSH compatibility matrix and what to re-verify on a new DSH release.

> **Both documents must be updated with every change to this project.**

## License

[MIT](LICENSE)
