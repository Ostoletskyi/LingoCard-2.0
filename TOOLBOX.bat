@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Keep console UTF-8 to avoid weird glyphs if your system locale is not English.
chcp 65001 >nul

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

rem Prefer PowerShell 7+ (pwsh) when available, otherwise fall back to Windows PowerShell.
set "PS_EXE=powershell.exe"
where /q pwsh.exe
if "%ERRORLEVEL%"=="0" set "PS_EXE=pwsh.exe"

title LingoCard Toolbox

:MAIN_MENU
cls
echo ================================================
echo                 LingoCard Toolbox
echo ================================================
echo Project: %PROJECT_ROOT%
echo.
echo [1] Git - Update local project (pull --rebase)
echo [2] Git - Push project state to remote
echo [3] Backup menu
echo [4] Run smoke test
echo [5] Start local dev server (open browser)
echo [6] Auto environment setup (Git/Node/Python via Chocolatey)
echo [7] Troubleshooting / Auto-fix common issues
echo [0] Exit
echo -----------------------------------------------
set /p CHOICE=Select option: 

if "%CHOICE%"=="1" call :RUN_PS git_pull.ps1 & goto MAIN_MENU
if "%CHOICE%"=="2" call :RUN_PS git_push.ps1 & goto MAIN_MENU
if "%CHOICE%"=="3" goto BACKUP_MENU
if "%CHOICE%"=="4" call :RUN_PS smoke.ps1 & goto MAIN_MENU
if "%CHOICE%"=="5" call :RUN_PS dev_start.ps1 & goto MAIN_MENU
if "%CHOICE%"=="6" call :RUN_PS env_autosetup.ps1 & goto MAIN_MENU
if "%CHOICE%"=="7" goto FIX_MENU
if "%CHOICE%"=="0" goto END

echo Invalid option.
pause
goto MAIN_MENU

:BACKUP_MENU
cls
echo ================================================
echo                    Backup Menu
echo ================================================
echo [1] Create backup
echo [2] Restore backup
echo [0] Back
echo -----------------------------------------------
set /p BCHOICE=Select option: 

if "%BCHOICE%"=="1" call :RUN_PS backup_create.ps1 & goto BACKUP_MENU
if "%BCHOICE%"=="2" call :RUN_PS backup_restore.ps1 & goto BACKUP_MENU
if "%BCHOICE%"=="0" goto MAIN_MENU

echo Invalid option.
pause
goto BACKUP_MENU

:FIX_MENU
cls
echo ================================================
echo           Troubleshooting / Auto-Fix Menu
echo ================================================
echo [1] Auto-fix common issues (Git + Node modules + checks)
echo [2] Fix Git issues (rebase/merge locks, stash-safe pull)
echo [3] Fix Node modules (clean reinstall: npm ci)
echo [4] Run diagnostics (quick report)
echo [5] Show latest reports folder
echo [0] Back
echo -----------------------------------------------
set /p FCHOICE=Select option: 

if "%FCHOICE%"=="1" call :RUN_PS autofix.ps1 & goto FIX_MENU
if "%FCHOICE%"=="2" call :RUN_PS fix_git.ps1 & goto FIX_MENU
if "%FCHOICE%"=="3" call :RUN_PS fix_node.ps1 & goto FIX_MENU
if "%FCHOICE%"=="4" call :RUN_PS diagnose.ps1 & goto FIX_MENU
if "%FCHOICE%"=="5" call :RUN_PS open_reports.ps1 & goto FIX_MENU
if "%FCHOICE%"=="0" goto MAIN_MENU

echo Invalid option.
pause
goto FIX_MENU

:RUN_PS
set "SCRIPT_NAME=%~1"
echo Running %SCRIPT_NAME% ...
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\%SCRIPT_NAME%" -ProjectRoot "%PROJECT_ROOT%"
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (
  echo Result: SUCCESS
) else (
  echo Result: ERROR ^(exit code %RC%^)
)
echo.
pause
exit /b %RC%

:END
echo Goodbye.
endlocal
exit /b 0
