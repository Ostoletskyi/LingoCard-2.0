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


function Remove-NodeModulesSafe {
    if (-not (Test-Path 'node_modules')) {
        return
    }

    for ($attempt = 1; $attempt -le 2; $attempt += 1) {
        try {
            Log-Info "Removing node_modules for clean reinstall (attempt $attempt)."
            Remove-Item -Path 'node_modules' -Recurse -Force
            return
        }
        catch {
            $message = $_.Exception.Message
            if ($attempt -eq 1 -and $message -match 'EPERM|EACCES|EBUSY|denied|being used by another process') {
                Log-Warn 'node_modules removal blocked by locked process. Running unlock helper and retrying.'
                $unlockScript = Join-Path $PSScriptRoot 'unlock_processes.ps1'
                if (Test-Path $unlockScript) {
                    try {
                        & $unlockScript -ProjectRoot $root | Out-Host
                    }
                    catch {
                        Log-Warn "Unlock helper failed: $($_.Exception.Message)"
                    }
                }
                Start-Sleep -Milliseconds 500
                continue
            }
            throw
        }
    }
}

function Install-Dependencies {
    $ok = Run-CmdSafe -Title 'npm ci' -Command 'npm' -Arguments @('ci')
    if ($ok) {
        return $true
    }

    $errText = "$($Error[0])"
    if ($errText -match 'EPERM|EACCES|EBUSY') {
        Log-Warn 'npm ci failed due to file lock/permission issue. Falling back to npm install.'
        return (Run-CmdSafe -Title 'npm install (fallback)' -Command 'npm' -Arguments @('install'))
    }

    return $false
}

$stashCreated = $false
$stashTag = ""

try {
    Assert-Command git
    Assert-Command node
    Assert-Command npm

    Push-Location $root
    try {
        Log-Info 'Starting recover and verify workflow (safe mode).'

        $status = (& git status --porcelain)
        if ($status) {
            $stashTag = "recover_verify_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            Run-Cmd -Title 'git stash push -u' -Command 'git' -Arguments @('stash', 'push', '-u', '-m', $stashTag)
            $stashCreated = $true
            Log-Ok 'Local changes were stashed.'
        }
        else {
            Log-Ok 'Working tree is clean.'
        }

        if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) {
            Log-Warn 'Detected unfinished rebase. Creating backup branch and aborting rebase.'
            $backup = "repair_rebase_backup_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
            Run-CmdSafe -Title "git branch $backup" -Command 'git' -Arguments @('branch', $backup) | Out-Null
            Run-Cmd -Title 'git rebase --abort' -Command 'git' -Arguments @('rebase', '--abort')
        }

        Run-Cmd -Title 'git fetch --all --prune' -Command 'git' -Arguments @('fetch', '--all', '--prune')
        Run-CmdSafe -Title 'git pull --rebase' -Command 'git' -Arguments @('pull', '--rebase') | Out-Null

        Remove-NodeModulesSafe

        if (-not (Install-Dependencies)) {
            throw 'Could not install dependencies (npm ci/npm install both failed).'
        }

        Run-Cmd -Title 'npm run tsc' -Command 'npm' -Arguments @('run', 'tsc')
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
