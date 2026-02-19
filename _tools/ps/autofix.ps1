param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')

$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'autofix'

function Say($msg) {
    Write-Host $msg
    Write-Log -LogPath $log -Message $msg
}

function Run-Native {
    param(
        [Parameter(Mandatory=$true)][string]$File,
        [string[]]$Args = @(),
        [switch]$Quiet
    )

    $cmdLine = ($Args | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
    Say ("RUN {0} {1}" -f $File, $cmdLine)

    if ($Quiet) {
        & $File @Args | Out-Null
    } else {
        & $File @Args | Out-Host
    }
    return $LASTEXITCODE
}

function Git-IsRepo {
    return (Test-Path (Join-Path $root '.git'))
}

function Git-HasRebaseInProgress {
    $gitDir = Join-Path $root '.git'
    return (Test-Path (Join-Path $gitDir 'rebase-merge')) -or (Test-Path (Join-Path $gitDir 'rebase-apply'))
}

function Git-HasUnmerged {
    $out = git diff --name-only --diff-filter=U
    return [bool]$out
}

function Git-AutoStashIfDirty {
    $dirty = git status --porcelain
    if ($dirty) {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $msg = "autofix_stash_{0}" -f $stamp
        Say "Dirty worktree detected. Creating stash: $msg"
        git stash push -u -m $msg | Out-Host
        return $true
    }
    return $false
}

function Git-EnsureCleanRebaseState {
    if (-not (Git-HasRebaseInProgress)) { return }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupBranch = "autofix/rebase_backup_{0}" -f $stamp
    Say "Rebase in progress detected. Creating safety branch: $backupBranch"
    git branch $backupBranch | Out-Host

    if (Git-HasUnmerged) {
        Say "Unmerged files detected. Aborting rebase to unblock git operations."
        git rebase --abort | Out-Host
        return
    }

    # Even without explicit conflicts, an in-progress rebase can block pulls.
    # Abort is the safest non-interactive action.
    Say "Rebase state present. Aborting rebase (non-interactive safety default)."
    git rebase --abort | Out-Host
}

function Ensure-NodeModules {
    $nm = Join-Path $root 'node_modules'
    if (Test-Path $nm) {
        Say "OK node_modules present."
        return $true
    }

    Say "node_modules not found. Running npm install..."
    $rc = Run-Native -File 'npm' -Args @('install')
    if ($rc -ne 0) {
        Say "ERROR npm install failed (exit code $rc)."
        return $false
    }
    return $true
}

function Run-Preflight {
    Say "Running preflight..."
    $rc = Run-Native -File 'node' -Args @('_tools/preflight.js')
    if ($rc -eq 0) { Say "OK preflight passed."; return $true }
    Say "WARN preflight failed (exit code $rc). Attempting npm install then retry..."
    if (-not (Ensure-NodeModules)) { return $false }
    $rc2 = Run-Native -File 'node' -Args @('_tools/preflight.js')
    if ($rc2 -eq 0) { Say "OK preflight passed after npm install."; return $true }
    Say "ERROR preflight still failing (exit code $rc2)."
    return $false
}

function Run-Smoke {
    Say "Running smoke test..."
    $rc = Run-Native -File 'node' -Args @('_tools/smoke.runner.js')
    if ($rc -eq 0) { Say "OK smoke test passed."; return $true }
    Say "ERROR smoke test failed (exit code $rc). See _reports/smoke_report.md"
    return $false
}

function Git-PullRebase {
    if (-not (Git-IsRepo)) {
        Say "SKIP git pull --rebase (not a git repo)."
        return $true
    }

    Say "Running git diagnostics..."
    Git-EnsureCleanRebaseState

    $stashed = Git-AutoStashIfDirty

    Say "Running git pull --rebase..."
    git pull --rebase | Out-Host
    $rc = $LASTEXITCODE

    if ($rc -ne 0) {
        # One automatic recovery attempt: if conflicts/unmerged happened, abort rebase and retry once.
        Say "WARN git pull --rebase failed (exit code $rc). Checking for unmerged/rebase state..."
        if (Git-HasRebaseInProgress -or (Git-HasUnmerged)) {
            Git-EnsureCleanRebaseState
            Say "Retrying git pull --rebase after abort..."
            git pull --rebase | Out-Host
            $rc = $LASTEXITCODE
        }
    }

    if ($rc -ne 0) {
        Say "ERROR git pull --rebase still failing (exit code $rc)."
        return $false
    }

    if ($stashed) {
        Say "Restoring stash (best effort)..."
        git stash pop | Out-Host
    }

    Say "OK git pull --rebase succeeded."
    return $true
}

function Git-Push {
    if (-not (Git-IsRepo)) {
        Say "SKIP git push (not a git repo)."
        return $true
    }

    Say "Running git push..."
    git push | Out-Host
    $rc = $LASTEXITCODE
    if ($rc -eq 0) { Say "OK git push succeeded."; return $true }

    Say "WARN git push failed (exit code $rc). Attempting pull --rebase then push again..."
    if (-not (Git-PullRebase)) { return $false }
    git push | Out-Host
    $rc2 = $LASTEXITCODE
    if ($rc2 -eq 0) { Say "OK git push succeeded after rebase."; return $true }

    Say "ERROR git push still failing (exit code $rc2)."
    return $false
}

try {
    Assert-Command node
    Assert-Command npm
    Push-Location $root
    try {
        Say "=== AutoFix started ==="

        $ok1 = Ensure-NodeModules
        $ok2 = $false
        if ($ok1) { $ok2 = Run-Preflight }
        $ok3 = $false
        if ($ok2) { $ok3 = Run-Smoke }

        $okGitPull = Git-PullRebase
        $okGitPush = Git-Push

        Say "=== Summary ==="
        Say ("node_modules: {0}" -f ($(if($ok1){'OK'}else{'FAIL'})))
        Say ("preflight:     {0}" -f ($(if($ok2){'OK'}else{'FAIL'})))
        Say ("smoke:        {0}" -f ($(if($ok3){'OK'}else{'FAIL'})))
        Say ("git pull:     {0}" -f ($(if($okGitPull){'OK'}else{'FAIL'})))
        Say ("git push:     {0}" -f ($(if($okGitPush){'OK'}else{'FAIL'})))
        Say ("Log saved:    {0}" -f $log)

        if ($ok1 -and $ok2 -and $ok3 -and $okGitPull -and $okGitPush) {
            Say "AutoFix complete: SUCCESS"
            exit 0
        }

        Say "AutoFix complete: SOME ISSUES REMAIN"
        exit 1
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'AutoFix failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message ("FATAL {0}" -f $_.Exception.Message)
    exit 2
}
