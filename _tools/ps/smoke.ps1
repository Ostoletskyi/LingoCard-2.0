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
