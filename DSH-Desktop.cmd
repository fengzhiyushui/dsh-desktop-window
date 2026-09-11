@echo off
rem ============================================================
rem  DSH Desktop Window launcher
rem  Double-click to start "dsh web" and auto-open the app window.
rem
rem  Usage:
rem    DSH-Desktop.cmd                  use this folder as the workspace
rem    DSH-Desktop.cmd "D:\my project"  use the given folder as the workspace
rem
rem  Environment:
rem    DSH_DESKTOP_DSH_VERSION   version to run via npx when `dsh` is not on
rem                              PATH (default: latest)
rem ============================================================
setlocal

if not "%~1"=="" (
  if exist "%~1\" (
    cd /d "%~1"
    shift
  )
)

where dsh >nul 2>nul
if not errorlevel 1 (
  dsh web %*
  exit /b %errorlevel%
)

if "%DSH_DESKTOP_DSH_VERSION%"=="" (
  echo [DSH] dsh is not on PATH; running the latest release via npx...
  echo [DSH] Set DSH_DESKTOP_DSH_VERSION to pin a version, e.g. 0.1.5-rc.1
  npx -y @deepseek-ai/dsh@latest web %*
) else (
  echo [DSH] dsh is not on PATH; running @deepseek-ai/dsh@%DSH_DESKTOP_DSH_VERSION% via npx...
  npx -y @deepseek-ai/dsh@%DSH_DESKTOP_DSH_VERSION% web %*
)
exit /b %errorlevel%
