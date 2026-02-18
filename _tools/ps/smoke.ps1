param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'smoke'

try {
    Assert-Command node
    Assert-Command npm

    Push-Location $root
    try {
        if (-not (Test-Path (Join-Path $root 'node_modules'))) {
            $install = Read-Host 'node_modules is missing. Run npm install? (Y/N)'
            if ($install -match '^(Y|y)$') {
                npm install | Out-Host
            } else {
                Write-Log -LogPath $log -Message 'CANCEL smoke node_modules_missing'
                exit 2
            }
        }

        npm run tools:smoke | Out-Host
        $smokeExit = $LASTEXITCODE
        if ($smokeExit -ne 0) {
            $reportJsonPath = Join-Path $root '_reports\smoke_report.json'
            if (Test-Path $reportJsonPath) {
                try {
                    $json = Get-Content -Path $reportJsonPath -Raw | ConvertFrom-Json
                    if ($json.overall.pass -eq $true) {
                        Write-Host 'Smoke command returned non-zero, but JSON report says PASS. Treating as success.' -ForegroundColor Yellow
                        Write-Log -LogPath $log -Message 'WARN smoke nonzero_exit_json_pass'
                        Write-Host 'Smoke test passed.'
                        Write-Log -LogPath $log -Message 'SUCCESS smoke'
                        exit 0
                    }

                    $jsonCode = if ($json.overall.code -ne $null) { [int]$json.overall.code } else { $smokeExit }
                    throw "Smoke test failed (npm run tools:smoke). JSON overall.code=$jsonCode"
                } catch {
                    Write-Log -LogPath $log -Message "WARN smoke json_parse_failed $($_.Exception.Message)"
                    throw 'Smoke test failed (npm run tools:smoke). Could not parse JSON report.'
                }
            }

            throw 'Smoke test failed (npm run tools:smoke). JSON report not found.'
        }

        Write-Host 'Smoke test passed.'
        Write-Log -LogPath $log -Message 'SUCCESS smoke'
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Smoke test failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR smoke $($_.Exception.Message)"
    exit 1
}
