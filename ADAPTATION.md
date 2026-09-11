# DSH version adaptation

> ## ⚠️ Mandatory upkeep
>
> **Every change to this project must update this file and [`DEVELOPMENT.md`](DEVELOPMENT.md) in the same change.**
>
> A new DSH release, a changed interface, a widened or narrowed compatibility range,
> or a completed adaptation run all belong here — in the same change that touches the
> code. The release process treats an out-of-date document as a release blocker, and
> `npm test` fails when the upkeep block or the bilingual pairing record is missing.
>
> When you touch this file, update [`ADAPTATION.zh.md`](ADAPTATION.zh.md) too and
> re-record both hashes in [`README.i18n.yaml`](README.i18n.yaml).

<!-- upkeep:required -->
<!-- pair: ADAPTATION.zh.md -->

## Compatibility matrix

| Plugin version | Verified against DSH | Supported DSH range | Notes |
|---|---|---|---|
| 0.4.0 | 0.1.5-rc.1 (HEAD `aa8262ec09`) | `>= 0.1.0-rc.6` | macOS/Linux browser discovery and POSIX teardown; all 15 interfaces re-verified |
| 0.3.0 | 0.1.5-rc.1 | `>= 0.1.0-rc.6` | window-decoration helper removed (see changelog) |
| 0.2.0 | 0.1.5-rc.1 | `>= 0.1.0-rc.6` | structured head injection; icon helper hardened |
| 0.1.0 | 0.1.0-rc.6 | `>= 0.1.0-rc.6` | initial release |

"Verified against" means the interfaces in the next section were read in that DSH tree
and the test suite passes. It does not mean the plugin was exercised against a live
browser session of that version.

## Interfaces this plugin depends on

Every row below is a contract that a DSH release can change. Verification column: **read**
means the source was inspected; **test** means a suite in this repository covers our side
of it; **runtime** means it can only be confirmed against a running DSH.

| # | Interface | Where it is used | What would break | Verification |
|---|---|---|---|---|
| 1 | `ctx.webServer` service, injected as `webServer` | `lib/index.js` | the plugin never activates | test (harness) + read |
| 2 | `webServer.register({ kind, path, handler })` → disposer; duplicate `(kind, path)` throws | all five routes | routes fail to mount, or collide on reload | test |
| 3 | `webServer.tapIndex()` (legacy escape hatch) | **not used** — superseded by #4 | — | read |
| 4 | `webserver/index-inject` event, `{ kind: 'html', placement: 'head', html }` row | the favicon/manifest injection | no whale icon in the title bar | test |
| 5 | `webServer.host` / `webServer.port` getters | `baseUrl()` | the window opens the wrong URL | test |
| 6 | `ctx.timeout(callback, delay)` as an effect-scoped timer | auto-open delay | timer not cleared on unload | test (armed) + read |
| 7 | `ctx.on(event, listener)` disposed with the plugin | the `index-inject` subscription | leaked listener after unload | read |
| 8 | `ctx.effect(factory)` unload ordering | process/route teardown | orphaned window process | test |
| 9 | `dsh.client` manifest + a `./client` export (the scan requires the export; `platform`, `inject`, `external`, `immediately` are validated fields) | package.json, module scan | the browser half never loads | runtime + read |
| 10 | `__ModuleLoader__.load({ id, factory })`, `id` == package name | `lib/client.js` | bundle loads without registering | test |
| 11 | `PLATFORM_MODULES` seeds React; bundles resolve it through `require("react")` | `lib/client.js` | Hooks break if React is inlined | test |
| 12 | Slot `conversation.session.header.actions` (list, scope session) | the header button | the button disappears | runtime |
| 13 | Slot `settings.general.item` (list, scope root) | the auto-open switch | the switch disappears | runtime |
| 14 | `dsh.bundle.patch` in package.json + a top-level `insert:` array in `cordis.patch.yml` | composition | the plugin row never mounts | runtime |
| 15 | `$DSH_HOME` (default `~/.dsh`) | the state file location | preference not persisted or not found | test |

Rows 9, 12, 13, and 14 need a running DSH with the plugin installed; they are the ones an
adaptation run must exercise by hand.

## Adaptation checklist for a new DSH release

Work through this list and record the outcome in the run log below. Do not mark an item
done without evidence.

1. **Read the DSH changelog** for anything touching the web server, the client module
   system, slots, or the plugin/composition format.
2. **Re-verify rows 1–15** in the new tree. Interface 2, 4, and 11 are the most volatile.
3. **Run the suite**: `npm test`. Green is necessary, not sufficient.
4. **A live pass**: install into a profile, start `dsh web`, and confirm the window opens,
   the header button toggles it, the settings switch persists, and the title bar shows the
   whale.
5. **Update the compatibility matrix** above and, if the supported minimum moved, the
   `peerDependencies` range in `package.json` and the Requirements table in both READMEs.
6. **Update `DEVELOPMENT.md`** if any build, test, or release step changed.
7. **Record the run** in the log below and add a changelog entry.

## Degradation strategy

When a DSH change breaks a contract, prefer these responses in order:

1. **Use the supported replacement API** if DSH ships one (this is what happened to
   `tapIndex` → `webserver/index-inject`).
2. **Guard and degrade**: keep the feature but detect the missing capability and fall back,
   logging once rather than spamming.
3. **Drop the feature** and document it in both READMEs under Known limitations.
4. **Widen the supported range** only after the checklist passes; narrow it instead if the
   interface is gone.

Never pin the plugin to one DSH patch release to avoid adaptation work — the package is
installed by git reference and follows the default branch.

## Using the local DSH source

A full DSH checkout may exist locally for adaptation work. It is a **reference only**:

- it is **not committed** — `.gitignore` ignores the `dsh/` folder;
- it is **not built** and **not run** from this repository;
- never copy code from it into this package; read interfaces and match them.

When the reference checkout is present, the paths worth reading are
`packages/host/webserver/src/index.ts` (routes, injection event), `src/injections.ts`
(head row rendering), `packages/client/modules/src/client/{system,manifest}.ts` (bundle
registration and the `id` rule), and the `slot-catalog`/slot contract sources for the two
slots this plugin claims.

## Adaptation run log

Newest first. Each entry: DSH version, date, what was checked, and the outcome.

### 0.1.5-rc.1 — 2026-09-10 (full re-verification)

- Established the reference point first: the newest DSH is **0.1.5-rc.1**. The npm registry
  reports `latest` and `next` as `0.1.5-rc.1` (and `alpha` as `0.1.5-alpha.2`), the highest
  local tag is `dsh-v0.1.5-rc.1`, and the local checkout's HEAD equals `origin/master` at
  `aa8262ec09`. There is nothing newer to adapt to, so this run re-verified all 15
  interfaces instead of chasing a version.
- Re-verified every row against that tree:
  - **2** — `register(route: WebRoute)` returns a disposer and throws
    `webserver: duplicate <kind> route "<path>"` on a collision (`webserver/src/index.ts`).
  - **4** — the `webserver/index-inject` event and the `{ kind: 'html', placement: 'head' }`
    row are unchanged, and head rows are still spliced after the real `<head>`
    (`webserver/src/injections.ts`).
  - **5** — `get host()` and `get port()` are unchanged.
  - **10** — `manifest.ts` still states "Entry name == package name", `stripClientSuffix`
    unchanged, and `system.ts` still enforces both the duplicate-factory and the
    `loaded without registering "<id>"` checks.
  - **9** — `clientExportOf()` resolves `exports["./client"]` to a string or an object with a
    string `default`, and the client source rules state the scan throws without the export.
    Our string form is accepted.
  - **12/13** — the two slots are unchanged: `conversation.session.header.actions` is
    `{ kind: 'list', scope: 'session' }` and `settings.general.item` is
    `{ kind: 'list', scope: 'root' }`. Registration options are the same
    `{ name, id, order }` we pass.
  - **6/7/8** — `timeout(callback, delay)` is still implemented over `ctx.effect`, so the
    auto-open timer is fibre-scoped; `ctx.on` and `ctx.effect` semantics are unchanged.
- No interface broke and no better replacement API was found, so this release changed no DSH
  interface usage. The changes are platform coverage: browser discovery per platform and a
  POSIX teardown path (see `DEVELOPMENT.md` → Platform abstraction).
- `npm test` green (six suites). Live pass against a running DSH session: **not yet
  performed**.

### 0.1.5-rc.1 — 2026-09-10

- Read interfaces 1–15 in the DSH tree (`host/webserver/src/index.ts`,
  `host/webserver/src/injections.ts`, `client/modules/src/client/{system,manifest}.ts`,
  the two slot contracts, `vendor/timer/src/index.ts`).
- Found and applied one supported-replacement upgrade: the favicon/manifest injection moved
  from `tapIndex` string replacement to the structured `webserver/index-inject` event
  (interface 4), because the string form silently no-ops on a page without a literal
  `</head>`.
- Confirmed the bundle `id` must equal the package name (`manifest.ts`:
  "Entry name == package name"; `stripClientSuffix` only removes a `/client` suffix).
- Confirmed the registration shell is enforced at
  `client/modules/src/client/system.ts` (a bundle that does not register throws
  `loaded without registering "<id>" via __ModuleLoader__.load`).
- `npm test` green. Live pass against a running DSH session: **not yet performed**.

## Related documents

- [`DEVELOPMENT.md`](DEVELOPMENT.md) — architecture, build, test strategy, release process
- [`README.md`](README.md) — the user-facing document
- [`CHANGELOG.md`](CHANGELOG.md) — release history
