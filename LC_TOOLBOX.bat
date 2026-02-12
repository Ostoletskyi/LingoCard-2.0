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
echo               LingoCard Toolbox
echo ================================================
echo Project: %PROJECT_ROOT%
echo.
echo [1] Git - Update local project (pull --rebase)
echo [2] Git - Push project state to remote
echo [3] Backup menu
echo [4] Run smoke test
echo [0] Exit
echo -----------------------------------------------
set /p CHOICE=Select option: 

if "%CHOICE%"=="1" call :RUN_PS git_pull.ps1 & goto MAIN_MENU
if "%CHOICE%"=="2" call :RUN_PS git_push.ps1 & goto MAIN_MENU
if "%CHOICE%"=="3" goto BACKUP_MENU
if "%CHOICE%"=="4" call :RUN_PS smoke.ps1 & goto MAIN_MENU
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
