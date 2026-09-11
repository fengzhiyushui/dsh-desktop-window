# Development guide

> ## ⚠️ Mandatory upkeep
>
> **Every change to this project must update this file and [`ADAPTATION.md`](ADAPTATION.md) in the same change.**
>
> There is no exception. A commit that adds, removes, or alters behaviour, files,
> dependencies, build steps, or DSH interfaces without updating both documents is
> incomplete. The release process in this file treats an out-of-date document as a
> release blocker, and `npm test` fails when the upkeep block or the bilingual
> pairing record is missing.
>
> When you touch this file, update [`DEVELOPMENT.zh.md`](DEVELOPMENT.zh.md) too and
> re-record both hashes in [`README.i18n.yaml`](README.i18n.yaml) — the same rule
> the two READMEs follow.

<!-- upkeep:required -->
<!-- pair: DEVELOPMENT.zh.md -->

## What changed, where it goes

| Kind of change | Document |
|---|---|
| New feature, changed behaviour, new/removed file, dependency bump, build or release step | **this file** |
| New DSH release, interface change, compatibility range, adaptation checklist | **[ADAPTATION.md](ADAPTATION.md)** |
| Anything a user sees (behaviour, option, limitation) | **[README.md](README.md)** + [`README.zh.md`](README.zh.md) |
| Every release | [`CHANGELOG.md`](CHANGELOG.md) |

## Architecture

One package, two halves — the DSH dual-face plugin shape:

```text
                         package.json
              dsh.bundle ─┘        └─ dsh.client
                    │                    │
        cordis.patch.yml                 │  (the scan serves ./client)
                    │                    │
        lib/index.js  ─── HTTP ───▶  lib/client.js ──▶ React slots
        (Host half)                  (Browser half)
```

**Host half — `lib/index.js`.** Injects the `webServer` and `timer` services and owns the
window process, the HTTP surface, the `<head>` injection, and the persisted preference.
Every registration is disposed on unload: routes through the `disposers` array, the
injection listener through `ctx.on` (effect-scoped), the auto-open delay through
`ctx.timeout` (also an effect), plus the child process tree.

**Browser half — `src/client.js` → `lib/client.js`.** Claims two slots:

| Slot | Entry | Purpose |
|---|---|---|
| `conversation.session.header.actions` | `desktop-window`, order 30 | the open/close button, state polled from `/desktop-window/status` |
| `settings.general.item` | `desktop-auto`, order 30 | the auto-open switch |

**Pure decisions — `lib/window-spec.js`.** Icon table, manifest body, favicon links,
route→icon mapping, browser candidates, launch flags. No I/O, no Cordis, so it is
directly unit-testable. Anything the tests need to reason about belongs here rather than
inline in `lib/index.js`.

## Layout

```text
package.json              dual-face declaration (dsh.bundle + dsh.client)
cordis.patch.yml          composition layer: one plugin row
lib/index.js              host half: window process, HTTP routes, injection, state
lib/window-spec.js        pure decisions — unit-tested without DSH
lib/client.js             browser bundle (build artifact, committed)
src/client.js             client source (React)
scripts/build-client.js   build script (esbuild + registration shell)
scripts/install.ps1       one-shot installer
scripts/create-shortcut.ps1  one-shot desktop shortcut
DSH-Desktop.cmd           double-click launcher
assets/                   official DeepSeek whale icon (SVG / multi-size PNG / ICO)
test/                     logic tests (node:test) — no DSH install required
```

## Environment

```sh
npm install     # esbuild only; react is a peer, provided by the DSH shell
npm run build   # regenerate lib/client.js from src/client.js
npm test        # four suites, no DSH install and no browser needed
```

Node.js `>= 22` is required by `package.json#engines`. `dsh` itself is **not** needed for
development: the tests exercise the host half through an in-process Cordis/WebServer
stand-in.

## The two hard rules for the client bundle

`lib/client.js` is committed so installers never build. Both rules below were established
by real failures and are enforced by `test/client-bundle.test.js` — do not "simplify" them:

1. **The `__ModuleLoader__.load` registration shell is mandatory.** The DSH client module
   system verifies that a bundle registered its factory; bare CJS output is not
   recognised. The registered `id` must equal the package name, because the module graph
   keys entries by package name.
2. **`react` must stay external.** Official bundles `require("react")` against the module
   table's seed word — the shared React the shell kernel registers. Bundling a second copy
   breaks Hooks.

## Platform abstraction

Platform-dependent behaviour is a **pure decision plus a thin executor**, and the decision
always lives in `lib/window-spec.js`:

| Decision | Function | Executor |
|---|---|---|
| Which browser executables to try | `browserCandidates(platform, env, joinPath)` | `resolveBrowser()` — checks existence in order |
| How to end the window process tree | `windowTermination(pid, platform, graceMs)` | `terminateWindow()` — runs the returned plan |

The platform, the environment, and the path joiner are all parameters. That is what makes a
macOS or Linux branch verifiable from a Windows machine; `test/platform.test.js` drives
every platform's branch there. `test/platform.test.js` also asserts that `lib/index.js`
contains none of these decisions — no `taskkill` call, no install-location literals, no
signal names, no `process.platform ===` branch — because a decision inlined there escapes
the tests that cover the other platforms.

Why the branches exist at all:

- Browser discovery differs by platform: Windows splits machine-wide (`Program Files`) from
  per-user (`LOCALAPPDATA`) installs, macOS keeps the executable inside
  `<App>.app/Contents/MacOS/`, and Linux distributions disagree on the executable name.
- Teardown differs by platform: `process.kill` on Windows ignores signal semantics, so the
  process tree needs `taskkill /T /F`; on POSIX platforms SIGTERM is sent first and SIGKILL
  only after the grace period, which is also how the launched Chromium takes its own
  renderer and GPU children with it.
- Launch flags must stay platform-neutral. Do not add a flag that only one platform
  accepts (`--class`, for instance, is rejected on macOS); `windowFlags()` is asserted
  against an allowlist.

## Test strategy

`npm test` runs six suites in order:

| Suite | Covers |
|---|---|
| `test/window-spec.test.js` | icon/manifest contract, route→icon mapping, launch flags |
| `test/platform.test.js` | browser candidates and teardown plans for win32/macOS/Linux, plus the guard that keeps those decisions out of `lib/index.js` |
| `test/host-half.test.js` | route registration, the head injection row, the armed auto-open timer, icon serving, the manifest, status, cross-site `403`, `405`, state-file persistence (including a BOM), unload cleanup |
| `test/client-bundle.test.js` | the committed bundle's invariants (rules 1 and 2 above, plus both slots) |
| `test/scripts-parse.test.js` | PowerShell hazards, then a real parse of every `scripts/*.ps1` |
| `test/docs-upkeep.test.js` | the mandatory-upkeep clause, the pair links, and the recorded document hashes |

Two properties of this suite are deliberate:

- **The host half is tested without DSH.** `createHarness()` supplies a minimal Cordis
  context and WebServer. Keep `lib/index.js` free of anything that cannot be faked this
  way; push pure logic into `lib/window-spec.js` instead.
- **A check that cannot run reports itself skipped.** In an environment that denies
  spawnable child processes the PowerShell parse step skips with a reason. Never convert
  an unrunnable check into a silent pass.

Run a single suite directly when needed:

```sh
node test/host-half.test.js
```

## Common tasks

| Task | How |
|---|---|
| Add or change an HTTP route | register it in the `disposers` block in `lib/index.js`, then cover it in `test/host-half.test.js` |
| Change a served icon or the manifest | edit `lib/window-spec.js`; `assets/` and the route table must stay in sync, and both suites check it |
| Add a browser location | extend `browserCandidates()` in `lib/window-spec.js` and its test |
| Add or change a platform branch | decide it in `lib/window-spec.js` with the platform as a parameter, execute it in `lib/index.js`, and cover every platform in `test/platform.test.js` |
| Change the window's launch flags | `windowFlags()` in `lib/window-spec.js` — stay within the portable allowlist |
| Change the client UI | edit `src/client.js`, run `npm run build`, then `npm test` |
| Add a preference key | extend the state read/write in `lib/index.js`, document it in both READMEs, and keep the write tolerant of a BOM |

## Conventions

- ESM only (`"type": "module"`), 2-space indent, LF in the working tree.
- No new runtime dependency without a reason recorded in this file and in the changelog.
- Keep `lib/index.js` free of pure logic that a test could hold directly.
- Comments explain *why*, especially where a platform quirk forces the shape.
- Both READMEs and both development documents are bilingual pairs; never edit one side alone.

## Release process

1. Make the change, with tests.
2. Run `npm run build` if `src/client.js` changed, then `npm test`.
3. **Update this file, `ADAPTATION.md`, their Chinese pairs, the READMEs, and
   `CHANGELOG.md`.** Re-record the README and development-document hashes in
   `README.i18n.yaml`.
4. Bump `version` in `package.json` (semver) and add a dated changelog section.
5. Commit and push to the default branch.
6. Users run `dsh plugin --profile web update dsh-desktop-window`, then restart `dsh web`.

## Related documents

- [`ADAPTATION.md`](ADAPTATION.md) — DSH compatibility matrix and the adaptation checklist
- [`README.md`](README.md) — the user-facing document
- [`CHANGELOG.md`](CHANGELOG.md) — release history
- [`README.i18n.yaml`](README.i18n.yaml) — bilingual pairing record
