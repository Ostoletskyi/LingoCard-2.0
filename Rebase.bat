@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem LingoCard 2.0 - Rebase + Smoke + Dev (EN)
rem ------------------------------------------------------------
rem IMPORTANT:
rem - Save this file as "ANSI" or "UTF-8 (no BOM)".
rem - UTF-8 WITH BOM will break cmd.exe and show weird symbols.
rem ============================================================

title LingoCard 2.0 - Rebase + Smoke + Dev

set "ROOT=%CD%"

call :requireTool git   || exit /b 1
call :requireTool node  || exit /b 1
call :requireTool npm   || exit /b 1

echo.
echo ============================================================
echo LingoCard 2.0 - Rebase + Smoke + Dev
echo ============================================================
echo Working dir: %ROOT%
echo.

call :ensureGitSafeDir "%ROOT%" || exit /b 1

rem --- Dirty working tree guard (pull --rebase requires clean state)
call :handleDirtyTree || exit /b 1

call :step "Git pull --rebase" "git pull --rebase" || exit /b 1
call :step "Smoke (tsc): npm run tools:smoke" "npm run tools:smoke" || exit /b 1
call :step "Git status" "git status" || exit /b 1
call :step "npm install" "npm install" || exit /b 1

if exist "%ROOT%\node_modules\" (
  echo [OK] node_modules exists
) else (
  echo [WARN] node_modules folder not found (npm install may have failed)
)

echo.
echo Starting dev server...
echo (Close this window to stop it)
echo.
npm run dev
exit /b %ERRORLEVEL%


rem ============================================================
rem Functions
rem ============================================================

:requireTool
set "TOOL=%~1"
where "%TOOL%" >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Required tool not found in PATH: %TOOL%
  echo         Install it or fix PATH, then run this file again.
  echo.
  pause
  exit /b 1
)
exit /b 0


:ensureGitSafeDir
set "DIR=%~1"

rem Quick probe: if OK, return success
git -C "%DIR%" status >nul 2>nul
if errorlevel 0 exit /b 0

rem Detect "dubious ownership" message
set "TMP=%TEMP%\lc_git_safe_%RANDOM%.txt"
git -C "%DIR%" status 1>"%TMP%" 2>&1

findstr /I /C:"detected dubious ownership" "%TMP%" >nul
if errorlevel 1 (
  del "%TMP%" >nul 2>nul
  rem Not the safe.directory issue; let normal flow handle errors later
  exit /b 0
)

del "%TMP%" >nul 2>nul

echo.
echo [WARN] Git reports "dubious ownership" for this directory:
echo        %DIR%
echo        Adding it to git safe.directory (global)...
echo.

git config --global --add safe.directory "%DIR%"
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to add safe.directory automatically.
  echo         Run this manually:
  echo         git config --global --add safe.directory "%DIR%"
  echo.
  pause
  exit /b 1
)

echo [OK] safe.directory added.
exit /b 0


:handleDirtyTree
set "DIRTY="
for /f "delims=" %%A in ('git status --porcelain') do (
  set "DIRTY=1"
  goto :dirtyMenu
)
exit /b 0

:dirtyMenu
echo.
echo [WARN] You have local uncommitted changes.
echo       "git pull --rebase" cannot continue until the working tree is clean.
echo.
echo [1] Stash changes (recommended)
echo [2] Commit WIP (quick commit)
echo [3] Cancel / Back
echo [4] Discard changes (DANGEROUS)
echo.
set /p "CHOICE=Select option (1-4): "

if "%CHOICE%"=="1" (
  call :step "Stash (including untracked)" "git stash push -u -m ""WIP before pull --rebase""" || exit /b 1
  call :step "Git pull --rebase" "git pull --rebase" || exit /b 1
  echo.
  echo Restoring stash...
  git stash pop
  echo.
  exit /b 0
)

if "%CHOICE%"=="2" (
  call :step "git add -A" "git add -A" || exit /b 1
  call :step "git commit -m WIP" "git commit -m ""WIP""" || exit /b 1
  exit /b 0
)

if "%CHOICE%"=="4" (
  echo.
  echo !!! WARNING: This will permanently remove local changes !!!
  choice /c YN /m "Continue?"
  if errorlevel 2 exit /b 1
  call :step "git reset --hard" "git reset --hard" || exit /b 1
  call :step "git clean -fd" "git clean -fd" || exit /b 1
  exit /b 0
)

exit /b 1


:step
set "DESC=%~1"
set "CMD=%~2"

echo ----------------------------------------------
echo %DESC%
echo ^> %CMD%
%CMD%
if errorlevel 1 (
  echo.
  echo [ERROR] Step failed: %DESC%
  echo Command: %CMD%
  echo.
  pause
  exit /b 1
)
exit /b 0
