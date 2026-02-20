@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

rem ---------------------------
rem  LingoCard Toolbox Launcher
rem ---------------------------

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "TOOLS_DIR=%PROJECT_ROOT%\_tools\ps"
set "TITLE=LingoCard Toolbox"
title %TITLE%

set "LANG=en"
set "LANG_NAME=English"
call :SET_LANG_TEXTS

rem Prefer pwsh if available, else Windows PowerShell
set "PS_EXE=powershell"
where pwsh >nul 2>nul && set "PS_EXE=pwsh"

call :ASSERT_DIR "%TOOLS_DIR%" || goto END

:LANG_SELECT
call :HEADER
call :PRINT_LANG_SELECT
set "LCHOICE="
set /p LCHOICE=Select option: 

if "%LCHOICE%"=="1" (set "LANG=ru" & set "LANG_NAME=Русский" & call :SET_LANG_TEXTS & goto MAIN_MENU)
if "%LCHOICE%"=="2" (set "LANG=de" & set "LANG_NAME=Deutsch" & call :SET_LANG_TEXTS & goto MAIN_MENU)
if "%LCHOICE%"=="3" (set "LANG=en" & set "LANG_NAME=English" & call :SET_LANG_TEXTS & goto MAIN_MENU)
if "%LCHOICE%"=="0" goto END

call :INVALID
goto LANG_SELECT

:MAIN_MENU
call :HEADER
echo Language: %LANG_NAME%
echo Project:  %PROJECT_ROOT%
echo Tools:    %TOOLS_DIR%
echo PS:       %PS_EXE%
echo.
echo [1] %MENU1%
echo [2] %MENU2%
echo [3] %MENU3%
echo [4] %MENU4%
echo [5] %MENU5%
echo [6] %MENU6%
echo [7] %MENU7%
echo [8] %MENU8%
echo [9] %MENU9%
echo [H] %MENUH%
echo.
echo [L] %MENUL%
echo [R] %MENUR%
echo [0] %MENU0%
echo -----------------------------------------------
set "CHOICE="
set /p CHOICE=%PROMPT_SELECT% 

if /I "%CHOICE%"=="1" (call :RUN_PS "git_pull.ps1"  & goto MAIN_MENU)
if /I "%CHOICE%"=="2" (call :RUN_PS "git_push.ps1"  & goto MAIN_MENU)
if /I "%CHOICE%"=="3" (goto BACKUP_MENU)
if /I "%CHOICE%"=="4" (call :RUN_PS "smoke.ps1"     & goto MAIN_MENU)
if /I "%CHOICE%"=="5" (call :RUN_PS "dev_start.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="6" (call :RUN_PS "env_autosetup.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="7" (call :RUN_PS "auto_problem_solver.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="8" (call :RUN_PS "recover_and_verify.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="9" (call :RUN_PS "help_repair.ps1" & goto MAIN_MENU)
if /I "%CHOICE%"=="H" (goto HELP_MENU)
if /I "%CHOICE%"=="L" (goto LANG_SELECT)
if /I "%CHOICE%"=="R" goto MAIN_MENU
if "%CHOICE%"=="0" goto END

call :INVALID
goto MAIN_MENU

:BACKUP_MENU
call :HEADER
echo %BACKUP_TITLE%
echo -----------------------------------------------
echo [1] %BACKUP_CREATE%
echo [2] %BACKUP_RESTORE%
echo.
echo [0] %BACKUP_BACK%
echo -----------------------------------------------
set "BCHOICE="
set /p BCHOICE=%PROMPT_SELECT% 

if "%BCHOICE%"=="1" (call :RUN_PS "backup_create.ps1"  & goto BACKUP_MENU)
if "%BCHOICE%"=="2" (call :RUN_PS "backup_restore.ps1" & goto BACKUP_MENU)
if "%BCHOICE%"=="0" goto MAIN_MENU

call :INVALID
goto BACKUP_MENU

:HELP_MENU
call :HEADER
echo %HELP_TITLE%
echo -----------------------------------------------
echo %HELP_HINT%
echo.
echo [1] %MENU1%
echo [2] %MENU2%
echo [3] %MENU3%
echo [4] %MENU4%
echo [5] %MENU5%
echo [6] %MENU6%
echo [7] %MENU7%
echo [8] %MENU8%
echo [9] %MENU9%
echo [H] %MENUH%
echo [L] %MENUL%
echo [R] %MENUR%
echo [0] %MENU0%
echo.
echo [M] %HELP_TO_MAIN%
echo -----------------------------------------------
set "HCHOICE="
set /p HCHOICE=%HELP_PROMPT% 

if "%HCHOICE%"=="1" (call :HELP_DETAIL 1 & goto HELP_MENU)
if "%HCHOICE%"=="2" (call :HELP_DETAIL 2 & goto HELP_MENU)
if "%HCHOICE%"=="3" (call :HELP_DETAIL 3 & goto HELP_MENU)
if "%HCHOICE%"=="4" (call :HELP_DETAIL 4 & goto HELP_MENU)
if "%HCHOICE%"=="5" (call :HELP_DETAIL 5 & goto HELP_MENU)
if "%HCHOICE%"=="6" (call :HELP_DETAIL 6 & goto HELP_MENU)
if "%HCHOICE%"=="7" (call :HELP_DETAIL 7 & goto HELP_MENU)
if "%HCHOICE%"=="8" (call :HELP_DETAIL 8 & goto HELP_MENU)
if "%HCHOICE%"=="9" (call :HELP_DETAIL 9 & goto HELP_MENU)
if /I "%HCHOICE%"=="H" (call :HELP_DETAIL H & goto HELP_MENU)
if /I "%HCHOICE%"=="L" (call :HELP_DETAIL L & goto HELP_MENU)
if /I "%HCHOICE%"=="R" (call :HELP_DETAIL R & goto HELP_MENU)
if "%HCHOICE%"=="0" goto END
if /I "%HCHOICE%"=="M" goto MAIN_MENU

call :INVALID
goto HELP_MENU

:HELP_DETAIL
set "TOPIC=%~1"
call :HEADER
echo %HELP_TITLE%
echo -----------------------------------------------
if "%TOPIC%"=="1" call :HELP_TOPIC_1
if "%TOPIC%"=="2" call :HELP_TOPIC_2
if "%TOPIC%"=="3" call :HELP_TOPIC_3
if "%TOPIC%"=="4" call :HELP_TOPIC_4
if "%TOPIC%"=="5" call :HELP_TOPIC_5
if "%TOPIC%"=="6" call :HELP_TOPIC_6
if "%TOPIC%"=="7" call :HELP_TOPIC_7
if "%TOPIC%"=="8" call :HELP_TOPIC_8
if "%TOPIC%"=="9" call :HELP_TOPIC_9
if "%TOPIC%"=="H" call :HELP_TOPIC_H
if "%TOPIC%"=="L" call :HELP_TOPIC_L
if "%TOPIC%"=="R" call :HELP_TOPIC_R

echo.
echo [B] %HELP_BACK%
echo [M] %HELP_TO_MAIN%
echo [0] %MENU0%
set "DCHOICE="
set /p DCHOICE=%PROMPT_SELECT% 
if /I "%DCHOICE%"=="B" exit /b 0
if /I "%DCHOICE%"=="M" goto MAIN_MENU
if "%DCHOICE%"=="0" goto END
exit /b 0

:HELP_TOPIC_1
if /I "%LANG%"=="ru" (
  echo [1] Git pull --rebase
  echo   Что делает: обновляет локальный проект из удаленного репозитория.
  echo   Когда использовать: перед началом работы и перед пушем.
  echo   Что меняет: историю локальной ветки, может создать stash/rebase состояние.
  echo   Безопасность: сохраните изменения и при необходимости сделайте backup из пункта [3].
  echo   Рекомендуемый шаг: после успеха запустите [4] Smoke test.
) else if /I "%LANG%"=="de" (
  echo [1] Git pull --rebase
  echo   Zweck: aktualisiert das lokale Projekt aus dem Remote-Repository.
  echo   Wann: vor Arbeitsbeginn und vor dem Push.
  echo   Aenderungen: lokale Branch-Historie, ggf. stash/rebase Status.
  echo   Sicherheit: lokale Aenderungen sichern, optional zuerst [3] Backup ausfuehren.
  echo   Naechster Schritt: danach [4] Smoke-Test starten.
) else (
  echo [1] Git pull --rebase
  echo   What it does: updates local project from remote repository.
  echo   When to use: before starting work and before pushing changes.
  echo   Changes: local branch history, may create stash/rebase state.
  echo   Safety: save your edits first; create backup with [3] if needed.
  echo   Recommended next step: run [4] Smoke test.
)
exit /b 0

:HELP_TOPIC_2
if /I "%LANG%"=="ru" (
  echo [2] Git push
  echo   Что делает: отправляет локальные коммиты в удаленный репозиторий.
  echo   Когда использовать: после успешных тестов и проверки кода.
  echo   Что меняет: состояние удаленной ветки.
  echo   Безопасность: убедитесь, что pull/rebase уже выполнен и нет конфликтов.
  echo   Рекомендуемый шаг: откройте PR после пуша.
) else if /I "%LANG%"=="de" (
  echo [2] Git push
  echo   Zweck: uebertraegt lokale Commits in das Remote-Repository.
  echo   Wann: nach erfolgreichen Tests und Code-Pruefung.
  echo   Aenderungen: Status der Remote-Branch.
  echo   Sicherheit: vorher pull/rebase ausfuehren und Konflikte loesen.
  echo   Naechster Schritt: danach PR erstellen.
) else (
  echo [2] Git push
  echo   What it does: pushes local commits to remote repository.
  echo   When to use: after tests pass and code is reviewed.
  echo   Changes: remote branch state.
  echo   Safety: ensure pull/rebase is done and conflicts are resolved.
  echo   Recommended next step: open a pull request.
)
exit /b 0

:HELP_TOPIC_3
if /I "%LANG%"=="ru" (
  echo [3] Backup create/restore
  echo   Что делает: создает резервную копию или восстанавливает проект из backup.
  echo   Когда использовать: перед рискованными правками, rebase/reset, авто-ремонтом.
  echo   Что меняет: папки backup в служебных директориях проекта.
  echo   Безопасность: проверяйте путь backup и дату перед восстановлением.
  echo   Рекомендуемый шаг: после restore запустите [4] Smoke test.
) else if /I "%LANG%"=="de" (
  echo [3] Backup erstellen/wiederherstellen
  echo   Zweck: erstellt ein Backup oder stellt Projekt aus Backup wieder her.
  echo   Wann: vor riskanten Aenderungen, rebase/reset, Auto-Reparatur.
  echo   Aenderungen: Backup-Ordner in den Tool-Verzeichnissen.
  echo   Sicherheit: vor Restore Backup-Pfad und Zeitstempel pruefen.
  echo   Naechster Schritt: nach Restore [4] Smoke-Test ausfuehren.
) else (
  echo [3] Backup create/restore
  echo   What it does: creates backup or restores project from backup.
  echo   When to use: before risky edits, rebase/reset, auto-repair actions.
  echo   Changes: backup folders/files under tooling directories.
  echo   Safety: verify backup path and timestamp before restore.
  echo   Recommended next step: run [4] Smoke test after restore.
)
exit /b 0

:HELP_TOPIC_4
if /I "%LANG%"=="ru" (
  echo [4] Smoke test
  echo   Что делает: запускает базовый пайплайн проверки проекта.
  echo   Когда использовать: после любых значимых изменений.
  echo   Что меняет: генерирует отчеты в _reports\smoke_report.* и preflight_report.*
  echo   Безопасность: не разрушает исходники, только проверяет/собирает.
  echo   Рекомендуемый шаг: если есть ошибки, откройте [9] Help/Repair hub.
) else if /I "%LANG%"=="de" (
  echo [4] Smoke-Test
  echo   Zweck: startet die Basis-Pipeline fuer Projektpruefung.
  echo   Wann: nach allen wichtigen Aenderungen.
  echo   Aenderungen: erzeugt Reports in _reports\smoke_report.* und preflight_report.*
  echo   Sicherheit: nicht destruktiv, prueft und baut nur.
  echo   Naechster Schritt: bei Fehlern [9] Help/Repair Hub nutzen.
) else (
  echo [4] Smoke test
  echo   What it does: runs baseline project verification pipeline.
  echo   When to use: after any significant change.
  echo   Changes: writes reports to _reports\smoke_report.* and preflight_report.*
  echo   Safety: non-destructive, checks/builds only.
  echo   Recommended next step: if failed, open [9] Help/Repair hub.
)
exit /b 0

:HELP_TOPIC_5
if /I "%LANG%"=="ru" (
  echo [5] Dev server
  echo   Что делает: запускает локальный dev-сервер приложения.
  echo   Когда использовать: для визуальной проверки интерфейса и функционала.
  echo   Что меняет: временные процессы node/vite.
  echo   Безопасность: перед запуском убедитесь, что порт свободен.
  echo   Рекомендуемый шаг: после проверки остановить сервер и прогнать [4].
) else if /I "%LANG%"=="de" (
  echo [5] Dev-Server
  echo   Zweck: startet den lokalen Entwicklungsserver.
  echo   Wann: fuer visuelle UI-Pruefung und Feature-Tests.
  echo   Aenderungen: temporaere node/vite Prozesse.
  echo   Sicherheit: pruefen, dass der Port frei ist.
  echo   Naechster Schritt: danach Server stoppen und [4] ausfuehren.
) else (
  echo [5] Dev server
  echo   What it does: starts local app development server.
  echo   When to use: for visual UI verification and feature checks.
  echo   Changes: temporary node/vite processes.
  echo   Safety: ensure required port is free before launch.
  echo   Recommended next step: stop server and run [4].
)
exit /b 0

:HELP_TOPIC_6
if /I "%LANG%"=="ru" (
  echo [6] Auto environment setup
  echo   Что делает: проверяет и подготавливает окружение для проекта.
  echo   Когда использовать: после новой установки или поломки зависимостей.
  echo   Что меняет: node_modules и служебные настройки инструментов.
  echo   Безопасность: рабочие файлы не трогает, но может переустановить пакеты.
  echo   Рекомендуемый шаг: выполнить [4] Smoke test.
) else if /I "%LANG%"=="de" (
  echo [6] Auto-Setup Umgebung
  echo   Zweck: prueft und richtet Projektumgebung ein.
  echo   Wann: nach frischer Einrichtung oder bei defekten Abhaengigkeiten.
  echo   Aenderungen: node_modules und Tool-Konfiguration.
  echo   Sicherheit: Quellcode bleibt, Pakete koennen neu installiert werden.
  echo   Naechster Schritt: [4] Smoke-Test ausfuehren.
) else (
  echo [6] Auto environment setup
  echo   What it does: verifies and prepares project environment.
  echo   When to use: after fresh setup or broken dependencies.
  echo   Changes: node_modules and tool-related setup state.
  echo   Safety: source files stay intact, dependencies may be reinstalled.
  echo   Recommended next step: run [4] Smoke test.
)
exit /b 0

:HELP_TOPIC_7
if /I "%LANG%"=="ru" (
  echo [7] Auto problem solver
  echo   Что делает: пытается автоматически исправить типичные проблемы проекта.
  echo   Когда использовать: если обычные команды не помогли.
  echo   Что меняет: окружение, git-состояние, отчеты в _reports.
  echo   Безопасность: сначала сделайте backup через [3].
  echo   Рекомендуемый шаг: после завершения запустите [4].
) else if /I "%LANG%"=="de" (
  echo [7] Automatische Problemlosung
  echo   Zweck: versucht typische Projektprobleme automatisch zu beheben.
  echo   Wann: wenn Standardbefehle nicht geholfen haben.
  echo   Aenderungen: Umgebung, Git-Status, Reports in _reports.
  echo   Sicherheit: zuerst Backup ueber [3] erstellen.
  echo   Naechster Schritt: danach [4] ausfuehren.
) else (
  echo [7] Auto problem solver
  echo   What it does: attempts automatic fix for common project issues.
  echo   When to use: when standard commands did not resolve problems.
  echo   Changes: environment state, git state, reports in _reports.
  echo   Safety: create backup first via [3].
  echo   Recommended next step: run [4] after completion.
)
exit /b 0

:HELP_TOPIC_8
if /I "%LANG%"=="ru" (
  echo [8] Recover and verify
  echo   Что делает: безопасно синхронизирует рабочую копию и запускает проверку.
  echo   Когда использовать: после конфликтов/сбоев или странного состояния git.
  echo   Что меняет: может делать stash, fetch/pull и отчеты проверки.
  echo   Безопасность: не делает принудительный reset исходников по умолчанию.
  echo   Рекомендуемый шаг: просмотреть отчеты в _reports.
) else if /I "%LANG%"=="de" (
  echo [8] Recover and verify
  echo   Zweck: synchronisiert Workspace sicher und fuehrt Verifikation aus.
  echo   Wann: nach Konflikten/Fehlern oder seltsamem Git-Zustand.
  echo   Aenderungen: kann stash, fetch/pull und Reports erzeugen.
  echo   Sicherheit: kein erzwungener Source-Reset standardmaessig.
  echo   Naechster Schritt: Reports in _reports pruefen.
) else (
  echo [8] Recover and verify
  echo   What it does: safely syncs workspace and runs verification.
  echo   When to use: after conflicts/failures or suspicious git state.
  echo   Changes: may perform stash, fetch/pull and verification reports.
  echo   Safety: does not force source reset by default.
  echo   Recommended next step: review reports in _reports.
)
exit /b 0

:HELP_TOPIC_9
if /I "%LANG%"=="ru" (
  echo [9] Help / Repair hub
  echo   Что делает: открывает расширенное меню диагностики и ремонта.
  echo   Когда использовать: когда нужно точечно проверить и починить систему.
  echo   Что меняет: зависит от выбранной подкоманды ^(диагностика, repair, backup^).
  echo   Безопасность: опасные действия явно помечены как DANGEROUS.
  echo   Рекомендуемый шаг: сначала Diagnose, потом Repair при необходимости.
) else if /I "%LANG%"=="de" (
  echo [9] Help / Repair Hub
  echo   Zweck: oeffnet erweitertes Diagnose- und Reparaturmenue.
  echo   Wann: wenn gezielte Analyse/Reparatur notwendig ist.
  echo   Aenderungen: abhaengig von Unterbefehl ^(Diagnose, Repair, Backup^).
  echo   Sicherheit: gefaehrliche Aktionen sind als DANGEROUS markiert.
  echo   Naechster Schritt: zuerst Diagnose, dann Repair falls noetig.
) else (
  echo [9] Help / Repair hub
  echo   What it does: opens advanced diagnostics and repair submenu.
  echo   When to use: when targeted investigation/fixes are needed.
  echo   Changes: depends on selected subcommand ^(diagnose, repair, backup^).
  echo   Safety: dangerous actions are explicitly marked DANGEROUS.
  echo   Recommended next step: run Diagnose first, then Repair if needed.
)
exit /b 0

:HELP_TOPIC_H
if /I "%LANG%"=="ru" (
  echo [H] Помощь
  echo   Что делает: открывает это справочное меню с пояснениями.
  echo   Когда использовать: если непонятно назначение пунктов.
  echo   Что меняет: ничего, только отображает справку.
  echo   Безопасность: полностью безопасно.
  echo   Рекомендуемый шаг: выбрать нужный пункт и затем вернуться в главное меню.
) else if /I "%LANG%"=="de" (
  echo [H] Hilfe
  echo   Zweck: oeffnet dieses Hilfemenue mit Erklaerungen.
  echo   Wann: wenn Bedeutung der Menuepunkte unklar ist.
  echo   Aenderungen: keine, nur Anzeige von Hilfe.
  echo   Sicherheit: vollstaendig sicher.
  echo   Naechster Schritt: gewuenschten Punkt lesen und ins Hauptmenue zurueck.
) else (
  echo [H] Help
  echo   What it does: opens this FAQ/help menu with explanations.
  echo   When to use: whenever menu meaning is unclear.
  echo   Changes: none, read-only information screen.
  echo   Safety: fully safe.
  echo   Recommended next step: read target topic and return to main menu.
)
exit /b 0

:HELP_TOPIC_L
if /I "%LANG%"=="ru" (
  echo [L] Смена языка
  echo   Что делает: возвращает к экрану выбора языка интерфейса.
  echo   Когда использовать: если нужно переключить RU/DE/EN в текущей сессии.
  echo   Что меняет: язык меню и справки.
  echo   Безопасность: не запускает утилиты и не меняет файлы.
  echo   Рекомендуемый шаг: выбрать язык и продолжить работу.
) else if /I "%LANG%"=="de" (
  echo [L] Sprache wechseln
  echo   Zweck: oeffnet die Sprachauswahl RU/DE/EN.
  echo   Wann: wenn Menuesprache in der Sitzung gewechselt werden soll.
  echo   Aenderungen: Sprache von Menue und Hilfe.
  echo   Sicherheit: startet keine Utilities, aendert keine Dateien.
  echo   Naechster Schritt: Sprache waehlen und weiterarbeiten.
) else (
  echo [L] Change language
  echo   What it does: opens language selection screen RU/DE/EN.
  echo   When to use: when you want to switch menu language in session.
  echo   Changes: menu and help language only.
  echo   Safety: does not run utilities or modify project files.
  echo   Recommended next step: pick language and continue workflow.
)
exit /b 0

:HELP_TOPIC_R
if /I "%LANG%"=="ru" (
  echo [R] Обновить экран
  echo   Что делает: перерисовывает текущее меню.
  echo   Когда использовать: если экран засорился выводом команд.
  echo   Что меняет: только отображение в консоли.
  echo   Безопасность: полностью безопасно.
  echo   Рекомендуемый шаг: после очистки выбрать нужную команду.
) else if /I "%LANG%"=="de" (
  echo [R] Bildschirm neu laden
  echo   Zweck: zeichnet das aktuelle Menue neu.
  echo   Wann: wenn die Konsole mit Ausgaben unuebersichtlich wurde.
  echo   Aenderungen: nur Darstellung in der Konsole.
  echo   Sicherheit: vollstaendig sicher.
  echo   Naechster Schritt: danach gewuenschten Befehl waehlen.
) else (
  echo [R] Reload screen
  echo   What it does: redraws current menu screen.
  echo   When to use: when console output becomes cluttered.
  echo   Changes: console display only.
  echo   Safety: fully safe.
  echo   Recommended next step: select your next command.
)
exit /b 0

:SET_LANG_TEXTS
if /I "%LANG%"=="ru" (
    set "MENU1=Git    - Обновить проект ^(pull --rebase^)"
    set "MENU2=Git    - Отправить изменения в remote"
    set "MENU3=Backup - Создать/восстановить"
    set "MENU4=Tests  - Запустить smoke тест"
    set "MENU5=Dev    - Запустить локальный dev сервер"
    set "MENU6=Setup  - Автонастройка окружения"
    set "MENU7=Repair - Автоисправление проблем"
    set "MENU8=Recover - Синхронизация и проверка"
    set "MENU9=Help   - Help / Repair hub"
    set "MENUH=Помощь - FAQ по меню"
    set "MENUL=Сменить язык"
    set "MENUR=Обновить экран"
    set "MENU0=Выход"
    set "PROMPT_SELECT=Выберите пункт:"
    set "BACKUP_TITLE=Меню резервных копий"
    set "BACKUP_CREATE=Создать резервную копию"
    set "BACKUP_RESTORE=Восстановить из резервной копии"
    set "BACKUP_BACK=Назад"
    set "HELP_TITLE=Справка по меню"
    set "HELP_HINT=Нажмите пункт, чтобы посмотреть подробное объяснение"
    set "HELP_PROMPT=Пункт справки:"
    set "HELP_BACK=Назад к справке"
    set "HELP_TO_MAIN=В главное меню"
) else if /I "%LANG%"=="de" (
    set "MENU1=Git    - Projekt aktualisieren ^(pull --rebase^)"
    set "MENU2=Git    - Lokale Commits in Remote pushen"
    set "MENU3=Backup - Erstellen/Wiederherstellen"
    set "MENU4=Tests  - Smoke-Test starten"
    set "MENU5=Dev    - Lokalen Dev-Server starten"
    set "MENU6=Setup  - Umgebung automatisch einrichten"
    set "MENU7=Repair - Automatische Problembehebung"
    set "MENU8=Recover - Workspace synchronisieren/pruefen"
    set "MENU9=Help   - Help / Repair hub"
    set "MENUH=Hilfe  - FAQ zum Menue"
    set "MENUL=Sprache wechseln"
    set "MENUR=Bildschirm neu laden"
    set "MENU0=Beenden"
    set "PROMPT_SELECT=Option waehlen:"
    set "BACKUP_TITLE=Backup-Menue"
    set "BACKUP_CREATE=Backup erstellen"
    set "BACKUP_RESTORE=Backup wiederherstellen"
    set "BACKUP_BACK=Zurueck"
    set "HELP_TITLE=Menuehilfe"
    set "HELP_HINT=Waehlen Sie einen Punkt fuer eine detailierte Erklaerung"
    set "HELP_PROMPT=Hilfethema:"
    set "HELP_BACK=Zurueck zur Hilfe"
    set "HELP_TO_MAIN=Zum Hauptmenue"
) else (
    set "MENU1=Git    - Update local project ^(pull --rebase^)"
    set "MENU2=Git    - Push project state to remote"
    set "MENU3=Backup - Create/Restore"
    set "MENU4=Tests  - Run smoke test"
    set "MENU5=Dev    - Start local dev server"
    set "MENU6=Setup  - Auto environment setup"
    set "MENU7=Repair - Automatic problem solving"
    set "MENU8=Recover - Sync and verify workspace"
    set "MENU9=Help   - Help / Repair hub"
    set "MENUH=Help   - Menu FAQ"
    set "MENUL=Change language"
    set "MENUR=Reload screen"
    set "MENU0=Exit"
    set "PROMPT_SELECT=Select option:"
    set "BACKUP_TITLE=Backup Menu"
    set "BACKUP_CREATE=Create backup"
    set "BACKUP_RESTORE=Restore backup"
    set "BACKUP_BACK=Back"
    set "HELP_TITLE=Main Menu Help"
    set "HELP_HINT=Select a menu item to read full explanation"
    set "HELP_PROMPT=Help topic:"
    set "HELP_BACK=Back to help menu"
    set "HELP_TO_MAIN=Back to main menu"
)
exit /b 0

:PRINT_LANG_SELECT
echo ================================================
echo               %TITLE%
echo ================================================
echo Language / Sprache / Язык
echo.
echo [1] Русский
echo [2] Deutsch
echo [3] English
echo [0] Exit
echo -----------------------------------------------
exit /b 0

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

if not "%RC%"=="0" (
  echo.
  echo [WARN] Script failed with exit code %RC%.
  echo [INFO] Trying to unlock blocked processes and retry once...
  if exist "%TOOLS_DIR%\unlock_processes.ps1" (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%TOOLS_DIR%\unlock_processes.ps1" -ProjectRoot "%PROJECT_ROOT%"
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -ProjectRoot "%PROJECT_ROOT%"
    set "RC=%ERRORLEVEL%"
  ) else (
    echo [WARN] unlock_processes.ps1 not found. Skipping retry unlock step.
  )
)

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
  echo   - Ensure you run this .bat from the project root
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
