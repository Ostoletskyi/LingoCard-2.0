param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'git_push'

try {
    Assert-Command git
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current folder is not a git repository.' }

    Push-Location $root
    try {
        git status -sb | Out-Host
        Write-Log -LogPath $log -Message 'RUN git status -sb'

        $dirty = git status --porcelain
        if ($dirty) {
            $commit = Read-Host 'Local changes found. Create commit before push? (Y/N)'
            if ($commit -match '^(Y|y)$') {
                git add -A | Out-Host
                $msg = Read-Host 'Enter commit message'
                if ([string]::IsNullOrWhiteSpace($msg)) { throw 'Commit message is required.' }
                git commit -m "$msg" | Out-Host
                if ($LASTEXITCODE -ne 0) { throw 'git commit failed.' }
            } else {
                Write-Log -LogPath $log -Message 'CANCEL git_push no_commit'
                exit 2
            }
        }

        git push | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Push failed. Check authentication and remote access.' -ForegroundColor Yellow
            throw 'git push failed.'
        }

        Write-Host 'Project state pushed successfully.'
        Write-Log -LogPath $log -Message 'SUCCESS git_push'
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git push failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR git_push $($_.Exception.Message)"
    exit 1
}
