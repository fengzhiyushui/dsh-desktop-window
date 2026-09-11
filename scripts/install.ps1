# DSH desktop-window plugin: one-shot installer.
# Run from any directory; every path is derived from this script's own location:
#
#   powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\install.ps1"
#
# Afterwards restart your `dsh web` process: this installs a bundle, and bundle
# membership is read at startup.

$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSScriptRoot

Write-Host '== 1/3 check pnpm =='
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host '  pnpm not found; installing it globally with npm (user scope, no admin needed)...'
  npm install -g pnpm
  # A fresh global install lands in a directory this process may not have on
  # PATH yet, so re-read PATH before deciding it failed.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw 'pnpm install failed: reopen the terminal and retry, or run: npm install -g pnpm'
  }
}
pnpm --version

# `dsh plugin` forwards its arguments through a shell, and a workspace path
# containing spaces gets re-split, producing ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER.
# Install through a space-free directory junction instead.
$installFrom = $pluginDir
$junction = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-desktop-window'
$createdJunction = $false
if ($pluginDir -match '\s') {
  Write-Host "  plugin path contains spaces; installing through a junction at $junction"
  if (Test-Path -LiteralPath $junction) {
    # A junction lists no contents and can be removed non-recursively, so this is
    # safe even if something else already occupies the name.
    if ((Get-Item -LiteralPath $junction).LinkType) {
      (Get-Item -LiteralPath $junction).Delete()
    } else {
      throw "refusing to replace ${junction}: it exists and is not a junction. Remove it and retry."
    }
  }
  New-Item -ItemType Junction -Path $junction -Target $pluginDir | Out-Null
  $createdJunction = $true
  $installFrom = $junction
}

try {
  Write-Host '== 2/3 install the plugin into the web profile =='
  dsh plugin --profile web add ("file:" + $installFrom)

  Write-Host '== 3/3 verify the composition =='
  $dump = dsh --profile web --dump-config 2>&1
  if ($dump | Select-String -Pattern 'dsh-desktop-window' -Quiet) {
    Write-Host '  OK: the desktop-window row is in the composition layer'
  } else {
    Write-Host '  WARNING: no desktop-window row found in the composition; check the dsh plugin output above'
  }
} finally {
  if ($createdJunction -and (Test-Path -LiteralPath $junction)) {
    (Get-Item -LiteralPath $junction).Delete()
  }
}

Write-Host ''
Write-Host 'Installed. Next steps:'
Write-Host '  1. Stop the running `dsh web` (Ctrl+C or close its terminal window)'
Write-Host '  2. Start it again: dsh web'
Write-Host '  3. Expected: a standalone app window opens automatically with the whale icon;'
Write-Host '     the session header has a window button and Settings > General has the auto-open switch'
Write-Host '  4. Optional desktop shortcut:'
Write-Host ('     powershell -ExecutionPolicy Bypass -File "' + $pluginDir + '\scripts\create-shortcut.ps1"')
