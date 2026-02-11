param(
    [string]$ProjectRoot,
    [string]$LogPath,
    [switch]$StatusOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'git_pull'
$action = 'git_pull_rebase'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is not installed.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current directory is not a git repository.' }

    Push-Location $root
    try {
        git status -sb 2>&1 | Tee-Object -FilePath $log.Md -Append
        if ($StatusOnly) {
            Write-ToolLog -LogPaths $log -Action $action -Command 'git status -sb' -Result 'success' -ExitCode 0
            Show-LogHint -LogPaths $log
            exit 0
        }

        $dirty = git status --porcelain
        if ($dirty) {
            Write-Host 'Working tree has local changes.' -ForegroundColor Yellow
            Write-Host '[1] Stash and continue pull'
            Write-Host '[2] Abort'
            $opt = Read-Host 'Select option'
            if ($opt -eq '1') {
                git stash push -u -m ("toolbox_auto_stash_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')) 2>&1 | Tee-Object -FilePath $log.Md -Append
            } else {
                Write-ToolLog -LogPaths $log -Action $action -Command 'dirty tree option' -Result 'cancelled' -ExitCode 2
                Show-LogHint -LogPaths $log
                exit 2
            }
        }

        git pull --rebase 2>&1 | Tee-Object -FilePath $log.Md -Append
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Pull rebase failed. Resolve conflicts manually.' -ForegroundColor Yellow
            Write-Host 'Next steps: git status, git rebase --abort, git rebase --continue'
            throw 'git pull --rebase failed.'
        }

        npm run tools:smoke 2>&1 | Tee-Object -FilePath $log.Md -Append
        if ($LASTEXITCODE -ne 0) {
            throw 'Smoke test failed after pull.'
        }

        Write-Host 'Pull and smoke checks passed.'
        Write-ToolLog -LogPaths $log -Action $action -Command 'git pull --rebase + npm run tools:smoke' -Result 'success' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git pull operation failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'git pull --rebase' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
