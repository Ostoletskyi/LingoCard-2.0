param(
    [string]$ProjectRoot,
    [string]$LogPath,
    [switch]$StatusOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPath -ProjectRoot $root -LogPath $LogPath -Prefix 'git_pull'
$action = 'git_pull_rebase'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is not installed.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current directory is not a git repository.' }

    Push-Location $root
    try {
        git status -sb | Tee-Object -FilePath $log -Append
        if ($StatusOnly) {
            Write-ToolLog -LogPath $log -Action $action -Command 'git status -sb' -Result 'success' -ExitCode 0
            Show-LogHint -LogPath $log
            exit 0
        }

        git pull --rebase 2>&1 | Tee-Object -FilePath $log -Append
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Pull rebase failed. Resolve conflicts and continue manually.' -ForegroundColor Yellow
            Write-Host 'Commands: git status, git rebase --abort, git rebase --continue'
            throw 'git pull --rebase failed.'
        }

        Write-Host 'Pull rebase completed successfully.'
        Write-ToolLog -LogPath $log -Action $action -Command 'git pull --rebase' -Result 'success' -ExitCode 0
        Show-LogHint -LogPath $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git pull operation failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPath $log -Action $action -Command 'git pull --rebase' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPath $log
    exit 1
}
