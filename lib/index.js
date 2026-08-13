import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ICON_DIR = join(HERE, '..', 'assets')
const EDGE_PROFILE_DIR = join(tmpdir(), 'dsh-desktop-window-edge-profile')

const ICON_FILES = {
  'icon.png': '256x256',
  'icon-128.png': '128x128',
  'icon-64.png': '64x64',
  'icon-32.png': '32x32',
  'icon-16.png': '16x16',
  'icon-192.png': '192x192',
  'icon-512.png': '512x512',
}

const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

function resolveBrowser() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('no supported browser found (Edge/Chrome)')
}

function killTree(pid) {
  if (pid === undefined) return
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } catch {
    /* best effort */
  }
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

/** 同源校验：拒绝其他网页跨站调用本插件的操作路由（状态读取无副作用，不受限）。 */
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
    let openedSeq = 0
    let disposed = false

    const icons = new Map()
    for (const name of Object.keys(ICON_FILES)) {
      try {
        icons.set(name, readFileSync(join(ICON_DIR, name)))
      } catch {
        /* 图标缺失时跳过，窗口沿用浏览器默认图标 */
      }
    }

    // 自动开窗开关持久化：$DSH_HOME/desktop-window.json（兼容记事本写入的 UTF-8 BOM）
    const statePath = join(dshHome(), 'desktop-window.json')
    try {
      const text = readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '')
      const saved = JSON.parse(text)
      if (typeof saved.autoOpen === 'boolean') autoOpen = saved.autoOpen
      console.log('[desktop-window] state loaded from ' + statePath + ': autoOpen=' + autoOpen)
    } catch (error) {
      console.log('[desktop-window] no state at ' + statePath + ' (' + String(error && error.code ? error.code : error) + '), default autoOpen=true')
    }
    function persistAuto() {
      try {
        mkdirSync(dirname(statePath), { recursive: true })
        writeFileSync(statePath, JSON.stringify({ autoOpen }))
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
      mkdirSync(EDGE_PROFILE_DIR, { recursive: true })
      const seq = ++openedSeq
      const child = spawn(executable, [
        '--app=' + url,
        '--user-data-dir=' + EDGE_PROFILE_DIR,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-mode',
        '--window-size=1440,900',
      ], { cwd: EDGE_PROFILE_DIR, stdio: 'ignore' })
      handle = child
      console.log('[desktop-window] opened:', url, 'pid=' + child.pid)
      // 任务栏图标：拉起常驻助手，把官方鲸鱼 icon.ico 设为窗口大/小图标
      const iconHelperPath = join(HERE, '..', 'scripts', 'set-window-icon.ps1')
      const iconIcoPath = join(ICON_DIR, 'icon.ico')
      if (existsSync(iconHelperPath) && existsSync(iconIcoPath)) {
        try {
          const helper = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', iconHelperPath,
            '-Pid', String(child.pid),
            '-IconPath', iconIcoPath,
          ], { stdio: 'ignore', windowsHide: true })
          helper.unref()
          helper.once('error', () => {})
          child._iconHelper = helper
        } catch {
          /* 图标助手失败不影响窗口本身 */
        }
      }
      const settle = (code, signal) => {
        if (seq === openedSeq && handle === child) handle = null
        console.log('[desktop-window] exited: code=' + code + ' signal=' + signal)
      }
      child.once('exit', settle)
      child.once('error', (error) => {
        console.error('[desktop-window] spawn error:', error)
        if (handle === child) handle = null
      })
      return { ok: true, open: true }
    }

    function closeWindow() {
      if (handle === null) return { ok: true, open: false, note: 'not-open' }
      const child = handle
      handle = null
      killTree(child.pid)
      if (child._iconHelper !== undefined) {
        try {
          child._iconHelper.kill()
        } catch {
          /* 助手可能已随窗口退出 */
        }
      }
      return { ok: true, open: false }
    }

    // ── HTTP 表面 ────────────────────────────────────────────────
    const disposers = []
    if (icons.size > 0) {
      disposers.push(ws.register({
        kind: 'prefix',
        path: '/desktop-window/',
        handler: (req, res) => {
          const pathname = new URL(req.url ?? '/', 'http://x').pathname
          const name = pathname.slice('/desktop-window/'.length)
          const bytes = icons.get(name)
          if (bytes === undefined) {
            res.writeHead(404)
            res.end()
            return
          }
          res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' })
          res.end(bytes)
        },
      }))
      const links = [...icons.entries()]
        .filter(([name]) => ICON_FILES[name] !== undefined && !name.startsWith('icon-19') && !name.startsWith('icon-51'))
        .map(([name]) => `<link rel="icon" type="image/png" sizes="${ICON_FILES[name]}" href="/desktop-window/${name}">`)
        .join('\n')
      const manifestLink = '<link rel="manifest" href="/desktop-window/manifest.webmanifest">'
      disposers.push(ws.tapIndex((html) => {
        if (!html.includes('</head>')) return html
        return html.replace('</head>', manifestLink + '\n' + links + '\n</head>')
      }))
    }
    disposers.push(ws.register({
      kind: 'exact',
      path: '/desktop-window/manifest.webmanifest',
      handler: (req, res) => {
        const manifest = JSON.stringify({
          name: 'DeepSeek Harness',
          short_name: 'DSH',
          start_url: '/',
          display: 'standalone',
          icons: [
            { src: '/desktop-window/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/desktop-window/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        })
        res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8' })
        res.end(manifest)
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

    // ── 自动开窗（服务器已就绪，稍等静态资源挂载后再开） ──────
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
      }, 800)
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
        const child = handle
        killTree(child.pid)
        if (child._iconHelper !== undefined) {
          try {
            child._iconHelper.kill()
          } catch {
            /* 助手可能已随窗口退出 */
          }
        }
        handle = null
      }
    }, 'desktop-window')
  },
}
