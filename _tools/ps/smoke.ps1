param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'smoke'

function Invoke-RecoverIfKnownTypeScriptDrift {
    param([string[]]$OutputLines)

    $joined = ($OutputLines -join "`n")
    $hasKnownErrors =
        ($joined -match "Cannot find name 'CARDS_CHUNK_SIZE'") -or
        ($joined -match "Cannot find name 'CARDS_META_KEY'") -or
        ($joined -match "Cannot find name 'CARDS_CHUNK_KEY_PREFIX'") -or
        ($joined -match "Cannot find name 'badgeDataUri'")

    if (-not $hasKnownErrors) {
        return $false
    }

    $recoverScript = Join-Path $PSScriptRoot 'recover_and_verify.ps1'
    if (-not (Test-Path $recoverScript)) {
        Write-Host 'Detected known local-drift TypeScript errors, but recover_and_verify.ps1 was not found.' -ForegroundColor Yellow
        Write-Log -LogPath $log -Message 'WARN smoke recover_script_missing'
        return $false
    }

    Write-Host 'Detected known local drift TypeScript errors. Starting automatic recover-and-verify workflow...' -ForegroundColor Yellow
    Write-Log -LogPath $log -Message 'WARN smoke triggering_recover_and_verify'

    & $recoverScript -ProjectRoot $root | Out-Host
    $recoverExit = $LASTEXITCODE
    if ($recoverExit -eq 0) {
        Write-Host 'Recover-and-verify completed successfully. Treating smoke as recovered.' -ForegroundColor Green
        Write-Log -LogPath $log -Message 'SUCCESS smoke recovered_via_recover_and_verify'
        return $true
    }

    Write-Host "Recover-and-verify failed (exit $recoverExit)." -ForegroundColor Red
    Write-Log -LogPath $log -Message "WARN smoke recover_and_verify_failed exit=$recoverExit"
    return $false
}

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

        $smokeOutput = @()
        npm run tools:smoke 2>&1 | Tee-Object -Variable smokeOutput | Out-Host
        $smokeExit = $LASTEXITCODE

        if ($smokeExit -ne 0 -and (Invoke-RecoverIfKnownTypeScriptDrift -OutputLines $smokeOutput)) {
            exit 0
        }

        if ($smokeExit -ne 0) {
            $reportJsonPath = Join-Path $root '_reports\smoke_report.json'
            if (Test-Path $reportJsonPath) {
                try {
                    $json = Get-Content -Path $reportJsonPath -Raw | ConvertFrom-Json
                } catch {
                    Write-Log -LogPath $log -Message "WARN smoke json_parse_failed $($_.Exception.Message)"
                    throw 'Smoke test failed (npm run tools:smoke). Could not parse JSON report.'
                }

                if ($json.overall.pass -eq $true) {
                    Write-Host 'Smoke command returned non-zero, but JSON report says PASS. Treating as success.' -ForegroundColor Yellow
                    Write-Log -LogPath $log -Message 'WARN smoke nonzero_exit_json_pass'
                    Write-Host 'Smoke test passed.'
                    Write-Log -LogPath $log -Message 'SUCCESS smoke'
                    exit 0
                }

                $jsonCode = if ($json.overall.code -ne $null) { [int]$json.overall.code } else { $smokeExit }
                throw "Smoke test failed (npm run tools:smoke). JSON overall.code=$jsonCode"
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
