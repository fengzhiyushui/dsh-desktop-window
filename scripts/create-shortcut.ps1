# 创建「DSH 桌面窗口」桌面快捷方式（鲸鱼图标）
# 用法（在 PowerShell 中运行）：
#   powershell -ExecutionPolicy Bypass -File "D:\person studio\dsh\1\dsh-desktop-window\scripts\create-shortcut.ps1"
# 可选参数：目标工作区目录（快捷方式启动后的默认会话工作区）

param(
  [string]$WorkspaceDir = ""
)

$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSScriptRoot
$launcher  = Join-Path $pluginDir 'DSH-Desktop.cmd'
$iconPath  = Join-Path $pluginDir 'assets\icon.ico'

if (-not (Test-Path $launcher)) { throw "未找到启动器：$launcher" }
if (-not (Test-Path $iconPath)) { throw "未找到图标：$iconPath" }

$target = '"' + $launcher + '"'
if ($WorkspaceDir -ne '') {
  $full = (Resolve-Path $WorkspaceDir).Path
  $target = $target + ' "' + $full + '"'
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'DSH 桌面窗口.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $launcher
if ($WorkspaceDir -ne '') { $shortcut.Arguments = '"' + $full + '"' }
$shortcut.WorkingDirectory = $pluginDir
$shortcut.IconLocation = $iconPath + ',0'
$shortcut.Description = 'DeepSeek Harness 桌面窗口（自动以独立应用窗口打开）'
$shortcut.Save()

Write-Output ("快捷方式已创建：$lnkPath")
Write-Output ('目标：' + $target)
Write-Output ('图标：' + $iconPath)
