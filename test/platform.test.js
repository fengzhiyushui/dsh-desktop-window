import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { browserCandidates, SUPPORTED_PLATFORMS, windowTermination } from '../lib/window-spec.js'

/**
 * Platform branches cannot be exercised by running them: this machine is one
 * operating system, and a wrong path list or a missing `taskkill` replacement
 * only shows up on somebody else's machine. Every branch is therefore decided by
 * a pure function that takes the platform as an argument, and these tests drive
 * all of them from here.
 */

const posixJoin = (...parts) => parts.join('/')
const winJoin = (...parts) => parts.join('\\')

test('every supported platform yields at least one candidate and no duplicates', () => {
  for (const platform of SUPPORTED_PLATFORMS) {
    const joinPath = platform === 'win32' ? winJoin : posixJoin
    const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', HOME: '/Users/tester' }
    const candidates = browserCandidates(platform, env, joinPath)
    assert.ok(candidates.length > 0, platform + ' has no browser candidate')
    assert.equal(new Set(candidates).size, candidates.length, platform + ' lists a duplicate candidate')
    for (const candidate of candidates) {
      assert.equal(typeof candidate, 'string')
      assert.ok(candidate.length > 0)
      // A candidate is an absolute path, never a bare name resolved by PATH.
      assert.match(candidate, platform === 'win32' ? /^[A-Za-z]:\\/ : /^\//, platform + ' candidate is not absolute: ' + candidate)
    }
  }
})

test('macOS candidates point inside the app bundles, Edge first then Chrome', () => {
  const candidates = browserCandidates('darwin', { HOME: '/Users/tester' }, posixJoin)
  assert.equal(candidates[0], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  assert.equal(candidates[1], '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
  assert.ok(candidates.includes('/Applications/Chromium.app/Contents/MacOS/Chromium'))
  // The per-user Applications directory is searched too, so a user-scoped
  // install is found without touching the system folder.
  assert.ok(candidates.includes('/Users/tester/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
  // Executables live inside the bundle, never at a bare top-level path.
  assert.ok(candidates.every((path) => path.includes('.app/Contents/MacOS/')))
  assert.equal(candidates.some((path) => path === '/Applications/Google Chrome'), false)
})

test('macOS falls back to system locations when HOME is unavailable', () => {
  for (const env of [{}, { HOME: '' }]) {
    const candidates = browserCandidates('darwin', env, posixJoin)
    assert.ok(candidates.length > 0)
    assert.ok(candidates.every((path) => path.startsWith('/Applications/')))
  }
})

test('linux candidates are the usual distribution executables', () => {
  const candidates = browserCandidates('linux', {}, posixJoin)
  assert.ok(candidates.includes('/usr/bin/google-chrome'))
  assert.ok(candidates.includes('/usr/bin/chromium'))
  assert.ok(candidates.includes('/usr/bin/microsoft-edge'))
  assert.ok(candidates.every((path) => path.startsWith('/')))
})

test('windows candidates keep Edge first and add the per-user installs last', () => {
  const base = browserCandidates('win32', { ProgramFiles: 'P', 'ProgramFiles(x86)': 'X' }, winJoin)
  assert.deepEqual(base, [
    'X\\Microsoft\\Edge\\Application\\msedge.exe',
    'P\\Microsoft\\Edge\\Application\\msedge.exe',
    'P\\Google\\Chrome\\Application\\chrome.exe',
    'X\\Google\\Chrome\\Application\\chrome.exe',
  ])
  const perUser = browserCandidates('win32', { ProgramFiles: 'P', 'ProgramFiles(x86)': 'X', LOCALAPPDATA: 'L' }, winJoin)
  assert.deepEqual(perUser.slice(-2), [
    'L\\Google\\Chrome\\Application\\chrome.exe',
    'L\\Microsoft\\Edge\\Application\\msedge.exe',
  ])
})

test('the default platform is the running one', () => {
  const candidates = browserCandidates()
  assert.ok(candidates.length > 0)
  assert.deepEqual(candidates, browserCandidates(process.platform))
})

test('windows termination uses the process-tree taskkill form', () => {
  const plan = windowTermination(4242, 'win32')
  assert.equal(plan.kind, 'taskkill')
  assert.equal(plan.command, 'taskkill')
  // /T takes the child renderers and /F forces, neither of which process.kill
  // offers on Windows.
  assert.deepEqual(plan.args, ['/PID', '4242', '/T', '/F'])
})

test('POSIX termination asks first and forces only after the grace period', () => {
  for (const platform of ['darwin', 'linux']) {
    const plan = windowTermination(4242, platform)
    assert.equal(plan.kind, 'signal', platform)
    assert.equal(plan.pid, 4242)
    assert.equal(plan.graceful, 'SIGTERM', platform)
    assert.equal(plan.force, 'SIGKILL', platform)
    assert.ok(plan.graceMs > 0)
  }
})

test('a missing or invalid pid is a no-op on every platform', () => {
  for (const platform of [...SUPPORTED_PLATFORMS, 'freebsd']) {
    for (const pid of [undefined, null, 0, -1, 1.5, Number.NaN, '123']) {
      assert.deepEqual(windowTermination(pid, platform), { kind: 'none' }, platform + ' / ' + String(pid))
    }
  }
})

test('an unknown platform still terminates rather than throwing', () => {
  // Better a signal the platform may reject than an exception in the teardown path.
  const plan = windowTermination(7, 'freebsd')
  assert.equal(plan.kind, 'signal')
})

test('the host half keeps every platform decision in window-spec.js', () => {
  // A platform fact inlined here would silently bypass the branches this file
  // tests, and would only fail on the platform nobody ran. The host half may
  // pass process.platform around and may execute a plan; it may not decide one.
  // Comments are stripped first: explaining the Windows branch is legitimate,
  // re-implementing it is not.
  const source = readFileSync(join(import.meta.dirname, '..', 'lib', 'index.js'), 'utf8')
  const host = source
    .replaceAll(/\/\*[\s\S]*?\*\//g, ' ')
    .replaceAll(/(^|[^:])\/\/.*$/gm, '$1')
  const forbidden = [
    { pattern: /\bspawn\(\s*['"`]taskkill/, why: 'the Windows teardown belongs to windowTermination()' },
    // Both spellings of the Windows install root: the environment variable name
    // (`ProgramFiles`, read via process.env) and the path literal
    // (`Program Files`, written out by hand). Either one inlined here bypasses
    // the Windows branch that browserCandidates() covers.
    { pattern: /Program ?Files|LOCALAPPDATA/, why: 'install locations belong to browserCandidates()' },
    { pattern: /\.app[/\\]Contents/, why: 'macOS bundle paths belong to browserCandidates()' },
    { pattern: /process\.platform\s*===/, why: 'branching on the platform belongs in window-spec.js' },
    // The executor may deliver signals, but only to the process the plan names:
    // killing a pid assembled elsewhere is how a bypass starts.
    { pattern: /process\.kill\((?!plan\.pid\b)/, why: 'signals must target plan.pid from windowTermination()' },
  ]
  for (const { pattern, why } of forbidden) {
    assert.equal(pattern.test(host), false, 'lib/index.js matches ' + pattern + ': ' + why)
  }
  // It must still ask window-spec.js for both decisions and execute the plan.
  assert.match(host, /windowTermination\(/)
  assert.match(host, /browserCandidates\(/)
})
