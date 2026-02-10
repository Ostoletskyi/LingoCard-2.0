@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM ============================================================
REM LingoCard 2.0 - Git Toolbox Launcher
REM - Forces running as Administrator (UAC)
REM - Delegates logic to PowerShell 5.1 script: _tools\ps\repo.ps1
REM ============================================================

set "ROOT=%~dp0"
set "PS1=%ROOT%_tools\ps\repo.ps1"

if not exist "%PS1%" (
  echo [ERROR] Missing script: %PS1%
  pause
  exit /b 1
)

REM --- Check admin rights
net session >nul 2>&1
if errorlevel 1 (
  echo [INFO] Elevating to Administrator...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%~f0' -WorkingDirectory '%CD%' -Verb RunAs"
  exit /b
)

REM --- Run toolbox
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%CD%"
exit /b %ERRORLEVEL%
