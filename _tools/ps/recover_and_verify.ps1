param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'recover_verify'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Log-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
    Write-Log -LogPath $log -Message "INFO $Message"
}

function Log-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log -LogPath $log -Message "OK $Message"
}

function Log-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    Write-Log -LogPath $log -Message "WARN $Message"
}

function Run-Cmd {
    param(
        [string]$Title,
        [string]$Command,
        [string[]]$Arguments
    )

    Log-Info "$Title -> $Command $($Arguments -join ' ')"
    & $Command @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$Title failed (exit $LASTEXITCODE)."
    }
}

function Run-CmdSafe {
    param(
        [string]$Title,
        [string]$Command,
        [string[]]$Arguments
    )

    try {
        Run-Cmd -Title $Title -Command $Command -Arguments $Arguments
        return $true
    }
    catch {
        Log-Warn $_.Exception.Message
        return $false
    }
}

function Test-TypeScriptStoreDrift {
    param([string[]]$OutputLines)
    $joined = ($OutputLines -join "`n")
    return
        ($joined -match "Cannot find name 'CARDS_CHUNK_SIZE'") -or
        ($joined -match "Cannot find name 'CARDS_META_KEY'") -or
        ($joined -match "Cannot find name 'CARDS_CHUNK_KEY_PREFIX'") -or
        ($joined -match "Cannot find name 'reason'") -or
        ($joined -match "updateBoxAcrossColumn") -or
        ($joined -match "TS1117")
}


function Restore-StoreFilesFromRecentHistory {
    param([int]$MaxCommits = 25)

    Log-Warn "Trying to recover store-related files from recent git history (up to $MaxCommits revisions)."
    $commits = @(& git rev-list --max-count=$MaxCommits HEAD -- src/state/store.ts)
    if (-not $commits -or $commits.Count -eq 0) {
        Log-Warn 'No historical revisions found for src/state/store.ts'
        return $false
    }

    foreach ($commit in $commits) {
        if ([string]::IsNullOrWhiteSpace($commit)) {
            continue
        }
        Log-Info "Trying store recovery from commit $commit"
        try {
            Run-Cmd -Title "git checkout $commit -- store-related files" -Command 'git' -Arguments @(
                'checkout', $commit, '--',
                'src/state/store.ts',
                'src/state/persistence.ts',
                'src/state/types.ts',
                'src/state/templateOps.ts'
            )
            $tscOk = Run-CmdSafe -Title "npm run tsc (probe @$commit)" -Command 'npm' -Arguments @('run', 'tsc')
            if ($tscOk) {
                Log-Ok "Store recovery succeeded using commit $commit"
                return $true
            }
        }
        catch {
            Log-Warn "Probe failed for commit $commit: $($_.Exception.Message)"
        }
    }

    Log-Warn 'Could not find a passing historical revision for store-related files.'
    return $false
}
function Restore-KnownProblemFilesFromOrigin {
    $hasOriginMain = $false
    & git rev-parse --verify --quiet 'origin/main' | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $hasOriginMain = $true
    }
    if (-not $hasOriginMain) {
        Log-Warn 'origin/main not found, skip forced restore from remote branch.'
        return
    }

    Run-Cmd -Title 'git checkout origin/main -- known-problem files' -Command 'git' -Arguments @(
        'checkout', 'origin/main', '--',
        'src/state/store.ts',
        'src/state/persistence.ts',
        'src/state/types.ts',
        'src/state/templateOps.ts',
        'src/ui/EditorCanvas.tsx',
        '_tools/preflight.js',
        '_tools/smoke.core.js',
        '_tools/utils.js'
    )
}

$stashCreated = $false
$stashTag = ""

try {
    Assert-Command git
    Assert-Command node
    Assert-Command npm

    Push-Location $root
    try {
        Log-Info 'Starting recover and verify workflow'

        $status = (& git status --porcelain)
        if ($status) {
            $stashTag = "recover_verify_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            Run-Cmd -Title 'git stash push -u' -Command 'git' -Arguments @('stash', 'push', '-u', '-m', $stashTag)
            $stashCreated = $true
            Log-Ok 'Local changes were stashed.'
        } else {
            Log-Ok 'Working tree is clean.'
        }

        Run-Cmd -Title 'git fetch --all --prune' -Command 'git' -Arguments @('fetch', '--all', '--prune')
        Run-Cmd -Title 'git pull --rebase' -Command 'git' -Arguments @('pull', '--rebase')

        Run-Cmd -Title 'git checkout (known-problem files)' -Command 'git' -Arguments @(
            'checkout', '--',
            'src/state/store.ts',
            'src/state/persistence.ts',
            'src/state/types.ts',
            'src/state/templateOps.ts',
            'src/ui/EditorCanvas.tsx',
            '_tools/preflight.js',
            '_tools/smoke.core.js',
            '_tools/utils.js'
        )

        if (Test-Path 'node_modules') {
            Log-Info 'Removing node_modules for clean reinstall.'
            Remove-Item -Path 'node_modules' -Recurse -Force
        }

        if (Test-Path 'package-lock.json') {
            Run-Cmd -Title 'git checkout -- package-lock.json' -Command 'git' -Arguments @('checkout', '--', 'package-lock.json')
        }

        Run-Cmd -Title 'npm ci' -Command 'npm' -Arguments @('ci')

        $tscOutput = @()
        npm run tsc 2>&1 | Tee-Object -Variable tscOutput | Out-Host
        $tscExit = $LASTEXITCODE
        if ($tscExit -ne 0) {
            $storeDriftDetected = Test-TypeScriptStoreDrift -OutputLines $tscOutput
            if ($storeDriftDetected) {
                Log-Warn 'Detected store drift in tsc output. Restoring known-problem files from origin/main before retry.'
                Restore-KnownProblemFilesFromOrigin
            }
            Log-Warn 'TypeScript failed after sync. Running hard reset + reinstall and retrying once.'
            Run-Cmd -Title 'git reset --hard HEAD' -Command 'git' -Arguments @('reset', '--hard', 'HEAD')
            if (Test-Path 'node_modules') {
                Remove-Item -Path 'node_modules' -Recurse -Force
            }
            Run-Cmd -Title 'npm ci (retry)' -Command 'npm' -Arguments @('ci')

            if ($storeDriftDetected) {
                $historyRestoreOk = Restore-StoreFilesFromRecentHistory
                if ($historyRestoreOk) {
                    Log-Ok 'Historical store recovery produced a passing tsc check.'
                } else {
                    Run-Cmd -Title 'npm run tsc (retry)' -Command 'npm' -Arguments @('run', 'tsc')
                }
            } else {
                Run-Cmd -Title 'npm run tsc (retry)' -Command 'npm' -Arguments @('run', 'tsc')
            }
        }
        Run-Cmd -Title 'npm run tools:preflight' -Command 'npm' -Arguments @('run', 'tools:preflight')
        Run-Cmd -Title 'npm run tools:smoke' -Command 'npm' -Arguments @('run', 'tools:smoke')

        Log-Ok 'Recover and verify finished successfully.'
        Log-Info 'Reports: _reports/preflight_report.{md,json}, _reports/smoke_report.{md,json}'

        if ($stashCreated) {
            Log-Warn "Your local changes are in stash: $stashTag"
            Log-Warn 'Restore them manually after verification: git stash list / git stash pop'
        }

        exit 0
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host "[ERR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERR $($_.Exception.Message)"
    if ($stashCreated) {
        Log-Warn "Stash preserved: $stashTag"
    }
    exit 1
}
