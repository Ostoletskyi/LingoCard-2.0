param(
    [string]$ProjectRoot,
    [int]$Port = 5173
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'dev_start'

try {
    Assert-Command node
    Assert-Command npm

    Push-Location $root
    try {
        if (-not (Test-Path (Join-Path $root 'node_modules'))) {
            $install = Read-Host 'node_modules is missing. Run npm install? (Y/N)'
            if ($install -match '^(Y|y)$') {
                npm install | Out-Host
                if ($LASTEXITCODE -ne 0) {
                    throw 'npm install failed.'
                }
            } else {
                Write-Log -LogPath $log -Message 'CANCEL dev_start node_modules_missing'
                exit 2
            }
        }

        $url = "http://localhost:$Port/"
        Write-Host "Opening browser: $url"
        Start-Process $url | Out-Null
        Write-Host 'Starting development server...'
        Write-Host 'Use Ctrl+C to stop the server.'
        Write-Log -LogPath $log -Message "INFO opening_browser $url"

        npm run dev -- --host 0.0.0.0 --port $Port | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw 'Development server exited with a non-zero status.'
        }

        Write-Log -LogPath $log -Message 'SUCCESS dev_start'
        exit 0
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host 'Failed to start development server.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR dev_start $($_.Exception.Message)"
    exit 1
}
