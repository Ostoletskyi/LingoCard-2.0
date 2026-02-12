@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PROJECT_ROOT=%SCRIPT_DIR%\.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

set "PS_SCRIPT=%PROJECT_ROOT%\_tools\ps\git_pull_rebase.ps1"
if not exist "%PS_SCRIPT%" (
  echo [ERROR] PowerShell script not found:
  echo         %PS_SCRIPT%
  echo Next step: run TOOLBOX.bat and execute Diagnostics / Self-check.
  exit /b 1
)

echo ================================================
echo LingoCard Rebase Runner
echo Project root: %PROJECT_ROOT%
echo Script: %PS_SCRIPT%
echo ================================================

if /I "%~1"=="--status" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -StatusOnly
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%"
)

set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (
  echo [OK] Rebase flow finished successfully.
) else if "%RC%"=="2" (
  echo [INFO] Operation was cancelled or requires user action.
) else (
  echo [ERROR] Rebase flow failed with code %RC%.
  echo Next step: check logs in _reports\toolbox\YYYY-MM-DD
)

exit /b %RC%
