param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'git_pull'

try {
    Assert-Command git
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current folder is not a git repository.' }

    Push-Location $root
    try {
        git status -sb | Out-Host
        Write-Log -LogPath $log -Message 'RUN git status -sb'

        $dirty = git status --porcelain
        if ($dirty) {
            Write-Host 'Local changes detected.' -ForegroundColor Yellow
            Write-Host '[1] Stash and continue'
            Write-Host '[2] Abort'
            $opt = Read-Host 'Select option'
            if ($opt -eq '1') {
                git stash push -u -m ("toolbox_auto_stash_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')) | Out-Host
            } else {
                Write-Log -LogPath $log -Message 'CANCEL git_pull dirty_worktree'
                exit 2
            }
        }

        git fetch --all --prune | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'git fetch --all --prune failed.' }

        $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
            Write-Host 'No upstream branch configured. Skipping pull --rebase.' -ForegroundColor Yellow
            Write-Host 'Set upstream manually, for example:' -ForegroundColor Yellow
            Write-Host '  git branch --set-upstream-to origin/<branch>' -ForegroundColor Yellow
            Write-Log -LogPath $log -Message 'WARN git_pull no_upstream'
            exit 3
        }

        git pull --rebase | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Pull failed. Resolve conflicts manually.' -ForegroundColor Yellow
            Write-Host 'Use: git status / git rebase --abort / git rebase --continue'
            throw 'git pull --rebase failed.'
        }

        Write-Host 'Local project updated successfully.'
        Write-Log -LogPath $log -Message 'SUCCESS git_pull'
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git update failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR git_pull $($_.Exception.Message)"
    exit 1
}
