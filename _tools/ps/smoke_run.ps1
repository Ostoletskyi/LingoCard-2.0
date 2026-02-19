param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'smoke_run'
$action = 'smoke_run'

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not installed.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not installed.' }

    Push-Location $root
    try {
        if (Test-Path (Join-Path $root 'package-lock.json')) {
            npm ci 2>&1 | Tee-Object -FilePath $log.Md -Append
        } else {
            npm install 2>&1 | Tee-Object -FilePath $log.Md -Append
        }

        npm run tools:smoke 2>&1 | Tee-Object -FilePath $log.Md -Append
        if ($LASTEXITCODE -ne 0) { throw 'tools:smoke returned non-zero exit code.' }

        $report = Join-Path $root '_tools\logs\smoke_report.md'
        $source = Join-Path $root '_tools\reports\smoke_report.md'
        if (Test-Path $source) { Copy-Item -Path $source -Destination $report -Force }

        Write-Host 'Smoke test passed.'
        if (Test-Path $report) { Write-Host "Smoke report copy: $report" }
        Write-ToolLog -LogPaths $log -Action $action -Command 'npm ci/install + npm run tools:smoke' -Result 'success' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Smoke test failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'smoke pipeline' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
