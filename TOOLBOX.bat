@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ---------------------------
rem  LingoCard Toolbox Launcher
rem  (ASCII-only output to avoid codepage issues)
rem ---------------------------

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "TOOLS_DIR=%PROJECT_ROOT%\_tools\ps"
set "TITLE=LingoCard Toolbox"
title %TITLE%

rem Prefer PowerShell 7 if available, else Windows PowerShell
set "PS_EXE=powershell.exe"
where /q pwsh && set "PS_EXE=pwsh"

call :ASSERT_DIR "%TOOLS_DIR%" || goto END

:MAIN_MENU
call :HEADER
echo Project: %PROJECT_ROOT%
echo Tools:   %TOOLS_DIR%
echo PS:      %PS_EXE%
echo.
echo [1] Git    - Update local project (pull --rebase)
echo [2] Git    - Push project state to remote
echo [3] Backup - Create/Restore
echo [4] Tests  - Run smoke test
echo [5] Dev    - Start local dev server (and open browser)
echo [6] Setup  - Auto environment setup (Admin)
echo [7] AutoFix - Automatic issue resolution (diagnose + fix)
echo.
echo [R] Reload screen
echo [0] Exit
echo -----------------------------------------------
set "CHOICE="
set /p CHOICE=Select option: 

if /I "%CHOICE%"=="1" (call :RUN_PS "git_pull.ps1"  & goto MAIN_MENU)
if /I "%CHOICE%"=="2" (call :RUN_PS "git_push.ps1"  & goto MAIN_MENU)
if /I "%CHOICE%"=="3" (goto BACKUP_MENU)
if /I "%CHOICE%"=="4" (call :RUN_PS "smoke.ps1"     & goto MAIN_MENU)
if /I "%CHOICE%"=="5" (call :RUN_PS "dev_start.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="6" (call :RUN_PS "env_autosetup.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="7" (call :RUN_PS "autofix.ps1" & goto MAIN_MENU)

if /I "%CHOICE%"=="R" goto MAIN_MENU
if "%CHOICE%"=="0" goto END

call :INVALID
goto MAIN_MENU

:BACKUP_MENU
call :HEADER
echo Backup Menu
echo -----------------------------------------------
echo [1] Create backup
echo [2] Restore backup
echo.
echo [0] Back
echo -----------------------------------------------
set "BCHOICE="
set /p BCHOICE=Select option: 

if "%BCHOICE%"=="1" (call :RUN_PS "backup_create.ps1"  & goto BACKUP_MENU)
if "%BCHOICE%"=="2" (call :RUN_PS "backup_restore.ps1" & goto BACKUP_MENU)
if "%BCHOICE%"=="0" goto MAIN_MENU

call :INVALID
goto BACKUP_MENU


rem ===========================
rem Helpers
rem ===========================

:RUN_PS
set "SCRIPT_NAME=%~1"
set "SCRIPT_PATH=%TOOLS_DIR%\%SCRIPT_NAME%"

if not exist "%SCRIPT_PATH%" (
  echo.
  echo [ERROR] Script not found:
  echo         %SCRIPT_PATH%
  echo.
  pause
  exit /b 2
)

echo.
echo -----------------------------------------------
echo Running: %SCRIPT_NAME%
echo -----------------------------------------------
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -ProjectRoot "%PROJECT_ROOT%"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo Result: SUCCESS
) else (
  echo Result: ERROR (exit code %RC%)
)
echo.
pause
exit /b %RC%

:ASSERT_DIR
set "D=%~1"
if not exist "%D%" (
  call :HEADER
  echo [FATAL] Required folder not found:
  echo         %D%
  echo.
  echo Fix:
  echo   - Run this .bat from the project root
  echo   - Ensure _tools\ps exists
  echo.
  pause
  exit /b 10
)
exit /b 0

:HEADER
cls
echo ================================================
echo               %TITLE%
echo ================================================
exit /b 0

:INVALID
echo.
echo Invalid option. Try again.
echo.
pause
exit /b 0

:END
echo.
echo Goodbye.
endlocal
exit /b 0
