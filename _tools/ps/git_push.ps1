param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'git_push'
$action = 'git_push'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is not installed.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current directory is not a git repository.' }

    Push-Location $root
    try {
        git status -sb | Tee-Object -FilePath $log -Append
        $dirty = git status --porcelain
        if ($dirty) {
            Write-Host 'There are local changes:'
            Write-Host '[1] Abort'
            Write-Host '[2] Commit with message'
            Write-Host '[3] Stash and push'
            $mode = Read-Host 'Select option'
            if ($mode -eq '1') { Write-ToolLog -LogPaths $log -Action $action -Command 'push mode select' -Result 'cancelled' -ExitCode 2; Show-LogHint -LogPaths $log; exit 2 }
            elseif ($mode -eq '2') {
                git add -A
                $msg = Read-Host 'Enter commit message'
                if ([string]::IsNullOrWhiteSpace($msg)) { throw 'Commit message is required.' }
                git commit -m $msg 2>&1 | Tee-Object -FilePath $log -Append
            }
            elseif ($mode -eq '3') {
                git stash push -u -m ("toolbox_stash_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')) | Tee-Object -FilePath $log -Append
            }
            else { Write-ToolLog -LogPaths $log -Action $action -Command 'push mode select' -Result 'invalid_input' -ExitCode 2; Show-LogHint -LogPaths $log; exit 2 }
        }

        git push 2>&1 | Tee-Object -FilePath $log -Append
        if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }

        Write-Host 'Push completed.'
        Write-ToolLog -LogPaths $log -Action $action -Command 'git push' -Result 'success' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git push failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'git push' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
