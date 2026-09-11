/**
 * Pure, dependency-free decisions shared by the host half and its tests.
 * Nothing here touches the filesystem, the network, or Cordis, so the icon and
 * manifest contract plus every platform branch can be verified with plain
 * `node --test` — no DSH install, no browser, and no second operating system.
 */

/**
 * Served icon table: request name -> declared `sizes` attribute. Every file here
 * is served from `/desktop-window/<name>` and read from `assets/`.
 */
export const ICON_FILES = {
  'icon.png': '256x256',
  'icon-128.png': '128x128',
  'icon-64.png': '64x64',
  'icon-32.png': '32x32',
  'icon-16.png': '16x16',
  'icon-192.png': '192x192',
  'icon-512.png': '512x512',
}

/**
 * Icons that belong to the web manifest and must stay out of the favicon
 * `<link>` list: the browser picks the best PNG for the tab itself.
 */
export const MANIFEST_ICONS = ['icon-192.png', 'icon-512.png']

/** The serve route prefix that owns every icon and the manifest. */
export const ICON_ROUTE_PREFIX = '/desktop-window/'

/** Platforms this plugin has an explicit launch strategy for. */
export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux']

/**
 * Chromium executables to try, in order, for one platform.
 *
 * Every row is a Chromium-based browser that accepts `--app`, which is the whole
 * mechanism this plugin relies on. The order is the preference order: Edge first
 * on Windows, Chrome first elsewhere, matching what each platform ships or what
 * users most often install.
 *
 * @param platform - `process.platform` value ('win32', 'darwin', 'linux').
 * @param env - environment to read install locations from (defaults to process.env).
 * @param joinPath - path joiner, injected so any platform's list is testable anywhere.
 * @returns absolute candidate paths, most preferred first.
 */
export function browserCandidates(platform = process.platform, env = process.env, joinPath = defaultJoin(platform)) {
  const home = env['HOME'] ?? env['USERPROFILE'] ?? ''
  const userApps = home === '' ? [] : [joinPath(home, 'Applications')]

  if (platform === 'darwin') {
    // macOS ships a per-user Applications directory, and the executable lives
    // inside the bundle rather than at a top-level path.
    return [
      ...bundlePaths('/Applications', ['Google Chrome', 'Microsoft Edge', 'Chromium', 'Brave Browser', 'Vivaldi'], joinPath),
      ...userApps.flatMap((dir) => bundlePaths(dir, ['Google Chrome', 'Microsoft Edge', 'Chromium'], joinPath)),
    ]
  }

  if (platform === 'linux') {
    // Distributions disagree on the executable name, so list the common ones.
    return [
      '/usr/bin/google-chrome',
      '/usr/bin/microsoft-edge',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/brave-browser',
      '/snap/bin/chromium',
    ]
  }

  // win32: a machine-wide install sits under Program Files, and a per-user
  // install under LOCALAPPDATA, which the fixed paths alone would miss.
  const programFiles = env['ProgramFiles'] ?? 'C:\\Program Files'
  const programFilesX86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const localAppData = env['LOCALAPPDATA']
  const candidates = [
    joinPath(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    joinPath(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    joinPath(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    joinPath(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  if (localAppData !== undefined && localAppData !== '') {
    candidates.push(joinPath(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    candidates.push(joinPath(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
  }
  return candidates
}

/**
 * How the host half ends the window process tree.
 *
 * Windows has no signal semantics for `process.kill` — Node terminates the target
 * outright — so the process tree is torn down with `taskkill /T /F` instead. On
 * POSIX systems the browser is asked to exit first (SIGTERM) and only forced
 * (SIGKILL) when it does not, which is also how the launched Chromium takes its
 * own renderer and GPU child processes with it.
 *
 * @param pid - the launched browser process; a non-positive or missing pid is a no-op.
 * @param platform - `process.platform` value.
 * @param graceMs - how long SIGTERM gets before SIGKILL on POSIX platforms.
 * @returns the plan to execute, or a no-op when there is nothing to end.
 */
export function windowTermination(pid, platform = process.platform, graceMs = 2000) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return { kind: 'none' }
  if (platform === 'win32') {
    return { kind: 'taskkill', command: 'taskkill', args: ['/PID', String(pid), '/T', '/F'] }
  }
  return { kind: 'signal', pid, graceful: 'SIGTERM', force: 'SIGKILL', graceMs }
}

/** Map a request pathname to a served icon name, or undefined when it is not one. */
export function iconNameForPath(pathname) {
  if (!pathname.startsWith(ICON_ROUTE_PREFIX)) return undefined
  const name = pathname.slice(ICON_ROUTE_PREFIX.length)
  return name.includes('/') ? undefined : name
}

/**
 * Favicon `<link>` tags for every served size, in table order. Manifest-only
 * icons are excluded so the tab icon and the installable-app icon stay distinct.
 * @returns one `<link>` per line, or '' when nothing is servable.
 */
export function faviconLinks(iconFiles = ICON_FILES, manifestIcons = MANIFEST_ICONS) {
  return Object.entries(iconFiles)
    .filter(([name]) => !manifestIcons.includes(name))
    .map(([name, sizes]) => `<link rel="icon" type="image/png" sizes="${sizes}" href="${ICON_ROUTE_PREFIX}${name}">`)
    .join('\n')
}

/**
 * The web manifest body. It is what makes "Install this site as an app" produce
 * the whale icon in the taskbar (Windows) or the Dock (macOS), which is the
 * reliable path when the window itself cannot carry the icon.
 * @returns JSON text served as `application/manifest+json`.
 */
export function manifestBody(iconFiles = ICON_FILES, manifestIcons = MANIFEST_ICONS) {
  return JSON.stringify({
    name: 'DeepSeek Harness',
    short_name: 'DSH',
    start_url: '/',
    display: 'standalone',
    icons: manifestIcons.map((name) => ({
      src: ICON_ROUTE_PREFIX + name,
      sizes: iconFiles[name],
      type: 'image/png',
    })),
  })
}

/** Browser launch flags shared by every Chromium candidate, on every platform. */
export function windowFlags(url, profile) {
  return [
    '--app=' + url,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    '--window-size=1440,900',
  ]
}

/** macOS bundle executables for the given app names, in preference order. */
function bundlePaths(applicationsDir, appNames, joinPath) {
  return appNames.map((app) =>
    joinPath(applicationsDir, app + '.app', 'Contents', 'MacOS', app))
}

/** Path joiner matching one platform's separator. */
function defaultJoin(platform) {
  const separator = platform === 'win32' ? '\\' : '/'
  return (...parts) => parts.join(separator)
}
