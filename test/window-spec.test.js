import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  faviconLinks,
  ICON_FILES,
  iconNameForPath,
  MANIFEST_ICONS,
  manifestBody,
  windowFlags,
} from '../lib/window-spec.js'

test('favicon links cover every icon except the manifest-only ones', () => {
  const links = faviconLinks()
  const listed = [...links.matchAll(/href="\/desktop-window\/([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(listed, Object.keys(ICON_FILES).filter((name) => !MANIFEST_ICONS.includes(name)))
  assert.equal(links.includes('icon-192.png'), false)
  assert.equal(links.includes('icon-512.png'), false)
  // One <link> per line, each carrying its declared size.
  assert.equal(links.split('\n').length, listed.length)
  assert.match(links, /sizes="256x256" href="\/desktop-window\/icon\.png"/)
})

test('manifest lists exactly the installable-app icons', () => {
  const manifest = JSON.parse(manifestBody())
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.deepEqual(manifest.icons, [
    { src: '/desktop-window/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/desktop-window/icon-512.png', sizes: '512x512', type: 'image/png' },
  ])
})

test('the icon route resolves plain names and refuses anything nested or unknown', () => {
  assert.equal(iconNameForPath('/desktop-window/icon-32.png'), 'icon-32.png')
  assert.equal(iconNameForPath('/desktop-window/manifest.webmanifest'), 'manifest.webmanifest')
  assert.equal(iconNameForPath('/desktop-window/'), '')
  assert.equal(iconNameForPath('/other/icon-32.png'), undefined)
  assert.equal(iconNameForPath('/desktop-window/nested/icon-32.png'), undefined)
  assert.equal(iconNameForPath('/desktop-window/../secrets.txt'), undefined)
})

test('window flags pin the app URL and the dedicated profile', () => {
  const flags = windowFlags('http://127.0.0.1:3080', 'C:\\Temp\\dsh-desktop-window')
  assert.ok(flags.includes('--app=http://127.0.0.1:3080'))
  assert.ok(flags.includes('--user-data-dir=C:\\Temp\\dsh-desktop-window'))
  // No address bar / no tab strip: this must stay an app window.
  assert.equal(flags.some((flag) => flag.startsWith('--app=')), true)
  assert.equal(flags.includes('--no-first-run'), true)
})

test('window flags carry no platform-specific option', () => {
  // Every flag must be accepted by Chromium on every platform: a flag such as
  // --class is rejected on macOS, and an unknown flag can abort the launch.
  const portable = [
    '--app=',
    '--user-data-dir=',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    '--window-size=',
  ]
  for (const flag of windowFlags('http://127.0.0.1:3080', '/tmp/dsh-desktop-window')) {
    assert.ok(portable.some((prefix) => flag.startsWith(prefix)), 'not portable: ' + flag)
  }
})
