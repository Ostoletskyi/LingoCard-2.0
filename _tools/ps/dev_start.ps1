param(
    [string]$ProjectRoot,
    [string]$LogPath,
    [switch]$OpenBrowser,
    [switch]$CleanInstall
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPath -ProjectRoot $root -LogPath $LogPath -Prefix 'dev_start'
$action = 'dev_start'

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not installed.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not installed.' }

    Push-Location $root
    try {
        if ($CleanInstall) {
            if (Test-Path (Join-Path $root 'node_modules')) { Remove-Item -Path (Join-Path $root 'node_modules') -Recurse -Force }
            npm ci 2>&1 | Tee-Object -FilePath $log -Append
            Write-Host 'Clean install completed.'
            Write-ToolLog -LogPath $log -Action $action -Command 'clean install' -Result 'success' -ExitCode 0
            Show-LogHint -LogPath $log
            exit 0
        }

        if (-not (Test-Path (Join-Path $root 'node_modules'))) {
            $install = Read-Host 'node_modules is missing. Run npm install? (Y/N)'
            if ($install -match '^(Y|y)$') { npm install 2>&1 | Tee-Object -FilePath $log -Append }
            else { Write-ToolLog -LogPath $log -Action $action -Command 'npm install prompt' -Result 'cancelled' -ExitCode 2; Show-LogHint -LogPath $log; exit 2 }
        }

        if ($OpenBrowser) { Start-Process 'http://localhost:5173' | Out-Null }

        Write-Host 'Starting dev server. Press CTRL+C to stop.'
        npm run dev 2>&1 | Tee-Object -FilePath $log -Append
        $exitCode = $LASTEXITCODE
        Write-ToolLog -LogPath $log -Action $action -Command 'npm run dev' -Result 'finished' -ExitCode $exitCode
        Show-LogHint -LogPath $log
        exit $exitCode
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Dev server failed to start.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPath $log -Action $action -Command 'npm run dev' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPath $log
    exit 1
}
