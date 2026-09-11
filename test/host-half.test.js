import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

// Redirect the persisted preference into a throwaway directory *before* the
// plugin module is imported: it resolves its state path at apply() time.
const DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-desktop-window-test-'))
process.env.DSH_HOME = DSH_HOME

const { default: plugin } = await import('../lib/index.js')

/** Minimal Cordis + WebServer stand-in: records registrations, no sockets. */
function createHarness() {
  const exact = new Map()
  const prefixes = new Map()
  const injections = []
  const timers = []
  const cleanups = []
  const webServer = {
    host: '127.0.0.1',
    port: 3080,
    register(route) {
      const table = route.kind === 'exact' ? exact : prefixes
      if (table.has(route.path)) throw new Error('duplicate route ' + route.path)
      table.set(route.path, route.handler)
      return () => table.delete(route.path)
    },
    tapIndex() {
      return () => {}
    },
  }
  const ctx = {
    webServer,
    timeout(callback, delay) {
      timers.push({ callback, delay })
      return () => {}
    },
    on(name, listener) {
      if (name === 'webserver/index-inject') injections.push(listener)
      return () => {}
    },
    effect(factory) {
      cleanups.push(factory())
      return () => {}
    },
  }
  return { ctx, exact, prefixes, injections, timers, cleanups }
}

/** Find a registered handler, preferring an exact route over a prefix route. */
function handlerFor(harness, pathname) {
  const exact = harness.exact.get(pathname)
  if (exact !== undefined) return exact
  for (const [prefix, handler] of harness.prefixes) {
    if (pathname.startsWith(prefix)) return handler
  }
  throw new Error('no route for ' + pathname)
}

/** Drive one registered route with a stub request/response pair. */
async function requestRoute(harness, pathname, options = {}) {
  const handler = handlerFor(harness, pathname)
  const req = {
    method: options.method ?? 'GET',
    url: pathname,
    headers: options.headers ?? { host: '127.0.0.1:3080' },
    async *[Symbol.asyncIterator]() {
      if (options.body !== undefined) yield Buffer.from(options.body, 'utf8')
    },
  }
  const captured = { status: 0, headers: {}, body: Buffer.alloc(0) }
  const res = {
    writeHead(status, headers) {
      captured.status = status
      captured.headers = headers ?? {}
    },
    end(body) {
      if (body !== undefined) captured.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body))
    },
  }
  await handler(req, res)
  return captured
}

/** Collect the head rows this plugin contributes to one index render. */
function collectInjectedHtml(harness) {
  const table = []
  for (const listener of harness.injections) listener(table)
  return table.filter((row) => row.placement === 'head').map((row) => row.html).join('\n')
}

const ICON_ROUTE_FILES = [
  ['/desktop-window/icon-32.png', 'icon-32.png'],
  ['/desktop-window/icon.png', 'icon.png'],
]

test('registers the icon prefix, the manifest, the status and both mutating routes', () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  assert.deepEqual([...harness.prefixes.keys()], ['/desktop-window/'])
  assert.deepEqual([...harness.exact.keys()].sort(), [
    '/desktop-window/manifest.webmanifest',
    '/desktop-window/set-auto',
    '/desktop-window/status',
    '/desktop-window/toggle',
  ])
})

test('contributes one head row with the favicon set and the manifest link', () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const html = collectInjectedHtml(harness)
  assert.match(html, /<link rel="manifest" href="\/desktop-window\/manifest\.webmanifest">/)
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/desktop-window\/icon-32\.png">/)
  // A `<link>`-carrying row is what replaces the old `</head>` string replace.
  assert.equal(html.includes('</head>'), false)
})

test('arms exactly one auto-open timer with a non-zero delay', () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  assert.equal(harness.timers.length, 1)
  assert.equal(typeof harness.timers[0].callback, 'function')
  assert.ok(harness.timers[0].delay > 0)
})

test('serves icon bytes from assets over the prefix route', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  for (const [pathname, file] of ICON_ROUTE_FILES) {
    const response = await requestRoute(harness, pathname)
    assert.equal(response.status, 200, pathname)
    assert.equal(response.headers['content-type'], 'image/png')
    assert.deepEqual(response.body, readFileSync(join(import.meta.dirname, '..', 'assets', file)))
  }
})

test('answers 404 for an unknown or nested icon path', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  for (const pathname of ['/desktop-window/missing.png', '/desktop-window/nested/icon-32.png']) {
    const response = await requestRoute(harness, pathname)
    assert.equal(response.status, 404, pathname)
  }
})

test('serves the installable-app manifest', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const response = await requestRoute(harness, '/desktop-window/manifest.webmanifest')
  assert.equal(response.status, 200)
  assert.equal(response.headers['content-type'], 'application/manifest+json; charset=utf-8')
  const manifest = JSON.parse(response.body.toString('utf8'))
  assert.equal(manifest.display, 'standalone')
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512'])
})

test('reports the closed state and the default auto-open preference', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const response = await requestRoute(harness, '/desktop-window/status')
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body.toString('utf8')), { open: false, auto: true })
})

test('rejects a cross-site toggle before touching the window', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const response = await requestRoute(harness, '/desktop-window/toggle', {
    method: 'POST',
    headers: { host: '127.0.0.1:3080', origin: 'https://evil.example' },
    body: '{}',
  })
  assert.equal(response.status, 403)
  assert.equal(JSON.parse(response.body.toString('utf8')).ok, false)
})

test('rejects a non-POST toggle with 405', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const response = await requestRoute(harness, '/desktop-window/toggle', { method: 'GET' })
  assert.equal(response.status, 405)
})

test('persists the auto-open preference to $DSH_HOME/desktop-window.json', async () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  const off = await requestRoute(harness, '/desktop-window/set-auto', {
    method: 'POST',
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' },
    body: JSON.stringify({ auto: false }),
  })
  assert.equal(off.status, 200)
  assert.deepEqual(JSON.parse(off.body.toString('utf8')), { auto: false })
  const saved = JSON.parse(readFileSync(join(DSH_HOME, 'desktop-window.json'), 'utf8'))
  assert.equal(saved.autoOpen, false)

  // A BOM (what Notepad writes) must not break the next read.
  const bomHarness = createHarness()
  plugin.apply(bomHarness.ctx)
  const read = await requestRoute(bomHarness, '/desktop-window/status')
  assert.equal(JSON.parse(read.body.toString('utf8')).auto, false)
})

test('releases every route on unload', () => {
  const harness = createHarness()
  plugin.apply(harness.ctx)
  assert.equal(harness.cleanups.length, 1)
  harness.cleanups[0]()
  assert.equal(harness.prefixes.size, 0)
  assert.equal(harness.exact.size, 0)
})

test.after(() => {
  rmSync(DSH_HOME, { recursive: true, force: true })
})
