@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "PS_EXE=powershell"
set "SHORT_HASH=unknown"
for /f %%i in ('git -C "%PROJECT_ROOT%" rev-parse --short HEAD 2^>nul') do set "SHORT_HASH=%%i"

:MAIN_MENU
cls
echo ====================================================
echo               LingoCard Toolbox  (rev !SHORT_HASH!)
echo ====================================================
echo Project: %PROJECT_ROOT%
echo.
call :CHECK_ENV
if errorlevel 1 (
  echo.
  echo Some dependencies are missing. Install them and try again.
  echo Install guide: Git for Windows + Node.js LTS + npm.
)
echo.
echo [1] Backups
echo [2] Git + Smoke
echo [3] Start server
echo [4] Diagnostics / Self-check
echo [0] Exit
echo ----------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" goto BACKUP_MENU
if "%CHOICE%"=="2" goto GIT_MENU
if "%CHOICE%"=="3" goto SERVER_MENU
if "%CHOICE%"=="4" goto DIAG_MENU
if "%CHOICE%"=="0" goto END
echo Invalid input.
pause
goto MAIN_MENU

:BACKUP_MENU
cls
echo ===================== Backups =====================
echo [1] Create backup
echo [2] Restore backup
echo [0] Back
echo ----------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS backup_create.ps1
if "%CHOICE%"=="2" call :RUN_PS backup_restore.ps1
if "%CHOICE%"=="0" goto MAIN_MENU
goto BACKUP_MENU

:GIT_MENU
cls
echo ==================== Git + Smoke ==================
echo [1] Pull ^(git pull --rebase^)
echo [2] Push ^(commit + push^)
echo [3] Fix GitHub access ^(diagnostics + guide^)
echo [4] Init local git ^(init + first commit^)
echo [5] Smoke test ^(npm run tools:smoke^)
echo [0] Back
echo ----------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS git_pull_rebase.ps1
if "%CHOICE%"=="2" call :RUN_PS git_push.ps1
if "%CHOICE%"=="3" call :RUN_PS git_fix_remote_access.ps1
if "%CHOICE%"=="4" call :RUN_PS git_init_local.ps1
if "%CHOICE%"=="5" call :RUN_PS smoke_run.ps1
if "%CHOICE%"=="0" goto MAIN_MENU
goto GIT_MENU

:SERVER_MENU
cls
echo ==================== Start server =================
echo [1] npm run dev
echo [2] Open browser on localhost:5173
echo [0] Back
echo ----------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS dev_start.ps1
if "%CHOICE%"=="2" call :RUN_PS dev_start.ps1 -OpenBrowser
if "%CHOICE%"=="0" goto MAIN_MENU
goto SERVER_MENU

:DIAG_MENU
cls
echo ================= Diagnostics / Self-check =========
echo [1] Self-check utilities
echo [2] Open latest report folder
echo [3] Open project folder
echo [0] Back
echo ----------------------------------------------------
set /p CHOICE=Enter option number: 
if "%CHOICE%"=="1" call :RUN_PS toolbox_selftest.ps1
if "%CHOICE%"=="2" start "" "%PROJECT_ROOT%\_reports\toolbox"
if "%CHOICE%"=="3" start "" "%PROJECT_ROOT%"
if "%CHOICE%"=="0" goto MAIN_MENU
goto DIAG_MENU

:RUN_PS
set "SCRIPT_NAME=%~1"
set "EXTRA_ARGS=%~2 %~3 %~4 %~5"
echo Running !SCRIPT_NAME! ...
if "%TOOLBOX_DEBUG%"=="1" echo Debug mode enabled.
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\!SCRIPT_NAME!" -ProjectRoot "%PROJECT_ROOT%" !EXTRA_ARGS!
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo Result: ERROR (code %RC%)
  echo Next step: run Self-check and inspect logs in _reports\toolbox.
) else (
  echo Result: SUCCESS.
)
pause
exit /b %RC%

:CHECK_ENV
set "MISS=0"
where powershell >nul 2>nul || (echo Missing: powershell & set MISS=1)
where git >nul 2>nul || (echo Missing: git & set MISS=1)
where node >nul 2>nul || (echo Missing: node & set MISS=1)
where npm >nul 2>nul || (echo Missing: npm & set MISS=1)
if "%MISS%"=="1" exit /b 1
exit /b 0

:END
echo Goodbye.
endlocal
exit /b 0
