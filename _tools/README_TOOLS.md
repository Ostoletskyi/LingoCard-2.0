# LingoCard 2.0 Toolbox

## Запуск
Из корня проекта запустите:

```bat
LC_TOOLBOX.bat
```

Главный батник открывает текстовое меню и запускает PowerShell-скрипты из `_tools/ps/` через:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script.ps1>
```

## Структура
- `_tools/ps/` — PowerShell 5.1 скрипты управления
- `_tools/backups/` — zip-бэкапы проекта
- `_tools/reports/` — логи (`toolbox.log`, `git_pull_*.log`, `smoke_report.md`)

## Команды меню
1. **Бэкап**
   - `backup_create.ps1` — создать zip-бэкап
   - `backup_restore.ps1` — восстановить из выбранного бэкапа (с pre-restore backup)
2. **Git + Smoke тест**
   - `git_pull_rebase.ps1`
   - `git_push.ps1`
   - `git_fix_remote_access.ps1`
   - `git_init_local.ps1`
   - `smoke.ps1`
3. **Запуск сервера**
   - `dev_server.ps1`

Все действия пишут результат в `_tools/reports/toolbox.log`.
