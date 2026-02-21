param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'git_remote_fix'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Assert-Command git
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Current folder is not a git repository.' }

    Push-Location $root
    try {
        $remoteUrl = (& git remote get-url origin 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
            throw 'No origin remote found. Example: git remote add origin https://github.com/your-user/your-repo.git'
        }

        Write-Host "Origin URL: $remoteUrl"
        if ($remoteUrl -match '^https://') {
            Write-Host 'Protocol: HTTPS'
            Write-Host 'Use a Personal Access Token (PAT) instead of password.'
            Write-Host 'If needed, clear stale credentials in Windows Credential Manager.'
        }
        elseif ($remoteUrl -match '^git@') {
            Write-Host 'Protocol: SSH'
            Write-Host 'Check SSH setup: ssh -T git@github.com'
        }
        else {
            Write-Host 'Unknown protocol. Check with: git remote -v'
        }

        $reportsDir = Join-Path $root '_tools\reports'
        $open = Read-Host 'Open reports folder now? (Y/N)'
        if ($open -match '^(Y|y)$') {
            Start-Process $reportsDir | Out-Null
        }

        Write-Log -LogPath $log -Message "SUCCESS git_fix_remote_access remote=$remoteUrl"
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Git remote diagnostics failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR git_fix_remote_access $($_.Exception.Message)"
    exit 1
}
