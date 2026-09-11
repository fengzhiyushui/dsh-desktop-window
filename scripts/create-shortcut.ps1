# Create the "DSH Desktop Window" desktop shortcut (whale icon).
# Run from any directory; paths are derived from this script's own location:
#
#   powershell -ExecutionPolicy Bypass -File "<plugin-dir>\scripts\create-shortcut.ps1"
#
# Optional: -WorkspaceDir <dir> sets the default session workspace the shortcut
# opens in. Without it, the shortcut uses this plugin folder as the workspace.

param(
  [string]$WorkspaceDir = ""
)

$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSScriptRoot
$launcher  = Join-Path $pluginDir 'DSH-Desktop.cmd'
$iconPath  = Join-Path $pluginDir 'assets\icon.ico'

if (-not (Test-Path -LiteralPath $launcher)) { throw "launcher not found: $launcher" }
if (-not (Test-Path -LiteralPath $iconPath)) { throw "icon not found: $iconPath" }

if ($WorkspaceDir -ne '') {
  if (-not (Test-Path -LiteralPath $WorkspaceDir)) { throw "workspace not found: $WorkspaceDir" }
  $WorkspaceDir = (Resolve-Path -LiteralPath $WorkspaceDir).Path
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'DSH Desktop Window.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $launcher
if ($WorkspaceDir -ne '') { $shortcut.Arguments = '"' + $WorkspaceDir + '"' }
$shortcut.WorkingDirectory = $pluginDir
$shortcut.IconLocation = $iconPath + ',0'
$shortcut.Description = 'DeepSeek Harness desktop window (opens as a standalone app window)'
$shortcut.Save()

Write-Output ("Shortcut created: $lnkPath")
Write-Output ("Target:  $launcher")
if ($WorkspaceDir -ne '') { Write-Output ("Arguments: `"$WorkspaceDir`"") }
Write-Output ("Icon:    $iconPath")
