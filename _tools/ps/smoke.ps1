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
        if ($LASTEXITCODE -ne 0) {
            $reportJson = Join-Path $root (Join-Path '_reports' 'smoke_report.json')
            if (Test-Path $reportJson) {
                try {
                    $report = Get-Content $reportJson -Raw | ConvertFrom-Json
                    $fails = @($report.steps | Where-Object { $_.status -eq 'FAIL' })
                    if ($fails.Count -gt 0) {
                        Write-Host ''
                        Write-Host 'Failing smoke steps:' -ForegroundColor Red
                        foreach ($s in $fails) {
                            $details = ($s.details | Out-String).Trim()
                            if ($details.Length -gt 400) { $details = $details.Substring(0, 400) + ' …' }
                            Write-Host (" - {0}: {1}" -f $s.label, $details) -ForegroundColor Red
                        }
                    }
                } catch {
                    # ignore parse issues
                }
            }

            throw 'Smoke test failed (npm run tools:smoke).'
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
