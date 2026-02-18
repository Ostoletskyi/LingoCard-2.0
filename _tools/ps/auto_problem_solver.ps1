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
        [string[]]$Args
    )

    Log-Info "$Title -> $Command $($Args -join ' ')"
    & $Command @Args | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$Title failed (exit $LASTEXITCODE)."
    }
}

function Run-CmdSafe {
    param(
        [string]$Title,
        [string]$Command,
        [string[]]$Args
    )

    try {
        Run-Cmd -Title $Title -Command $Command -Args $Args
        return $true
    }
    catch {
        Log-Warn $_.Exception.Message
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
        Run-CmdSafe -Title 'Git safe.directory' -Command 'git' -Args @('config','--global','--add','safe.directory',$repoPath) | Out-Null

        # Abort stale rebase session if present
        if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) {
            Log-Warn 'Detected unfinished rebase, attempting automatic abort.'
            Run-CmdSafe -Title 'git rebase --abort' -Command 'git' -Args @('rebase','--abort') | Out-Null
        } else {
            Log-Ok 'No unfinished rebase detected.'
        }

        Run-CmdSafe -Title 'git fetch --all --prune' -Command 'git' -Args @('fetch','--all','--prune') | Out-Null

        $branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        if ($branch -eq 'HEAD' -or [string]::IsNullOrWhiteSpace($branch)) {
            Log-Warn 'Detached HEAD detected. Rebase/push steps will be skipped.'
        }

        $dirty = (& git status --porcelain)
        if ($dirty) {
            $stashLabel = "toolbox_auto_fix_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            if (Run-CmdSafe -Title 'git stash push -u' -Command 'git' -Args @('stash','push','-u','-m',$stashLabel)) {
                $stashCreated = $true
                Log-Ok 'Local changes were stashed automatically.'
            }
        } else {
            Log-Ok 'Working tree is clean.'
        }

        if (-not [string]::IsNullOrWhiteSpace($branch) -and $branch -ne 'HEAD') {
            $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null)
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($upstream)) {
                if (-not (Run-CmdSafe -Title 'git pull --rebase' -Command 'git' -Args @('pull','--rebase'))) {
                    Log-Warn 'Rebase pull failed. Attempting automatic rollback.'
                    Run-CmdSafe -Title 'git rebase --abort' -Command 'git' -Args @('rebase','--abort') | Out-Null
                }
            } else {
                Log-Warn 'No upstream branch configured. Pull/rebase skipped.'
            }
        }

        if (-not (Test-Path 'node_modules')) {
            Log-Warn 'node_modules missing, running npm install.'
            Run-CmdSafe -Title 'npm install' -Command 'npm' -Args @('install') | Out-Null
        } else {
            Log-Ok 'node_modules found.'
        }

        $preflightOk = Run-CmdSafe -Title 'npm run tools:preflight' -Command 'npm' -Args @('run','tools:preflight')
        if (-not $preflightOk) {
            Log-Warn 'Preflight failed. Trying npm ci as auto-fix.'
            if (Run-CmdSafe -Title 'npm ci' -Command 'npm' -Args @('ci')) {
                $preflightOk = Run-CmdSafe -Title 'npm run tools:preflight (retry)' -Command 'npm' -Args @('run','tools:preflight')
            }
        }

        if ($preflightOk) {
            $smokePassed = Run-CmdSafe -Title 'npm run tools:smoke' -Command 'npm' -Args @('run','tools:smoke')
            if (-not $smokePassed) {
                Log-Warn 'Smoke failed. Running npm ci + smoke retry.'
                if (Run-CmdSafe -Title 'npm ci' -Command 'npm' -Args @('ci')) {
                    $smokePassed = Run-CmdSafe -Title 'npm run tools:smoke (retry)' -Command 'npm' -Args @('run','tools:smoke')
                }
            }
        }

        if ($smokePassed -and -not [string]::IsNullOrWhiteSpace($branch) -and $branch -ne 'HEAD') {
            $ahead = [int]((& git rev-list --count '@{u}..HEAD' 2>$null).Trim())
            if ($LASTEXITCODE -eq 0 -and $ahead -gt 0) {
                Run-CmdSafe -Title 'git push' -Command 'git' -Args @('push') | Out-Null
            } else {
                Log-Ok 'No commits to push or upstream is unavailable.'
            }
        } elseif (-not $smokePassed) {
            Log-Warn 'Smoke is still failing after retries. Push was skipped for safety.'
        }

        if ($stashCreated) {
            Log-Info 'Restoring stashed local changes.'
            if (-not (Run-CmdSafe -Title 'git stash pop' -Command 'git' -Args @('stash','pop'))) {
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
