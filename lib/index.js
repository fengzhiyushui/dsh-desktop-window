import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  browserCandidates,
  faviconLinks,
  ICON_FILES,
  iconNameForPath,
  manifestBody,
  windowFlags,
  windowTermination,
} from './window-spec.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ICON_DIR = join(HERE, '..', 'assets')

/**
 * Delay between plugin activation and the automatic window. `dsh web` is already
 * listening when this plugin mounts (it injects `webServer`), so this is not a
 * readiness wait 鈥?it lets the served page settle so the window's first paint is
 * the real UI instead of a blank frame. Raise it on a slow machine.
 */
const AUTO_OPEN_DELAY_MS = 800

/** Dedicated browser profile: keeps the app window out of the user's normal profile. */
const PROFILE_DIR_NAME = 'dsh-desktop-window'

function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

function profileDir() {
  return join(tmpdir(), PROFILE_DIR_NAME)
}

function resolveBrowser() {
  for (const candidate of browserCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    'no supported browser found for ' + process.platform + ' (Edge/Chrome/Chromium); '
    + 'install one or edit browserCandidates()',
  )
}

/** Grace period between the polite and the forced signal on POSIX platforms. */
const FORCE_KILL_DELAY_MS = 2000

/**
 * End the window process tree.
 *
 * The plan is decided in `windowTermination()` so every platform's branch is
 * unit-tested; this function only executes it. Windows uses `taskkill /T /F`
 * because `process.kill` there ignores signal semantics; POSIX platforms send
 * SIGTERM and escalate to SIGKILL, which is also what lets the launched Chromium
 * shut down its own renderer and GPU child processes cleanly.
 */
function terminateWindow(pid) {
  const plan = windowTermination(pid, process.platform, FORCE_KILL_DELAY_MS)
  if (plan.kind === 'none') return
  if (plan.kind === 'taskkill') {
    try {
      spawn(plan.command, plan.args, { stdio: 'ignore', windowsHide: true })
    } catch {
      /* best effort: the window may already be gone */
    }
    return
  }
  try {
    process.kill(plan.pid, plan.graceful)
  } catch {
    /* ESRCH: already exited */
    return
  }
  const force = setTimeout(() => {
    try {
      process.kill(plan.pid, plan.force)
    } catch {
      /* exited within the grace period */
    }
  }, plan.graceMs)
  // Do not hold the process open just to escalate a kill.
  force.unref?.()
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

/** Same-origin check: rejects cross-site calls to this plugin's mutating routes. */
function sameAuthority(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true
  const authority = req.headers.host ?? ''
  return origin === 'http://' + authority || origin === 'https://' + authority
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4096) throw new Error('body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text === '' ? {} : JSON.parse(text)
}

export default {
  name: 'desktop-window',
  inject: ['timer', 'webServer'],
  apply(ctx) {
    const ws = ctx.webServer
    let handle = null
    let autoOpen = true
    /** Delete the dedicated browser profile when the plugin unloads. */
    let cleanProfile = false
    let openedSeq = 0
    let disposed = false

    const icons = new Map()
    for (const name of Object.keys(ICON_FILES)) {
      try {
        icons.set(name, readFileSync(join(ICON_DIR, name)))
      } catch {
        /* a missing icon is skipped; the window keeps the browser default */
      }
    }

    // Auto-open preference, persisted to $DSH_HOME/desktop-window.json.
    // The BOM strip keeps hand edits from Notepad valid.
    const statePath = join(dshHome(), 'desktop-window.json')
    try {
      const text = readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '')
      const saved = JSON.parse(text)
      if (typeof saved.autoOpen === 'boolean') autoOpen = saved.autoOpen
      if (typeof saved.cleanProfileOnUnload === 'boolean') cleanProfile = saved.cleanProfileOnUnload
      console.log('[desktop-window] state loaded from ' + statePath + ': autoOpen=' + autoOpen)
    } catch (error) {
      console.log('[desktop-window] no state at ' + statePath + ' (' + String(error && error.code ? error.code : error) + '), default autoOpen=true')
    }
    function persistAuto() {
      try {
        mkdirSync(dirname(statePath), { recursive: true })
        writeFileSync(statePath, JSON.stringify({ autoOpen, cleanProfileOnUnload: cleanProfile }))
      } catch (error) {
        console.error('[desktop-window] persist failed:', error)
      }
    }

    function baseUrl() {
      const host = ws.host === '0.0.0.0' ? '127.0.0.1' : ws.host
      const port = ws.port
      if (port === undefined || port === null) return null
      return 'http://' + host + ':' + String(port)
    }

    function openWindow(url) {
      if (handle !== null) return { ok: true, open: true, note: 'already-open' }
      const executable = resolveBrowser()
      const profile = profileDir()
      mkdirSync(profile, { recursive: true })
      const seq = ++openedSeq
      const child = spawn(executable, windowFlags(url, profile), { cwd: profile, stdio: 'ignore' })
      handle = child
      console.log('[desktop-window] opened:', url, 'pid=' + child.pid)

      const settle = (code, signal) => {
        if (seq === openedSeq && handle === child) handle = null
        console.log('[desktop-window] exited: code=' + code + ' signal=' + signal)
      }
      child.once('exit', settle)
      child.once('error', (error) => {
        console.error('[desktop-window] spawn error:', error)
        if (seq === openedSeq && handle === child) handle = null
      })
      return { ok: true, open: true }
    }

    function closeWindow() {
      if (handle === null) return { ok: true, open: false, note: 'not-open' }
      const child = handle
      handle = null
      terminateWindow(child.pid)
      return { ok: true, open: false }
    }

    // 鈹€鈹€ HTTP surface 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    const disposers = []
    if (icons.size > 0) {
      disposers.push(ws.register({
        kind: 'prefix',
        path: '/desktop-window/',
        handler: (req, res) => {
          const pathname = new URL(req.url ?? '/', 'http://x').pathname
          const name = iconNameForPath(pathname)
          const bytes = name === undefined ? undefined : icons.get(name)
          if (bytes === undefined) {
            res.writeHead(404)
            res.end()
            return
          }
          res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' })
          res.end(bytes)
        },
      }))
      // Structured head injection, not a `tapIndex` string replace: the web
      // server splices head rows after the real <head> tag and prepends them on
      // a fragment without one, so the favicon does not depend on the page
      // keeping a literal `</head>`. ctx.on is effect-scoped: unloading removes it.
      ctx.on('webserver/index-inject', (table) => {
        table.push({
          kind: 'html',
          placement: 'head',
          html: '<link rel="manifest" href="/desktop-window/manifest.webmanifest">\n' + faviconLinks(),
        })
      })
    }
    disposers.push(ws.register({
      kind: 'exact',
      path: '/desktop-window/manifest.webmanifest',
      handler: (req, res) => {
        res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8' })
        res.end(manifestBody())
      },
    }))
    disposers.push(ws.register({
      kind: 'exact',
      path: '/desktop-window/status',
      handler: (req, res) => {
        sendJson(res, 200, { open: handle !== null, auto: autoOpen })
      },
    }))
    const guard = (handler) => async (req, res) => {
      if (!sameAuthority(req)) {
        sendJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      try {
        await handler(req, res)
      } catch (error) {
        console.error('[desktop-window] route error:', error)
        sendJson(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    }
    disposers.push(ws.register({
      kind: 'exact',
      path: '/desktop-window/toggle',
      handler: guard(async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false })
          return
        }
        if (handle !== null) {
          sendJson(res, 200, closeWindow())
          return
        }
        const url = baseUrl()
        if (url === null) {
          sendJson(res, 503, { ok: false, open: false, error: 'server not ready' })
          return
        }
        sendJson(res, 200, openWindow(url))
      }),
    }))
    disposers.push(ws.register({
      kind: 'exact',
      path: '/desktop-window/set-auto',
      handler: guard(async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false })
          return
        }
        const body = await readJsonBody(req)
        if (typeof body.auto === 'boolean') {
          autoOpen = body.auto
          persistAuto()
        }
        sendJson(res, 200, { auto: autoOpen })
      }),
    }))

    // 鈹€鈹€ Auto-open 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    // ctx.timeout is an effect: the timer is cleared if the plugin unloads first.
    if (autoOpen) {
      ctx.timeout(() => {
        if (disposed || handle !== null) return
        const url = baseUrl()
        if (url === null) return
        try {
          openWindow(url)
        } catch (error) {
          console.error('[desktop-window] auto-open failed:', error)
        }
      }, AUTO_OPEN_DELAY_MS)
    }

    ctx.effect(() => () => {
      disposed = true
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          /* already disposed */
        }
      }
      if (handle !== null) {
        terminateWindow(handle.pid)
        handle = null
      }
      if (cleanProfile) {
        try {
          rmSync(profileDir(), { recursive: true, force: true })
        } catch (error) {
          console.error('[desktop-window] profile cleanup failed:', error)
        }
      }
    }, 'desktop-window')
  },
}
