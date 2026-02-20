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
        } else {
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
        } else {
            Ok 'No active rebase.'
        }

        $dirty = (& git status --porcelain)
        if ($dirty) {
            $stash = "repair_stash_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            if (-not (Run-CmdSafe -Command 'git' -Args @('stash','push','-u','-m',$stash))) { throw 'git stash push failed.' }
            Ok "Working tree stashed: $stash"
        } else {
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
    Write-Host '[D] Reset source files to HEAD (DANGEROUS)'
    Write-Host '[B] Back to main toolbox menu'
    Write-Host '[0] Exit'
}

Push-Location $root
try {
    while ($true) {
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
            'D' { Invoke-MenuAction -Label 'Dangerous source reset' -Action { Dangerous-ResetSourceFiles } }
            'd' { Invoke-MenuAction -Label 'Dangerous source reset' -Action { Dangerous-ResetSourceFiles } }
            'B' { break }
            'b' { break }
            '0' { break }
            default {
                Warn 'Invalid option.'
                Wait-Return
            }
        }
    }
}
finally { Pop-Location }
