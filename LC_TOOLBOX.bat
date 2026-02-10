@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "PS_EXE=powershell"

title LingoCard 2.0 - Пульт управления

:MAIN_MENU
cls
echo ==============================================
echo        LingoCard 2.0 — Пульт управления
echo ==============================================
echo [1] Бэкап
echo [2] Git + Smoke тест
echo [3] Запуск сервера (авто)
echo [0] Выход
echo ----------------------------------------------
set /p CHOICE=Введите номер: 

if "%CHOICE%"=="1" goto BACKUP_MENU
if "%CHOICE%"=="2" goto GIT_MENU
if "%CHOICE%"=="3" goto RUN_DEV
if "%CHOICE%"=="0" goto END

echo Неверный ввод. Введите номер из меню.
pause
goto MAIN_MENU

:BACKUP_MENU
cls
echo ==============================================
echo                 Бэкап
echo ==============================================
echo [1] Создать бэкап
echo [2] Восстановить из бэкапа
echo [0] Назад
echo ----------------------------------------------
set /p BCHOICE=Введите номер: 

if "%BCHOICE%"=="1" goto BACKUP_CREATE
if "%BCHOICE%"=="2" goto BACKUP_RESTORE
if "%BCHOICE%"=="0" goto MAIN_MENU

echo Неверный ввод. Введите номер из меню.
pause
goto BACKUP_MENU

:GIT_MENU
cls
echo ==============================================
echo             Git + Smoke тест
echo ==============================================
echo [1] Обновить последнюю версию с GitHub (pull --rebase)
echo [2] Запушить изменённую версию в GitHub
echo [3] Если нет доступа к GitHub — создать связь
echo [4] Создать локальный git (init + первый коммит)
echo [5] Smoke test (npm run tools:smoke)
echo [0] Назад
echo ----------------------------------------------
set /p GCHOICE=Введите номер: 

if "%GCHOICE%"=="1" goto GIT_PULL
if "%GCHOICE%"=="2" goto GIT_PUSH
if "%GCHOICE%"=="3" goto GIT_FIX
if "%GCHOICE%"=="4" goto GIT_INIT
if "%GCHOICE%"=="5" goto SMOKE
if "%GCHOICE%"=="0" goto MAIN_MENU

echo Неверный ввод. Введите номер из меню.
pause
goto GIT_MENU

:BACKUP_CREATE
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\backup_create.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto BACKUP_MENU

:BACKUP_RESTORE
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\backup_restore.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto BACKUP_MENU

:GIT_PULL
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\git_pull_rebase.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto GIT_MENU

:GIT_PUSH
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\git_push.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto GIT_MENU

:GIT_FIX
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\git_fix_remote_access.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto GIT_MENU

:GIT_INIT
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\git_init_local.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto GIT_MENU

:SMOKE
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\smoke.ps1" -ProjectRoot "%PROJECT_ROOT%"
pause
goto GIT_MENU

:RUN_DEV
set /p OPENBROWSER=Открыть браузер http://localhost:5173 ? (Y/N): 
if /I "%OPENBROWSER%"=="Y" (
  %PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\dev_server.ps1" -ProjectRoot "%PROJECT_ROOT%" -OpenBrowser
) else (
  %PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\_tools\ps\dev_server.ps1" -ProjectRoot "%PROJECT_ROOT%"
)
pause
goto MAIN_MENU

:END
echo Выход.
endlocal
exit /b 0
