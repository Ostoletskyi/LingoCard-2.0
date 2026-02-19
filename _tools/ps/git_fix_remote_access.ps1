param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'git_remote_fix'
$action = 'git_fix_remote_access'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git is not installed.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current directory is not a git repository.' }

    Push-Location $root
    try {
        $remoteUrl = git remote get-url origin 2>$null
        if (-not $remoteUrl) {
            throw 'No origin remote found. Example: git remote add origin https://github.com/your-user/your-repo.git'
        }

        Write-Host "Origin URL: $remoteUrl"
        if ($remoteUrl -match '^https://') {
            Write-Host 'Protocol: HTTPS'
            Write-Host 'Use a GitHub PAT token instead of password.'
            Write-Host 'Check Windows Credential Manager if old credentials are cached.'
            Write-Host 'Then retry: git push'
        }
        elseif ($remoteUrl -match '^git@') {
            Write-Host 'Protocol: SSH'
            Write-Host 'Generate key if needed: ssh-keygen -t ed25519 -C "you@example.com"'
            Write-Host 'Test connection: ssh -T git@github.com'
            Write-Host 'Add the public key in GitHub SSH keys settings.'
        }
        else {
            Write-Host 'Unknown remote protocol. Review with: git remote -v'
        }

        $open = Read-Host 'Open log folder now? (Y/N)'
        if ($open -match '^(Y|y)$') {
            Start-Process (Join-Path $root '_tools\logs') | Out-Null
        }

        Write-ToolLog -LogPaths $log -Action $action -Command 'git remote get-url origin' -Result 'success' -ExitCode 0 -Details $remoteUrl
        Show-LogHint -LogPaths $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git remote diagnostics failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'git remote diagnostics' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
