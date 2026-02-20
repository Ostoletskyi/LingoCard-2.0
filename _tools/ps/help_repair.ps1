param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'help_repair'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Log([string]$m) { Write-Log -LogPath $log -Message $m }
function Info([string]$m) { Write-Host "[INFO] $m" -ForegroundColor Cyan; Log "INFO $m" }
function Ok([string]$m) { Write-Host "[OK] $m" -ForegroundColor Green; Log "OK $m" }
function Warn([string]$m) { Write-Host "[WARN] $m" -ForegroundColor Yellow; Log "WARN $m" }
function Err([string]$m) { Write-Host "[ERR] $m" -ForegroundColor Red; Log "ERR $m" }

function Show-Banner {
    Clear-Host
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host '                 LingoCard Help / Repair Hub                ' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host "Project: $root" -ForegroundColor Gray
    Write-Host ''
}

function Show-Step([string]$Label) {
    Write-Host "--> $Label" -ForegroundColor Magenta
}

function Wait-Return {
    Write-Host ''
    Read-Host 'Press Enter to return to Help / Repair menu' | Out-Null
}

function Invoke-MenuAction {
    param(
        [string]$Label,
        [scriptblock]$Action
    )
    try {
        Show-Step $Label
        & $Action
        Ok "$Label completed."
    }
    catch {
        Err "$Label failed: $($_.Exception.Message)"
    }
    finally {
        Wait-Return
    }
}

function Run-CmdSafe {
    param([string]$Command, [string[]]$Args)
    & $Command @Args | Out-Host
    return ($LASTEXITCODE -eq 0)
}

function Show-Diagnose {
    Push-Location $root
    try {
        Info 'Diagnose started (read-only).'
        Write-Host "Project: $root"
        Write-Host "Branch: $((& git branch --show-current).Trim())"
        & git status --short | Out-Host

        if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) { Warn 'Rebase state: IN PROGRESS' } else { Ok 'Rebase state: clean' }

        $bins = @('node_modules/.bin/tsc','node_modules/.bin/vite','node_modules/.bin/eslint')
        foreach ($bin in $bins) {
            if (Test-Path $bin) { Ok ".bin tool found: $bin" } else { Warn ".bin tool missing: $bin" }
        }

        $nodeV = (& node -v 2>$null)
        $npmV = (& npm -v 2>$null)
        Write-Host "node: $nodeV"
        Write-Host "npm:  $npmV"

        $reportDir = Join-Path $root '_reports'
        if (Test-Path $reportDir) {
            Get-ChildItem -Path $reportDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 10 | ForEach-Object {
                Write-Host ("report: " + $_.FullName)
            }
        }
        else {
            Warn '_reports folder not found.'
        }
    }
    finally { Pop-Location }
}

function Repair-Environment {
    Push-Location $root
    try {
        Info 'Repair environment (safe) started.'
        Run-CmdSafe -Command 'taskkill' -Args @('/F','/IM','node.exe') | Out-Null
        Run-CmdSafe -Command 'taskkill' -Args @('/F','/IM','esbuild.exe') | Out-Null

        if (Test-Path 'node_modules') {
            Remove-Item -Recurse -Force 'node_modules'
        }

        if (-not (Run-CmdSafe -Command 'npm' -Args @('ci'))) {
            Warn 'npm ci failed, trying npm install fallback.'
            if (-not (Run-CmdSafe -Command 'npm' -Args @('install'))) {
                throw 'Both npm ci and npm install failed.'
            }
        }

        foreach ($bin in @('node_modules/.bin/tsc','node_modules/.bin/vite','node_modules/.bin/eslint')) {
            if (Test-Path $bin) { Ok ".bin tool found: $bin" } else { throw "Required .bin tool missing: $bin" }
        }

        Ok 'Repair environment completed.'
    }
    finally { Pop-Location }
}

function Repair-GitState {
    Push-Location $root
    try {
        Info 'Repair git state (safe) started.'
        if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) {
            $backup = "repair_rebase_backup_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            Run-CmdSafe -Command 'git' -Args @('branch', $backup) | Out-Null
            if (-not (Run-CmdSafe -Command 'git' -Args @('rebase','--abort'))) { throw 'git rebase --abort failed.' }
            Ok "Rebase aborted. Backup branch: $backup"
        }
        else {
            Ok 'No active rebase.'
        }

        $dirty = (& git status --porcelain)
        if ($dirty) {
            $stash = "repair_stash_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            if (-not (Run-CmdSafe -Command 'git' -Args @('stash','push','-u','-m',$stash))) { throw 'git stash push failed.' }
            Ok "Working tree stashed: $stash"
        }
        else {
            Ok 'Working tree clean.'
        }

        Run-CmdSafe -Command 'git' -Args @('fetch','--all','--prune') | Out-Null
        if (-not (Run-CmdSafe -Command 'git' -Args @('pull','--rebase'))) {
            Warn 'git pull --rebase failed. Please resolve manually.'
        }
    }
    finally { Pop-Location }
}

function Dangerous-ResetSourceFiles {
    Push-Location $root
    try {
        Warn 'DANGEROUS: this will discard local changes in selected source files.'
        $confirm = Read-Host 'Type YES to continue'
        if ($confirm -ne 'YES') {
            Warn 'Cancelled.'
            return
        }
        & git checkout -- src/state/store.ts src/state/persistence.ts src/state/types.ts src/state/templateOps.ts src/ui/EditorCanvas.tsx
        if ($LASTEXITCODE -ne 0) { throw 'Dangerous reset failed.' }
        Ok 'Selected source files were reset to HEAD.'
    }
    finally { Pop-Location }
}

function Get-HelpDictionary([string]$Lang) {
    switch ($Lang) {
        'ru' {
            return @{
                title = 'Справка по главному меню Toolbox';
                hint = 'Выберите пункт для подробного объяснения';
                back = 'Назад';
                items = @{
                    '1' = 'Обновить проект из git (pull --rebase). При изменениях предложит stash.';
                    '2' = 'Отправить локальные коммиты в remote. При отсутствии upstream попробует настроить.';
                    '3' = 'Меню резервных копий: создать backup или восстановить из backup.';
                    '4' = 'Запустить smoke-тест (включает tsc/preflight/build).';
                    '5' = 'Запустить dev-сервер для локального просмотра приложения.';
                    '6' = 'Автонастройка окружения (проверки и базовая подготовка).';
                    '7' = 'Автоматический ремонт типовых проблем проекта.';
                    '8' = 'Safe recover: синхронизация, проверка, preflight/smoke.';
                    '9' = 'Help/Repair Hub: диагностика, ремонт, отчеты, backup, self-test.';
                    'R' = 'Обновить экран главного меню.';
                    '0' = 'Выход из Toolbox.'
                }
            }
        }
        'de' {
            return @{
                title = 'Toolbox-Hilfe zum Hauptmenue';
                hint = 'Waehlen Sie einen Punkt fuer eine detailierte Erklaerung';
                back = 'Zurueck';
                items = @{
                    '1' = 'Projekt aus git aktualisieren (pull --rebase). Bei lokalen Aenderungen wird stash angeboten.';
                    '2' = 'Lokale Commits zum Remote pushen. Ohne Upstream wird Setup versucht.';
                    '3' = 'Backup-Menue: Backup erstellen oder wiederherstellen.';
                    '4' = 'Smoke-Test starten (inklusive tsc/preflight/build).';
                    '5' = 'Dev-Server fuer lokale Vorschau starten.';
                    '6' = 'Umgebung automatisch vorbereiten.';
                    '7' = 'Automatische Reparatur typischer Projektprobleme.';
                    '8' = 'Safe Recover: Sync, Verifikation, preflight/smoke.';
                    '9' = 'Help/Repair Hub: Diagnose, Reparatur, Reports, Backup, Self-Test.';
                    'R' = 'Hauptmenue neu laden.';
                    '0' = 'Toolbox beenden.'
                }
            }
        }
        default {
            return @{
                title = 'Toolbox Main Menu Help';
                hint = 'Select a key to see detailed explanation';
                back = 'Back';
                items = @{
                    '1' = 'Update local project from git (pull --rebase). Offers stash if tree is dirty.';
                    '2' = 'Push local commits to remote. Attempts upstream setup if missing.';
                    '3' = 'Backup menu: create backup or restore backup.';
                    '4' = 'Run smoke test pipeline (includes tsc/preflight/build).';
                    '5' = 'Start dev server for local app preview.';
                    '6' = 'Run automatic environment setup checks.';
                    '7' = 'Run automatic repair for common project problems.';
                    '8' = 'Run safe recover workflow: sync and verify workspace.';
                    '9' = 'Open Help/Repair Hub: diagnostics, repair, reports, backup, self-test.';
                    'R' = 'Reload main toolbox screen.';
                    '0' = 'Exit toolbox.'
                }
            }
        }
    }
}

function Show-MainMenuGuide([string]$Lang) {
    $dict = Get-HelpDictionary $Lang
    $exitGuide = $false
    while (-not $exitGuide) {
        Clear-Host
        Write-Host '============================================================' -ForegroundColor DarkCyan
        Write-Host (' ' + $dict.title) -ForegroundColor Cyan
        Write-Host '============================================================' -ForegroundColor DarkCyan
        Write-Host $dict.hint -ForegroundColor Gray
        Write-Host ''
        Write-Host '[1] Git    - Update local project (pull --rebase)'
        Write-Host '[2] Git    - Push project state to remote'
        Write-Host '[3] Backup - Create/Restore'
        Write-Host '[4] Tests  - Run smoke test'
        Write-Host '[5] Dev    - Start local dev server (and open browser)'
        Write-Host '[6] Setup  - Auto environment setup'
        Write-Host '[7] Repair - Automatic problem solving'
        Write-Host '[8] Recover - Sync and verify workspace'
        Write-Host '[9] Help   - Help / Repair hub'
        Write-Host '[R] Reload screen'
        Write-Host '[0] Exit'
        Write-Host ''
        Write-Host '[B] Back to Help / Repair menu'

        $pick = (Read-Host 'Select key to explain').ToUpperInvariant()
        if ($pick -eq 'B') { break }
        if ($pick -eq '0') {
            Write-Host $dict.items['0'] -ForegroundColor Yellow
            Read-Host 'Press Enter to continue' | Out-Null
            continue
        }
        if ($dict.items.ContainsKey($pick)) {
            Write-Host ''
            Write-Host (("{0}: " -f $pick) + $dict.items[$pick]) -ForegroundColor Green
            Read-Host 'Press Enter to continue' | Out-Null
        }
        else {
            Write-Host 'Unknown key.' -ForegroundColor Yellow
            Read-Host 'Press Enter to continue' | Out-Null
        }
    }
}

function Open-LanguageHelp {
    $exitLang = $false
    while (-not $exitLang) {
        Clear-Host
        Write-Host '================= Help Language =================' -ForegroundColor DarkCyan
        Write-Host '[1] English'
        Write-Host '[2] Русский'
        Write-Host '[3] Deutsch'
        Write-Host '[0] Back'
        $langChoice = Read-Host 'Select language'
        switch ($langChoice) {
            '1' { Show-MainMenuGuide 'en' }
            '2' { Show-MainMenuGuide 'ru' }
            '3' { Show-MainMenuGuide 'de' }
            '0' { $exitLang = $true }
            default {
                Write-Host 'Invalid option.' -ForegroundColor Yellow
                Read-Host 'Press Enter to continue' | Out-Null
            }
        }
    }
}

function Show-Menu {
    Show-Banner
    Write-Host '================ Help / Repair ================'
    Write-Host '[1] Diagnose (read-only)'
    Write-Host '[2] Repair environment (safe)'
    Write-Host '[3] Repair git state (safe)'
    Write-Host '[4] Run preflight'
    Write-Host '[5] Run smoke'
    Write-Host '[6] Open reports folder'
    Write-Host '[7] Create backup now'
    Write-Host '[8] Restore from backup'
    Write-Host '[9] Run toolbox self-test (quick)'
    Write-Host '[H] Menu help / FAQ (EN / RU / DE)'
    Write-Host '[D] Reset source files to HEAD (DANGEROUS)'
    Write-Host '[B] Back to main toolbox menu'
    Write-Host '[0] Exit'
}

Push-Location $root
try {
    $exitMenu = $false
    while (-not $exitMenu) {
        Show-Menu
        $choice = Read-Host 'Select option'
        switch ($choice) {
            '1' { Invoke-MenuAction -Label 'Diagnose' -Action { Show-Diagnose } }
            '2' { Invoke-MenuAction -Label 'Repair environment' -Action { Repair-Environment } }
            '3' { Invoke-MenuAction -Label 'Repair git state' -Action { Repair-GitState } }
            '4' { Invoke-MenuAction -Label 'Run preflight' -Action { & npm run tools:preflight | Out-Host } }
            '5' { Invoke-MenuAction -Label 'Run smoke' -Action { & npm run tools:smoke | Out-Host } }
            '6' {
                Invoke-MenuAction -Label 'Open reports folder' -Action {
                    $reportDir = Join-Path $root '_reports'
                    if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }
                    & explorer.exe $reportDir | Out-Null
                }
            }
            '7' { Invoke-MenuAction -Label 'Create backup' -Action { & (Join-Path $PSScriptRoot 'backup_create.ps1') -ProjectRoot $root | Out-Host } }
            '8' { Invoke-MenuAction -Label 'Restore backup' -Action { & (Join-Path $PSScriptRoot 'backup_restore.ps1') -ProjectRoot $root | Out-Host } }
            '9' { Invoke-MenuAction -Label 'Toolbox self-test quick' -Action { & (Join-Path $PSScriptRoot 'toolbox_selftest.ps1') -ProjectRoot $root -Quick | Out-Host } }
            'H' { Open-LanguageHelp }
            'h' { Open-LanguageHelp }
            'D' { Invoke-MenuAction -Label 'Dangerous source reset' -Action { Dangerous-ResetSourceFiles } }
            'd' { Invoke-MenuAction -Label 'Dangerous source reset' -Action { Dangerous-ResetSourceFiles } }
            'B' { $exitMenu = $true }
            'b' { $exitMenu = $true }
            '0' { exit 0 }
            default {
                Warn 'Invalid option.'
                Wait-Return
            }
        }
    }
}
finally { Pop-Location }
