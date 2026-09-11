import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const bundle = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

/**
 * `lib/client.js` is a committed build artifact, and its two failure modes are
 * both silent until the page breaks. These guards run without esbuild installed,
 * so a bad rebuild is caught in `npm test` rather than in a browser console.
 */

test('the bundle registers itself through the module loader under the package name', () => {
  assert.match(bundle, /window\.__ModuleLoader__\.load\(\{/)
  // The module graph keys entries by package name; a mismatch fails at boot with
  // `loaded without registering "<id>" via __ModuleLoader__.load`.
  assert.match(bundle, new RegExp('id:\\s*"' + manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'))
  // The factory must build its own module/exports and return them: bare CJS
  // output is not recognised by the loader.
  assert.match(bundle, /factory:\s*\(require\)\s*=>\s*\{/)
  assert.match(bundle, /var module = \{ exports: \{\} \};/)
  assert.match(bundle, /return module\.exports;/)
  assert.match(bundle.trimEnd(), /\}\);\s*$/)
})

test('react stays external instead of being inlined', () => {
  assert.match(bundle, /require\("react"\)/)
  // A bundled React would ship its own internals; any of these markers means a
  // second React is about to break Hooks with `Invalid hook call`.
  for (const marker of ['react-dom', 'react.production', 'Invalid hook call', '__SECRET_INTERNALS']) {
    assert.equal(bundle.includes(marker), false, `bundle contains inlined React marker: ${marker}`)
  }
})

test('the bundle still exports the client plugin body', () => {
  assert.match(bundle, /apply:/)
  assert.match(bundle, /inject:/)
  // The two slots the client half claims must survive a rebuild.
  assert.match(bundle, /conversation\.session\.header\.actions/)
  assert.match(bundle, /settings\.general\.item/)
})
