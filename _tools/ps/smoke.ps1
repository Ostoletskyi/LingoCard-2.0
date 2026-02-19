param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'smoke'

function Invoke-RecoverIfTypeScriptFailure {
    param(
        [string[]]$OutputLines,
        [string]$ReportJsonPath
    )

    $joined = ($OutputLines -join "`n")
    $knownDriftPattern =
        ($joined -match "Cannot find name 'CARDS_CHUNK_SIZE'") -or
        ($joined -match "Cannot find name 'CARDS_META_KEY'") -or
        ($joined -match "Cannot find name 'CARDS_CHUNK_KEY_PREFIX'") -or
        ($joined -match "Cannot find name 'reason'") -or
        ($joined -match "TS1117") -or
        ($joined -match "updateBoxAcrossColumn") -or
        ($joined -match "Cannot find name 'badgeDataUri'")

    $typeScriptStepFailed = $false
    if (Test-Path $ReportJsonPath) {
        try {
            $report = Get-Content -Path $ReportJsonPath -Raw | ConvertFrom-Json
            $typeScriptStepFailed = @($report.steps | Where-Object {
                $_.label -eq 'TypeScript' -and $_.status -eq 'FAIL'
            }).Count -gt 0
        } catch {
            Write-Log -LogPath $log -Message "WARN smoke ts_step_parse_failed $($_.Exception.Message)"
        }
    }

    if (-not ($knownDriftPattern -or $typeScriptStepFailed)) {
        return $false
    }

    $recoverScript = Join-Path $PSScriptRoot 'recover_and_verify.ps1'
    if (-not (Test-Path $recoverScript)) {
        Write-Host 'Detected TypeScript-related smoke failure, but recover_and_verify.ps1 was not found.' -ForegroundColor Yellow
        Write-Log -LogPath $log -Message 'WARN smoke recover_script_missing'
        return $false
    }

    Write-Host 'Detected TypeScript-related smoke failure. Starting automatic recover-and-verify workflow...' -ForegroundColor Yellow
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
      $install = Read-Host 'node_modules is missing. Run npm install now? (Y/N)'
      if ($install -match '^(Y|y)$') {
        npm install | Out-Host
      } else {
        Write-Log -LogPath $log -Message 'CANCEL smoke node_modules_missing'
        exit 2
      }
    }

    npm run tools:smoke | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw 'Smoke test failed (npm run tools:smoke).'
    }
	
	# After running smoke (exit code in $LASTEXITCODE)
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n[ERROR] Smoke test failed. Showing failing steps from report..." -ForegroundColor Red

  $jsonPath = Join-Path $PSScriptRoot "..\..\_reports\smoke_report.json"
  if (Test-Path $jsonPath) {
    try {
      $report = Get-Content $jsonPath -Raw | ConvertFrom-Json
      $fails = @($report.steps | Where-Object { $_.status -eq "FAIL" -or ($_.status -eq "SKIP" -and $_.details -match "failed") })
      if ($fails.Count -gt 0) {
        foreach ($s in $fails) {
          $lbl = $s.label
          $det = $s.details
          Write-Host (" - {0}: {1}" -f $lbl, $det) -ForegroundColor Yellow
        }
      } else {
        Write-Host "Report found but no FAIL steps parsed." -ForegroundColor DarkYellow
      }
    } catch {
      Write-Host "Could not parse smoke_report.json: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
  } else {
    Write-Host "Report not found: $jsonPath" -ForegroundColor DarkYellow
  }
}

        $smokeOutput = @()
        npm run tools:smoke 2>&1 | Tee-Object -Variable smokeOutput | Out-Host
        $smokeExit = $LASTEXITCODE

        $reportJsonPath = Join-Path $root '_reports\smoke_report.json'
        if ($smokeExit -ne 0 -and (Invoke-RecoverIfTypeScriptFailure -OutputLines $smokeOutput -ReportJsonPath $reportJsonPath)) {
            exit 0
        }

        if ($smokeExit -ne 0) {
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

        if ($smokeExit -ne 0) {
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

    Write-Host ''
    Write-Host '[OK] Smoke test passed.' -ForegroundColor Green
    Write-Host 'Reports:' -ForegroundColor Cyan
    Write-Host "- _reports\smoke_report.md" -ForegroundColor Gray
    Write-Host "- _reports\smoke_report.json" -ForegroundColor Gray

    Write-Log -LogPath $log -Message 'SUCCESS smoke'
    exit 0
  }
  finally { Pop-Location }
}
catch {
  Write-Host ''
  Write-Host '[ERROR] Smoke test failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR smoke {0}" -f $_.Exception.Message)
  exit 1
}
