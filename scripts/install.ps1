# DSH 桌面窗口插件 一键安装
# 用法（在 PowerShell 中运行，需联网）：
#   powershell -ExecutionPolicy Bypass -File "D:\person studio\dsh\1\dsh-desktop-window\scripts\install.ps1"
# 完成后请重启你的 dsh web 进程（安装的是组合层，需重启才生效）。

$ErrorActionPreference = 'Stop'

$pluginDir = Split-Path -Parent $PSScriptRoot

Write-Host '== 1/3 检查 pnpm =='
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host '  未找到 pnpm，用 npm 全局安装（安装到用户目录，无需管理员）...'
  npm install -g pnpm
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw 'pnpm 安装失败：请重开终端后重试，或手动执行 npm install -g pnpm'
  }
}
pnpm --version

Write-Host '== 2/3 安装插件到 web profile =='
dsh plugin --profile web add ("file:" + $pluginDir)

Write-Host '== 3/3 校验组合 =='
$env:DSH_HOME_SAVE = $env:DSH_HOME
$dump = dsh --profile web --dump-config 2>&1
$found = $dump | Select-String -Pattern 'dsh-desktop-window' -Quiet
if ($found) {
  Write-Host '  OK：desktop-window 行已进入组合层'
} else {
  Write-Host '  警告：组合层中未找到 desktop-window 行，请检查上面 dsh plugin 的输出'
}

Write-Host ''
Write-Host '安装完成。下一步：'
Write-Host '  1. 关闭当前正在运行的 dsh web（Ctrl+C 或关闭其终端窗口）'
Write-Host '  2. 重新运行：dsh web'
Write-Host '  3. 预期：自动弹出带鲸鱼图标的独立应用窗口；会话头部有「独立窗口」按钮；设置-常规有自动开窗开关'
Write-Host '  4. 创建桌面快捷方式：'
Write-Host '     powershell -ExecutionPolicy Bypass -File "' + $pluginDir + '\scripts\create-shortcut.ps1"'
