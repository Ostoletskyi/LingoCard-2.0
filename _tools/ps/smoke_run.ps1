param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'smoke_run'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Log-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
    Write-Log -LogPath $log -Message "INFO $Message"
}

function Log-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log -LogPath $log -Message "OK $Message"
}

function Log-Err([string]$Message) {
    Write-Host "[ERR] $Message" -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERR $Message"
}

try {
    Assert-Command node
    Assert-Command npm

    Push-Location $root
    try {
        if (-not (Test-Path 'node_modules')) {
            Log-Info 'node_modules is missing. Installing dependencies.'
            npm install | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
        }

        Log-Info 'Running smoke pipeline.'
        npm run tools:smoke | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'tools:smoke failed.' }

        Log-Ok 'Smoke run completed successfully.'
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Log-Err $_.Exception.Message
    exit 1
}
