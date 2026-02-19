param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'git_init'
$action = 'git_init_local'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is not installed.' }
    if (Test-Path (Join-Path $root '.git')) {
        Write-Host 'Already initialized.'
        Write-ToolLog -LogPaths $log -Action $action -Command 'git init' -Result 'success' -ExitCode 0 -Details 'already initialized'
        Show-LogHint -LogPaths $log
        exit 0
    }

    Push-Location $root
    try {
        git init | Tee-Object -FilePath $log.Md -Append
        git add -A | Tee-Object -FilePath $log.Md -Append
        git commit -m 'Initial commit' 2>&1 | Tee-Object -FilePath $log.Md -Append

        Write-Host 'Local repository initialized.'
        Write-Host 'Tip: add remote with: git remote add origin https://github.com/your-user/your-repo.git'
        Write-ToolLog -LogPaths $log -Action $action -Command 'git init/add/commit' -Result 'success' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Local git initialization failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'git init/add/commit' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
