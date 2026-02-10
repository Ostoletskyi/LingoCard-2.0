@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "PS_EXE=powershell"

title LingoCard Toolbox

:MAIN_MENU
cls
echo ================================================
echo                 LingoCard Toolbox
echo ================================================
echo [1] Backup
echo [2] Git + Smoke
echo [3] Dev server
echo [4] Diagnostics / Self-test
echo [0] Exit
echo ------------------------------------------------
set /p CHOICE=Enter option number: 

if "%CHOICE%"=="1" goto BACKUP_MENU
if "%CHOICE%"=="2" goto GIT_MENU
if "%CHOICE%"=="3" goto DEV_MENU
if "%CHOICE%"=="4" goto DIAG_MENU
if "%CHOICE%"=="0" goto END

echo Invalid input. Please enter a number from menu.
pause
goto MAIN_MENU

:BACKUP_MENU
cls
echo ===================== Backup ====================
echo [1] Create backup
echo [2] Restore backup
echo [0] Back
echo ------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS backup_create.ps1 & goto BACKUP_MENU
if "%CHOICE%"=="2" call :RUN_PS backup_restore.ps1 & goto BACKUP_MENU
if "%CHOICE%"=="0" goto MAIN_MENU
echo Invalid input.
pause
goto BACKUP_MENU

:GIT_MENU
cls
echo =================== Git + Smoke =================
echo [1] Pull latest (rebase)
echo [2] Push changes
echo [3] Fix remote access
echo [4] Init local repo
echo [5] Run smoke test
echo [0] Back
echo ------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS git_pull_rebase.ps1 & goto GIT_MENU
if "%CHOICE%"=="2" call :RUN_PS git_push.ps1 & goto GIT_MENU
if "%CHOICE%"=="3" call :RUN_PS git_fix_remote_access.ps1 & goto GIT_MENU
if "%CHOICE%"=="4" call :RUN_PS git_init_local.ps1 & goto GIT_MENU
if "%CHOICE%"=="5" call :RUN_PS smoke_run.ps1 & goto GIT_MENU
if "%CHOICE%"=="0" goto MAIN_MENU
echo Invalid input.
pause
goto GIT_MENU

:DEV_MENU
cls
echo ==================== Dev server =================
echo [1] Start dev server
echo [2] Clean install (remove node_modules + npm ci)
echo [0] Back
echo ------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS dev_start.ps1 & goto DEV_MENU
if "%CHOICE%"=="2" call :RUN_PS dev_start.ps1 -CleanInstall & goto DEV_MENU
if "%CHOICE%"=="0" goto MAIN_MENU
echo Invalid input.
pause
goto DEV_MENU

:DIAG_MENU
cls
echo ============== Diagnostics / Self-test ===========
echo [1] Run toolbox self-test
echo [2] Show git status
echo [3] Show versions (node/npm/git)
echo [4] Open project folder
echo [5] Open logs folder
echo [0] Back
echo ------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS toolbox_selftest.ps1 & goto DIAG_MENU
if "%CHOICE%"=="2" call :RUN_PS git_pull_rebase.ps1 -StatusOnly & goto DIAG_MENU
if "%CHOICE%"=="3" call :RUN_PS toolbox_selftest.ps1 -VersionsOnly & goto DIAG_MENU
if "%CHOICE%"=="4" start "" "%PROJECT_ROOT%" & pause & goto DIAG_MENU
if "%CHOICE%"=="5" if not exist "%PROJECT_ROOT%\_tools\logs" mkdir "%PROJECT_ROOT%\_tools\logs" & start "" "%PROJECT_ROOT%\_tools\logs" & pause & goto DIAG_MENU
if "%CHOICE%"=="0" goto MAIN_MENU
echo Invalid input.
pause
goto DIAG_MENU

:RUN_PS
set "SCRIPT_NAME=%~1"
set "EXTRA_ARGS=%~2 %~3 %~4 %~5"
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\%SCRIPT_NAME%" -ProjectRoot "%PROJECT_ROOT%" %EXTRA_ARGS%
echo.
pause
exit /b %ERRORLEVEL%

:END
echo Goodbye.
endlocal
exit /b 0
