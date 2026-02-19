param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'auto_problem_solver'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Log-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
    Write-Log -LogPath $log -Message "INFO $Message"
}

function Log-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    Write-Log -LogPath $log -Message "WARN $Message"
}

function Log-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log -LogPath $log -Message "OK $Message"
}

function Log-Err {
    param([string]$Message)
    Write-Host "[ERR] $Message" -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERR $Message"
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

function Invoke-SmokeWithReportFallback {
    param([string]$Title)

    $ok = Run-CmdSafe -Title $Title -Command 'npm' -Arguments @('run','tools:smoke')
    if ($ok) {
        return $true
    }

    $reportJsonPath = Join-Path $root '_reports\smoke_report.json'
    if (-not (Test-Path $reportJsonPath)) {
        Log-Warn "$Title failed and JSON smoke report was not found."
        return $false
    }

    try {
        $json = Get-Content -Path $reportJsonPath -Raw | ConvertFrom-Json
        if ($json.overall.pass -eq $true) {
            Log-Warn "$Title returned non-zero, but JSON smoke report says PASS. Treating as success."
            Write-Log -LogPath $log -Message 'WARN smoke nonzero_exit_json_pass'
            return $true
        }

        $jsonCode = if ($json.overall.code -ne $null) { [int]$json.overall.code } else { -1 }
        Log-Warn "$Title failed. JSON overall.code=$jsonCode"
        return $false
    } catch {
        Log-Warn "Could not parse smoke JSON report: $($_.Exception.Message)"
        return $false
    }
}

$stashCreated = $false
$stashLabel = ""
$smokePassed = $false

try {
    Log-Info "Starting automatic problem solving workflow"

    Assert-Command git
    Assert-Command node
    Assert-Command npm

    if (-not (Test-Path (Join-Path $root '.git'))) {
        throw 'Current folder is not a git repository.'
    }

    Push-Location $root
    try {
        # Fix dubious ownership proactively
        $repoPath = (Resolve-Path $root).Path
        Run-CmdSafe -Title 'Git safe.directory' -Command 'git' -Arguments @('config','--global','--add','safe.directory',$repoPath) | Out-Null

        # Abort stale rebase session if present
        if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) {
            Log-Warn 'Detected unfinished rebase. Creating backup branch before abort.'
            $backup = "auto_fix_rebase_backup_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            Run-CmdSafe -Title "git branch $backup" -Command 'git' -Arguments @('branch', $backup) | Out-Null
            Run-CmdSafe -Title 'git rebase --abort' -Command 'git' -Arguments @('rebase','--abort') | Out-Null
        } else {
            Log-Ok 'No unfinished rebase detected.'
        }

        Run-CmdSafe -Title 'git fetch --all --prune' -Command 'git' -Arguments @('fetch','--all','--prune') | Out-Null

        $branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        if ($branch -eq 'HEAD' -or [string]::IsNullOrWhiteSpace($branch)) {
            Log-Warn 'Detached HEAD detected. Rebase/push steps will be skipped.'
        }

        $dirty = (& git status --porcelain)
        if ($dirty) {
            $stashLabel = "toolbox_auto_fix_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            if (Run-CmdSafe -Title 'git stash push -u' -Command 'git' -Arguments @('stash','push','-u','-m',$stashLabel)) {
                $stashCreated = $true
                Log-Ok 'Local changes were stashed automatically.'
            }
        } else {
            Log-Ok 'Working tree is clean.'
        }

        if (-not [string]::IsNullOrWhiteSpace($branch) -and $branch -ne 'HEAD') {
            $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null)
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($upstream)) {
                if (-not (Run-CmdSafe -Title 'git pull --rebase' -Command 'git' -Arguments @('pull','--rebase'))) {
                    Log-Warn 'Rebase pull failed. Attempting automatic rollback.'
                    Run-CmdSafe -Title 'git rebase --abort' -Command 'git' -Arguments @('rebase','--abort') | Out-Null
                }
            } else {
                Log-Warn 'No upstream branch configured. Pull/rebase skipped.'
            }
        }

        if (-not (Test-Path 'node_modules')) {
            Log-Warn 'node_modules missing, running npm install.'
            Run-CmdSafe -Title 'npm install' -Command 'npm' -Arguments @('install') | Out-Null
        } else {
            Log-Ok 'node_modules found.'
        }

        $preflightOk = Run-CmdSafe -Title 'npm run tools:preflight' -Command 'npm' -Arguments @('run','tools:preflight')
        if (-not $preflightOk) {
            Log-Warn 'Preflight failed. Trying npm ci as auto-fix.'
            $depsOk = Run-CmdSafe -Title 'npm ci' -Command 'npm' -Arguments @('ci')
            if (-not $depsOk) {
                Log-Warn 'npm ci failed. Trying npm install fallback.'
                $depsOk = Run-CmdSafe -Title 'npm install (fallback)' -Command 'npm' -Arguments @('install')
            }
            if ($depsOk) {
                $preflightOk = Run-CmdSafe -Title 'npm run tools:preflight (retry)' -Command 'npm' -Arguments @('run','tools:preflight')
            }
        }

        if ($preflightOk) {
            $smokePassed = Invoke-SmokeWithReportFallback -Title 'npm run tools:smoke'
            if (-not $smokePassed) {
                Log-Warn 'Smoke failed. Running dependency repair + smoke retry.'
                $depsOk = Run-CmdSafe -Title 'npm ci' -Command 'npm' -Arguments @('ci')
                if (-not $depsOk) {
                    Log-Warn 'npm ci failed. Trying npm install fallback.'
                    $depsOk = Run-CmdSafe -Title 'npm install (fallback)' -Command 'npm' -Arguments @('install')
                }
                if ($depsOk) {
                    $smokePassed = Invoke-SmokeWithReportFallback -Title 'npm run tools:smoke (retry)'
                }
            }
        }

        if ($smokePassed -and -not [string]::IsNullOrWhiteSpace($branch) -and $branch -ne 'HEAD') {
            $ahead = [int]((& git rev-list --count '@{u}..HEAD' 2>$null).Trim())
            if ($LASTEXITCODE -eq 0 -and $ahead -gt 0) {
                Run-CmdSafe -Title 'git push' -Command 'git' -Arguments @('push') | Out-Null
            } else {
                Log-Ok 'No commits to push or upstream is unavailable.'
            }
        } elseif (-not $smokePassed) {
            Log-Warn 'Smoke is still failing after retries. Push was skipped for safety.'
        }

        if ($stashCreated) {
            Log-Info 'Restoring stashed local changes.'
            if (-not (Run-CmdSafe -Title 'git stash pop' -Command 'git' -Arguments @('stash','pop'))) {
                Log-Warn "Could not auto-apply stash. Recover manually: git stash list / git stash apply '$stashLabel'"
            }
        }

        if ($smokePassed) {
            Log-Ok 'Automatic problem solving completed successfully.'
            exit 0
        }

        Log-Err 'Automatic problem solving completed with unresolved issues.'
        exit 1
    }
    finally {
        Pop-Location
    }
}
catch {
    Log-Err $_.Exception.Message
    if ($stashCreated) {
        Log-Warn "Stash may still contain your changes. Check: git stash list"
    }
    exit 1
}
