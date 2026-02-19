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
    Write-Host ''
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
    Write-Host '[0] Exit'
}

Push-Location $root
try {
    while ($true) {
        Show-Menu
        $choice = Read-Host 'Select option'
        switch ($choice) {
            '1' { Show-Diagnose }
            '2' { Repair-Environment }
            '3' { Repair-GitState }
            '4' { & npm run tools:preflight | Out-Host }
            '5' { & npm run tools:smoke | Out-Host }
            '6' {
                $reportDir = Join-Path $root '_reports'
                if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory | Out-Null }
                & explorer.exe $reportDir | Out-Null
            }
            '7' { & (Join-Path $PSScriptRoot 'backup_create.ps1') -ProjectRoot $root | Out-Host }
            '8' { & (Join-Path $PSScriptRoot 'backup_restore.ps1') -ProjectRoot $root | Out-Host }
            '9' { & (Join-Path $PSScriptRoot 'toolbox_selftest.ps1') -ProjectRoot $root -Quick | Out-Host }
            'D' { Dangerous-ResetSourceFiles }
            'd' { Dangerous-ResetSourceFiles }
            '0' { break }
            default { Warn 'Invalid option.' }
        }
    }
}
finally { Pop-Location }
