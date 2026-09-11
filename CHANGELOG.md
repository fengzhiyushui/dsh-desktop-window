# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] — 2026-09-10

macOS support, and a full re-verification against the newest DSH.

### Added

- **macOS.** The window now opens and closes on macOS:
  - browser discovery covers the Chromium-based browsers a Mac actually has — Chrome, Edge,
    Chromium, Brave, and Vivaldi — looked up inside `<App>.app/Contents/MacOS/` in both
    `/Applications` and `~/Applications`;
  - closing uses SIGTERM and escalates to SIGKILL after a 2 s grace period, instead of the
    Windows-only `taskkill`, which previously left the window open with no way to close it
    from the plugin.
- **Linux** browser discovery (`/usr/bin` and `/bin` names for Chrome, Edge, Chromium, and
  Brave) sharing the same POSIX teardown.
- `test/platform.test.js` — drives the win32, macOS, and Linux branches of browser discovery
  and teardown from any single machine, and asserts that `lib/index.js` contains none of
  those decisions (no `taskkill` call, no install-location literals, no signal names, no
  `process.platform ===` branch).
- A launch-flag allowlist test: `windowFlags()` may only carry flags every platform accepts
  (`--class` and similar are rejected on macOS).

### Changed

- Browser discovery and process teardown are now **pure decisions** in `lib/window-spec.js`
  — `browserCandidates(platform, env, joinPath)` and
  `windowTermination(pid, platform, graceMs)` — with `lib/index.js` only executing the
  returned plan. Taking the platform as a parameter is what makes the other platforms
  testable; see `DEVELOPMENT.md` → Platform abstraction.
- README: the installation commands name the real repository, and the platform, browser, and
  known-limitation sections state what each platform actually does.
- `ADAPTATION.md`: compatibility matrix extended, and all 15 tracked DSH interfaces re-verified
  against the newest release (0.1.5-rc.1, HEAD `aa8262ec09` — also the npm `latest`). No DSH
  interface usage changed.

### Verified

- The newest DSH is 0.1.5-rc.1: npm reports `latest` and `next` as `0.1.5-rc.1`, the highest
  local tag is `dsh-v0.1.5-rc.1`, and the local checkout's HEAD equals `origin/master`. No
  interface in use broke, and no better replacement API was found, so this release changes no
  DSH integration.

## [0.3.0] — 2026-09-10

Documentation-structure release: the window-decoration helper is gone, the README is
user-facing only, and the two development documents are now mandatory upkeep.

### Removed

- **`scripts/set-window-icon.ps1` and its host-half wiring.** The helper applied
  `WM_SETICON`, the window class icon, and a custom AppUserModelID to the app window to
  paint a whale on the title bar and the taskbar. It is removed because the taskbar
  identity of a Chromium `--app` window is owned by the browser's application identity,
  not by the window icon: the taskbar result was never reliable, while the cost was a
  resident PowerShell process per window (with a live `Add-Type` C# compile) and a
  capability to modify another process's window properties.
  - Feature impact: **none.** Opening, closing, state sync, auto-open, both UI entry
    points, every route, and unload teardown are unaffected.
  - Presentation impact: the title bar and Alt+Tab entry now come from the injected
    favicon instead of a forced window icon. The taskbar button shows the browser icon
    unless the site is installed as an app (which consumes the manifest this plugin
    injects) — documented in README Known limitations.
  - `assets/icon.ico` is kept: the desktop shortcut still uses it.
- `assets/icon.html`, which nothing referenced.
- `WINDOW_TITLE_HINT`, `ICON_HELPER`, the helper spawn block, and `stopIconHelper()` in
  `lib/index.js`; the `scripts/set-window-icon.ps1` entry in `package.json#files`.

### Added

- **`DEVELOPMENT.md` / `DEVELOPMENT.zh.md`** — architecture, layout, environment, the two
  client-bundle rules, test strategy, common tasks, conventions, and the release process.
- **`ADAPTATION.md` / `ADAPTATION.zh.md`** — the compatibility matrix, the 15 DSH interfaces
  this plugin depends on (with the failure mode and the verification method for each), the
  adaptation checklist, the degradation strategy, how to use the local DSH reference
  checkout, and an adaptation run log.
- Both documents carry a **mandatory-upkeep clause** requiring every change to update them,
  and both are registered in `README.i18n.yaml` alongside the READMEs.
- `test/docs-upkeep.test.js` — fails when a development document loses its upkeep clause or
  pair link, when a recorded hash is stale or still a placeholder, or when `dsh/` is not
  ignored. Hashes are computed with git's own blob algorithm, so no git process is needed.

### Changed

- **README rewritten to the user-facing template** (introduction, features, requirements,
  installation, usage, configuration, platform support, known limitations, license).
  Internal engineering narrative was removed from it: the Troubleshooting section is gone
  (its content lives in the development documents), the bundle-invariant explanation moved
  to `DEVELOPMENT.md`, and "Development" is now a pointer to the two new documents.
- `.gitignore` ignores `dsh/`, the local DSH source checkout kept only as an adaptation
  reference. It is never committed, built, or run from this repository.
- `package.json#files` lists the four new documents; version bumped to 0.3.0.

## [0.2.0] — 2026-09-10

Open-source preparation release: sensitive data removed, the favicon injection
and the taskbar-icon helper reworked, and the documentation rewritten.

### Compatibility

- Verified against **DSH 0.1.5-rc.1** (host `webServer` routes, the
  `webserver/index-inject` event, and the client slot contract).
- Supported DSH range stays `>= 0.1.0-rc.6`.

### Changed

- **Favicon and manifest injection now uses structured index rows.** The plugin
  subscribes to `webserver/index-inject` and contributes one `html` head row instead
  of string-replacing `</head>` through `tapIndex`. The old form silently did nothing
  on a page without a literal `</head>`; the web server now splices the row after the
  real `<head>` tag and prepends it on a fragment. Behaviour is covered by a test.
- **Browser discovery honours install environment variables.** `ProgramFiles`,
  `ProgramFiles(x86)`, and `LOCALAPPDATA` are consulted, so a per-user Chrome or Edge
  install no longer ends in `no supported browser found`.
- Pure decisions (icon table, manifest, favicon links, route→icon mapping, browser
  candidates, window flags) moved to `lib/window-spec.js` so they are unit-testable
  without a DSH install.
- `scripts/install.ps1` detects a path containing spaces and installs through a
  temporary junction automatically, then removes it. `DSH-Desktop.cmd` falls back to
  `npx @deepseek-ai/dsh@latest` (pinnable via `DSH_DESKTOP_DSH_VERSION`) and no longer
  hardcodes a release candidate.
- README rewritten (English + Chinese, structurally identical): requirements,
  compatibility matrix, configuration keys, HTTP endpoint reference, platform matrix,
  development workflow, troubleshooting, and an honest known-limitations section.

### Fixed

- **The taskbar-icon helper no longer repaints unrelated windows.** Selection was
  "any `msedge`/`chrome` process started around the same time", which on a busy machine
  could decorate a window belonging to the user's normal browsing. It now matches only
  windows owned by the launched browser process or its descendants (walked through
  `Win32_Process`) whose class is a Chromium top-level window, and additionally requires
  the title to contain the DSH product name when a hint is supplied.
- **The taskbar-icon helper can no longer run forever.** It exits when the browser
  process is gone and gives up after 60 s without finding the window (previously it
  looped for as long as the process lived, including for the whole `dsh web` session if
  the window never appeared). It reports why it gave up instead of staying silent.
- A failed icon-helper spawn is no longer an unhandled `'error'` event; it is logged and
  ignored, since the helper is cosmetic.
- The icon helper process is now killed on the window's `error` path as well as on
  `exit` and close, so a failed spawn cannot leak a PowerShell process.
- Icon route dispatcher refuses nested or traversal-shaped paths instead of relying on a
  version-string prefix filter.
- `scripts/install.ps1` re-reads `PATH` after installing pnpm globally (a fresh global
  install is not on the current process's `PATH`) and no longer leaves `DSH_HOME_SAVE`
  behind.
- `scripts/create-shortcut.ps1` validates `-WorkspaceDir` before `Resolve-Path` and uses
  literal paths throughout (a directory name containing `[` or `]` is no longer treated
  as a wildcard).

### Added

- `test/window-spec.test.js` — icon/manifest contract, route→icon mapping, browser
  candidate ordering, window flags.
- `test/host-half.test.js` — an in-process Cordis/WebServer stand-in covering route
  registration, the head injection row, the armed auto-open timer, icon serving, the
  manifest, status, cross-site `403`, `405`, state-file persistence (including a BOM),
  and unload cleanup.
- `test/client-bundle.test.js` — guards the committed build artifact's invariants
  (registration shell with the package name, `react` staying external, both slots still
  claimed) without needing esbuild installed, so a bad rebuild fails `npm test` instead
  of the browser console.
- `test/scripts-parse.test.js` — statically rejects the `"$var: text"` PowerShell
  interpolation trap and then has PowerShell parse every script under `scripts/`. The
  parser step reports itself skipped where the environment denies spawnable, readable
  child processes rather than claiming a pass it did not earn.
- `npm test` runs all four suites; no DSH install and no browser required.
- `LICENSE` (MIT), `.editorconfig`, `.gitattributes`.

### Removed

- Machine-specific absolute paths from `scripts/install.ps1` and
  `scripts/create-shortcut.ps1` usage headers (both now derive paths from
  `$PSScriptRoot`).
- A stale package-name reference in the launcher's messaging.

## [0.1.0] — 2026-08-14

Initial release.

### Features

- `dsh web` opens the Web UI in a standalone app window (Edge/Chrome `--app` mode);
- a window button in the session header opens and closes it, with state kept in sync;
- Settings → General hosts an auto-open switch, persisted to
  `$DSH_HOME/desktop-window.json` (BOM-tolerant);
- the official DeepSeek whale icon: multi-size favicon plus a web manifest (192/512),
  effective in the window title bar;
- a taskbar-icon helper using `WM_SETICON` (re-applied periodically), the window class
  icon, and a custom AppUserModelID (experimental — **removed in 0.3.0**; see that entry);
- same-origin protection on mutating routes (cross-site `POST` → 403); the window uses a
  profile directory fully isolated from the everyday browser;
- window process-tree cleanup (`taskkill /T /F`) and full teardown on plugin unload.

### Fixes within this version

- the client bundle gained the `__ModuleLoader__.load` registration shell (without it:
  `loaded without registering`);
- `react` became external, using the shared React (without it: `Invalid hook call` /
  a crashed `useState`);
- `windowsHide` removed (it had produced a live but invisible window process);
- the state file parser tolerates a UTF-8 BOM; `cordis.patch.yml` corrected to the
  top-level array form.

### Known issues

- On some Edge versions the taskbar button still shows the default icon (the title bar is
  already the whale); use "Install this site as an app" for a guaranteed result.
- Closing the window does not quit the `dsh` process (by design).

## Release process

1. Run `npm run build` after touching `src/client.js` (regenerates the committed
   `lib/client.js`).
2. Run `npm test`.
3. Update `DEVELOPMENT.md`, `ADAPTATION.md`, their Chinese pairs, both READMEs, and this
   file; re-record the document hashes in `README.i18n.yaml`.
4. Bump `version` in `package.json` and add a dated section to this file.
5. Commit and push to the default branch.
6. Users run `dsh plugin --profile web update dsh-desktop-window` and restart `dsh web`.
