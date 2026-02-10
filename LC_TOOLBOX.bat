@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem LingoCard 2.0 Toolbox (Windows CMD)
rem Keep this file ASCII (no UTF-8 BOM) to avoid garbled output in cmd.exe.

title LingoCard 2.0 - Toolbox

set "ROOT=%~dp0"
pushd "%ROOT%" >nul

call :requireTool git
if errorlevel 1 goto :end
call :requireTool node
if errorlevel 1 goto :end
call :requireTool npm
if errorlevel 1 goto :end

:main
cls
echo ==============================================
echo              LingoCard 2.0 Toolbox
echo ==============================================
echo Project root: %CD%
echo.
echo [1] Backup
echo [2] Git + Smoke
echo [3] Start dev server
echo [0] Exit
echo ----------------------------------------------
set "CHOICE="
set /p "CHOICE=Select option: "
if "%CHOICE%"=="1" goto :menu_backup
if "%CHOICE%"=="2" goto :menu_git
if "%CHOICE%"=="3" goto :run_dev
if "%CHOICE%"=="0" goto :end
goto :main

:menu_backup
cls
echo ==============================================
echo                    Backup
echo ==============================================
echo [1] Create backup
echo [2] Restore from backup
echo [0] Back
echo ----------------------------------------------
set "CHOICE="
set /p "CHOICE=Select option: "
if "%CHOICE%"=="1" call :ps "_tools\ps\backup_create.ps1" & goto :pause_back
if "%CHOICE%"=="2" call :ps "_tools\ps\backup_restore.ps1" & goto :pause_back
if "%CHOICE%"=="0" goto :main
goto :menu_backup

:menu_git
cls
echo ==============================================
echo                Git + Smoke tests
echo ==============================================
echo [1] Pull latest from GitHub (pull --rebase)
echo [2] Push local changes to GitHub
echo [3] Fix GitHub access (remote/auth hints)
echo [4] Create local git repo (init + first commit)
echo [5] Smoke test (npm run tools:smoke)
echo [0] Back
echo ----------------------------------------------
set "CHOICE="
set /p "CHOICE=Select option: "
if "%CHOICE%"=="1" call :ps "_tools\ps\git_pull_rebase.ps1" & goto :pause_back
if "%CHOICE%"=="2" call :ps "_tools\ps\git_push.ps1" & goto :pause_back
if "%CHOICE%"=="3" call :ps "_tools\ps\git_fix_remote_access.ps1" & goto :pause_back
if "%CHOICE%"=="4" call :ps "_tools\ps\git_init_local.ps1" & goto :pause_back
if "%CHOICE%"=="5" call :ps "_tools\ps\smoke.ps1" & goto :pause_back
if "%CHOICE%"=="0" goto :main
goto :menu_git

:run_dev
cls
echo ==============================================
echo                 Dev server
echo ==============================================
echo Starting dev server (npm run dev)...
echo Close this window to stop it.
echo.
call :ps "_tools\ps\dev_server.ps1"
goto :pause_back

:pause_back
echo.
pause
goto :main

:ps
set "PSFILE=%~1"
if not exist "%PSFILE%" (
  echo.
  echo [ERROR] PowerShell script not found: %PSFILE%
  goto :eof
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%"
goto :eof

:requireTool
set "TOOL=%~1"
where "%TOOL%" >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Required tool not found in PATH: %TOOL%
  echo Install it or fix PATH, then run this toolbox again.
  echo.
  pause
  exit /b 1
)
exit /b 0

:end
popd >nul
endlocal
exit /b 0
