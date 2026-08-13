@echo off
rem ============================================================
rem  DSH Desktop Window launcher
rem  Double-click to start "dsh web" and auto-open the app window
rem  Usage:
rem    DSH-Desktop.cmd                  use this folder as workspace
rem    DSH-Desktop.cmd "D:\my project"  use given folder as workspace
rem ============================================================
setlocal

if not "%~1"=="" (
  if exist "%~1\" (
    cd /d "%~1"
    shift
  )
)

where dsh >nul 2>nul
if errorlevel 1 (
  echo [DSH] dsh not installed globally, running via npx @deepseek-ai/dsh@0.1.0-rc.6 ...
  npx -y @deepseek-ai/dsh@0.1.0-rc.6 web %*
  exit /b %errorlevel%
)

dsh web %*
